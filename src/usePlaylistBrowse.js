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
import { isMissingCatalogRpc } from "./useExplore.js";
export { classSlugsForStage } from "./classLevels.js";

export const PAGE_SIZE = 12;

// One row -> the shape the card renders. Explicit nulls, never defaults.
function toCard(row) {
  // When the browse is chapter-scoped, `pv` holds the SAME playlist_videos rows
  // narrowed to that chapter by the inner join, so its LENGTH is how many
  // lectures this course actually has ON this chapter. `playlist_videos(count)`
  // is the whole-course total, and measured against production it overstated
  // 73% of chapter cards, median 9x -- a card read "30 lectures" and then opened
  // a 2-lesson list, because CourseVideoPage scopes correctly and the card did
  // not. The scoped number is the one the student is deciding with, so it wins
  // whenever it is present.
  const chapterRows = Array.isArray(row.pv) ? row.pv : null;
  const lectures = chapterRows
    ? chapterRows.length
    : (row.playlist_videos?.[0]?.count ?? null);
  // Those same rows carry duration, so a chapter-scoped card can total it
  // honestly instead of falling back to the null below.
  const chapterSeconds = chapterRows
    ? chapterRows.reduce((sum, r) => sum + (Number(r.videos?.duration_seconds) || 0), 0)
    : 0;
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
    // True when `lectures` counts one chapter rather than the whole course, so
    // the card can say "on this chapter" instead of implying a course total.
    chapterScoped: chapterRows != null,
    coverVideoId: row.cover?.[0]?.videos?.youtube_video_id ?? null,
    // Whole-course duration is still NOT a column on playlists (it is computed
    // inside get_chapter_courses()), so an unscoped card omits it rather than
    // inventing one. A chapter-scoped card CAN total it honestly, from rows the
    // inner join already returned.
    durationSeconds: chapterSeconds > 0 ? chapterSeconds : null,
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
  // Rows per request. Defaults to the browse page's PAGE_SIZE; the watch page
  // raises it so that ONE request can serve every panel that needs this
  // chapter's courses, instead of each panel issuing its own.
  pageSize = PAGE_SIZE,
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

    // The catalogue search box now matches with the SAME engine as the homepage
    // instead of a single-column title ILIKE. A small RPC (search_playlist_ids)
    // returns the ids of courses whose title matches — multi-token, typo-
    // tolerant, Hinglish-aware — and we intersect that set with the active
    // filters below via .in("id", ...). Resolving ids ONCE here (they depend
    // only on the term, not on the stats-column retry) keeps buildQuery a pure
    // filter composition. Before this, "friction problems" returned 0 courses
    // on /browse while the homepage found 3.
    //
    // The RPC returns ids IN RELEVANCE ORDER (its SQL ends `order by
    // search_rank_aliased(...), length(pl.title), pl.id limit 500`) but exposes
    // NO rank column, so the ranking is carried entirely by the position of
    // each id in this array. That position is the only copy of the ranking that
    // exists on the client — the ordering further down depends on it.
    const term = (search ?? "").trim();
    let searchIds = null;
    let searchIlike = null; // graceful fallback while the match RPC is undeployed
    if (term) {
      const { data: idRows, error: searchErr } = await supabase.rpc(
        "search_playlist_ids", { p_query: term },
      );
      if (!current()) return;
      if (searchErr) {
        if (isMissingCatalogRpc(searchErr)) {
          // The browse-search functions (docs/sql/browse_search_2026-08-25.sql)
          // are not deployed yet. Fall back to the old single-column match so
          // search still works — no regression window if the frontend ships
          // before the SQL. Once the functions exist, this branch never runs.
          searchIlike = term;
        } else {
          console.error("playlist browse search:", searchErr);
          setState({ items: [], total: null, loading: false, error: "Couldn't search courses.", hasMore: false });
          return;
        }
      } else {
        searchIds = (idRows ?? []).map((r) => r.id);
        // No title matched. An empty .in() is ambiguous in PostgREST and an
        // unfiltered query would wrongly show everything, so answer empty here.
        if (searchIds.length === 0) {
          setState({ items: [], total: 0, loading: false, error: null, hasMore: false });
          return;
        }
      }
    }

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
      // duration_seconds rides along on rows already being fetched, so the one
      // embed yields both the chapter-scoped lecture count and its runtime.
      (chapterId ? ", pv:playlist_videos!inner(videos!inner(chapter_id, duration_seconds))" : "");

    // hasOwn, not a plain lookup: `?sort=constructor` would otherwise resolve
    // to an inherited property and be treated as a real ordering. It matters
    // twice over now, because the relevance branch below asks which sort this
    // is, not merely which chain to run.
    const effectiveSort = Object.hasOwn(ORDER_BY, sort ?? "") ? sort : "recommended";

    // RELEVANCE. `SQL IN` does not preserve the order of its arguments, so
    // .in("id", searchIds).order(...) throws the server's ranking away and
    // hands back whatever ?sort= says — which, measured against production on
    // 2 Sep 2026, means a student typing "kinematics" gets a page of
    // *Mathematics* courses (44 of the 48 matches are trigram-fuzzy) while the
    // two courses actually called Kinematics sit below the fold. Postgres knows
    // the rank; PostgREST cannot order by a position in a client-supplied
    // array, and the RPC exposes no rank column, so the reordering happens here.
    //
    // It is only correct if it sees the WHOLE filtered result set, because the
    // filters run in the database: taking the 12 most relevant ids first and
    // filtering after would give short pages, a wrong total, and an empty page
    // 1 in front of a full page 2. That is affordable precisely because the RPC
    // caps itself at 500 ids, and .in("id", …) on a unique key bounds the
    // result to at most that many rows — so ONE request with range(0, n-1)
    // always covers everything, and the page is sliced from it below.
    //
    // THE COST, MEASURED against production rather than guessed at, because
    // /browse debounces at 300ms and so pays it per keystroke. Course rows are
    // fatter than lecture rows (cover embed, counts, stats), so this was
    // measured with the exact `cols` above: "che"/"chemistry" 96 ids / 64 KB,
    // "maths" 58 / 38 KB, "jee" 54 / 35 KB, "phy" 49 / 33 KB, "physics" 47 /
    // 32 KB, "organic chemistry" 18 / 12 KB — against ~8 KB for a 12-row page,
    // at the same one round trip and the same ~230-300ms. The absolute ceiling
    // is the whole table: 484 playlists / 322 KB, and no real query came within
    // a factor of five of it. If the catalogue ever makes broad queries hit the
    // RPC's 500 cap, re-measure before assuming that still holds.
    //
    // Only the DEFAULT sort becomes relevance. A student who picked "Most
    // viewed" asked for most viewed, and gets most viewed.
    const byRelevance = Boolean(searchIds) && effectiveSort === "recommended";

    // The sort the student chose (?sort=) selects the ordering. "recommended"
    // still leads with curated display_order (new courses default to 1,000,000,
    // so they stay after deliberately placed rows). Every chain ends with a
    // unique .order("id") so paging is deterministic even when earlier keys tie.
    const buildQuery = (includeStats) => {
      const selectedColumns = includeStats
        ? cols
        : cols.replace(" view_count_total, stats_fetched_at,", "");
      const orderMap = includeStats ? ORDER_BY : ORDER_WITHOUT_STATS;
      const applyOrder = orderMap[effectiveSort];
      let q = applyOrder(supabase.from("playlists").select(selectedColumns, { count: "exact" }))
        .order("id")
        // One representative image per course, chosen deterministically from
        // the first lesson. The nested range prevents a 100-lesson course from
        // turning the browse page into a large thumbnail payload.
        .order("position", { ascending: true, referencedTable: "cover" })
        .order("id", { ascending: true, referencedTable: "cover" })
        .range(0, 0, { referencedTable: "cover" })
        // Under relevance this is the WHOLE bounded match set, not a page: the
        // page is cut from it after the ranking is re-applied below.
        .range(
          byRelevance ? 0 : page * pageSize,
          byRelevance
            ? Math.max(searchIds.length - 1, 0)
            : page * pageSize + pageSize - 1,
        );

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
      // Intersect the filtered catalogue with the search matches resolved above.
      if (searchIds) q = q.in("id", searchIds);
      else if (searchIlike) q = q.ilike("title", `%${searchIlike}%`);

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
    let items = (data ?? []).map(toCard);
    // Under relevance the request above fetched the ENTIRE filtered match set,
    // so its size is the true total even if the count header were ever missing,
    // and the page is cut from it AFTER reordering — which is what makes page 2
    // continue the ranking instead of restarting it.
    let total = count ?? null;
    if (byRelevance) {
      if (total == null) total = items.length;
      const rankOf = new Map(searchIds.map((id, i) => [id, i]));
      const rank = (c) => rankOf.get(c.id) ?? Number.MAX_SAFE_INTEGER;
      items = [...items]
        // Every id has a distinct rank, so this is a total order — the same
        // rows always produce the same page. The id tie-break only ever runs
        // for a row the id list somehow did not name.
        .sort((a, b) => rank(a) - rank(b) || a.id - b.id)
        .slice(page * pageSize, (page + 1) * pageSize);
    }
    // "recommended" is display_order -> popularity_score -> title, but 472/477
    // production rows share display_order=1000000 and popularity_score is 0 on
    // ALL of them, so a chapter page fell through to ALPHABETICAL. That floated
    // omnibus one-shot series -- the thinnest chapter matches, carrying the most
    // inflated counts -- above genuinely chapter-specific courses. Rank by real
    // chapter depth instead. Only the DEFAULT sort is re-ordered; a sort the
    // student explicitly chose is left alone.
    //
    // LIMIT: this orders the fetched PAGE, not the whole result set, because
    // PostgREST cannot order by an embedded aggregate without a database-side
    // rollup. That is enough in practice -- chapter result sets are tiny (median
    // 3 courses, max 22) and only 18 of 249 populated chapters exceed one page.
    //
    // NOT under relevance. A student who typed a query asked "which of these
    // is the best match", and chapter depth is a different question with a
    // different answer; running both would leave neither control honest. When
    // a term is active the ranking wins and this heuristic stands down.
    if (!byRelevance && chapterId && effectiveSort === "recommended") {
      items = [...items].sort((a, b) => (b.lectures ?? 0) - (a.lectures ?? 0));
    }
    setState({
      items, total, loading: false, error: null,
      hasMore: total != null ? (page + 1) * pageSize < total : items.length === pageSize,
    });
  }, [enabled, goalId, boardId, subjectId, chapterId, stage, channelId, teacherId,
      chapterClassKey,
      languageKey, contentTypeKey, difficultyKey,
      search, sort, page, pageSize]);

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
