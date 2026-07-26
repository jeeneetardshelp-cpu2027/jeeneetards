// =====================================================================
//  Home.jsx  —  the student landing page.
//
//  NOT an "all lessons" feed. It gets a student to a chapter (and thus to
//  playlist comparison) in two or three taps:
//    • a prominent search box with grouped live results
//    • Browse by exam
//    • a small, real featured-courses row (honest data, never faked)
//
//  Sections that need engagement data we don't have yet (Continue Watching is
//  device-local; Popular is not built) are omitted or use only real fields.
// =====================================================================

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search, GraduationCap, BookOpen, PlayCircle, Users, ArrowRight, X, History,
  ShieldCheck, ListFilter, Sparkles, Activity, Compass, Layers,
} from "lucide-react";
import { useDebouncedValue } from "./useBrowse.js";
import { usePlaylistBrowse } from "./usePlaylistBrowse.js";
import { ratingDisplay } from "./ratingConfidence.js";
import { GlobalHeader, Container } from "./AppShell.jsx";
import { useSearch } from "./useSearch.js";
import { getContinueWatching } from "./progress.js";
import { EXAMS } from "./filterModel.js";
import { useTheme } from "./theme.jsx";
import { useLearningGoals } from "./useExplore.js";
import { RELEASE_CAPABILITIES } from "./releaseCapabilities.js";
import { BRAND_NAVY, BRAND_TEAL } from "./brandColors.js";

const BRAND = { navy: BRAND_NAVY, teal: BRAND_TEAL };

// Editorial serif for the wordmark, hero and titles — academic and premium,
// deliberately not the default sans-everywhere look. System faces only (the
// build ships no webfonts), highest-quality serif first with graceful fallback.
const SERIF =
  '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Times New Roman",serif';

// A restrained subject palette for card spines / kickers. Falls back to the
// brand accent for anything unmapped.
const SUBJECT_COLORS = {
  physics: "#3B6FE0", chemistry: "#CF8526", mathematics: "#7A5AF0",
  maths: "#7A5AF0", biology: "#D85B84", botany: "#2E9E6B", zoology: "#2E9E6B",
};
const subjectColor = (name) => SUBJECT_COLORS[String(name || "").toLowerCase()] ?? BRAND.teal;
const goldFor = (dark) => (dark ? "#D6A94C" : "#B4842C");

// Per-exam identity for the "Browse by exam" cards.
const EXAM_META = {
  jee: { icon: GraduationCap, tint: "#0F6F78" },
  neet: { icon: Activity, tint: "#D85B84" },
  school: { icon: BookOpen, tint: "#3B6FE0" },
  olympiad: { icon: Compass, tint: "#7A5AF0" },
};

function StarIcon({ size = 14, color }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      style={{ fill: color, stroke: "none", flex: "none" }}>
      <path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z" />
    </svg>
  );
}

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
  const { t, dark } = useTheme();

  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader />

      {/* ---- Hero + search ---- */}
      <section className={`relative overflow-hidden border-b ${t.border} ${t.card}`}>
        {/* a whisper of accent, not a gradient hero */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0"
          style={{
            background: dark
              ? "radial-gradient(60% 120% at 85% -10%, rgba(55,192,160,.10), transparent 60%)"
              : "radial-gradient(60% 120% at 85% -10%, rgba(15,111,120,.07), transparent 60%)",
          }} />
        <div className="relative mx-auto max-w-3xl px-4 py-14 text-center sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: dark ? "#5AD0B4" : BRAND.teal }}>
            JEE &amp; NEET · lecture directory
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl"
            style={{ fontFamily: SERIF, textWrap: "balance" }}>
            Find the right lecture.{" "}
            <span className="italic" style={{ color: dark ? "#5AD0B4" : BRAND.teal }}>
              Skip the noise.
            </span>
          </h1>
          <p className={`mx-auto mt-4 max-w-xl text-base ${t.faint}`}>
            {homeTagline()} Ad-free, curriculum-organised, and rated so you can
            choose before you commit.
          </p>

          <div className="relative mx-auto mt-8 max-w-xl">
            <Search className={`pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 ${t.muted}`} />
            <input
              autoFocus
              aria-label="Search the library"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search chapters, courses, teachers or lectures"
              className={`w-full rounded-2xl border ${t.border} ${t.input} ${t.text} py-4 pl-12 pr-11 text-base shadow-sm outline-none transition focus:ring-2 focus:ring-teal-500`}
            />
            {input && (
              <button
                onClick={() => setInput("")}
                aria-label="Clear search"
                className={`absolute right-1.5 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-xl ${t.muted} ${t.hover}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {!searching && (
            <div className={`mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs ${t.muted}`}>
              {["No ads, no rabbit holes", "Free forever", "Curated & rated"].map((chip) => (
                <span key={chip} className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: BRAND.teal }} />
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="py-8 sm:py-12">
        <Container>
          {searching ? (
            <SearchResults
              results={results} loading={loading} total={total} error={error}
              retry={retry} query={debounced.trim()} navigate={navigate}
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
  const [continueWatching] = useState(() => getContinueWatching(3));
  const { t } = useTheme();
  const { goals, loading: goalsLoading, error: goalsError } = useLearningGoals();
  const jee = (goals ?? []).find((g) => g.slug === "jee");

  return (
    <div className="space-y-14">
      {continueWatching.length > 0 && (
        <Section title="Continue watching" icon={History}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {continueWatching.map((e) => (
              <button
                key={e.playlistId}
                onClick={() => navigate(`/course/${e.playlistId}/chapter/${e.chapterId}?v=${e.lastVideoId}`)}
                className={`rounded-2xl border ${t.border} ${t.card} ${t.cardHover} p-4 text-left shadow-sm transition hover:-translate-y-0.5`}
              >
                <span className={`block truncate text-sm font-semibold ${t.text}`}>
                  {e.lastVideoTitle || e.courseTitle}
                </span>
                <span className={`mt-0.5 block truncate text-xs ${t.muted}`}>
                  {e.courseTitle}
                  {e.totalLessons ? ` · lesson ${e.lastPosition ?? "?"} of ${e.totalLessons}` : ""}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ---- Browse by exam ---- */}
      <Section title="Browse by exam" eyebrow="Start here">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {EXAMS.map((exam) => {
            const { available, hint, count } = examCardState(exam, goals, {
              loading: goalsLoading, error: goalsError,
              boardClassification: RELEASE_CAPABILITIES.boardClassification,
            });
            const meta = EXAM_META[exam.id] ?? { icon: GraduationCap, tint: BRAND.teal };
            const Icon = meta.icon;
            return (
              <button
                key={exam.id}
                type="button"
                disabled={!available}
                onClick={() => available && navigate(`/explore/${exam.id}`)}
                className={`group relative flex min-h-[9.5rem] flex-col rounded-2xl border ${t.border} ${t.card} p-5 text-left shadow-sm transition ${
                  available ? "hover:-translate-y-1 hover:shadow-lg" : "cursor-not-allowed opacity-60"
                }`}
              >
                <span className="absolute right-4 top-4 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide"
                  style={available
                    ? { color: meta.tint, background: `${meta.tint}1a` }
                    : { color: "#9aa3b2", border: "1px solid currentColor" }}>
                  {available ? "Live" : "Soon"}
                </span>
                <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl"
                  style={{ background: `${meta.tint}17`, color: meta.tint }}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xl font-semibold" style={{ fontFamily: SERIF }}>{exam.label}</span>
                <span className={`mt-1 text-xs ${t.muted}`}>
                  {available ? "Choose class, subject & chapter" : hint}
                </span>
                {available && (
                  <span className={`mt-3 border-t ${t.divider} pt-3 text-xs ${t.faint}`}>
                    <b className={t.text} style={{ fontWeight: 600 }}>{count}</b> courses
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ---- Why it's different ---- */}
      <section className={`rounded-3xl border ${t.border} ${t.card} px-6 py-8 shadow-sm sm:px-10 sm:py-10`}>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "No ads, no rabbit holes",
              body: "Lectures play in a clean, distraction-free player. No autoplay traps, no recommended spiral pulling you off task." },
            { icon: ListFilter, title: "Organised by your syllabus",
              body: "Filter by exam, class, subject, chapter, teacher and language — so you land on exactly the lesson you need." },
            { icon: Sparkles, title: "Curated, not random",
              body: "Every course is reviewed and curriculum-tagged, with ratings so you can judge quality before you spend hours in it." },
          ].map((v) => (
            <div key={v.title}>
              <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl"
                style={{ background: `${BRAND.teal}17`, color: BRAND.teal }}>
                <v.icon className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-semibold" style={{ fontFamily: SERIF }}>{v.title}</h3>
              <p className={`mt-2 text-sm ${t.faint}`}>{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Featured courses (real data via the browse hook) ---- */}
      {jee?.id && (
        <FeaturedCourses goalId={jee.id} navigate={navigate} />
      )}

      {/* ---- Browse the library CTA ---- */}
      <Section title="Browse the library" eyebrow="The full catalogue">
        <button
          onClick={() => navigate("/browse")}
          className={`flex w-full items-center justify-between gap-4 rounded-2xl border ${t.border} ${t.card} ${t.cardHover} p-6 text-left shadow-sm transition hover:-translate-y-0.5`}
        >
          <span>
            <span className="block text-lg font-semibold" style={{ fontFamily: SERIF }}>
              Explore all courses
            </span>
            <span className={`mt-1 block text-sm ${t.faint}`}>
              Filter by exam, class, subject, chapter, channel and language.
            </span>
          </span>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
            style={{ background: `${BRAND.teal}17`, color: BRAND.teal }}>
            <ArrowRight className="h-5 w-5" />
          </span>
        </button>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Featured courses — reuses the hardened browse hook; shows only real
//  fields, hides itself on empty/error (never fakes a "popular" list).
// ---------------------------------------------------------------------
function FeaturedCourses({ goalId, navigate }) {
  const { t } = useTheme();
  const { items, loading, error } = usePlaylistBrowse({ goalId, page: 0, enabled: !!goalId });
  const courses = (items ?? []).slice(0, 3);

  if (error) return null;

  return (
    <Section title="Courses to start with" eyebrow="From the catalogue"
      action={{ label: "Browse all", onClick: () => navigate("/browse") }}>
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`h-44 animate-pulse rounded-2xl ${t.input}`} />
          ))}
        </div>
      ) : courses.length === 0 ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} onOpen={() => navigate(`/course/${c.id}`)} />
          ))}
        </div>
      )}
    </Section>
  );
}

function CourseCard({ course, onOpen }) {
  const { t, dark } = useTheme();
  const color = subjectColor(course.subject);
  const rating = ratingDisplay(course.rating, course.ratingCount);
  const initials = (course.teacher || "")
    .split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const facts = [
    course.lectures != null && `${course.lectures} lesson${course.lectures === 1 ? "" : "s"}`,
    course.contentType && cap(course.contentType.replace(/-/g, " ")),
    course.language && cap(course.language),
  ].filter(Boolean);

  return (
    <button onClick={onOpen}
      className={`group flex flex-col overflow-hidden rounded-2xl border ${t.border} ${t.card} text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg`}>
      <span className="h-1 w-full" style={{ background: color }} />
      <span className="flex flex-1 flex-col p-5">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em]" style={{ color }}>
          {[course.subject, course.classLevels?.[0]].filter(Boolean).join(" · ") || "Course"}
        </span>
        <span className="mt-2 text-lg font-semibold leading-snug" style={{ fontFamily: SERIF }}>
          {course.title}
        </span>
        {facts.length > 0 && (
          <span className={`mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs ${t.faint}`}>
            {facts.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                {i === 0 && <Layers className="h-3.5 w-3.5" />}{f}
              </span>
            ))}
          </span>
        )}
        <span className={`mt-4 flex items-center justify-between border-t ${t.divider} pt-3`}>
          <span className="flex min-w-0 items-center gap-2">
            {course.teacher ? (
              <>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.68rem] font-bold text-white"
                  style={{ background: color }}>{initials || "?"}</span>
                <span className={`truncate text-xs font-semibold ${t.text}`}>{course.teacher}</span>
              </>
            ) : (
              <span className={`text-xs ${t.muted}`}>Teacher on course page</span>
            )}
          </span>
          {rating?.kind === "scored" ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
              <StarIcon color={goldFor(dark)} />{rating.score.toFixed(1)}
            </span>
          ) : (
            <span className={`shrink-0 text-[0.68rem] ${t.muted}`}>Not yet rated</span>
          )}
        </span>
      </span>
    </button>
  );
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// ---------------------------------------------------------------------
//  Grouped search results
// ---------------------------------------------------------------------
function SearchResults({ results, loading, total, error, retry, query, navigate }) {
  if (loading) return <SkeletonRow />;

  if (error)
    return (
      <Empty>
        <p>{error}</p>
        <button type="button" onClick={retry}
          className="mt-3 min-h-11 rounded-xl border px-4 font-medium">
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
          <ResultList items={chapters.map((c) => ({
            key: `ch-${c.id}`, title: c.name, subtitle: c.subject,
            onClick: () => navigate(`/browse?ch=${c.id}`),
          }))} />
        </Section>
      )}

      {playlists.length > 0 && (
        <Section title="Playlists" icon={PlayCircle}>
          <ResultList items={playlists.map((p) => ({
            key: `pl-${p.id}`, title: p.title,
            subtitle: [p.teacher, p.institute].filter(Boolean).join(" · "),
            badges: p.classLevels, disabled: !p.chapterId,
            onClick: () => p.chapterId && navigate(`/course/${p.id}/chapter/${p.chapterId}`),
          }))} />
        </Section>
      )}

      {lectures.length > 0 && (
        <Section title="Lectures" icon={PlayCircle}>
          <ResultList items={lectures.map((v) => ({
            key: `v-${v.id}`, title: v.title, subtitle: "Lecture",
            onClick: () => navigate(`/browse?sub=${v.subjectId}` + (v.chapterId ? `&ch=${v.chapterId}` : "")),
          }))} />
        </Section>
      )}

      {teachers.length > 0 && (
        <Section title="Channels" icon={Users}>
          <ResultList items={teachers.map((teacher) => ({
            key: `t-${teacher.id}`, title: teacher.name, subtitle: "Channel",
            onClick: () => navigate("/browse"),
          }))} />
        </Section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
//  Small shared pieces
// ---------------------------------------------------------------------
function Section({ title, icon: Icon, eyebrow, action, children }) {
  const { t } = useTheme();
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em]" style={{ color: BRAND.teal }}>
              {eyebrow}
            </p>
          )}
          <h2 className={`flex items-center gap-2 text-xl font-semibold ${t.text}`} style={{ fontFamily: SERIF }}>
            {Icon && <Icon className="h-5 w-5" />}
            {title}
          </h2>
        </div>
        {action && (
          <button onClick={action.onClick}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold"
            style={{ color: BRAND.teal }}>
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function ResultList({ items }) {
  const { t } = useTheme();
  return (
    <ul className={`divide-y overflow-hidden rounded-2xl border ${t.divider} ${t.border} ${t.card} shadow-sm`}>
      {items.map((it) => (
        <li key={it.key}>
          <button onClick={it.onClick} disabled={it.disabled}
            className={`flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left transition ${t.hover} disabled:opacity-50`}>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-medium ${t.text}`}>{it.title}</span>
              {it.subtitle && (
                <span className={`block truncate text-xs ${t.muted}`}>{it.subtitle}</span>
              )}
            </span>
            {it.badges?.length > 0 && (
              <span className="flex shrink-0 gap-1">
                {it.badges.map((b) => (
                  <span key={b} className="rounded-full border px-2 py-0.5 text-xs font-semibold"
                    style={{ borderColor: BRAND.teal, color: BRAND.teal }}>{b}</span>
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
        <div key={i} className={`h-16 animate-pulse rounded-2xl ${t.input}`} />
      ))}
    </div>
  );
}

function Empty({ children }) {
  const { t } = useTheme();
  return (
    <div className={`rounded-2xl border border-dashed ${t.border} ${t.card} p-8 text-center text-sm ${t.muted}`}>
      {children}
    </div>
  );
}
