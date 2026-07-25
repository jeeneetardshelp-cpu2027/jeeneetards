// Compare.jsx — /compare?chapter=<id>&ids=1,2
//
// A real side-by-side comparison: one row per attribute, one column per
// course. A grid of cards cannot do this — your eye has to jump between cards
// and hold values in memory.
//
// COMPARISON IS ALWAYS CHAPTER-SCOPED. Two courses are only comparable if they
// teach the same thing, so the chapter is part of the URL and every selected
// playlist is verified to contain material for it. A comparison of "Kinematics"
// against "Thermodynamics" is not a comparison, it is a category error, and
// silently rendering one would be worse than refusing.
//
// Rules that shape every cell:
//   * Unknown is "Unknown" — never 0, 0% or 0.0
//   * a row that is Unknown for EVERY course is hidden, not printed as a
//     column of shrugs
//   * nothing is inferred. "Best for" may only restate curated metadata; it
//     may not derive exam suitability from difficulty, or thoroughness from a
//     lecture count
//   * differences are highlighted; no winner is declared

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { Page } from "./AppShell.jsx";
import { formatDuration } from "./usePlaylistBrowse.js";
import { ratingDisplay } from "./ratingConfidence.js";
import { COURSE_TYPES, DIFFICULTIES, MIN_COMPARE, MAX_COMPARE } from "./filterModel.js";
import { useTheme } from "./theme.jsx";

export { MIN_COMPARE, MAX_COMPARE };

const TYPE = Object.fromEntries(COURSE_TYPES.map((c) => [c.id, c.label]));
const LEVEL = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d.label]));
const humanize = (value) => value
  ? value.replaceAll("-", " ").replace(/^./, (first) => first.toUpperCase())
  : null;

/**
 * Parse ?ids= into at most MAX_COMPARE distinct positive integers.
 *
 * `overflow` reports that the link asked for more than we will show, so the
 * UI can say so rather than silently dropping courses the student picked.
 */
export function parseCompareIds(raw) {
  const seen = new Set();
  for (const part of (raw ?? "").split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0) seen.add(n);
  }
  const all = [...seen];
  return { ids: all.slice(0, MAX_COMPARE), overflow: all.length > MAX_COMPARE };
}

/**
 * Fetch the courses through the bounded comparison RPC. The database returns
 * an explicit row for an unavailable or cross-chapter selection, so the UI
 * never weakens a stale link by silently dropping its bad ids.
 *
 * A stale id must never WEAKEN validation: it is reported and excluded, and
 * the >= MIN_COMPARE rule is applied to what actually resolved. Dropping a bad
 * id and then comparing whatever is left is how a 4-course comparison quietly
 * becomes a 1-course table.
 */
export function useComparison(ids, chapterId, learningGoalId = null) {
  const [state, setState] = useState({
    rows: [], notFound: [], wrongChapter: [], loading: true, error: null,
  });
  const [nonce, setNonce] = useState(0);
  const idsKey = ids.join(",");

  useEffect(() => {
    let active = true;
    const requestIds = idsKey ? idsKey.split(",").map(Number) : [];
    if (!requestIds.length || !chapterId) {
      setState({ rows: [], notFound: [], wrongChapter: [], loading: false, error: null });
      return;
    }
    if (!isSupabaseConfigured) {
      setState({ rows: [], notFound: [], wrongChapter: [], loading: false,
                 error: "Supabase isn't configured." });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));

    supabase.rpc("get_playlist_comparison", {
      p_playlist_ids: requestIds,
      p_chapter_id: chapterId,
      p_learning_goal_id: learningGoalId,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("compare:", error);
        setState({ rows: [], notFound: [], wrongChapter: [], loading: false,
                   error: "Couldn't load these courses." });
        return;
      }
      const result = [...(data ?? [])].sort(
        (a, b) => Number(a.requested_order) - Number(b.requested_order),
      );
      const rows = result.filter((r) => r.course_status === "ok");
      const notFound = result.filter((r) => r.course_status === "not-found")
        .map((r) => Number(r.playlist_id));
      const wrongChapter = result.filter((r) => r.course_status === "wrong-chapter")
        .map((r) => Number(r.playlist_id));

      setState({ rows, notFound, wrongChapter, loading: false, error: null });
    });
    return () => { active = false; };
  }, [idsKey, chapterId, learningGoalId, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}

// ---- attribute rows. `get` returns a display value, or null for Unknown. ----
//
// There is deliberately NO "JEE Main / Advanced" row. It used to be derived
// from `difficulty` (advanced -> "Advanced", intermediate -> "Main"), which is
// an invention: a course's difficulty rating is not a statement about which
// exam it prepares you for. Restoring that row needs a real curated field.
export const ATTRIBUTES = [
  { key: "faculty",   label: "Faculty",   get: (c) => c.teacher || null },
  { key: "institute", label: "Institute", get: (c) => c.channel_title || null },
  { key: "subject",   label: "Subject",   get: (c) => c.subject_title || null },
  { key: "class",     label: "Class",     get: (c) => (c.class_levels?.length ? c.class_levels.join(", ") : null) },
  { key: "language",  label: "Language",  get: (c) => (c.language ? c.language[0].toUpperCase() + c.language.slice(1) : null) },
  { key: "type",      label: "Course type", get: (c) => TYPE[c.content_type] ?? c.content_type ?? null },
  { key: "lectures",  label: "Lectures",  get: (c) => {
      const n = c.chapter_lecture_count;
      // 0 is a real answer here, but it is not "Unknown" — guard the null
      // case only, and never let a missing count render as 0.
      return n == null ? null : String(n);
    } },
  // total_duration_seconds is computed inside get_chapter_courses(), not stored
  // on the row, so it is genuinely unknown here rather than zero.
  { key: "duration", label: "Chapter duration", get: (c) => formatDuration(c.chapter_duration_seconds) },
  { key: "coverage", label: "Syllabus coverage", get: (c) => {
      if (c.syllabus_coverage_pct == null) return null;
      const detail = c.coverage_mapped_topics != null && c.coverage_required_topics != null
        ? ` (${c.coverage_mapped_topics} of ${c.coverage_required_topics} topics)` : "";
      return `${Number(c.syllabus_coverage_pct).toLocaleString(undefined, { maximumFractionDigits: 2 })}%${detail}`;
    } },
  { key: "difficulty", label: "Difficulty",        get: (c) => LEVEL[c.difficulty] ?? c.difficulty ?? null },
  { key: "pacing", label: "Pacing", get: (c) => humanize(c.pacing) },
  { key: "theory", label: "Theory focus", get: (c) =>
      c.theory_percentage == null ? null : `${c.theory_percentage}%` },
  { key: "prerequisites", label: "Prerequisites", get: (c) =>
      humanize(c.prerequisites_level) },
  { key: "completeness", label: "Completeness", get: (c) =>
      c.completeness_status && c.completeness_status !== "unassessed"
        ? humanize(c.completeness_status) : null },
  { key: "rating",     label: "Student rating",    get: (c) => {
      const r = ratingDisplay(Number(c.average_rating), Number(c.ratings_count ?? 0));
      if (!r) return null;
      return r.kind === "scored" ? `${r.score.toFixed(1)} (${r.count} ratings)` : r.text;
    } },
  { key: "updated",    label: "Last checked",      get: (c) =>
      c.last_verified_at ? new Date(c.last_verified_at).toLocaleDateString() : null },
];

/**
 * "Best for", from CURATED METADATA ONLY.
 *
 * Every clause below restates a field a human explicitly set. Nothing is
 * derived. Two claims were removed from an earlier version:
 *
 *   * "JEE Advanced depth" from difficulty === 'advanced' — difficulty is not
 *     an exam mapping.
 *   * "thorough coverage" from a lecture count >= 20 — a long playlist can be
 *     twenty superficial videos, and a short one can be complete. Coverage is
 *     a separate curated field; when it is absent we say nothing.
 *
 * A course with no curated metadata gets no claim, not a flattering guess.
 */
export function bestFor(course) {
  return typeof course.best_for === "string" && course.best_for.trim()
    ? course.best_for.trim() : null;
}

/** Rows where at least one course has a value. Requirement: hide all-Unknown rows. */
export function visibleAttributes(rows) {
  return ATTRIBUTES.filter((a) => rows.some((c) => a.get(c) != null));
}

// ---------------------------------------------------------------- page
export default function Compare() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { t, dark } = useTheme();
  const { ids, overflow } = parseCompareIds(params.get("ids"));
  const chapterRaw = Number(params.get("chapter"));
  const chapterId = Number.isInteger(chapterRaw) && chapterRaw > 0 ? chapterRaw : null;
  const goalRaw = Number(params.get("goal"));
  const learningGoalId = Number.isInteger(goalRaw) && goalRaw > 0 ? goalRaw : null;

  const { rows, notFound, wrongChapter, loading, error, reload } =
    useComparison(ids, chapterId, learningGoalId);

  // Back must land on the exact filtered catalogue the student came from.
  // history.back() preserves the query string AND the scroll position, which a
  // fresh navigate("/browse") would discard.
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/browse"));
  const chooseAnother = () =>
    navigate(chapterId ? `/browse?ch=${chapterId}` : "/browse");

  const crumbs = [{ label: "Browse courses", to: "/browse" }, { label: "Compare" }];

  const Frame = ({ children }) => (
    <Page crumbs={crumbs}>
      <button
        onClick={back}
        className={`mb-4 flex min-h-11 items-center gap-1 text-sm ${t.muted} ${t.hover}`}
      >
        <ArrowLeft className="h-4 w-4" /> Back to results
      </button>
      <h1 className={`text-xl font-semibold ${t.text}`}>Compare courses</h1>
      {children}
    </Page>
  );

  const Notice = ({ title, detail, action = true }) => (
    <div className={`mt-6 rounded-2xl border border-dashed ${t.border} ${t.card} p-8 text-center`}>
      <p className={`text-sm font-semibold ${t.text}`}>{title}</p>
      {detail && <p className={`mt-1 text-sm ${t.muted}`}>{detail}</p>}
      {action && (
        <button
          onClick={chooseAnother}
          className={`mt-4 min-h-11 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover}`}
        >
          Choose another course
        </button>
      )}
    </div>
  );

  // A comparison without a chapter is not scoped to anything comparable.
  if (!chapterId)
    return (
      <Frame>
        <Notice
          title="Comparison needs a chapter."
          detail="Open a chapter, pick two to four courses that teach it, then compare."
        />
      </Frame>
    );

  if (error) return (
    <Frame>
      <Notice title={error} detail="Your selection and filters are unchanged." action={false} />
      <button
        onClick={reload}
        className={`mt-3 min-h-11 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover}`}
      >
        Try again
      </button>
    </Frame>
  );
  if (loading) return <Frame><div className={`mt-6 h-72 animate-pulse rounded-2xl ${t.card}`} /></Frame>;

  if (ids.length < MIN_COMPARE)
    return (
      <Frame>
        <Notice
          title={`Pick at least ${MIN_COMPARE} courses to compare.`}
          detail={`Choose up to ${MAX_COMPARE} courses that teach this chapter.`}
        />
      </Frame>
    );

  // Everything that went wrong with the requested ids, stated plainly.
  const problems = [];
  if (notFound.length)
    problems.push(`${notFound.length} course${notFound.length === 1 ? " is" : "s are"} no longer available`);
  if (wrongChapter.length)
    problems.push(`${wrongChapter.length} course${wrongChapter.length === 1 ? " does" : "s do"} not teach this chapter`);

  // THE VALIDATION GATE. Applied to what actually RESOLVED, so a stale or
  // cross-chapter id can never soften it into a one-column table.
  if (rows.length < MIN_COMPARE)
    return (
      <Frame>
        <Notice
          title="This comparison is out of date."
          detail={
            (problems.length ? problems.join(", ") + ". " : "") +
            (rows.length === 1
              ? "Only one course is left, and one course is not a comparison."
              : "None of the selected courses are available for this chapter.")
          }
        />
      </Frame>
    );

  return (
    <Frame>
      {(problems.length > 0 || overflow) && (
        <div className={`mt-3 flex gap-2 rounded-xl p-3 text-sm ${dark ? "bg-amber-950/40 text-amber-100" : "bg-amber-50 text-amber-900"}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <p>
            {problems.join(", ")}
            {problems.length ? ` — showing the remaining ${rows.length}.` : ""}
            {overflow && ` Only the first ${MAX_COMPARE} courses can be compared at once.`}
          </p>
        </div>
      )}
      <ComparisonTable rows={rows} />
    </Frame>
  );
}

function ComparisonTable({ rows }) {
  const { t, dark } = useTheme();
  // Only rows where at least one course has data. A row that reads
  // "Unknown | Unknown | Unknown" tells the student nothing and makes the
  // whole product look broken.
  const attrs = visibleAttributes(rows);

  // Highlight rows where the courses actually DIFFER. No winner is declared —
  // "shorter" is better for one student and worse for another.
  const differing = new Set(
    attrs.filter((a) => new Set(rows.map((c) => a.get(c) ?? "\u0000")).size > 1).map((a) => a.key)
  );

  const anyBestFor = rows.some((c) => bestFor(c) != null);

  return (
    // The table scrolls horizontally rather than shrinking text: four columns
    // squeezed into 360px would be unreadable, which defeats the purpose.
    // Flagged as an intentional scroller so the UI audit does not have to
    // guess (and so nothing ELSE gets excused by sitting inside it).
    <div className="mt-6 overflow-x-auto" data-allow-horizontal-scroll="true">
      <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className={`sticky left-0 z-10 p-3 text-left align-bottom text-xs font-medium ${t.page} ${t.muted}`}>
              Attribute
            </th>
            {rows.map((c) => (
              <th key={c.playlist_id} className={`min-w-[11rem] rounded-t-xl border border-b-0 ${t.border} ${t.card} p-3 text-left align-bottom`}>
                <span className={`line-clamp-2 font-semibold ${t.text}`}>{c.title}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attrs.map((a) => (
            <tr key={a.key}>
              <th
                scope="row"
                className={`sticky left-0 z-10 p-3 text-left text-xs font-medium ${t.page} ${
                  differing.has(a.key) ? t.text : t.muted
                }`}
              >
                {a.label}
              </th>
              {rows.map((c) => {
                const v = a.get(c);
                return (
                  <td
                    key={c.playlist_id}
                    className={`border-x ${t.border} p-3 align-top ${
                      differing.has(a.key)
                        ? dark ? "bg-amber-950/25 text-neutral-100" : "bg-amber-50/40 text-slate-800"
                        : t.faint
                    }`}
                  >
                    {v ?? <span className={t.muted}>Unknown</span>}
                  </td>
                );
              })}
            </tr>
          ))}
          {anyBestFor && (
            <tr>
              <th scope="row" className={`sticky left-0 z-10 rounded-bl-xl p-3 text-left text-xs font-medium ${t.page} ${t.text}`}>
                Best for
              </th>
              {rows.map((c) => {
                const b = bestFor(c);
                return (
                  <td key={c.playlist_id} className={`rounded-b-xl border-x border-b ${t.border} ${t.card} ${t.faint} p-3 align-top`}>
                    {b ?? <span className={t.muted}>Not enough information</span>}
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
