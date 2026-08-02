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

import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowRight, BookOpen, Loader2, PlayCircle, Search, Users, X,
} from "lucide-react";
import { usePlaylistBrowse } from "./usePlaylistBrowse.js";
import { Container, GlobalHeader } from "./AppShell.jsx";
// ONE search system. The hero box used to run its own ilike queries against
// raw columns — no index use, no typo tolerance, no Devanagari bridge, and a
// separate ranking that disagreed with /search. It now calls the same
// server-ranked universal_search RPC that /search does.
import { useUniversalSearch, MIN_QUERY } from "./useUniversalSearch.js";
import { resultHref } from "./searchDestinations.js";
import { getContinueWatching } from "./progress.js";
import { EXAMS } from "./filterModel.js";
import { useLearningGoals } from "./useExplore.js";
import { RELEASE_CAPABILITIES } from "./releaseCapabilities.js";
import { useStructuredData } from "./PageMetadata.jsx";
import { organizationSchema, websiteSchema } from "./structuredData.js";
import { Button, EmptyState, Pill, Skeleton, Surface } from "./ui.jsx";
import {
  Benefits, ContinueWatching, ExamGrid, Faq, Features, FinalCta, Hero,
  Pricing, Process, SocialProof, Statistics, TopRated,
  pickInstitutes, pickTopRated,
} from "./HomeSections.jsx";

// The comparison table's attribute count, and the languages the catalogue
// classifies. Both are real product facts, stated once here so the numbers
// on the page cannot drift from the pages they describe.
const COMPARED_ATTRIBUTES = 17;
const LANGUAGES = 3;

export function homeTagline(capabilities = RELEASE_CAPABILITIES) {
  return capabilities.comparison
    ? "Compare courses from different teachers and pick what fits you."
    : "Find free courses by exam, class, subject and chapter.";
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
  // The hook debounces, cancels obsolete requests and enforces the same
  // minimum length the database does, so no local debounce is needed.
  const { groups, loading, error, tooShort, retry } = useUniversalSearch(input, { limit: 6 });
  const searching = input.trim().length > 0;

  const [continueWatching] = useState(() => getContinueWatching(3));
  const { goals, loading: goalsLoading, error: goalsError } = useLearningGoals();
  // ONE catalogue request serves four things: the hero stat rail, the rated
  // strip, the channel marquee and the library-wide course total.
  const { items, total, loading: catalogueLoading } = usePlaylistBrowse({ page: 0 });

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
  const institutes = useMemo(() => pickInstitutes(items, 8), [items]);

  // Site identity, not search-state-dependent — written once, never removed
  // while Home stays mounted. organizationSchema describes the SITE itself,
  // never a course's provider (that's courseSchema's job, on the course page).
  useStructuredData([websiteSchema(), organizationSchema()], []);

  // The rail is a teaser, not the statistics band: three figures, and only
  // rendered once at least one of them is real, so it never animates to zero.
  const heroStats = courseCount > 0
    ? [
        { value: courseCount, label: "Free courses", note: "Curriculum-tagged" },
        { value: liveTracks, label: "Exam tracks", note: "JEE, NEET, Boards" },
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
          <HeroSearch
            value={input}
            onChange={setInput}
            onClear={() => setInput("")}
            busy={loading}
          />
        }
        chips={searching ? null : <TrustChips />}
        stats={searching ? [] : heroStats}
      />

      <main>
        {searching ? (
          <Container className="py-12 sm:py-16">
            <SearchResults
              groups={groups}
              loading={loading}
              error={error}
              tooShort={tooShort}
              retry={retry}
              query={input.trim()}
            />
          </Container>
        ) : (
          <Landing
            continueWatching={continueWatching}
            exams={exams}
            institutes={institutes}
            topRated={topRated}
            catalogueLoading={catalogueLoading}
            courseCount={courseCount}
            liveTracks={liveTracks}
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
function HeroSearch({ value, onChange, onClear, busy }) {
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
        aria-label="Search the library"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search chapters, courses, teachers or lectures"
        className="relative min-h-16 w-full rounded-lg border border-hairline-strong bg-surface pl-14 pr-14 text-base text-ink shadow-e2 outline-none transition-colors duration-300 placeholder:text-ink-3 focus:border-accent-line"
      />
      {busy && (
        <Loader2
          aria-hidden="true"
          className="anim-spin absolute right-14 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-3"
        />
      )}
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
//  Default landing (no query). Order is deliberate: a returning student's
//  own progress first, then the exam entry points, then the argument.
// ---------------------------------------------------------------------
function Landing({
  continueWatching, exams, institutes, topRated, catalogueLoading,
  courseCount, liveTracks,
}) {
  return (
    <>
      <ContinueWatching entries={continueWatching} />

      <SocialProof institutes={institutes} loading={catalogueLoading} />

      <ExamGrid exams={exams} />

      <Features />

      <TopRated courses={topRated} loading={catalogueLoading} />

      <Benefits />

      <Process />

      {/* Counts that come from a live query are dropped when that query hasn't
          produced a real number, rather than rendered as a confident "0". With
          a literal array here, a failed catalogue request made the homepage
          state "0 — Courses in the library" and "0 — Exam tracks live" as
          statistics, while the hero rail above (already guarded on
          courseCount > 0) correctly hid itself. The last two are constants
          describing the product, not measurements, so they always hold. */}
      <Statistics
        stats={[
          courseCount > 0 && {
            value: courseCount,
            label: "Courses in the library",
            note: "Curriculum-tagged, chapter by chapter",
          },
          liveTracks > 0 && {
            value: liveTracks,
            label: "Exam tracks live",
            note: "JEE, NEET and school boards",
          },
          {
            value: COMPARED_ATTRIBUTES,
            label: "Attributes compared",
            note: "Coverage, pacing, prerequisites and more",
          },
          {
            value: LANGUAGES,
            label: "Languages classified",
            note: "Hindi, English and Hinglish",
          },
        ].filter(Boolean)}
      />

      <Pricing />

      <Faq />

      <FinalCta />
    </>
  );
}

// ---------------------------------------------------------------------
//  Grouped search results
// ---------------------------------------------------------------------
const HOME_GROUPS = [
  { key: "chapter", label: "Chapters", icon: BookOpen },
  { key: "playlist", label: "Courses", icon: PlayCircle },
  { key: "lecture", label: "Lectures", icon: PlayCircle },
  { key: "faculty", label: "Teachers", icon: Users, gated: "facultyRegistry" },
  { key: "institute", label: "Channels", icon: Users },
];

function SearchResults({ groups, loading, error, tooShort, retry, query }) {
  if (loading) return <SkeletonRows />;

  if (error) {
    return (
      <EmptyState
        title="Search is unavailable"
        detail={error}
        action={<Button variant="secondary" onClick={retry}>Try again</Button>}
      />
    );
  }

  if (tooShort) {
    return (
      <EmptyState
        title={`Type at least ${MIN_QUERY} characters`}
        detail="Search looks across chapters, courses, teachers and individual lectures."
      />
    );
  }

  const visible = HOME_GROUPS.filter(
    (g) => (groups[g.key]?.rows?.length ?? 0) > 0 &&
           (!g.gated || RELEASE_CAPABILITIES[g.gated]),
  );

  if (visible.length === 0) {
    return (
      <EmptyState
        title={`No results for “${query}”`}
        detail="Try a chapter name, a course, a channel or a teacher — spelling variations are handled."
        action={<Button variant="secondary" to="/browse">Browse the catalogue instead</Button>}
      />
    );
  }

  return (
    <div className="space-y-12">
      {visible.map((g) => {
        const group = groups[g.key];
        // Deliberately NOT wrapped in <Reveal>: results answer a question the
        // student just typed, so they must paint immediately and must never
        // depend on an IntersectionObserver firing. A .reveal starts at
        // opacity 0 and only becomes visible once a useReveal() root observes
        // it — and <main> has no such root, which silently made every homepage
        // search result invisible in production. Same reasoning as
        // SearchPage.jsx, which has never animated its results.
        return (
          <div key={g.key} className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-h3 flex items-center gap-2.5 text-ink">
                <g.icon aria-hidden="true" className="h-5 w-5 text-accent" />
                {g.label}
              </h2>
              {group.total > group.rows.length && (
                <Link
                  to={`/search?q=${encodeURIComponent(query)}`}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent transition-opacity hover:opacity-80"
                >
                  All {group.total}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              )}
            </div>
            <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface">
              {group.rows.map((row) => (
                <li key={`${g.key}-${row.id}`}>
                  <Link
                    to={resultHref(g.key, row)}
                    className="group/row flex min-h-14 w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-200 hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {row.title}
                      </span>
                      {row.subtitle && (
                        <span className="mt-0.5 block truncate text-xs text-ink-3">
                          {row.subtitle}
                        </span>
                      )}
                    </span>
                    {/* Verified aliases, e.g. "also ABJ Sir" — faculty only. */}
                    {row.aka && <Pill tone="accent" className="hidden sm:inline-flex">{row.aka}</Pill>}
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-ink-3 transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)] group-hover/row:translate-x-1 group-hover/row:text-accent"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-12" aria-hidden="true">
      {Array.from({ length: 2 }).map((_, group) => (
        <div key={group} className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Surface padded={false} className="divide-y divide-hairline">
            {Array.from({ length: 3 }).map((_, row) => (
              <div key={row} className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </Surface>
        </div>
      ))}
    </div>
  );
}
