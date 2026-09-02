// =====================================================================
//  Dashboard.jsx  —  Systematic Educational Video Directory
//  React + Tailwind CSS.  Beginner-friendly, split into small pieces.
//
//  HOW IT'S ORGANISED (read top to bottom):
//    1. VideoCard      -> one card in the grid; a link to the watch page.
//    2. SearchBar      -> the top search box.
//    3. Dashboard      -> puts everything together (this is exported).
//
//  REMOVED: VideoModal, a second bare-iframe player that opened here. It
//  recorded no progress, so a lesson watched in it earned no Continue
//  watching entry, no streak day and no watched tick, and it offered none of
//  the lesson sequence, notes, materials, rating or report controls. Every
//  lecture already has a real home at /course/:playlistId?v=:youtubeVideoId,
//  so the cards link there instead of playing in place.
// =====================================================================

import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { useCanonicalFilters } from "./useCanonicalFilters.js";
import { applyFilterChange, buildChips, removeChip, clearAllChips } from "./filterChips.js";
import { filterByKey } from "./filterSchema.js";
import FilterPanel from "./FilterPanel.jsx";
import { useFilterOptions } from "./useFilterOptions.js";
import { useBrowseFacets } from "./useBrowseFacets.js";
import { useGoalCatalog } from "./useExplore.js";
import { parseFilterParams, normalizeFilterParams } from "./filterParams.js";
import {
  Search, X, Play, AlertTriangle,
} from "lucide-react";
import { useVideos, useDebouncedValue, LECTURE_PAGE_SIZE, parseLectureSort } from "./useBrowse.js";
import { useChapterName } from "./useChapterName.js";
import { GlobalHeader, MAIN_CONTENT_ID } from "./AppShell.jsx";
import PlaylistBrowse from "./PlaylistBrowse.jsx";
import { FacultyFilter } from "./FacultyFilter.jsx";
import { useTheme } from "./theme.jsx";
import { RELEASE_CAPABILITIES } from "./releaseCapabilities.js";
// Lesson titles, chapter names and the scope heading are catalogue text, and
// this catalogue writes plenty of it in Devanagari under a document that
// declares lang="en". See lang.js.
import { langAttrs } from "./lang.js";
import { BRAND_TEAL } from "./brandColors.js";
import YouTubeThumbnail from "./YouTubeThumbnail.jsx";
import ChannelAvatar from "./ChannelAvatar.jsx";


// ---------------------------------------------------------------------
// 1. VIDEO CARD
// ---------------------------------------------------------------------
// The card is a LINK, not a player. The watch page is where progress is
// recorded, so opening a lesson from here counts towards Continue watching,
// the streak and the watched ticks — and arrives with the lesson sequence,
// notes, materials and the rating/report controls beside it.
//
// ?v= selects the lesson on that page and takes the YouTube id, not the row
// id (see how CourseVideoPage matches lesson.videoId).
export function watchHref(video) {
  return video?.playlistId
    ? `/course/${video.playlistId}?v=${encodeURIComponent(video.youtubeVideoId)}`
    : null;
}

export function VideoCard({ video }) {
  const { t } = useTheme();
  const href = watchHref(video);

  return (
    <div className={`group flex flex-col overflow-hidden rounded-xl border ${t.border} ${t.card} shadow-sm transition hover:shadow-md`}>
      {/* Thumbnail (click to open the lesson) */}
      {href ? (
        <Link
          to={href}
          aria-label={`Watch ${video.title}`}
          className="relative block aspect-video w-full overflow-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <YouTubeThumbnail
            videoId={video.youtubeVideoId}
            alt={video.title}
            className="h-full w-full"
            imageClassName="transition duration-300 group-hover:scale-105"
          />
          {/* Play overlay on hover */}
          <span
            className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100"
            style={{ backgroundColor: "rgba(15,23,42,0.35)" }}
          >
            <Play className="h-12 w-12 text-white" fill="white" />
          </span>
        </Link>
      ) : (
        <div className="relative block aspect-video w-full overflow-hidden">
          <YouTubeThumbnail
            videoId={video.youtubeVideoId}
            alt={video.title}
            className="h-full w-full"
          />
        </div>
      )}

      {/* Text + button */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {video.instituteId ? (
          <Link
            to={`/browse?channel=${video.instituteId}`}
            aria-label={`View all courses from ${video.institute}`}
            className="inline-flex w-fit items-center gap-1.5 rounded-sm text-xs font-medium text-accent transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ChannelAvatar
              url={video.instituteLogoUrl}
              name={video.institute}
              className="h-6 w-6"
            />
            {video.institute}
          </Link>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <ChannelAvatar
              url={video.instituteLogoUrl}
              name={video.institute}
              className="h-6 w-6"
            />
            {video.institute}
          </div>
        )}

        <h3
          {...langAttrs(video.title)}
          className={`line-clamp-2 font-semibold leading-snug ${t.text}`}
        >
          {video.title}
        </h3>

        {/* Subject and chapter are both catalogue text and read as one line, so
            the tag goes on the <p> rather than splitting it into spans — the
            same call lang.js documents for a mixed string. */}
        <p
          {...langAttrs(`${video.subject ?? ""} ${video.chapter ?? ""}`)}
          className={`text-xs ${t.muted}`}
        >
          {video.subject} · {video.chapter}
        </p>

        {href ? (
          <Link
            to={href}
            className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Play className="h-4 w-4" fill="currentColor" />
            Watch Lesson
          </Link>
        ) : (
          // No course contains this lesson, so there is no page that can play
          // it and record the progress. Say that instead of offering a button
          // that leads nowhere.
          <p className={`mt-auto text-xs ${t.muted}`}>
            This lesson isn’t part of a course yet, so there’s no lesson page to open.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// 2. SEARCH BAR
// ---------------------------------------------------------------------
function SearchBar({ value, onChange, ariaLabel = "Search courses and lessons" }) {
  const { t } = useTheme();
  return (
    <form
      role="search"
      className="relative w-full"
      // The list filters live as you type; Enter/Go just closes the keyboard.
      onSubmit={(e) => {
        e.preventDefault();
        e.currentTarget.querySelector("input")?.blur();
      }}
    >
      <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.muted}`} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        placeholder="Search courses and lessons…"
        className={`w-full min-h-11 min-w-0 rounded-lg border ${t.border} ${t.input} ${t.text} py-2 pl-9 pr-11 text-sm outline-none transition focus:ring-2 focus:ring-accent`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={`absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded ${t.muted} ${t.hover}`}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------
// 3. DASHBOARD  — the main component (this is what you export/use)
// ---------------------------------------------------------------------
// A stable skeleton that matches VideoCard's shape, so the layout doesn't
// jump when the real cards arrive.
// ---------------------------------------------------------------------
function SkeletonCard() {
  const { t } = useTheme();
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border ${t.border} ${t.card}`}>
      <div className={`aspect-video w-full animate-pulse ${t.input}`} />
      <div className="flex flex-col gap-3 p-4">
        <div className={`h-3 w-24 animate-pulse rounded ${t.input}`} />
        <div className={`h-4 w-full animate-pulse rounded ${t.input}`} />
        <div className={`h-4 w-2/3 animate-pulse rounded ${t.input}`} />
        <div className={`mt-2 h-9 w-full animate-pulse rounded-lg ${t.input}`} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// LANGUAGE, VISIBLE ON /browse ITSELF AT PHONE WIDTH
// ---------------------------------------------------------------------
// FilterPanel already promotes language out of the checkbox list and leads with
// it as a chip row. On a desktop that row is on screen the moment /browse
// loads, in the sidebar. On a phone the same panel lives inside the Filters
// bottom sheet, so the row is one tap away behind a button — and a student who
// does not know a language filter exists has no reason to make that tap. The
// Hindi-medium student it was promoted for is precisely the student who never
// finds out.
//
// So the row is surfaced here too, beside the active-filter chips, and hidden
// from lg up where the sidebar's copy is already showing.
//
// THIS IS NOT A SECOND FILTER MODEL. The values come from filterSchema (remove
// language from AVAILABLE and this row disappears with it), the click writes
// through the SAME applyFilterChange as the panel, and the URL parameter is
// unchanged — so this row, the sheet's row, the removable chips below and the
// catalogue query cannot disagree about what is selected.
function BrowseLanguageChips({ params, counts, countsLoading, countsExact = true, onChange }) {
  const { t } = useTheme();
  const filter = filterByKey("language");
  if (!filter) return null;

  const selected = (params.get(filter.param) ?? "").split(",").filter(Boolean);
  // The honest-filters rule, applied exactly as FilterPanel applies it: once
  // the contextual counts have settled, a language this view has no courses in
  // is not offered at all. A chip at the top of the results reads as "what this
  // catalogue has", so a dead end here is a worse lie than one buried in a
  // panel. An already-selected value survives so a shared or stale URL can
  // still be cleared.
  const known = !countsLoading && counts?.language ? counts.language : null;
  const options = filter.options
    .map((option) => ({ value: option.id, label: option.label }))
    .filter((option) => (
      known == null
      || selected.includes(String(option.value))
      || Number(known[String(option.value)] ?? 0) > 0
    ));
  if (options.length === 0) return null;

  return (
    <section aria-labelledby="browse-language-heading" className="mb-4 lg:hidden">
      <h2 id="browse-language-heading" className={`text-xs font-medium ${t.muted}`}>
        {filter.label}
      </h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(String(option.value));
          // On a board or teacher view the counts are an upper bound (see the
          // useBrowseFacets call below): fine for dropping a zero, wrong to
          // print as a figure. No number, rather than a number that may be high.
          const count = known == null || !countsExact
            ? null
            : Number(known[String(option.value)] ?? 0);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(applyFilterChange(params, filter, option.value))}
              aria-pressed={active}
              aria-label={count == null
                ? undefined
                : `${option.label}, ${count} course${count === 1 ? "" : "s"}`}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition ${
                active
                  ? "border-transparent font-medium text-white"
                  : `${t.border} ${t.card} ${t.faint} ${t.hover}`
              }`}
              style={active ? { backgroundColor: BRAND_TEAL } : undefined}
            >
              {option.label}
              {count != null && (
                <span
                  className={`tabular-nums ${active ? "text-white/80" : t.muted}`}
                  aria-hidden="true"
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Browse is fully URL-driven: learning-goal/subject/chapter ids and the search
// term live in the query string (?goal=1&sub=1&ch=2&q=...), so any filtered
// view is shareable and survives a refresh. No props — the component reads
// the URL itself and fetches from Supabase.
//
// The top level is a LEARNING GOAL, not a category: the sidebar tree and the
// results list are both built from video_learning_goals, so they cannot
// disagree about which lessons belong where.
// ---------------------------------------------------------------------
export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const { t, dark } = useTheme();

  // The canonical URL is slug-based:
  //   /browse?goal=jee&class=11&subject=physics&chapter=kinematics
  // Legacy id links (?goal=3&sub=5&ch=7) still resolve, so old bookmarks and
  // the guided journey's hand-off land on IDENTICAL results — that equivalence
  // is the whole point of having one result system.
  const canonical = useCanonicalFilters(params);

  // Validate enum/id values BEFORE they reach a query. An unknown value is
  // dropped and reported, never forwarded: forwarding it would either error in
  // PostgREST or be ignored, silently widening the result set.
  const validated = parseFilterParams(params);
  const [facultyCapability, setFacultyCapability] = useState("loading");
  const teacherRequested = validated.teacherId;
  const facultyFilterReady = !teacherRequested || facultyCapability === "available";
  const teacherId = facultyCapability === "available" ? teacherRequested : null;

  // Rewrite the URL once when it carries junk, duplicates, or the legacy
  // `institute=` key, so what is shared afterwards is canonical. `replace` so
  // this never becomes a history entry the Back button trips over, and the
  // null-check stops it looping.
  useEffect(() => {
    const normalized = normalizeFilterParams(params);
    if (normalized) setParams(normalized, { replace: true });
  }, [params, setParams]);
  const category = canonical.goalId != null ? String(canonical.goalId) : null;
  const subject = canonical.subjectId != null ? String(canonical.subjectId) : null;
  const chapter = canonical.chapterId != null ? String(canonical.chapterId) : null;
  const urlQuery = params.get("q") ?? "";

  const tab = params.get("tab") === "lectures" ? "lectures" : "playlists";  // playlists by default
  // Lectures-tab sort (?lsort=). Validated in ONE place (useBrowse.js) so this
  // page and the select in PlaylistBrowse cannot disagree about what is valid.
  const lectureSort = parseLectureSort(params);
  const setTab = (t) => setParams((prev) => { const n = new URLSearchParams(prev); if (t === "lectures") n.set("tab", t); else n.delete("tab"); n.delete("page"); return n; });
  const page = Math.max(0, Number(params.get("page") ?? 0) || 0);
  const setPage = (p) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (p > 0) next.set("page", String(p)); else next.delete("page");
    return next;
  });

  // Search: type into a local box, debounce, THEN push into the URL, so the
  // database query (and the shareable link) only update once typing settles.
  const [searchInput, setSearchInput] = useState(urlQuery);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  // Back/Forward and URL-backed Reset can change `q` without typing in the
  // input. Keep the controlled field aligned so a stale debounced value cannot
  // silently put a cleared search back into the URL.
  useEffect(() => {
    setSearchInput(urlQuery);
  }, [urlQuery]);
  useEffect(() => {
    const wanted = debouncedSearch.trim();
    // Reset, Clear, and browser navigation can change the field before the
    // previous debounced value expires. Never write that obsolete value back
    // into the URL.
    if (searchInput.trim() !== wanted) return;

    const current = params.get("q") ?? "";
    // DO NOTHING when the URL already says this. On mount both are "", and
    // writing anyway pushed a snapshot of the params taken BEFORE the
    // normalisation effect ran — silently reverting `institute=`→`channel=`
    // and re-introducing invalid enum values. An effect that rewrites the URL
    // to its current value is never harmless; it is a lost update waiting to
    // happen.
    if (wanted === current) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (wanted) next.set("q", wanted); else next.delete("q");
        next.delete("page");
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, searchInput, params]);

  // The inactive tab sends no catalogue request. At library scale a student
  // viewing courses must not also download lectures in the background.
  const { videos, total: lectureTotal, loading, error, hasMore, reload } = useVideos({
    goalId: category,
    subjectId: subject,
    chapterId: chapter,
    chapterClassSlugs: canonical.chapterClassSlugs,
    stage: canonical.stage,
    channelId: validated.channelId,
    language: validated.language,
    contentType: validated.contentType,
    difficulty: validated.difficulty,
    teacherId,
    search: urlQuery,
    sort: lectureSort,
    page,
    enabled: canonical.ready && facultyFilterReady && tab === "lectures",
  });

  const clearAll = () => {
    setSearchInput("");
    setParams(clearAllChips(params), { replace: false });
  };

  // Dimension rows are bounded by curriculum, unlike a tree rebuilt from the
  // growing video junction. They also label legacy numeric bookmarks.
  const filterOptions = useFilterOptions({ subjectId: canonical.subjectId });
  const optionValue = (key, raw) => {
    if (!raw) return null;
    return filterOptions.options?.[key]?.find(
      (option) => String(option.value) === String(raw) || String(option.id) === String(raw),
    )?.value ?? (Number.isInteger(Number(raw)) ? null : raw);
  };
  const optionName = (key, raw) => {
    if (!raw) return null;
    return filterOptions.options?.[key]?.find(
      (o) => String(o.value) === String(raw) || String(o.id) === String(raw),
    )?.label ?? canonical.names?.[key]?.[raw] ?? null;
  };
  const goalRaw = params.get("goal");
  const subjectRaw = params.get("subject") ?? params.get("sub");
  const chapterRaw = params.get("chapter") ?? params.get("ch");
  const goalValue = optionValue("goal", goalRaw);
  const subjectValue = optionValue("subject", subjectRaw);
  // On a board or teacher view the facet counts are only an upper bound (the
  // v9 count RPC has no such argument), so they prune but are never shown. Keep the chapter picker honest in
  // that state by reusing the bounded curriculum RPC that powers Explore. It
  // applies the selected exam/class scope and never downloads the catalogue.
  const chapterCatalog = useGoalCatalog({
    goal: canonical.ready ? goalValue : null,
    stage: canonical.stage,
    subject: canonical.ready ? subjectValue : null,
  });
  const shouldScopeChapters = Boolean(canonical.ready && goalValue && subjectValue);
  const scopedSubject = chapterCatalog.subjects.find((row) => row.slug === subjectValue);
  // null means "no scope known -- do not filter" (FilterPanel's documented
  // contract); [] means "scope known, and it is empty". Emitting [] while the
  // curriculum RPC is still loading -- or after it ERRORED -- made FilterPanel
  // strip every chapter option and drop the whole Chapter section, so a slow or
  // failed lookup was indistinguishable from "this subject has no chapters",
  // with no error and no retry. Only claim an empty scope once we actually know.
  const chapterScopeValues = shouldScopeChapters && chapterCatalog.ready && scopedSubject
    ? (chapterCatalog.chaptersBySubject[scopedSubject.id] ?? []).map((row) => row.slug)
    : null;
  const goalName = optionName("goal", goalRaw);
  const subjectName = optionName("subject", subjectRaw);
  // Search results deep-link chapters as /browse?ch=<id> (the search RPC
  // returns no slugs), and neither the slug resolver nor the subject-scoped
  // chapter list can label a bare id — the chip read "27" and the heading
  // stayed "All courses". Look the name up by primary key instead, only when
  // no other source already knows it; an unresolved name still falls back to
  // the raw value below rather than a guess.
  const resolvedChapterName = optionName("chapter", chapterRaw);
  const legacyChapterName = useChapterName(canonical.chapterId, {
    enabled: chapterRaw != null && resolvedChapterName == null,
  });
  const chapterName = resolvedChapterName ?? legacyChapterName;
  const facetCounts = useBrowseFacets({
    goal: goalValue,
    stage: canonical.stage,
    subject: subjectValue,
    chapter: optionValue("chapter", chapterRaw),
    channelId: validated.channelId,
    language: validated.language,
    contentType: validated.contentType,
    difficulty: validated.difficulty,
    search: urlQuery,
    // v9 has no teacher/board argument, so on those views its numbers ignore
    // part of the student's question. That makes them an UPPER BOUND: adding
    // the missing predicate can only shrink a count, never grow it, so a zero
    // here is a zero for the student too. The counts are therefore still
    // fetched on board and teacher views and used to drop certain dead ends -
    // but never DISPLAYED there (countsExact below), because a positive number
    // might be too high. Before this the counts were simply switched off, which
    // is how school offered Class 11 and Class 12 with no courses and no zero
    // to warn anyone.
    //
    // Search counts ARE shown: browse_facet_search_2026-08-25.sql upgraded the
    // facet RPC's p_search to match with the same engine as the result list
    // (search_playlist_ids), so the sidebar counts now agree with the results.
    // If that migration is not yet deployed the RPC still answers (its own
    // matcher), so counts never error here.
    enabled: canonical.ready && !filterOptions.loading && !filterOptions.error,
  });
  // Exact when every active filter reached the RPC; an upper bound otherwise.
  const countsExact = !teacherRequested && !canonical.board;
  const searchTerm = urlQuery.trim();
  const scopeHeading = chapterName ?? subjectName ?? goalName ?? null;
  const heading = searchTerm
    ? `Search results for “${searchTerm}”${scopeHeading ? ` in ${scopeHeading}` : ""}`
    : scopeHeading ?? (tab === "playlists" ? "All courses" : "All lessons");

  // Chip labels come from the tree we already resolved, keyed by whatever the
  // URL actually holds (slug OR legacy id) so both forms render a real name.
  // Anything unresolved falls back to the raw value rather than a guess.
  // Slug -> display name comes from the resolver, which already fetched these
  // rows; the curriculum tree carries ids only. Legacy id-based URLs are
  // labelled from the tree instead. Anything unresolved falls back to the raw
  // value — a chip must never assert a name we could not look up.
  const chipNames = {
    goal: { ...(canonical.names?.goal ?? {}), ...(goalName ? { [goalRaw]: goalName } : {}) },
    subject: { ...(canonical.names?.subject ?? {}), ...(subjectName ? { [subjectRaw]: subjectName } : {}) },
    chapter: { ...(canonical.names?.chapter ?? {}), ...(chapterName ? { [chapterRaw]: chapterName } : {}) },
    board: { ...(canonical.names?.board ?? {}) },
    // Same dead-end as the chapter chip, same cure: an institute search result
    // lands on /browse?channel=<id>, and without a name the chip read "3".
    // The channel dimension list is already fetched for the filter panel.
    channel: Object.fromEntries(
      (filterOptions.options?.channel ?? []).map((o) => [String(o.value), o.label]),
    ),
  };
  const chips = buildChips(params, chipNames);

  // One "are the counts still settling?" answer, shared by the panel and the
  // mobile language row, so the two cannot apply the honest-filters rule at
  // different moments and offer different languages.
  const countsLoading = facetCounts.loading || (shouldScopeChapters && chapterCatalog.loading);

  // ONE FilterPanel, rendered in two places (desktop column + mobile sheet).
  // Both read and write the same URLSearchParams, so they cannot disagree —
  // there is no second copy of the option lists or the cascade to drift.
  const filterPanel = (variant) => (
    <FilterPanel
      variant={variant}
      options={filterOptions.options}
      loading={filterOptions.loading}
      error={filterOptions.error}
      onRetry={filterOptions.retry}
      counts={facetCounts.counts}
      countsLoading={countsLoading}
      countsExact={countsExact}
      chapterScopeValues={chapterScopeValues}
      params={params}
      onChange={(next) => setParams(next)}
    />
  );


  const anyFilter = category || subject || chapter || teacherRequested || urlQuery;

  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      {/* ---------- HEADER ---------- */}
      <GlobalHeader
        search={<SearchBar value={searchInput} onChange={setSearchInput} />}
      />

      {/* ---------- BODY: sidebar + grid ---------- */}
      <div className="flex">
        {/* desktop sidebar */}
        {/* Sticky so filters stay reachable while the results scroll. */}
        <aside className={`hidden w-64 shrink-0 border-r ${t.border} ${t.card} lg:block`}>
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {filterPanel("sidebar")}
          </div>
        </aside>

        {/* main content */}
        <main id={MAIN_CONTENT_ID} className="flex-1 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            {/* The heading names the chapter or subject in view, so it carries
                catalogue text — and on a Devanagari chapter it is the first
                thing a screen reader reaches on this page. */}
            <h1 {...langAttrs(heading)} className={`text-lg font-semibold ${t.text}`}>{heading}</h1>
            {/* The video count describes the LECTURES tab only. On Playlists it
                would contradict the course count PlaylistBrowse renders. */}
            {tab === "lectures" && !loading && !error && (
              <span className={`text-sm ${t.muted}`}>
                {lectureTotal ?? videos.length} lesson{(lectureTotal ?? videos.length) === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {/* Active filters, directly under the heading. URL-backed: each × is
              a navigation, so Back undoes it and a shared link carries it.
              Same markup on desktop and mobile — the row wraps rather than
              collapsing into a menu, so a phone user can see and remove every
              filter narrowing their results. */}
          {/* An unresolved slug is neither an error nor an empty result: the
              URL asked for something specific that does not exist. Say which,
              and offer to remove it — the catalogue query is held back until
              it is resolved or dropped, so this is the only way forward. */}
          {canonical.unresolved?.length > 0 && (
            <div className={`mb-4 rounded-xl border p-4 text-sm ${dark ? "border-amber-900 bg-amber-950/40 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <p className="font-medium">
                {canonical.unresolved.map((u) => `“${u.slug}”`).join(", ")}{" "}
                {canonical.unresolved.length === 1 ? "is not a" : "are not"}{" "}
                {canonical.unresolved.length === 1 ? canonical.unresolved[0].key : "valid filter"} we know about.
              </p>
              <p className="mt-1">This link may be out of date. Results are not shown for a filter we can’t resolve.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {canonical.unresolved.map((u) => (
                  <button
                    key={u.key}
                    onClick={() => setParams(removeChip(params, u.key))}
                    className={`min-h-11 rounded-xl border ${dark ? "border-amber-800" : "border-amber-300"} ${t.card} px-4 text-sm font-medium`}
                  >
                    Remove {u.key} filter
                  </button>
                ))}
                <button
                  onClick={() => setParams(clearAllChips(params))}
                  className={`min-h-11 rounded-xl border ${dark ? "border-amber-800" : "border-amber-300"} ${t.card} px-4 text-sm font-medium`}
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}

          {/* A failed lookup is different again: we could not find out. */}
          {canonical.error && (
            <div className={`mb-4 rounded-xl border ${t.border} ${t.card} p-4 text-sm`}>
              <p className={`font-medium ${t.text}`}>{canonical.error}</p>
              <button
                onClick={canonical.retry}
                className={`mt-3 min-h-11 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover}`}
              >
                Try again
              </button>
            </div>
          )}

          <BrowseLanguageChips
            params={params}
            counts={facetCounts.counts}
            countsLoading={countsLoading}
            countsExact={countsExact}
            onChange={(next) => setParams(next)}
          />

          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button
                  key={`${c.key}-${c.value}`}
                  onClick={() => setParams(removeChip(params, c.key, c.value))}
                  aria-label={`Remove filter ${c.label}`}
                  // The tag goes on the button, not on a span around the visible
                  // label: aria-label wins over the contents, so the announced
                  // name is what needs the language, and only the element
                  // carrying that name can supply it.
                  {...langAttrs(c.label)}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border ${t.border} ${t.card} ${t.text} ${t.cardHover} px-3 text-sm transition`}
                >
                  {c.label}
                  <X className={`h-3.5 w-3.5 ${t.muted}`} />
                </button>
              ))}
              {chips.length > 1 && (
                <button
                  onClick={() => setParams(clearAllChips(params))}
                  className={`min-h-11 px-2 text-sm ${t.muted} underline`}
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {RELEASE_CAPABILITIES.facultyRegistry && (
            <FacultyFilter
              params={params}
              setParams={setParams}
              scope={{
                goalId: canonical.goalId,
                subjectId: canonical.subjectId,
                chapterId: canonical.chapterId,
              }}
              onAvailabilityChange={setFacultyCapability}
            />
          )}

          {teacherRequested && facultyCapability !== "available" && facultyCapability !== "loading" && (
            <div className={`mt-3 rounded-xl border p-4 text-sm ${dark ? "border-amber-900 bg-amber-950/40 text-amber-100" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <p className="font-medium">This faculty filter cannot be verified on the current database.</p>
              <p className="mt-1">Results are held back rather than silently showing courses from every teacher.</p>
              <button
                onClick={() => setParams(removeChip(params, "teacher"))}
                className="mt-2 min-h-11 font-medium underline"
              >
                Remove faculty filter
              </button>
            </div>
          )}

          {/* REMOVED: a "Compare courses for {chapter} — see every teacher side
              by side" banner that linked to /chapter/:id. The chapter hub is a
              grid of cards, not a comparison; the promise was never kept. Real
              comparison now lives in the Compare checkbox on each course card
              below, which builds /compare?ids=… — an actual attribute table. */}

          <PlaylistBrowse
            tab={tab}
            onTabChange={setTab}
            comparisonEnabled={RELEASE_CAPABILITIES.comparison}
            mobileSearch={
              <SearchBar
                value={searchInput}
                onChange={setSearchInput}
                ariaLabel="Search catalogue"
              />
            }
            onResetFilters={clearAll}
            filters={{ goal: category, board: canonical.boardId, stage: canonical.stage,
                       subject, chapter, chapterClassSlugs: canonical.chapterClassSlugs,
                       search: urlQuery, sheetContent: filterPanel("sheet"),
                       // Validated, de-duplicated, bounded. Never the raw URL.
                       channelId: validated.channelId,
                       language: validated.language,
                       contentType: validated.contentType,
                       difficulty: validated.difficulty,
                       // THE GATE. No catalogue request until every slug in the
                       // URL has resolved to an id — otherwise the first
                       // request carries no chapter predicate and briefly shows
                       // the whole library under a filtered heading.
                       enabled: canonical.ready && facultyFilterReady,
                       teacherId,
                       chapterName, subjectName }}
            lectureTotal={lectureTotal}
            lectureLoading={loading}
            lectureView={<>
          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : error ? (
            <div className={`rounded-xl border border-dashed ${t.border} ${t.card} p-12 text-center`}>
              <AlertTriangle className="mx-auto h-5 w-5 text-amber-500" />
              <p className={`font-medium ${t.text}`}>We couldn't load lessons.</p>
              <p className={`mt-1 text-sm ${t.muted}`}>
                Please check your connection and try again.
              </p>
              <button
                onClick={reload}
                className="mt-4 min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:brightness-110"
              >
                Retry
              </button>
            </div>
          ) : videos.length === 0 ? (
            <div className={`rounded-xl border border-dashed ${t.border} ${t.card} p-12 text-center`}>
              <p className={`font-medium ${t.text}`}>
                {anyFilter
                  ? "No lessons match your filters."
                  : "No lessons have been added yet."}
              </p>
              {anyFilter && (
                <button
                  onClick={clearAll}
                  className="mt-2 text-sm font-medium text-accent"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {videos.map((v) => (
                  <VideoCard key={v.id} video={v} />
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
                    {lectureTotal != null
                      ? ` of ${Math.max(1, Math.ceil(lectureTotal / LECTURE_PAGE_SIZE))}`
                      : ""}
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
            </>}
          />
        </main>
      </div>

      {/* ---------- MOBILE SIDEBAR DRAWER ---------- */}
    </div>
  );
}
