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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router";
import {
  SlidersHorizontal, X, AlertTriangle,
} from "lucide-react";
import { usePlaylistBrowse, PAGE_SIZE } from "./usePlaylistBrowse.js";
import {
  lectureSortOptions, DEFAULT_LECTURE_SORT, LECTURE_SORT_PARAM, parseLectureSort,
} from "./useBrowse.js";
import { MIN_COMPARE, MAX_COMPARE, SORTS, DEFAULT_SORT } from "./filterModel.js";
import { clearAllChips, dropParam, emptyStateMessage } from "./filterChips.js";
import { FILTER_PARAMS } from "./filterSchema.js";
import { makeReturnState } from "./returnTo.js";
import { useTheme } from "./theme.jsx";
import { useStructuredData, useChapterMetadata } from "./PageMetadata.jsx";
import { itemListSchema } from "./structuredData.js";
import { useRatingsAvailability } from "./useRatingsAvailability.js";
import { usePopularityAvailability } from "./usePopularityAvailability.js";
// The empty-state title names the chapter or subject that emptied the list —
// catalogue text, sometimes Devanagari, under a document that declares
// lang="en". See lang.js.
import { langAttrs } from "./lang.js";
// The ONE course card lives in its own module now (PlaylistCard.jsx), so the
// homepage can share it without pulling this whole page into its bundle.
// ratingDisplay's home is ratingConfidence.js — import it from there.
import { PlaylistCard } from "./PlaylistCard.jsx";

// Two is the minimum that is a comparison at all; beyond four the columns stop
// being readable on a phone, which is where the comparison matters most.
// (MIN_COMPARE / MAX_COMPARE come from filterModel.js — see the import
// above. They are NOT redeclared here: the tray must never offer a selection
// the comparison page would then reject.)

function SkeletonCard() {
  const { t } = useTheme();
  return (
    <div className={`animate-pulse overflow-hidden rounded-xl border ${t.border} ${t.card}`}>
      <div className={`aspect-video w-full ${t.input}`} />
      <div className="p-5">
        <div className={`h-3 w-16 rounded ${t.input}`} />
        <div className={`mt-3 h-5 w-3/4 rounded ${t.input}`} />
        <div className={`mt-2 h-4 w-1/2 rounded ${t.input}`} />
        <div className={`mt-6 h-4 w-2/3 rounded ${t.input}`} />
        <div className={`mt-8 h-11 w-full rounded-xl ${t.input}`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- page
export default function PlaylistBrowse({
  tab, onTabChange, filters, lectureView, lectureTotal = null, lectureLoading = false,
  comparisonEnabled = true, mobileSearch = null, onResetFilters = null,
  chapterName = null,
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { t } = useTheme();
  // Router location, NOT window.location: under MemoryRouter (and during any
  // client-side navigation) window.location lags behind the router.
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const ratingsAvailable = useRatingsAvailability();
  const popularityAvailable = usePopularityAvailability();
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

  // A sort that cannot change the order is worse than not offering it: the
  // student picks "Most viewed", nothing moves, and the control reads as broken.
  // Three sorts are data-dependent -- "Highest rated" (ratings), "Most popular"
  // (popularity_score) and "Most viewed" (view_count_total) -- and each is
  // suppressed only once the catalogue POSITIVELY confirms its column is empty.
  // "unknown" (the check hasn't resolved, or failed) keeps every control.
  const unavailableSorts = useMemo(() => {
    const dead = new Set();
    if (ratingsAvailable === false) dead.add("rating");
    if (popularityAvailable && popularityAvailable.popular === false) dead.add("popular");
    if (popularityAvailable && popularityAvailable.views === false) dead.add("most_viewed");
    return dead;
  }, [ratingsAvailable, popularityAvailable]);

  // Sort is a view preference in the URL (?sort=). Validated against SORTS so a
  // junk value falls back to the default rather than producing an empty order.
  const sortRaw = params.get("sort");
  const sortUnavailable = unavailableSorts.has(sortRaw);
  const sort = !sortUnavailable && SORTS.some((s) => s.id === sortRaw)
    ? sortRaw
    : DEFAULT_SORT;
  const sortOptions = useMemo(
    () => SORTS.filter((option) => !unavailableSorts.has(option.id)),
    [unavailableSorts],
  );
  const setSort = useCallback((value, { replace = false } = {}) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== DEFAULT_SORT) next.set("sort", value); else next.delete("sort");
      next.delete("page"); // reordering invalidates the current page offset
      return next;
    }, { replace }), [setParams]);

  // A shared URL may still carry ?sort=most_viewed (or rating/popular) from
  // before that data existed. Remove the now-meaningless preference once the
  // catalogue confirms the column is empty, keeping URL, control and database
  // ordering in agreement.
  //
  // REPLACE, not push: this is automatic cleanup the student never asked for.
  // Pushing trapped the Back button -- going back to the stale-sort URL re-ran
  // this effect and immediately pushed /browse again, so they could never get
  // past it. A sort the student picks themselves still pushes, so they can undo it.
  useEffect(() => {
    if (sortUnavailable) setSort(DEFAULT_SORT, { replace: true });
  }, [sortUnavailable, setSort]);

  // The lectures tab has its own sort key (?lsort=) and its own, smaller
  // vocabulary — only orderings videos columns can back (see LECTURE_SORTS in
  // useBrowse.js). Validation is shared with BrowsePage's useVideos call via
  // parseLectureSort, so the control and the query cannot disagree.
  const lectureSort = parseLectureSort(params);
  const setLectureSort = (value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== DEFAULT_LECTURE_SORT) next.set(LECTURE_SORT_PARAM, value);
      else next.delete(LECTURE_SORT_PARAM);
      next.delete("page"); // reordering invalidates the current page offset
      return next;
    });

  const { items, total, loading, error, hasMore, reload } = usePlaylistBrowse({
    // goalId was the defect: accepted by the hook, never supplied by the page.
    goalId: filters.goal, subjectId: filters.subject,
    boardId: filters.board, stage: filters.stage,
    chapterClassSlugs: filters.chapterClassSlugs,
    // Do not run the course query behind the Individual lectures tab. At
    // library scale both tabs querying at once doubles work for no user value.
    enabled: filters.enabled !== false && tab === "playlists",
    channelId: filters.channelId, language: filters.language,
    contentType: filters.contentType, difficulty: filters.difficulty,
    teacherId: filters.teacherId,
    chapterId: filters.chapter, search: filters.search, sort, page,
  });

  // A chapter view is the one indexable filtered shape, and the shared rule
  // defaults it to noindex because a URL cannot prove the chapter exists. This
  // is the only place on the client that holds the confirmed count, so this is
  // where the head is re-stated — otherwise RouteMetadata's URL-derived pass
  // would overwrite the edge's good head and every real chapter page would ask
  // not to be indexed on the render Google actually judges.
  useChapterMetadata({
    chapterName,
    courseCount: total,
    ready: Boolean(filters.chapter) && !loading && !error,
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
  const courseUrl = (course) =>
    filters.chapter ? `/course/${course.id}/chapter/${filters.chapter}` : `/course/${course.id}`;
  const courseReturnState = makeReturnState(location.pathname, location.search);

  // ItemList for the currently visible page of COURSE cards (the lecture-tab
  // view has no card-per-course identity worth marking up). Position folds in
  // the real pagination offset so page 2 reads 21-40, not 1-20 again — never
  // just the on-screen index. Nothing to describe on loading/error/empty, so
  // those states pass an empty list and the hook clears any prior markup.
  const canListCourses = tab === "playlists" && !loading && !error && items.length > 0;
  useStructuredData(
    canListCourses
      ? [
          itemListSchema(
            items.map((course, index) => ({
              title: course.title,
              url: courseUrl(course), // the exact href the card's own Link uses
              position: page * PAGE_SIZE + index + 1,
            })),
          ),
        ]
      : [],
    [canListCourses, items, page, filters.chapter],
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
        <div className="flex items-center gap-2">
          {/* Each tab gets the sort its own data can honour: ?sort= drives the
              Playlists list (usePlaylistBrowse), ?lsort= drives the lectures
              list (useVideos). Separate keys, separate vocabularies — a
              playlists sort must never silently mean something else here. */}
          {tab === "playlists" && (
            <label className="flex items-center gap-2 text-sm">
              <span className={`hidden sm:inline ${t.muted}`}>Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort courses"
                className={`min-h-11 rounded-xl border ${t.border} ${t.card} ${t.text} px-3 text-sm`}
              >
                {sortOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          )}
          {tab === "lectures" && (
            <label className="flex items-center gap-2 text-sm">
              <span className={`hidden sm:inline ${t.muted}`}>Sort</span>
              <select
                value={lectureSort}
                onChange={(e) => setLectureSort(e.target.value)}
                aria-label="Sort lessons"
                className={`min-h-11 rounded-xl border ${t.border} ${t.card} ${t.text} px-3 text-sm`}
              >
                {/* While a search is active the default option is relevance,
                    so it says "Best match" instead of "Recommended". Same id,
                    same ?lsort= — the word is the only thing that moves. */}
                {lectureSortOptions(filters.search).map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          )}
          <button
            ref={filterButtonRef}
            onClick={() => setSheetOpen(true)}
            className={`sticky top-[6.25rem] z-30 flex min-h-11 items-center gap-1.5 rounded-xl border ${t.border} ${t.card} ${t.text} px-3 text-sm sm:top-16 lg:hidden`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
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
                className="mt-4 min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:brightness-110"
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
              {/* A mixed string is tagged as a whole (lang.js); the detail line
                  is fixed English and stays under the document's own lang. */}
              <p {...langAttrs(emptyTitle)} className={`text-sm font-semibold ${t.text}`}>{emptyTitle}</p>
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
                  className="min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:brightness-110"
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((c) => (
                  <PlaylistCard key={c.id} course={c}
                    to={courseUrl(c)} state={courseReturnState}
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
        <div className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 border-t border-hairline p-3 shadow-e3">
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
              className="ml-auto flex min-h-11 items-center gap-1 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />
          <div ref={sheetRef} className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-surface p-4 text-ink shadow-e3">
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
                className="min-h-11 flex-1 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:brightness-110"
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
