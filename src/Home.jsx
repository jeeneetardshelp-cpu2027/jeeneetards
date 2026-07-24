// =====================================================================
//  Home.jsx  —  the student landing page.
//
//  NOT an "all lessons" feed. It gets a student to a chapter (and thus to
//  playlist comparison) in two or three taps:
//    • a prominent search box with grouped live results
//    • Browse by exam
//    • Quick jumps to chapters
//    • Class quick-links
//
//  Sections that need engagement data we don't have yet (Continue Watching,
//  Popular, Recently viewed) are intentionally omitted rather than faked.
// =====================================================================

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search, GraduationCap, BookOpen, PlayCircle, Users, ArrowRight, X, History,
} from "lucide-react";
import { useDebouncedValue } from "./useBrowse.js";
import { GlobalHeader, Container } from "./AppShell.jsx";
import { useSearch } from "./useSearch.js";
import { getContinueWatching } from "./progress.js";
import { EXAMS } from "./filterModel.js";
import { useTheme } from "./theme.jsx";
import { useLearningGoals } from "./useExplore.js";
import { RELEASE_CAPABILITIES } from "./releaseCapabilities.js";

const BRAND = { navy: "#142A4F", teal: "#13919B" };

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Seed from ?q= so "search the entire library" from Explore lands here
  // with the query already run.
  const [input, setInput] = useState(searchParams.get("q") ?? "");
  const debounced = useDebouncedValue(input, 250);
  const { results, loading, total, error, retry } = useSearch(debounced);
  const searching = debounced.trim().length > 0;
  const { t } = useTheme();

  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      {/* Header */}
      <GlobalHeader />

      {/* Hero + search */}
      <section className={`border-b ${t.border} ${t.card}`}>
        <div className="mx-auto max-w-3xl px-4 py-10 text-center">
          <h1 className={`text-2xl font-bold tracking-tight ${t.text} sm:text-3xl`}>
            Find the right lecture, fast.
          </h1>
          <p className={`mt-2 text-sm ${t.muted}`}>
            {homeTagline()}
          </p>

          <div className="relative mt-6">
            <Search className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${t.muted}`} />
            <input
              autoFocus
              aria-label="Search the library"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search chapters, courses, channels or lectures"
              className={`w-full rounded-xl border ${t.border} ${t.input} ${t.text} py-3 pl-12 pr-11 text-sm outline-none transition focus:ring-2 focus:ring-teal-500`}
            />
            {input && (
              <button
                onClick={() => setInput("")}
                aria-label="Clear search"
                className={`absolute right-0 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg ${t.muted} ${t.hover}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      <main className="py-6 sm:py-8">
        <Container>
        {searching ? (
          <SearchResults
            results={results}
            loading={loading}
            total={total}
            error={error}
            retry={retry}
            query={debounced.trim()}
            navigate={navigate}
          />
        ) : (
          <Landing navigate={navigate} />
        )}
        </Container>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Default landing (no query)
// ---------------------------------------------------------------------
function Landing({ navigate }) {
  // Read once per visit — localStorage is fast and Home remounts on navigation.
  const [continueWatching] = useState(() => getContinueWatching(3));
  const { t } = useTheme();
  const { goals, loading: goalsLoading, error: goalsError } = useLearningGoals();

  return (
    <div className="space-y-10">
      {/* Class shortcuts were removed: they navigated to /browse?class=… which
          the browse query ignored, so they filtered nothing. They'll come back
          when they point at real class-aware Explore routes. */}

      {/* Continue watching — from local watch history (this device). */}
      {continueWatching.length > 0 && (
        <Section title="Continue watching" icon={History}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {continueWatching.map((e) => (
              <button
                key={e.playlistId}
                onClick={() =>
                  navigate(
                    `/course/${e.playlistId}/chapter/${e.chapterId}?v=${e.lastVideoId}`
                  )
                }
                className={`rounded-xl border ${t.border} ${t.card} ${t.cardHover} p-4 text-left transition`}
              >
                <span className={`block truncate text-sm font-semibold ${t.text}`}>
                  {e.lastVideoTitle || e.courseTitle}
                </span>
                <span className={`mt-0.5 block truncate text-xs ${t.muted}`}>
                  {e.courseTitle}
                  {e.totalLessons
                    ? ` · lesson ${e.lastPosition ?? "?"} of ${e.totalLessons}`
                    : ""}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Browse by exam */}
      <Section title="Browse by exam" icon={GraduationCap}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EXAMS.map((exam) => {
            const { available, hint } = examCardState(exam, goals, {
              loading: goalsLoading,
              error: goalsError,
              boardClassification: RELEASE_CAPABILITIES.boardClassification,
            });

            return (
              <button
                key={exam.id}
                type="button"
                disabled={!available}
                onClick={() => available && navigate(`/explore/${exam.id}`)}
                className={`flex min-h-24 items-center justify-between rounded-xl border ${t.border} ${t.card} p-4 text-left transition ${
                  available ? t.cardHover : "cursor-not-allowed opacity-60"
                }`}
              >
                <span>
                  <span className={`block font-semibold ${t.text}`}>{exam.label}</span>
                  <span className={`mt-1 block text-xs ${t.muted}`}>{hint}</span>
                </span>
                {available && <ArrowRight className="h-4 w-4 shrink-0" style={{ color: BRAND.teal }} />}
              </button>
            );
          })}
        </div>
      </Section>

      {/* An "every chapter" grid grows into hundreds of cards. The catalogue
          is the scalable chapter picker: searchable filters, one result page,
          and a URL that can be bookmarked or shared. */}
      <Section title="Browse the library" icon={BookOpen}>
        <button
          onClick={() => navigate("/browse")}
          className={`flex min-h-24 w-full items-center justify-between rounded-xl border ${t.border} ${t.card} ${t.cardHover} p-5 text-left transition`}
        >
          <span>
            <span className={`block font-semibold ${t.text}`}>Explore all courses</span>
            <span className={`mt-1 block text-sm ${t.muted}`}>
              Filter by exam, class, subject, chapter, channel and language.
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" style={{ color: BRAND.teal }} />
        </button>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Grouped search results
// ---------------------------------------------------------------------
function SearchResults({ results, loading, total, error, retry, query, navigate }) {
  if (loading) return <SkeletonRow />;

  if (error)
    return (
      <Empty>
        <p>{error}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-3 min-h-11 rounded-xl border px-4 font-medium"
        >
          Try again
        </button>
      </Empty>
    );

  if (total === 0)
    return (
      <Empty>
        No results for “{query}”. Try a chapter, course, channel or lecture.
      </Empty>
    );

  const { chapters, playlists, lectures, teachers } = results;

  return (
    <div className="space-y-8">
      {chapters.length > 0 && (
        <Section title="Chapters" icon={BookOpen}>
          <ResultList
            items={chapters.map((c) => ({
              key: `ch-${c.id}`,
              title: c.name,
              subtitle: c.subject,
              onClick: () => navigate(`/browse?ch=${c.id}`),
            }))}
          />
        </Section>
      )}

      {playlists.length > 0 && (
        <Section title="Playlists" icon={PlayCircle}>
          <ResultList
            items={playlists.map((p) => ({
              key: `pl-${p.id}`,
              title: p.title,
              subtitle: [p.teacher, p.institute].filter(Boolean).join(" · "),
              badges: p.classLevels,
              disabled: !p.chapterId,
              onClick: () =>
                p.chapterId && navigate(`/course/${p.id}/chapter/${p.chapterId}`),
            }))}
          />
        </Section>
      )}

      {lectures.length > 0 && (
        <Section title="Lectures" icon={PlayCircle}>
          <ResultList
            items={lectures.map((v) => ({
              key: `v-${v.id}`,
              title: v.title,
              subtitle: "Lecture",
              onClick: () =>
                // See Explore.jsx: a search row has a category, not a goal, so
                // we link by subject/chapter rather than guessing a goal.
                navigate(
                  `/browse?sub=${v.subjectId}` +
                    (v.chapterId ? `&ch=${v.chapterId}` : "")
                ),
            }))}
          />
        </Section>
      )}

      {teachers.length > 0 && (
        <Section title="Channels" icon={Users}>
          <ResultList
            items={teachers.map((t) => ({
              key: `t-${t.id}`,
              title: t.name,
              subtitle: "Channel",
              onClick: () => navigate("/browse"),
            }))}
          />
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
//  Small shared pieces
// ---------------------------------------------------------------------
function Section({ title, icon: Icon, children }) {
  const { t } = useTheme();
  return (
    <section>
      <h2 className={`mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide ${t.muted}`}>
        {Icon && <Icon className="h-4 w-4" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function ResultList({ items }) {
  const { t } = useTheme();
  return (
    <ul className={`divide-y overflow-hidden rounded-xl border ${t.divider} ${t.border} ${t.card}`}>
      {items.map((it) => (
        <li key={it.key}>
          <button
            onClick={it.onClick}
            disabled={it.disabled}
            className={`flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left transition ${t.hover} disabled:opacity-50`}
          >
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-medium ${t.text}`}>
                {it.title}
              </span>
              {it.subtitle && (
                <span className={`block truncate text-xs ${t.muted}`}>
                  {it.subtitle}
                </span>
              )}
            </span>
            {it.badges?.length > 0 && (
              <span className="flex shrink-0 gap-1">
                {it.badges.map((b) => (
                  <span
                    key={b}
                    className="rounded-full border px-2 py-0.5 text-xs font-semibold"
                    style={{ borderColor: BRAND.teal, color: BRAND.teal }}
                  >
                    {b}
                  </span>
                ))}
              </span>
            )}
            <ArrowRight className={`h-4 w-4 shrink-0 ${t.muted}`} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function SkeletonRow() {
  const { t } = useTheme();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`h-16 animate-pulse rounded-xl ${t.input}`} />
      ))}
    </div>
  );
}

function Empty({ children }) {
  const { t } = useTheme();
  return (
    <div className={`rounded-xl border border-dashed ${t.border} ${t.card} p-8 text-center text-sm ${t.muted}`}>
      {children}
    </div>
  );
}
