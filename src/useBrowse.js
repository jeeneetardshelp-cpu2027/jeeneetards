// useBrowse.js — Supabase-backed browsing for the homepage.
//
//   useVideos(...)      — the video grid, filtered SERVER-SIDE by
//                         category/subject/chapter id and a title search.
//   useDebouncedValue() — so typing doesn't hit the database on every key.
//
// Everything reads with the public anon key, so browsing works without a
// login (public-read RLS).

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { chapterScopeStageDecision, classSlugsForStage } from "./classLevels.js";
import { isMissingCatalogRpc } from "./useExplore.js";
import { isServableQuery } from "./useUniversalSearch.js";
import { fetchSearchQueryTokens, partitionByStrength } from "./searchStrongMatch.js";

const NOT_CONFIGURED = "Supabase isn't configured. Add your keys to .env and restart.";

// Individual lectures are secondary to curated courses, but the list must
// still scale. Every request is one deterministic database page.
export const LECTURE_PAGE_SIZE = 24;

// Sorts for the Individual Lectures tab. Only orderings the videos table can
// actually answer are offered (the honest-sorts rule — a control that cannot
// change the order reads as broken): duration_seconds and created_at are real
// columns, while per-video rating/popularity rollups do not exist, so those
// sorts are deliberately absent even though the Playlists tab has them.
export const LECTURE_SORTS = [
  { id: "recommended", label: "Recommended" },
  { id: "shortest", label: "Shortest first" },
  { id: "longest", label: "Longest first" },
  { id: "recent", label: "Recently added" },
];
export const DEFAULT_LECTURE_SORT = "recommended";

/**
 * The sort options AS THE CONTROL SHOULD LABEL THEM for the current search box.
 *
 * There is no fifth "Relevance" sort id, deliberately. While a term is active
 * the default sort IS relevance (see useVideos below), so a separate id would
 * only add a ?lsort=relevance value that goes meaningless the moment the term
 * is cleared — the exact stale-preference problem the courses tab already has
 * to clean up with a replace-effect — and an option that appears and vanishes
 * as you type is a control moving under the student's hand.
 *
 * What DOES change is the word: "Recommended" is not what the list is doing
 * during a search, "Best match" is. Same id, same URL, same default.
 */
export function lectureSortOptions(search) {
  if (!(search ?? "").trim()) return LECTURE_SORTS;
  return LECTURE_SORTS.map((s) =>
    s.id === DEFAULT_LECTURE_SORT ? { ...s, label: "Best match" } : s);
}

// ?lsort= — its own URL key, not the playlists tab's ?sort=: the two tabs have
// different honest vocabularies, and sharing one key would make a playlists
// sort silently mean something else (or nothing) after a tab switch.
export const LECTURE_SORT_PARAM = "lsort";

/** Read the lectures-tab sort out of the URL. Junk falls back to the default
 *  rather than producing an unordered (or playlists-flavoured) query. */
export function parseLectureSort(params) {
  const raw = params.get(LECTURE_SORT_PARAM);
  return LECTURE_SORTS.some((s) => s.id === raw) ? raw : DEFAULT_LECTURE_SORT;
}

// Maps a LECTURE_SORTS id to its .order() chain; the caller's .order("id")
// tie-break follows every chain so paging stays deterministic. Lessons with an
// unknown duration go LAST under both duration sorts (nullsFirst: false) — an
// unknown value must never masquerade as the shortest or the longest.
const LECTURE_ORDER_BY = {
  recommended: (q) => q,            // the catalogue order: the id tie-break alone
  shortest: (q) => q.order("duration_seconds", { ascending: true, nullsFirst: false }),
  longest: (q) => q.order("duration_seconds", { ascending: false, nullsFirst: false }),
  recent: (q) => q.order("created_at", { ascending: false }),
};

export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Server-side filtered, paged video list. The `enabled` gate prevents an
// unresolved slug—or the inactive Playlists tab—from issuing a broad query.
export function useVideos({
  goalId, subjectId, chapterId, stage, channelId, teacherId,
  chapterClassSlugs = null,
  language, contentType, difficulty, search, sort, page = 0, enabled = true,
}) {
  const [state, setState] = useState({
    videos: [], total: null, strongTotal: null, loading: true, error: null, hasMore: false,
  });
  const generation = useRef(0);
  const languageKey = JSON.stringify(language ?? []);
  const contentTypeKey = JSON.stringify(contentType ?? []);
  const difficultyKey = JSON.stringify(difficulty ?? []);
  const chapterClassKey = JSON.stringify(chapterClassSlugs);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    const current = () => gen === generation.current;
    const languageValues = JSON.parse(languageKey);
    const contentTypeValues = JSON.parse(contentTypeKey);
    const difficultyValues = JSON.parse(difficultyKey);
    if (!enabled) {
      setState({ videos: [], total: null, strongTotal: null, loading: true, error: null, hasMore: false });
      return;
    }
    if (!isSupabaseConfigured) {
      setState({ videos: [], total: null, strongTotal: null, loading: false, error: NOT_CONFIGURED, hasMore: false });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    const reviewedChapterClasses = JSON.parse(chapterClassKey);
    const chapterStage = chapterId
      ? chapterScopeStageDecision(reviewedChapterClasses, stage)
      : "fallback";
    if (chapterStage === "mismatch") {
      setState({ videos: [], total: 0, strongTotal: null, loading: false, error: null, hasMore: false });
      return;
    }
    const classSlugs = chapterStage === "match" ? null : classSlugsForStage(stage);
    // These are COURSE attributes. Individual lectures inherit them only
    // through membership in a matching playlist; old production videos are
    // not reliably backfilled in video_class_levels even though their courses
    // are classified. Filtering the direct video junction made Playlists show
    // 5 valid courses while Lectures incorrectly showed zero.
    const needsPlaylistContext = Boolean(
      classSlugs || languageValues.length || contentTypeValues.length || difficultyValues.length || teacherId,
    );

    // The lecture search now uses the homepage's matcher instead of a single-
    // column title ILIKE: search_video_ids returns the ids of lectures whose
    // title matches (multi-token, typo-tolerant, Hinglish), capped at the most
    // relevant 500, and we intersect that with the filters below. Resolving ids
    // once here keeps the branchy column/filter builder untouched otherwise.
    //
    // The RPC returns ids IN RELEVANCE ORDER (its SQL is `order by rank,
    // length(title), id limit 500`) but returns no rank column, so the order is
    // carried entirely by the position of each id in this array. That position
    // is the only copy of the ranking that exists on the client — the ordering
    // below depends on it.
    const term = (search ?? "").trim();
    let searchIds = null;
    let searchIlike = null; // graceful fallback while the match RPC is undeployed
    // The query's CONTENT TOKENS, straight from the server's own tokeniser
    // (search_query_tokens — the helper universal_search and both browse RPCs
    // already share). They are what tells a title that literally matches from
    // one the fuzzy tier brought along; see searchStrongMatch.js for why they
    // are fetched rather than re-derived here.
    let queryTokens = [];
    // A query the server cannot answer is answered as "no matches" WITHOUT
    // asking it. Measured on production 2026-09-03, search_video_ids:
    //   "ac"      HTTP 500 3218ms   57014 canceling statement due to timeout
    //   "3d"      HTTP 500 3226ms   57014
    //   "acid"    HTTP 200  325ms   71 rows
    // Two characters yield one or two trigrams, so the GIN index cannot narrow
    // candidates and the planner scans. It is not a slow result, it is a failed
    // request: the branch below turns it into the red "Couldn't search lessons."
    // banner, for a student who typed "ac" meaning Alternating Current.
    // search_playlist_ids survives the same input, so only the lecture tab
    // breaks — which is why /browse looked half-working rather than broken.
    //
    // The test is isServableQuery, NOT `length < MIN_QUERY`. A length floor
    // gets the single-token case right and the multi-token case wrong: "p c",
    // "a b c" and "p and c" are all 3 characters or more, and all three are
    // recorded as FAIL 500 in useUniversalSearch.js. Length is not the rule —
    // per-token selectivity is, because a 1-character token contributes at most
    // one trigram no matter how long the whole string is. Importing the
    // predicate rather than re-deriving it is what keeps the three search
    // surfaces from drifting.
    if (term && !isServableQuery(term)) {
      setState({ videos: [], total: 0, strongTotal: null, loading: false, error: null, hasMore: false });
      return;
    }
    if (term) {
      // ALONGSIDE, not after. The tokens are needed only once the rows are in
      // hand, so making them a second round trip would add latency to every
      // debounced keystroke for nothing. fetchSearchQueryTokens never rejects:
      // a missing or failing helper yields no tokens and the page keeps
      // today's behaviour exactly.
      const [{ data: idRows, error: searchErr }, tokens] = await Promise.all([
        supabase.rpc("search_video_ids", { p_query: term }),
        fetchSearchQueryTokens(supabase, term),
      ]);
      if (!current()) return;
      queryTokens = tokens;
      if (searchErr) {
        if (isMissingCatalogRpc(searchErr)) {
          // search_video_ids not deployed yet (see the note in usePlaylistBrowse):
          // fall back to the old single-column match so lecture search still
          // works regardless of deploy order.
          searchIlike = term;
        } else {
          console.error("videos search:", searchErr);
          setState({ videos: [], total: null, strongTotal: null, loading: false, error: "Couldn't search lessons.", hasMore: false });
          return;
        }
      } else {
        searchIds = (idRows ?? []).map((r) => r.id);
        // No title matched: answer empty rather than letting an empty .in() or a
        // dropped filter show the whole catalogue.
        if (searchIds.length === 0) {
          setState({ videos: [], total: 0, strongTotal: null, loading: false, error: null, hasMore: false });
          return;
        }
      }
    }
    // `membership` is ALWAYS embedded, because a lecture's only watchable home
    // is /course/:playlistId?v=:youtubeVideoId and `videos` has no playlist_id
    // column — the course id exists solely in playlist_videos. Bounded to ONE
    // row per lecture (a video belongs to one course in practice, a handful at
    // most), ordered so the same card always links to the same course.
    // When playlist filters are active the embed is the !inner one, so the
    // course we link to is one that MATCHES the student's filters.
    const cols =
      "id, youtube_video_id, title, institutes_channels(id, name, logo_url), subjects(name), chapters(name)" +
      (goalId ? ", video_learning_goals!inner(learning_goal_id)" : "") +
      (needsPlaylistContext
        ? ", membership:playlist_videos!inner(playlist_id, playlists!inner(language, content_type, difficulty" +
          (classSlugs ? ", pcl:playlist_class_levels!inner(class_levels!inner(slug))" : "") +
          (teacherId ? ", pt:playlist_teachers!inner(teacher_id)" : "") +
          "))"
        : ", membership:playlist_videos(playlist_id)");
    // The chosen sort leads; .order("id") always follows as the unique
    // tie-break, so "recommended" is exactly the order this list always had.
    // hasOwn, not a plain lookup: `?lsort=constructor` would otherwise resolve
    // to an inherited property and be treated as a real sort. It now matters
    // twice over, because the relevance branch below asks which sort this is.
    const effectiveSort = Object.hasOwn(LECTURE_ORDER_BY, sort ?? "")
      ? sort
      : DEFAULT_LECTURE_SORT;
    const applyOrder = LECTURE_ORDER_BY[effectiveSort];

    // RELEVANCE. `SQL IN` does not preserve the order of its arguments, so
    // .in("id", searchIds).order("id") threw the server's ranking away and
    // handed back database-id order — the best match for "friction problems"
    // could sit on page 3. Postgres knows the rank; PostgREST cannot order by
    // a position in a client-supplied array, and the RPC exposes no rank
    // column to order on, so the reordering has to happen here.
    //
    // It is only correct if it sees the WHOLE filtered result set, because the
    // filters run in the database: taking the 24 most relevant ids first and
    // filtering after would give short pages, a wrong total, and an empty page
    // 1 in front of a full page 2. That is affordable precisely because the
    // RPC caps itself at 500 ids, and .in("id", …) on a unique key bounds the
    // result to at most that many rows — so ONE request with range(0, n-1)
    // always covers everything, and the page is sliced from it below.
    //
    // THE COST, MEASURED against production on 2 Sep 2026 rather than guessed
    // at, because /browse debounces at 300ms and so pays it per keystroke:
    // "phy" 229 ids / 92 KB, "physics" 211 / 85 KB, "kin" 212 / 80 KB,
    // "friction problems" 40 / 15 KB, "notes" 23 / 9 KB — against ~9 KB for a
    // 24-row page.
    //
    // RE-MEASURED 8 Sep 2026, and the line that used to sit here was wrong.
    // It said "Nothing came near the 500 cap, so the realistic ceiling is
    // ~90 KB" and told the next reader to re-measure if that ever changed.
    // It already had: four ordinary student queries sit EXACTLY at the cap —
    // "neet" 500 ids / 211 KB, "the" 500 / 193 KB, "lecture" 500 / 188 KB,
    // "jee" 500 / 180 KB, with "chemistry" at 394 / 159 KB. The real ceiling is
    // 211 KB, 2.3x what was claimed, and this change extends that cost from one
    // sort to four.
    //
    // It is still worth paying, on the figure the earlier note could not read
    // cross-origin: gzipped on the wire the cap costs ~18 KB against ~0.9 KB
    // for a single page, and latency is flat (427 ms vs 243 ms). But the number
    // in a comment should be the measured one, not the reassuring one.
    // The two-request alternative — ids-only, then .in() the
    // 24 page ids — would trade that for a second round trip on every
    // debounced keystroke plus a duplicated join builder. At this size the
    // round trip is the thing a student on mobile data actually feels, so it
    // is not worth it. If a future catalogue makes broad queries hit the 500
    // cap, re-measure before assuming that still holds.
    //
    // TWO JOBS, TWO FLAGS. One flag used to drive both the RANGE (fetch the
    // whole match set) and the COMPARATOR (re-order it by rank), which meant
    // only the default sort ever saw the whole set. Splitting them is what this
    // change is:
    //
    //   fullSet     — a term is active, so fetch every matching row, on EVERY
    //                 sort. The RPC's 500-id cap bounds it and the default sort
    //                 has been paying this exact cost since 2 Sep; the measured
    //                 ceiling is 211 KB of JSON, ~18 KB gzipped on the wire.
    //   byRelevance — and the student has not chosen a sort, so the server's
    //                 ranking is the order. Unchanged.
    //
    // Only the DEFAULT sort becomes relevance. A student who picked "Shortest
    // first" still gets shortest — but SHORTEST AMONG THE LESSONS THAT ACTUALLY
    // MATCH first, then shortest among the rest. Measured on production
    // 2026-09-08, "kinematics" returns 172 rows of which 38 have the word in
    // the title, and the entire first page under "Shortest first" was Kinetic
    // Theory of Gases clips: "shortest" was being applied to everything the
    // fuzzy tier admitted rather than to the rows the student was looking for.
    // Nothing is removed and the count is untouched — the 134 loose matches
    // follow the 38, on the same page ordering, one block later.
    const fullSet = Boolean(searchIds);
    const byRelevance = fullSet && effectiveSort === DEFAULT_LECTURE_SORT;
    const from = fullSet ? 0 : page * LECTURE_PAGE_SIZE;
    const to = fullSet
      ? Math.max(searchIds.length - 1, 0)
      : page * LECTURE_PAGE_SIZE + LECTURE_PAGE_SIZE - 1;
    let q = applyOrder(supabase.from("videos").select(cols, { count: "exact" }))
      .order("id", { ascending: true })
      // Referenced-table order + limit: the course embed above, bounded to the
      // lowest-numbered matching course so the link is stable across reloads.
      .order("playlist_id", { referencedTable: "membership", ascending: true })
      .limit(1, { referencedTable: "membership" })
      .range(from, to);

    if (goalId) q = q.eq("video_learning_goals.learning_goal_id", goalId);
    if (classSlugs) q = q.in("membership.playlists.pcl.class_levels.slug", classSlugs);
    if (subjectId) q = q.eq("subject_id", subjectId);
    if (chapterId) q = q.eq("chapter_id", chapterId);
    if (channelId) q = q.eq("channel_id", channelId);
    if (teacherId) q = q.eq("membership.playlists.pt.teacher_id", teacherId);
    if (languageValues.length) q = q.in("membership.playlists.language", languageValues);
    if (contentTypeValues.length) q = q.in("membership.playlists.content_type", contentTypeValues);
    if (difficultyValues.length) q = q.in("membership.playlists.difficulty", difficultyValues);
    if (searchIds) q = q.in("id", searchIds);
    else if (searchIlike) q = q.ilike("title", `%${searchIlike}%`);

    try {
      const { data, error, count } = await q;
      if (!current()) return;
      if (error) {
        const outOfRange = error.code === "PGRST103" || /range not satisfiable/i.test(error.message || "");
        if (outOfRange) {
          setState({ videos: [], total: count ?? null, strongTotal: null, loading: false, error: null, hasMore: false });
          return;
        }
        console.error("videos:", error);
        setState({ videos: [], total: null, strongTotal: null, loading: false, error: "Couldn't load lessons.", hasMore: false });
        return;
      }

      let videos = (data ?? []).map((r) => ({
        id: r.id,
        youtubeVideoId: r.youtube_video_id,
        title: r.title,
        instituteId: r.institutes_channels?.id ?? null,
        institute: r.institutes_channels?.name ?? "—",
        instituteLogoUrl: r.institutes_channels?.logo_url ?? null,
        subject: r.subjects?.name ?? "—",
        chapter: r.chapters?.name ?? "—",
        // The course this lesson is watched inside. null only if a lesson
        // belongs to no course at all — then there is no watch page to link to,
        // and the card says so rather than promising a destination.
        playlistId: r.membership?.[0]?.playlist_id ?? null,
      }));
      // With a term active the request above fetched the ENTIRE filtered match
      // set, so its size is the true total even if the count header were ever
      // missing, and the page is cut from it AFTER reordering — which is what
      // makes page 2 continue the ordering instead of restarting it.
      let total = count ?? null;
      if (fullSet && total == null) total = videos.length;

      // HOW MANY OF THESE ARE REALLY ABOUT WHAT WAS TYPED. Computed on every
      // sort, from the whole match set, and reported so the heading can stop
      // saying "172 lessons" for 38 kinematics lectures. null means the
      // question was not asked (no term) or could not be answered (no tokens),
      // never a fabricated zero.
      let strongTotal = null;
      if (fullSet && queryTokens.length > 0) {
        const { strong, weak } = partitionByStrength(videos, queryTokens);
        strongTotal = strong.length;
        // STRONG FIRST, THEN THE REST — but only when the ordering is the
        // student's chosen sort. Under relevance the ranking already puts the
        // real matches on top (24 of 24 on page 1, measured), and running both
        // would leave neither control honest.
        //
        // Both blocks come out of order-preserving passes over rows the
        // DATABASE already sorted, so "shortest" still means shortest inside
        // each block without this file owning a comparator. That matters:
        // mirroring the .order() chains in JS would mean re-deriving Postgres's
        // null placement (asc NULLS LAST, desc NULLS FIRST unless nullsFirst
        // says otherwise) on the wrong side of the wire — and it is not even
        // possible here, because `cols` above selects neither duration_seconds
        // nor created_at. The rows would have to grow columns to be re-sorted
        // into the order they already arrived in.
        //
        // When the strong block is EVERYTHING or NOTHING this concatenation is
        // the input array, element for element — which is why "trigonometry"
        // (91 of 91) and the typo "kinamatics" (0 of 38) come out byte-identical
        // to the pre-change page under every sort.
        if (!byRelevance) videos = [...strong, ...weak];
      }

      if (byRelevance) {
        const rankOf = new Map(searchIds.map((id, i) => [id, i]));
        const rank = (v) => rankOf.get(v.id) ?? Number.MAX_SAFE_INTEGER;
        videos = videos
          .slice()
          // Every id has a distinct rank, so this is a total order — the same
          // rows always produce the same page. The id tie-break only ever runs
          // for a row the id list somehow did not name.
          .sort((a, b) => rank(a) - rank(b) || a.id - b.id)
          .slice(page * LECTURE_PAGE_SIZE, (page + 1) * LECTURE_PAGE_SIZE);
      } else if (fullSet) {
        // The whole match set is in hand on this sort too, so the page is cut
        // here rather than by range(). Paging is still driven by `total`, which
        // is the database's count and has not moved.
        videos = videos.slice(page * LECTURE_PAGE_SIZE, (page + 1) * LECTURE_PAGE_SIZE);
      }
      setState({
        videos, total, strongTotal, loading: false, error: null,
        hasMore: total != null
          ? (page + 1) * LECTURE_PAGE_SIZE < total
          : videos.length === LECTURE_PAGE_SIZE,
      });
    } catch (err) {
      if (!current()) return;
      console.error("videos:", err);
      setState({ videos: [], total: null, strongTotal: null, loading: false, error: "Couldn't reach the database.", hasMore: false });
    }
  }, [enabled, goalId, subjectId, chapterId, stage, channelId, teacherId,
      chapterClassKey,
      languageKey, contentTypeKey, difficultyKey, search, sort, page]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
