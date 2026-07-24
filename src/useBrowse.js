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
import { classSlugsForStage } from "./classLevels.js";

const NOT_CONFIGURED = "Supabase isn't configured. Add your keys to .env and restart.";

// Individual lectures are secondary to curated courses, but the list must
// still scale. Every request is one deterministic database page.
export const LECTURE_PAGE_SIZE = 24;

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
  language, contentType, difficulty, search, page = 0, enabled = true,
}) {
  const [state, setState] = useState({
    videos: [], total: null, loading: true, error: null, hasMore: false,
  });
  const generation = useRef(0);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    const current = () => gen === generation.current;
    if (!enabled) {
      setState({ videos: [], total: null, loading: true, error: null, hasMore: false });
      return;
    }
    if (!isSupabaseConfigured) {
      setState({ videos: [], total: null, loading: false, error: NOT_CONFIGURED, hasMore: false });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    const classSlugs = classSlugsForStage(stage);
    // These are COURSE attributes. Individual lectures inherit them only
    // through membership in a matching playlist; old production videos are
    // not reliably backfilled in video_class_levels even though their courses
    // are classified. Filtering the direct video junction made Playlists show
    // 5 valid courses while Lectures incorrectly showed zero.
    const needsPlaylistContext = Boolean(
      classSlugs || language?.length || contentType?.length || difficulty?.length || teacherId,
    );
    const cols =
      "id, youtube_video_id, title, institutes_channels(name), subjects(name), chapters(name)" +
      (goalId ? ", video_learning_goals!inner(learning_goal_id)" : "") +
      (needsPlaylistContext
        ? ", membership:playlist_videos!inner(playlists!inner(language, content_type, difficulty" +
          (classSlugs ? ", pcl:playlist_class_levels!inner(class_levels!inner(slug))" : "") +
          (teacherId ? ", pt:playlist_teachers!inner(teacher_id)" : "") +
          "))"
        : "");
    let q = supabase
      .from("videos")
      .select(cols, { count: "exact" })
      .order("id", { ascending: true })
      .range(page * LECTURE_PAGE_SIZE, page * LECTURE_PAGE_SIZE + LECTURE_PAGE_SIZE - 1);

    if (goalId) q = q.eq("video_learning_goals.learning_goal_id", goalId);
    if (classSlugs) q = q.in("membership.playlists.pcl.class_levels.slug", classSlugs);
    if (subjectId) q = q.eq("subject_id", subjectId);
    if (chapterId) q = q.eq("chapter_id", chapterId);
    if (channelId) q = q.eq("channel_id", channelId);
    if (teacherId) q = q.eq("membership.playlists.pt.teacher_id", teacherId);
    if (language?.length) q = q.in("membership.playlists.language", language);
    if (contentType?.length) q = q.in("membership.playlists.content_type", contentType);
    if (difficulty?.length) q = q.in("membership.playlists.difficulty", difficulty);
    const term = (search ?? "").trim();
    if (term) q = q.ilike("title", `%${term}%`);

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

      const videos = (data ?? []).map((r) => ({
        id: r.id,
        youtubeVideoId: r.youtube_video_id,
        title: r.title,
        institute: r.institutes_channels?.name ?? "—",
        subject: r.subjects?.name ?? "—",
        chapter: r.chapters?.name ?? "—",
      }));
      setState({
        videos, total: count ?? null, loading: false, error: null,
        hasMore: count != null
          ? (page + 1) * LECTURE_PAGE_SIZE < count
          : videos.length === LECTURE_PAGE_SIZE,
      });
    } catch (err) {
      if (!current()) return;
      console.error("videos:", err);
      setState({ videos: [], total: null, loading: false, error: "Couldn't reach the database.", hasMore: false });
    }
  }, [enabled, goalId, subjectId, chapterId, stage, channelId, teacherId,
      language?.join(","), contentType?.join(","), difficulty?.join(","), search, page]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
