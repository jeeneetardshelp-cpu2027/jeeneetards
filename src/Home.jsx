// =====================================================================
//  Home.jsx  —  the student landing page.
//
//  Two jobs, in this order:
//    1. Get a returning student into a lecture in as few taps as possible
//       (continue-watching, search, exam grid).
//    2. Convince a first-time visitor in the first few seconds that this is
//       a serious, free, independent tool — not another link farm.
//
//  HONESTY RULE (inherited from the catalogue, applies to this page too):
//  nothing on this page is invented. Course counts, ratings and channel
//  names come from the live catalogue; a section with no data hides itself
//  rather than rendering a placeholder. There is no pricing table because
//  there is nothing to sell — the "Free forever" panel says so plainly.
//
//  There are no quoted testimonials either. Ratings ARE live (see
//  releaseCapabilities.courseRatingSubmission), so the "rated by students"
//  strip shows real scores with their real counts — which is the honest
//  form of social proof here. Inventing quotes on top of that would be the
//  one thing that undermines it.
//
//  This file owns the data and the search state. The sections live in
//  HomeSections.jsx.
// =====================================================================

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Search, X } from "lucide-react";
import { usePlaylistBrowse } from "./usePlaylistBrowse.js";
import { Container, GlobalHeader, MAIN_CONTENT_ID } from "./AppShell.jsx";
// ONE search system, and now ONE renderer for it. The hero box used to run its
// own ilike queries against raw columns — no index use, no typo tolerance, no
// Devanagari bridge, and a separate ranking that disagreed with /search — and
// then, once that was fixed, it still drew the RPC's rows through a private
// SearchResults component of its own. That second UI is gone: the hero keeps
// its input and hands the query straight to the component /search uses, so the
// same query behaves identically wherever a student types it.
import UniversalSearch from "./UniversalSearch.jsx";
// The hero's empty state. Same component /search draws under its own empty
// field — the student's own successful searches, or a short curated list while
// they have none yet. Nothing it shows has ever left this browser; see
// searchHistory.js.
import SearchStarters from "./SearchStarters.jsx";
import { getContinueWatching, mergeRemoteEntry } from "./progress.js";
import { pullServerProgress } from "./progressSync.js";
import { useSession } from "./useSession.js";
import { EXAMS } from "./filterModel.js";
import { useLearningGoals } from "./useExplore.js";
import { RELEASE_CAPABILITIES } from "./releaseCapabilities.js";
import { useStructuredData } from "./PageMetadata.jsx";
import { organizationSchema, websiteSchema } from "./structuredData.js";
import {
  ExamGrid, Faq, Features, Hero,
  SocialProof, TopRated, pickTopRated,
} from "./HomeSections.jsx";
import PrepToday from "./PrepToday.jsx";
// Lazy so the polls feed/API modules stay out of the eager entry chunk; the
// flag gate at the render site means the chunk is not even fetched while
// polls are unreleased. PollOfTheDay keeps its own internal gate as a second
// line of defence.
const PollOfTheDay = lazy(() => import("./PollOfTheDay.jsx"));
import { RELEASE_FEATURES } from "./releaseCapabilities.js";
import DueForRevision from "./DueForRevision.jsx";
import { useHomepageChannels } from "./useHomepageChannels.js";

export function homeTagline(capabilities = RELEASE_CAPABILITIES) {
  return capabilities.comparison
    ? "Compare courses from different teachers and pick what fits you."
    : "Find free courses by exam, class, subject and chapter.";
}

// The caption under the "Exam tracks" figure names exactly the tracks the
// figure counts. It was a hardcoded "JEE, NEET, Boards": three names under a
// number that read 4 once Olympiad went live, so the number and its own
// caption disagreed on the highest-traffic screen. Deriving both from the same
// list means they cannot drift apart again — and when a track is not live, it
// is neither counted nor named.
export function examTracksCaption(exams) {
  return (exams ?? [])
    .filter((exam) => exam.available)
    .map((exam) => exam.label)
    .join(", ");
}

export function examCardState(
  exam,
  goals,
  { loading = false, error = null, boardClassification = false } = {},
) {
  const goal = (goals ?? []).find((row) => row.slug === exam.id);
  const boardBlocked = exam.id === "school" && !boardClassification;
  const count = Number(goal?.count ?? 0);
  const available = !loading && !error && !boardBlocked && count > 0;
  const hint = loading
    ? "Checking availability…"
    : error
      ? "Course guide unavailable"
      : available
        ? `${count} ${count === 1 ? "course" : "courses"} · Choose class and subject`
        : "Coming soon";
  return { available, hint, count };
}

export default function Home() {
  const [searchParams] = useSearchParams();
  // Seed from ?q= so "search the entire library" from Explore lands here
  // with the query already run.
  const [input, setInput] = useState(searchParams.get("q") ?? "");
  // No hook call here. <UniversalSearch> owns the request — it debounces,
  // cancels obsolete responses and enforces the database's own minimum length —
  // and running the hook here as well would double every request just to draw a
  // spinner. The component says "Searching…" below the field instead.
  const searching = input.trim().length > 0;

  // Tapping a recent-search or starter chip removes the chips from the page,
  // so focus would otherwise fall to <body> and a keyboard student would lose
  // their place. Put it back in the field they are now searching from.
  const heroInputRef = useRef(null);
  const runQuery = useCallback((query) => {
    setInput(query);
    heroInputRef.current?.focus();
  }, []);

  const [continueWatching, setContinueWatching] = useState(() => getContinueWatching(3));
  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  // A signed-in student's resume history lives on the server; localStorage on a
  // fresh device (or after a sign-out that cleared it) starts empty, so without
  // this the homepage — the first thing a returning student sees — greets them
  // as a stranger and hides "Continue watching" entirely. Pull once when the
  // session resolves, fold each row forward into localStorage (mergeRemoteEntry
  // is idempotent and never moves a position backward), then re-read the rail.
  // Mirrors the same pull the course page already runs on every visit.
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    pullServerProgress(userId).then((rows) => {
      if (!active || !rows.length) return;
      rows.forEach((row) => mergeRemoteEntry(row));
      setContinueWatching(getContinueWatching(3));
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const { goals, loading: goalsLoading, error: goalsError } = useLearningGoals();
  // One catalogue request serves the hero stat rail, rated strip, and
  // library-wide course total. Channels come from their complete bounded
  // dimension query below; a page of courses can never prove which channels
  // exist elsewhere in the library.
  const { items, total, loading: catalogueLoading } = usePlaylistBrowse({ page: 0 });
  const { channels, loading: channelsLoading } = useHomepageChannels();

  const exams = useMemo(
    () =>
      EXAMS.map((exam) => ({
        ...exam,
        ...examCardState(exam, goals, {
          loading: goalsLoading,
          error: goalsError,
          boardClassification: RELEASE_CAPABILITIES.boardClassification,
        }),
      })),
    [goals, goalsLoading, goalsError],
  );

  const liveTracks = exams.filter((exam) => exam.available).length;
  // Prefer the catalogue's own total; fall back to summing the per-goal counts
  // so the figure is never blank while the course query is in flight.
  const courseCount =
    total ?? (goals ?? []).reduce((sum, goal) => sum + Number(goal.count ?? 0), 0);

  const topRated = useMemo(() => pickTopRated(items, 3), [items]);

  // Site identity, not search-state-dependent — written once, never removed
  // while Home stays mounted. organizationSchema describes the SITE itself,
  // never a course's provider (that's courseSchema's job, on the course page).
  useStructuredData([websiteSchema(), organizationSchema()], []);

  // The rail is a teaser, not the statistics band: three figures, and only
  // rendered once at least one of them is real, so it never animates to zero.
  const heroStats = courseCount > 0
    ? [
        {
          value: courseCount,
          label: "Free courses",
          note: "Curriculum-tagged",
          to: "/browse",
        },
        {
          value: liveTracks,
          label: "Exam tracks",
          note: examTracksCaption(exams),
          to: "/explore",
        },
        { value: "₹0", numeric: false, label: "Forever", note: "No account needed" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* The one header for every student route (AppShell is the only file
          allowed to contain <header>). It is transparent over the hero and
          fills in with glass once the page scrolls. */}
      <GlobalHeader />

      <Hero
        searchField={
          <>
            <HeroSearch
              value={input}
              onChange={setInput}
              onClear={() => setInput("")}
              inputRef={heroInputRef}
            />
            {/* Outside the <form>, not inside it: HeroSearch's focus halo is
                an absolutely positioned -inset-1 of the form, so chips added
                within it would sit under the glow. */}
            {!searching && (
              <SearchStarters onPick={runQuery} className="mt-5 text-left" />
            )}
          </>
        }
        chips={searching ? null : <TrustChips />}
        stats={searching ? [] : heroStats}
      />

      <main id={MAIN_CONTENT_ID}>
        {searching ? (
          <Container className="py-12 sm:py-16">
            {/* The ONE result renderer. Not a copy of it, not a homepage
                variant of it — the same component /search and Explore use, so
                a lecture row opens the lesson and a note opens /materials
                identically from all three. */}
            <UniversalSearch
              query={input}
              footer={
                <Link
                  to={`/search?q=${encodeURIComponent(input.trim())}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-accent transition-opacity hover:opacity-80"
                >
                  Open this search on its own page →
                </Link>
              }
            />
          </Container>
        ) : (
          <Landing
            continueWatching={continueWatching}
            exams={exams}
            institutes={channels}
            channelsLoading={channelsLoading}
            topRated={topRated}
            catalogueLoading={catalogueLoading}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Hero search — the page's primary control, so it is the only input on
//  the site that gets display sizing and a focus glow.
// ---------------------------------------------------------------------
function HeroSearch({ value, onChange, onClear, inputRef }) {
  return (
    <form
      role="search"
      className="group/search relative"
      // Results are already live below as you type; Enter (the "Go" key on
      // phone keyboards) previously did nothing at all. Dismiss the keyboard
      // so the results are actually visible.
      onSubmit={(event) => {
        event.preventDefault();
        event.currentTarget.querySelector("input")?.blur();
      }}
    >
      {/* Focus halo. Sits behind the field, so it reads as the field glowing
          rather than as a second border. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1 rounded-lg opacity-0 blur-md transition-opacity duration-500 [transition-timing-function:var(--ease-out-expo)] group-focus-within/search:opacity-100"
        style={{ background: "var(--accent-glow)" }}
      />
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-ink-3 transition-colors duration-300 group-focus-within/search:text-accent"
      />
      {/* No autoFocus. It made sense when Home WAS the search page; now that
          there are ten sections below, focusing on load pops the phone
          keyboard over the hero and pins the page at the top. ?q= still
          seeds the field, so a hand-off from Explore behaves as before. */}
      <input
        ref={inputRef}
        aria-label="Search the library"
        // How AppShell's "/" and Ctrl/Cmd-K shortcut finds this field — see
        // "The global search shortcut" in AppShell.jsx. Without it the
        // shortcut would send a student who is already looking at the hero
        // off to /search.
        data-search-input="hero"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search chapters, courses, teachers or lectures"
        className="relative min-h-16 w-full rounded-lg border border-hairline-strong bg-surface pl-14 pr-14 text-base text-ink shadow-e2 outline-none transition-colors duration-300 placeholder:text-ink-3 focus:border-accent-line"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 z-10 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

function TrustChips() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-ink-3">
      {[
        "No advertisements or sponsored rankings from JEENEETARD.",
        "No account needed",
        "Free forever",
      ].map((chip) => (
        <span key={chip} className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-accent" />
          {chip}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
//  Default landing (no query).
//
//  Trimmed on 2026-08-10, from eleven sections to six. The page was 14.8
//  phone-screens tall and led with marketing; the audit's finding was that a
//  student wanting a Thermodynamics lecture had to scroll past a value
//  proposition, a before/after table, a three-step explainer, a pricing tier
//  and a stat band to reach the tool. Removed: Benefits (why-students-stay),
//  Process (how-it-works), the Statistics band (which also carried a false
//  "17 attributes" figure), Pricing (the hero already says "Free forever"),
//  and the Final CTA (it repeated the hero). Those components are gone from
//  HomeSections.jsx too, not just unrendered.
//
//  What stays is the tool and one honest explainer, in a deliberate order:
//  a returning student's own progress, then the exam entry grid (the actual
//  product), then the trust strip, then one compact "what it does", the real
//  student ratings, and the FAQ that answers genuine first-visit questions.
//  The search box itself is at the very top, in the hero.
// ---------------------------------------------------------------------
function Landing({
  continueWatching, exams, institutes, topRated, catalogueLoading,
  channelsLoading,
}) {
  return (
    <>
      {/* The student's own status — continue-watching, streak, today's goal
          and days-to-exam — merged into ONE compact band, so a returning
          student reaches the exam grid a screen sooner. It renders nothing
          for a brand-new visitor: every piece hides itself without data. */}
      <PrepToday entries={continueWatching} />

      {/* Beside continue-watching, not beside the motivational bands: both are
          actions on work the student has already done. Hides itself until a
          chapter they finished is old enough to be worth going back to. */}
      <DueForRevision />

      {/* The tool comes before any argument for it. The student's remembered
          exam lane (chosen in the countdown above) leads the grid. */}
      <ExamGrid exams={exams} />

      {/* Inert until the polls release flag flips: nothing renders — and the
          lazy chunk is never even fetched — while polls are unreleased. */}
      {RELEASE_FEATURES.polls ? (
        <Suspense fallback={null}>
          <PollOfTheDay />
        </Suspense>
      ) : null}

      <SocialProof institutes={institutes} loading={channelsLoading} />

      <Features />

      {/* Real ratings, and it hides itself when there are none. */}
      <TopRated courses={topRated} loading={catalogueLoading} />

      <Faq />
    </>
  );
}
