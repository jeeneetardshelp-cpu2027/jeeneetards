// PlaylistBrowse.jsx — the playlist-first catalogue.
//
// Replaces a wall of 40 raw YouTube thumbnails with courses a student can
// actually choose between. Two rules run through every line here:
//
//   1. The CURATED title dominates. Raw YouTube titles ("#7 Examples on motion
//      under gravity | Kinematics | IIT advanced | JEE main | ...") live inside
//      the playlist, never in the catalogue.
//   2. Nothing is invented. Missing rating -> "Not yet rated". Unknown duration
//      -> the field is omitted entirely. Unknown coverage -> "Coverage not
//      assessed". A legacy free-text teacher is shown as a plain name and is
//      NOT presented as a resolved faculty identity.

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router";
import {
  Star, Clock, Layers, Building2, SlidersHorizontal, X, AlertTriangle,
} from "lucide-react";
import { usePlaylistBrowse, formatDuration, PAGE_SIZE } from "./usePlaylistBrowse.js";
import { COURSE_TYPES, DIFFICULTIES, MIN_COMPARE, MAX_COMPARE } from "./filterModel.js";
import { clearAllChips, dropParam, emptyStateMessage } from "./filterChips.js";
import { FILTER_PARAMS } from "./filterSchema.js";
import { makeReturnState } from "./returnTo.js";
import { ratingDisplay, RATING_CONFIDENCE_MIN } from "./ratingConfidence.js";
import { useTheme } from "./theme.jsx";

// Labels come from the canonical filter vocabulary — a second copy here would
// drift, and the card would say "Advanced" while the filter said something else.
const COURSE_TYPE_LABEL = Object.fromEntries(COURSE_TYPES.map((c) => [c.id, c.label]));
const DIFFICULTY_LABEL = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d.label]));

const BRAND = { navy: "#142A4F", teal: "#13919B" };
// Two is the minimum that is a comparison at all; beyond four the columns stop
// being readable on a phone, which is where the comparison matters most.
// (MIN_COMPARE / MAX_COMPARE now come from filterModel.js — see the import
// above. They are NOT redeclared here: the tray must never offer a selection
// the comparison page would then reject.)

// Kept as re-exports for existing callers. The pure implementation is shared
// with course, comparison, and faculty views so those screens cannot drift.
export { ratingDisplay, RATING_CONFIDENCE_MIN };

// ---------------------------------------------------------------- card
function PlaylistCard({ course, onOpen, selected, onToggle, disabled, comparisonEnabled = true }) {
  const { t } = useTheme();
  const duration = formatDuration(course.durationSeconds);
  const rating = ratingDisplay(course.rating, course.ratingCount);

  // Present facts only. Anything unknown is simply absent — repeating
  // "Teacher not recorded / Coverage not assessed / Not yet rated" on every
  // card made the whole catalogue read as broken (rule 2).
  const facts = [
    course.lectures != null && { icon: Layers, text: `${course.lectures} lecture${course.lectures === 1 ? "" : "s"}` },
    duration && { icon: Clock, text: duration },
    course.language && { text: cap(course.language) },
    course.contentType && { text: COURSE_TYPE_LABEL[course.contentType] ?? course.contentType },
    course.difficulty && { text: DIFFICULTY_LABEL[course.difficulty] ?? course.difficulty },
    course.coverage != null && { text: `${course.coverage}% coverage` },
  ].filter(Boolean);

  // One quiet indicator instead of three apologies. Counted on the fields a
  // student actually decides with.
  const missing = [
    course.teacher == null, course.durationSeconds == null,
    course.coverage == null, course.contentType == null, course.difficulty == null,
  ].filter(Boolean).length;
  const limited = missing >= 3;

  return (
    <div className={`flex h-full min-h-[15rem] flex-col rounded-2xl border ${t.border} ${t.card} ${t.cardHover} p-4 transition hover:shadow-sm sm:p-5`}>
      {course.classLevels?.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {course.classLevels.map((c) => (
            <span key={c} className={`rounded-full border ${t.border} px-2 py-0.5 text-[11px] ${t.faint}`}>
              {c}
            </span>
          ))}
        </div>
      )}

      {/* curated title leads; clamped so every card is the same shape */}
      <h3 className={`line-clamp-2 text-base font-semibold leading-snug ${t.text}`}>
        {course.title}
      </h3>

      {/* Faculty and institute on one line. Omitted when unknown — an absent
          line reads as "no data", a placeholder reads as "broken product". */}
      {(course.teacher || course.institute) && (
        <p className={`mt-1 line-clamp-1 flex items-center gap-1 text-sm ${t.faint}`}>
          {course.teacher}
          {course.teacher && course.institute && <span className={t.muted}>·</span>}
          {course.institute && (
            <span className={`inline-flex items-center gap-1 ${t.muted}`}>
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{course.institute}</span>
            </span>
          )}
        </p>
      )}

      <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${t.faint}`}>
        {facts.map((f, i) => (
          <span key={i} className="flex items-center gap-1">
            {f.icon && <f.icon className="h-3.5 w-3.5 shrink-0" />}
            {f.text}
          </span>
        ))}
      </div>

      {(rating || limited) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {rating?.kind === "scored" && (
            <span className={`flex items-center gap-1 font-medium ${t.text}`}>
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {rating.score.toFixed(1)}
              <span className={`font-normal ${t.muted}`}>({rating.count})</span>
            </span>
          )}
          {/* neutral, unranked, no star — it is a count, not a score */}
          {rating?.kind === "low" && <span className={t.muted}>{rating.text}</span>}
          {limited && <span className={t.muted}>Limited metadata</span>}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-4">
        <button
          onClick={() => onOpen(course)}
          className="flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: BRAND.teal }}
        >
          View course
        </button>
        {comparisonEnabled && (
          <label
            className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs ${
              selected ? "border-slate-700 bg-slate-800 text-white" : `${t.border} ${t.faint}`
            } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
          >
            <input type="checkbox" className="sr-only" checked={selected} disabled={disabled}
                   onChange={() => onToggle(course)} />
            Compare
          </label>
        )}
      </div>
    </div>
  );
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function SkeletonCard() {
  const { t } = useTheme();
  return (
    <div className={`h-64 animate-pulse rounded-2xl border ${t.border} ${t.card} p-5`}>
      <div className={`h-3 w-16 rounded ${t.input}`} />
      <div className={`mt-3 h-5 w-3/4 rounded ${t.input}`} />
      <div className={`mt-2 h-4 w-1/2 rounded ${t.input}`} />
      <div className={`mt-6 h-4 w-2/3 rounded ${t.input}`} />
      <div className={`mt-8 h-11 w-full rounded-xl ${t.input}`} />
    </div>
  );
}

// ---------------------------------------------------------------- page
export default function PlaylistBrowse({
  tab, onTabChange, filters, lectureView, lectureTotal = null, lectureLoading = false,
  comparisonEnabled = true, mobileSearch = null, onResetFilters = null,
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { t, dark } = useTheme();
  // Router location, NOT window.location: under MemoryRouter (and during any
  // client-side navigation) window.location lags behind the router.
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const filterButtonRef = useRef(null);
  const sheetRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!sheetOpen) return;
    const bodyOverflow = document.body.style.overflow;
    const returnFocusTarget = filterButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSheetOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = [...sheetRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = bodyOverflow;
      returnFocusTarget?.focus();
    };
  }, [sheetOpen]);

  const page = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const setPage = (p) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p > 0) next.set("page", String(p)); else next.delete("page");
      return next;
    });

  const { items, total, loading, error, hasMore, reload } = usePlaylistBrowse({
    // goalId was the defect: accepted by the hook, never supplied by the page.
    goalId: filters.goal, subjectId: filters.subject,
    boardId: filters.board, stage: filters.stage,
    // Do not run the course query behind the Individual lectures tab. At
    // library scale both tabs querying at once doubles work for no user value.
    enabled: filters.enabled !== false && tab === "playlists",
    channelId: filters.channelId, language: filters.language,
    contentType: filters.contentType, difficulty: filters.difficulty,
    teacherId: filters.teacherId,
    chapterId: filters.chapter, search: filters.search, page,
  });

  // Selection lives in ?compare= so a comparison is shareable and survives a
  // refresh. Capped at MAX_COMPARE; the tray appears from MIN_COMPARE.
  // Counted from the URL, so the sticky button, the chips and both panels
  // can never disagree about how many filters are on.
  const activeFilterCount = FILTER_PARAMS.filter((k) => params.get(k)).length;

  const { title: emptyTitle, detail: emptyDetail } = emptyStateMessage({
    stage: filters.stage, chapterName: filters.chapterName, subjectName: filters.subjectName,
  });

  const compareIds = comparisonEnabled
    ? (params.get("compare") ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const toggleCompare = (course) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      const cur = (next.get("compare") ?? "").split(",").map(Number).filter(Boolean);
      const updated = cur.includes(course.id)
        ? cur.filter((x) => x !== course.id)
        : [...cur, course.id].slice(0, MAX_COMPARE);
      if (updated.length) next.set("compare", updated.join(",")); else next.delete("compare");
      return next;
    });

  // OLD NOTE (kept for history): A checkbox that leads to a
  // dead button is a worse experience than no checkbox: it invites a student to
  // build a selection and then refuses to honour it. The controls come back
  // when /compare exists. Selection state is deliberately not kept meanwhile.

  // Chapter 0 does not exist. The catalogue is browsable without a chapter
  // selected, so link to the chapterless course route rather than inventing an
  // id that would 404 or silently mis-scope the "back to chapter" action.
  // Stamp an explicit marker carrying the FULL Browse URL. The course page
  // trusts Back only when it sees this; without it a shared link would send a
  // student out of the app.
  const openCourse = (course) =>
    navigate(
      filters.chapter ? `/course/${course.id}/chapter/${filters.chapter}` : `/course/${course.id}`,
      { state: makeReturnState(location.pathname, location.search) },
    );

  return (
    <>
      {/* ---- tabs: playlists lead, lectures are secondary ---- */}
      <div className={`flex items-center gap-1 border-b ${t.border}`}>
        {[["playlists", "Playlists"], ["lectures", "Individual lectures"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            aria-current={tab === id ? "page" : undefined}
            className={`-mb-px min-h-11 border-b-2 px-3 text-sm transition ${
              tab === id
                ? `border-current font-semibold ${t.text}`
                : `border-transparent ${t.muted} ${t.hover}`
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* The Filters control sits ABOVE the tab split, so both Playlists and
          Individual lectures reach the same panel. It used to live inside the
          playlists branch, which is why the lectures tab needed a separate
          legacy curriculum drawer — two filter interaction models for one set
          of filters. */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className={`text-sm ${t.muted}`}>
          {tab === "lectures" ? "" :
            loading ? "Loading courses…"
              : total != null ? `${total} course${total === 1 ? "" : "s"}`
              : `${items.length} courses`}
        </p>
        <button
          ref={filterButtonRef}
          onClick={() => setSheetOpen(true)}
          className={`sticky top-[6.25rem] z-30 flex min-h-11 items-center gap-1.5 rounded-xl border ${t.border} ${t.card} ${t.text} px-3 text-sm sm:top-16 lg:hidden`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
      </div>

      {tab === "lectures" ? (
        <div className="mt-5">{lectureView}</div>
      ) : (
        <>
          {error ? (
            // A failed request is not an empty catalogue. It gets its own
            // state with a real Retry that re-runs the SAME query — the URL
            // and every filter are untouched, so retrying cannot silently
            // widen what the student asked for.
            <div className={`mt-8 rounded-2xl border ${t.border} ${t.card} p-8 text-center`}>
              <AlertTriangle className="mx-auto h-5 w-5 text-amber-500" />
              <p className={`mt-2 text-sm font-semibold ${t.text}`}>Couldn’t load courses</p>
              <p className={`mt-1 text-sm ${t.muted}`}>{error}</p>
              <button
                onClick={reload}
                className="mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold text-white"
                style={{ backgroundColor: BRAND.teal }}
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : items.length === 0 ? (
            // "0 courses" alone reads as a broken page. Name the filter that
            // actually emptied the list and offer the ways out — WITHOUT
            // widening the query: unclassified courses stay excluded, because
            // the student asked for a class and we do not know these match it.
            <div className={`mt-8 rounded-2xl border border-dashed ${t.border} ${t.card} p-8 text-center`}>
              <p className={`text-sm font-semibold ${t.text}`}>{emptyTitle}</p>
              <p className={`mt-1 text-sm ${t.muted}`}>{emptyDetail}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {filters.stage && (
                  <button
                    onClick={() => setParams(dropParam(params, ["class", "stage"]))}
                    className={`min-h-11 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover}`}
                  >
                    View all classes
                  </button>
                )}
                {filters.chapter && (
                  <button
                    onClick={() => setParams(dropParam(params, ["chapter", "ch"]))}
                    className={`min-h-11 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover}`}
                  >
                    Choose another chapter
                  </button>
                )}
                <button
                  onClick={() => setParams(clearAllChips(params))}
                  className="min-h-11 rounded-xl px-4 text-sm font-medium text-white"
                  style={{ backgroundColor: BRAND.teal }}
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((c) => (
                  <PlaylistCard key={c.id} course={c} onOpen={openCourse}
                    selected={compareIds.includes(c.id)}
                    disabled={!compareIds.includes(c.id) && compareIds.length >= MAX_COMPARE}
                    onToggle={toggleCompare}
                    comparisonEnabled={comparisonEnabled} />
                ))}
              </div>

              {(page > 0 || hasMore) && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                    className={`min-h-11 rounded-xl border ${t.border} px-4 text-sm ${t.hover} disabled:opacity-40`}
                  >
                    Previous
                  </button>
                  <span className={`text-sm ${t.muted}`}>
                    Page {page + 1}
                    {total != null ? ` of ${Math.max(1, Math.ceil(total / PAGE_SIZE))}` : ""}
                  </span>
                  <button
                    disabled={!hasMore}
                    onClick={() => setPage(page + 1)}
                    className={`min-h-11 rounded-xl border ${t.border} px-4 text-sm ${t.hover} disabled:opacity-40`}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ---- sticky comparison tray: desktop AND mobile ---- */}
      {comparisonEnabled && compareIds.length > 0 && (
        <div className={`fixed inset-x-0 bottom-0 z-40 border-t ${t.border} ${dark ? "bg-neutral-950/95" : "bg-white/95"} p-3 backdrop-blur`}>
          <div className="mx-auto flex w-full max-w-[1280px] items-center gap-3 px-1">
            <span className={`text-sm ${t.text}`}>
              <span className="font-medium">{compareIds.length}</span> selected
              {/* Comparison is chapter-scoped. Without a chapter there is no
                  shared subject matter, so the selection cannot be compared —
                  say so here rather than letting /compare refuse it later. */}
              {!filters.chapter ? (
                <span className={t.muted}> · open a chapter to compare</span>
              ) : compareIds.length < MIN_COMPARE ? (
                <span className={t.muted}> · pick {MIN_COMPARE - compareIds.length} more</span>
              ) : null}
            </span>
            <button
              onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.delete("compare"); return n; })}
              className={`min-h-11 text-xs ${t.muted} underline`}
            >
              Clear
            </button>
            <button
              disabled={compareIds.length < MIN_COMPARE || !filters.chapter}
              onClick={() => {
                const comparison = new URLSearchParams({
                  chapter: String(filters.chapter),
                  ids: compareIds.join(","),
                });
                // Coverage only has meaning inside an exam/learning-goal
                // syllabus. Carry the resolved id rather than making the
                // comparison page infer it from a label or slug.
                if (filters.goal) comparison.set("goal", String(filters.goal));
                navigate(`/compare?${comparison}`, {
                  state: makeReturnState(location.pathname, location.search),
                });
              }}
              className="ml-auto flex min-h-11 items-center gap-1 rounded-xl px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: BRAND.navy }}
            >
              Compare {compareIds.length}
            </button>
          </div>
        </div>
      )}

      {/* ---- mobile filter bottom sheet ---- */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title">
          <button
            type="button"
            aria-label="Dismiss filter dialog"
            tabIndex={-1}
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setSheetOpen(false)}
          />
          <div ref={sheetRef} className={`absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl ${t.card} ${t.text} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 id="mobile-filter-title" className={`text-sm font-semibold ${t.text}`}>Filters</h2>
              <button ref={closeButtonRef} onClick={() => setSheetOpen(false)} aria-label="Close filters" className={`flex h-11 w-11 items-center justify-center rounded-lg ${t.hover}`}>
                <X className={`h-5 w-5 ${t.muted}`} />
              </button>
            </div>
            {mobileSearch && (
              <div className="mb-4">
                <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${t.muted}`}>
                  Search
                </p>
                {mobileSearch}
              </div>
            )}
            {filters.sheetContent}
            {/* Reset and Show sit together: the sheet stays open while the
                student adjusts filters (selections are URL-backed, so the
                results behind update live), and Show is the deliberate exit. */}
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => {
                  if (onResetFilters) onResetFilters();
                  else setParams(clearAllChips(params));
                }}
                disabled={activeFilterCount === 0}
                className={`min-h-11 shrink-0 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.text} ${t.hover} disabled:opacity-40`}
              >
                Reset
              </button>
              <button
                onClick={() => setSheetOpen(false)}
                className="min-h-11 flex-1 rounded-xl px-4 text-sm font-semibold text-white"
                style={{ backgroundColor: BRAND.teal }}
              >
                {tab === "lectures"
                  ? lectureLoading
                    ? "Show lessons"
                    : `Show ${lectureTotal ?? 0} lesson${(lectureTotal ?? 0) === 1 ? "" : "s"}`
                  : loading
                    ? "Show courses"
                    : `Show ${total ?? items.length} course${(total ?? items.length) === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
