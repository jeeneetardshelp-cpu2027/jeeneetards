// usePlaylistBrowse.js — paged playlist listing for the catalogue.
//
// The old catalogue fetched every video (VIDEO_LIMIT 200) and rendered 40 raw
// YouTube thumbnails. This fetches PLAYLISTS, a page at a time, with the
// metadata a student actually decides on.
//
// Nothing is invented. A field the database does not have comes back null and
// the card says so ("Not yet rated", "Coverage not assessed") rather than
// showing a plausible-looking zero.

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { chapterScopeStageDecision, classSlugsForStage } from "./classLevels.js";
export { classSlugsForStage } from "./classLevels.js";

export const PAGE_SIZE = 12;

// One row -> the shape the card renders. Explicit nulls, never defaults.
function toCard(row) {
  const lectures = row.playlist_videos?.[0]?.count ?? null;
  const ratings = Number(row.ratings_count ?? 0);
  return {
    id: row.id,
    title: row.title,                       // curated title — dominates the card
    teacher: row.teacher ?? null,           // LEGACY free text. Not a resolved identity.
    instituteId: row.institutes_channels?.id ?? null,
    institute: row.institutes_channels?.name ?? null,
    instituteLogoUrl: row.institutes_channels?.logo_url ?? null,
    subject: row.subjects?.name ?? null,
    lectures,
    coverVideoId: row.cover?.[0]?.videos?.youtube_video_id ?? null,
    // NOTE: total duration is NOT a column on playlists — it is computed inside
    // get_chapter_courses(). Rather than invent a number here, it stays null and
    // the card omits the field. A database-side aggregate view is the correct
    // fix and is on the follow-up list.
    durationSeconds: null,
    language: row.language ?? null,
    contentType: row.content_type ?? null,
    difficulty: row.difficulty ?? null,
    classLevels: row.class_levels ?? [],
    rating: ratings > 0 ? Number(row.average_rating) : null,
    ratingCount: ratings,
    // Popularity rollups (maintained by refreshVideoStats.js). Null until the
    // stats job has run, so the card shows nothing rather than a fake "0 views".
    viewCountTotal: row.view_count_total != null && Number(row.view_count_total) > 0
      ? Number(row.view_count_total) : null,
    statsFetchedAt: row.stats_fetched_at ?? null,
    // no coverage column exists yet — the card must say "not assessed", not 0%
    coverage: null,
  };
}

/**
 * Which class_levels.slug values satisfy a chosen stage.
 *
 * Dropper is a SUPERSET: a dropper revises both years, so 11th and 12th
 * material counts. Class 11 and Class 12 are exact — Class 11 must never pick
 * up Class-12-only content. classLevels.js owns this rule for in-memory
 * checks; this is the same rule expressed as the set the DATABASE filters on,
 * and classFilter.test.js asserts the two agree.
 */
// Maps a SORTS id (filterModel.js) to its Supabase .order() chain. Every chain
// is followed by .order("id") in the caller so paging stays deterministic when
// the primary keys tie. "popular"/"most_viewed" read the video_stats rollups
// on playlists (popularity_score / view_count_total); an unknown id falls back
// to "recommended". See DESIGN_popularity_sort.md §4.
const ORDER_BY = {
  recommended: (q) => q.order("display_order").order("popularity_score", { ascending: false }).order("title"),
  popular: (q) => q.order("popularity_score", { ascending: false }),
  most_viewed: (q) => q.order("view_count_total", { ascending: false }),
  rating: (q) => q.order("average_rating", { ascending: false }).order("ratings_count", { ascending: false }),
  recent: (q) => q.order("created_at", { ascending: false }),
};

// Older/disposable environments can legitimately predate video_stats.sql.
// Browsing should still work there: popularity is optional catalogue metadata,
// not a reason to hide every course. Production keeps the one-request path
// above; this ordering is used only when Postgres reports a missing rollup.
const ORDER_WITHOUT_STATS = {
  ...ORDER_BY,
  recommended: (q) => q.order("display_order").order("title"),
  popular: (q) => q.order("display_order").order("title"),
  most_viewed: (q) => q.order("display_order").order("title"),
};

const OPTIONAL_STATS_COLUMN = /\b(view_count_total|popularity_score|stats_fetched_at)\b/i;
export const isMissingBrowseStatsColumn = (error) =>
  ["42703", "PGRST204"].includes(error?.code) &&
  OPTIONAL_STATS_COLUMN.test(error?.message ?? "");

export function usePlaylistBrowse({
  goalId, boardId, subjectId, chapterId, stage, channelId, teacherId,
  chapterClassSlugs = null,
  language, contentType, difficulty, search, sort, page = 0,
  // GATE. When false, no request is issued at all and the hook reports
  // loading. The caller sets this from useCanonicalFilters().ready, so a URL
  // carrying slugs cannot fire a catalogue query before those slugs are ids.
  //
  // The generation guard below would discard the early response, but it
  // cannot un-send the request — and for the moment before the real one
  // returns, an unfiltered result set is on screen under a filtered heading.
  // Not querying at all is the only correct behaviour.
  enabled = true,
}) {
  const [state, setState] = useState({
    items: [], total: null, loading: true, error: null, hasMore: false,
  });
  const languageKey = JSON.stringify(language ?? []);
  const contentTypeKey = JSON.stringify(contentType ?? []);
  const difficultyKey = JSON.stringify(difficulty ?? []);
  const chapterClassKey = JSON.stringify(chapterClassSlugs);

  // Discards obsolete responses. Filters resolve asynchronously (a slug has to
  // become an id), so this hook runs once with no chapter and again with one.
  // Without a generation guard the FIRST, unfiltered response can land last
  // and overwrite the filtered one — which is exactly what made /browse?ch=1
  // show all 7 courses while the correct 5-course request had already
  // returned. Same class of bug as a search box showing results for a prefix.
  const generation = useRef(0);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    const current = () => gen === generation.current;
    const reviewedChapterClasses = JSON.parse(chapterClassKey);
    const chapterStage = chapterId
      ? chapterScopeStageDecision(reviewedChapterClasses, stage)
      : "fallback";
    if (chapterStage === "mismatch") {
      setState({ items: [], total: 0, loading: false, error: null, hasMore: false });
      return;
    }
    const classSlugs = chapterStage === "match" ? null : classSlugsForStage(stage);
    const languageValues = JSON.parse(languageKey);
    const contentTypeValues = JSON.parse(contentTypeKey);
    const difficultyValues = JSON.parse(difficultyKey);
    if (!enabled) {
      // Hold the skeleton rather than showing a stale or unfiltered list.
      setState({ items: [], total: null, loading: true, error: null, hasMore: false });
      return;
    }
    if (!isSupabaseConfigured) {
      setState({ items: [], total: null, loading: false, error: "Supabase isn't configured.", hasMore: false });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));

    // Every filter runs IN THE DATABASE and the page is fetched with range().
    // The previous version pulled every playlist_videos row for a chapter into
    // the browser, deduped it, then passed the whole id list back as .in(...) —
    // unbounded work that grows with the catalogue.
    //
    // Inner joins are added ONLY when their filter is active: making them
    // unconditional would silently drop playlists that have no goal tag or no
    // videos from the unfiltered view.
    const cols =
      "id, title, display_order, teacher, average_rating, ratings_count, language, content_type," +
      " difficulty, class_levels, view_count_total, stats_fetched_at, institutes_channels(id, name, logo_url), subjects(name)," +
      " playlist_videos(count), cover:playlist_videos(id, position, videos(youtube_video_id))" +
      (goalId ? ", playlist_learning_goals!inner(learning_goal_id)" : "") +
      // Board scoping lives in the QUERY, not in a post-filter. CBSE and ICSE
      // must never bleed into each other, and filtering after paging would
      // silently drop rows from an already-truncated page.
      (boardId ? ", playlist_boards!inner(board_id)" : "") +
      // CLASS runs in the database too, through the playlist_class_levels
      // junction — an indexed, importer-maintained store, not the denormalised
      // playlists.class_levels[] label array.
      //
      // The !inner join is what makes "untagged matches nothing" true for free:
      // a playlist with no junction row cannot satisfy an inner join, so it
      // drops out before LIMIT/OFFSET and before count. Filtering a fetched
      // page in React would give both a wrong count and a short page.
      (classSlugs ? ", pcl:playlist_class_levels!inner(class_levels!inner(slug))" : "") +
      // Faculty filtering is course-scoped and happens before range()/count.
      // It is included only when teachers_v7 capability has been confirmed.
      (teacherId ? ", pt:playlist_teachers!inner(teacher_id)" : "") +
      (chapterId ? ", pv:playlist_videos!inner(videos!inner(chapter_id))" : "");

    // The sort the student chose (?sort=) selects the ordering. "recommended"
    // still leads with curated display_order (new courses default to 1,000,000,
    // so they stay after deliberately placed rows). Every chain ends with a
    // unique .order("id") so paging is deterministic even when earlier keys tie.
    const buildQuery = (includeStats) => {
      const selectedColumns = includeStats
        ? cols
        : cols.replace(" view_count_total, stats_fetched_at,", "");
      const orderMap = includeStats ? ORDER_BY : ORDER_WITHOUT_STATS;
      const applyOrder = orderMap[sort] ?? orderMap.recommended;
      let q = applyOrder(supabase.from("playlists").select(selectedColumns, { count: "exact" }))
        .order("id")
        // One representative image per course, chosen deterministically from
        // the first lesson. The nested range prevents a 100-lesson course from
        // turning the browse page into a large thumbnail payload.
        .order("position", { ascending: true, referencedTable: "cover" })
        .order("id", { ascending: true, referencedTable: "cover" })
        .range(0, 0, { referencedTable: "cover" })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      // Learning goal was accepted as a prop and never applied, so a JEE view
      // also listed NEET courses. Goal isolation is the point of the journey.
      if (goalId) q = q.eq("playlist_learning_goals.learning_goal_id", goalId);
      if (boardId) q = q.eq("playlist_boards.board_id", boardId);
      if (classSlugs) q = q.in("pcl.class_levels.slug", classSlugs);
      if (subjectId) q = q.eq("subject_id", subjectId);
      // Scalar columns on playlists — no join needed, so these cost nothing extra.
      // Multi-select uses .in(); a single value still goes through .in() so the
      // AND-of-ORs shape is identical whether one or three values are chosen.
      if (channelId) q = q.eq("channel_id", channelId);
      if (teacherId) q = q.eq("pt.teacher_id", teacherId);
      if (languageValues.length) q = q.in("language", languageValues);
      if (contentTypeValues.length) q = q.in("content_type", contentTypeValues);
      if (difficultyValues.length) q = q.in("difficulty", difficultyValues);
      if (chapterId) q = q.eq("pv.videos.chapter_id", chapterId);
      const term = (search ?? "").trim();
      if (term) q = q.ilike("title", `%${term}%`);

      return q;
    };

    let result = await buildQuery(true);
    if (!current()) return;
    if (isMissingBrowseStatsColumn(result.error)) {
      result = await buildQuery(false);
    }
    const { data, error, count } = result;
    if (!current()) return;                    // a newer query has superseded this one
    if (error) {
      // PostgREST answers a range past the end of the result set with 416
      // "Requested range not satisfiable" rather than an empty page. A stale
      // ?page=99 in a shared URL is a normal thing for a student to hit, and it
      // must read as an empty page, not as a failure. (Found by running the
      // real query against staging — the mocked builder could not surface it.)
      const outOfRange = error.code === "PGRST103" || /range not satisfiable/i.test(error.message || "");
      if (outOfRange) {
        setState({ items: [], total: count ?? null, loading: false, error: null, hasMore: false });
        return;
      }
      console.error("playlist browse:", error);
      setState({ items: [], total: null, loading: false, error: "Couldn't load courses.", hasMore: false });
      return;
    }
    const items = (data ?? []).map(toCard);
    setState({
      items, total: count ?? null, loading: false, error: null,
      hasMore: count != null ? (page + 1) * PAGE_SIZE < count : items.length === PAGE_SIZE,
    });
  }, [enabled, goalId, boardId, subjectId, chapterId, stage, channelId, teacherId,
      chapterClassKey,
      languageKey, contentTypeKey, difficultyKey,
      search, sort, page]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

// "1h 40m" / "45m". Returns null when unknown so the caller can omit the field
// entirely rather than printing "0m".
// Rounds to whole minutes before splitting -- see the note on the copy in
// src/metadata.js. Splitting first prints "6h 60m".
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
