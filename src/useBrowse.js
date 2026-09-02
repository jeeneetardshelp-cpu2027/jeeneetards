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
    videos: [], total: null, loading: true, error: null, hasMore: false,
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
      setState({ videos: [], total: null, loading: true, error: null, hasMore: false });
      return;
    }
    if (!isSupabaseConfigured) {
      setState({ videos: [], total: null, loading: false, error: NOT_CONFIGURED, hasMore: false });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    const reviewedChapterClasses = JSON.parse(chapterClassKey);
    const chapterStage = chapterId
      ? chapterScopeStageDecision(reviewedChapterClasses, stage)
      : "fallback";
    if (chapterStage === "mismatch") {
      setState({ videos: [], total: 0, loading: false, error: null, hasMore: false });
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
    if (term) {
      const { data: idRows, error: searchErr } = await supabase.rpc(
        "search_video_ids", { p_query: term },
      );
      if (!current()) return;
      if (searchErr) {
        if (isMissingCatalogRpc(searchErr)) {
          // search_video_ids not deployed yet (see the note in usePlaylistBrowse):
          // fall back to the old single-column match so lecture search still
          // works regardless of deploy order.
          searchIlike = term;
        } else {
          console.error("videos search:", searchErr);
          setState({ videos: [], total: null, loading: false, error: "Couldn't search lessons.", hasMore: false });
          return;
        }
      } else {
        searchIds = (idRows ?? []).map((r) => r.id);
        // No title matched: answer empty rather than letting an empty .in() or a
        // dropped filter show the whole catalogue.
        if (searchIds.length === 0) {
          setState({ videos: [], total: 0, loading: false, error: null, hasMore: false });
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
    // 24-row page. Nothing came near the 500 cap, so the realistic ceiling is
    // ~90 KB of JSON (uncompressed; the wire figure is smaller and could not
    // be read cross-origin), roughly what one or two of the page's own video
    // thumbnails cost. The two-request alternative — ids-only, then .in() the
    // 24 page ids — would trade that for a second round trip on every
    // debounced keystroke plus a duplicated join builder. At this size the
    // round trip is the thing a student on mobile data actually feels, so it
    // is not worth it. If a future catalogue makes broad queries hit the 500
    // cap, re-measure before assuming that still holds.
    //
    // Only the DEFAULT sort becomes relevance. A student who picked "Shortest
    // first" asked for shortest, and gets shortest.
    const byRelevance = Boolean(searchIds) && effectiveSort === DEFAULT_LECTURE_SORT;
    const from = byRelevance ? 0 : page * LECTURE_PAGE_SIZE;
    const to = byRelevance
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
          setState({ videos: [], total: count ?? null, loading: false, error: null, hasMore: false });
          return;
        }
        console.error("videos:", error);
        setState({ videos: [], total: null, loading: false, error: "Couldn't load lessons.", hasMore: false });
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
      // Under relevance the request above fetched the ENTIRE filtered match
      // set, so its size is the true total even if the count header were ever
      // missing, and the page is cut from it AFTER reordering — which is what
      // makes page 2 continue the ranking instead of restarting it.
      let total = count ?? null;
      if (byRelevance) {
        if (total == null) total = videos.length;
        const rankOf = new Map(searchIds.map((id, i) => [id, i]));
        const rank = (v) => rankOf.get(v.id) ?? Number.MAX_SAFE_INTEGER;
        videos = videos
          .slice()
          // Every id has a distinct rank, so this is a total order — the same
          // rows always produce the same page. The id tie-break only ever runs
          // for a row the id list somehow did not name.
          .sort((a, b) => rank(a) - rank(b) || a.id - b.id)
          .slice(page * LECTURE_PAGE_SIZE, (page + 1) * LECTURE_PAGE_SIZE);
      }
      setState({
        videos, total, loading: false, error: null,
        hasMore: total != null
          ? (page + 1) * LECTURE_PAGE_SIZE < total
          : videos.length === LECTURE_PAGE_SIZE,
      });
    } catch (err) {
      if (!current()) return;
      console.error("videos:", err);
      setState({ videos: [], total: null, loading: false, error: "Couldn't reach the database.", hasMore: false });
    }
  }, [enabled, goalId, subjectId, chapterId, stage, channelId, teacherId,
      chapterClassKey,
      languageKey, contentTypeKey, difficultyKey, search, sort, page]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
