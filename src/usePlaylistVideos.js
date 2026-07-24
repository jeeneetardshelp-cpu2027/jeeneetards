// Bounded course-detail query: one playlist row and that playlist's ordered
// lessons. Nothing here scans the catalogue, and every optional value remains
// null until the database actually supplies it.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const EMPTY = { course: null, lessons: [], loading: true, error: null };

// PostgREST projects commonly cap a single response at 1,000 rows. Fetching
// the lesson junction in explicit pages prevents a large course from looking
// complete while actually being silently truncated.
export const COURSE_LESSON_PAGE_SIZE = 500;

const LESSON_SELECT =
  "id, position, videos(id, youtube_video_id, title, description, duration_seconds," +
  " embedding_status, last_verified_at, chapters(id, name, slug), subjects(name))";

const pagingError = (code, message) => ({ data: null, error: { code, message } });
const isOutOfRange = (error) => error?.code === "PGRST103" ||
  /range not satisfiable/i.test(error?.message ?? "");

export async function fetchAllCourseLessonRows(client, playlistId, { signal } = {}) {
  const rows = [];
  const seenIds = new Set();
  let expectedCount = null;
  let start = 0;

  while (expectedCount === null || rows.length < expectedCount) {
    const requested = expectedCount === null
      ? COURSE_LESSON_PAGE_SIZE
      : Math.min(COURSE_LESSON_PAGE_SIZE, expectedCount - rows.length);
    const end = start + requested - 1;
    let query = client
      .from("playlist_videos")
      // The first exact count is the contract for the whole read. It prevents
      // both an exact-multiple 416 and silent truncation when PostgREST's
      // configured row cap is smaller than our requested page.
      .select(LESSON_SELECT, start === 0 ? { count: "exact" } : undefined)
      .eq("playlist_id", playlistId)
      .order("position", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end);
    if (signal && typeof query.abortSignal === "function") {
      query = query.abortSignal(signal);
    }
    const result = await query;

    if (result.error) {
      // An empty relation may be represented as an unsatisfied first range.
      // A later 416 is not success: it contradicts the count we already saw.
      if (start === 0 && isOutOfRange(result.error)) {
        return { data: [], error: null };
      }
      return { data: null, error: result.error };
    }

    if (expectedCount === null) {
      if (!Number.isSafeInteger(result.count) || result.count < 0) {
        return pagingError(
          "COURSE_LESSON_COUNT_UNAVAILABLE",
          "PostgREST did not return the exact course lesson count.",
        );
      }
      expectedCount = result.count;
      if (expectedCount === 0) return { data: [], error: null };
    }

    const batch = result.data ?? [];
    if (batch.length === 0) {
      return pagingError(
        "COURSE_LESSON_INCOMPLETE",
        `Course lesson paging stopped after ${rows.length} of ${expectedCount} rows.`,
      );
    }

    for (const row of batch) {
      if (row?.id == null || seenIds.has(row.id)) {
        return pagingError(
          "COURSE_LESSON_UNSTABLE",
          "Course lesson paging returned a missing or duplicate junction id.",
        );
      }
      seenIds.add(row.id);
      rows.push(row);
    }
    start += batch.length;
  }

  if (rows.length !== expectedCount) {
    return pagingError(
      "COURSE_LESSON_COUNT_MISMATCH",
      `Course lesson paging returned ${rows.length} rows for an expected ${expectedCount}.`,
    );
  }
  return { data: rows, error: null };
}

const relationRows = (value) => Array.isArray(value) ? value : value ? [value] : [];

export function mapCourseDetail(playlist, lessonRows) {
  if (!playlist) return { course: null, lessons: [] };

  const lessons = (lessonRows ?? [])
    .filter((row) => row.videos)
    .map((row) => {
      const video = row.videos;
      return {
        linkId: row.id,
        id: video.id,
        position: row.position,
        videoId: video.youtube_video_id,
        title: video.title,
        description: video.description ?? null,
        durationSeconds: video.duration_seconds ?? null,
        embeddingStatus: video.embedding_status ?? "unknown",
        lastVerifiedAt: video.last_verified_at ?? null,
        chapter: video.chapters
          ? { id: video.chapters.id, name: video.chapters.name, slug: video.chapters.slug }
          : null,
        subject: video.subjects?.name ?? null,
      };
    });

  const syllabus = [];
  const seenChapters = new Set();
  for (const lesson of lessons) {
    if (!lesson.chapter?.id || seenChapters.has(lesson.chapter.id)) continue;
    seenChapters.add(lesson.chapter.id);
    syllabus.push({ ...lesson.chapter, subject: lesson.subject });
  }

  const classLevels = relationRows(playlist.playlist_class_levels)
    .map((row) => row.class_levels?.name)
    .filter(Boolean);
  const learningGoals = relationRows(playlist.playlist_learning_goals)
    .map((row) => row.learning_goals?.name)
    .filter(Boolean);
  const durations = lessons.map((lesson) => Number(lesson.durationSeconds));
  const hasCompleteDuration = lessons.length > 0 && durations.every(
    (duration) => Number.isFinite(duration) && duration > 0,
  );

  return {
    lessons,
    course: {
      id: playlist.id,
      title: playlist.title,
      teacher: playlist.teacher ?? null,
      institute: playlist.institutes_channels?.name ?? null,
      subject: playlist.subjects?.name ?? null,
      lectures: lessons.length,
      language: playlist.language ?? null,
      contentType: playlist.content_type ?? null,
      difficulty: playlist.difficulty ?? null,
      classLevels: classLevels.length ? classLevels : (playlist.class_levels ?? []),
      learningGoals,
      averageRating: playlist.ratings_count > 0 ? Number(playlist.average_rating) : null,
      ratingsCount: Number(playlist.ratings_count ?? 0),
      lastVerifiedAt: playlist.last_verified_at ?? null,
      totalDurationSeconds: hasCompleteDuration
        ? durations.reduce((sum, duration) => sum + duration, 0)
        : null,
      syllabus,
      blockedLessons: lessons.filter((lesson) => lesson.embeddingStatus === "blocked").length,
    },
  };
}

export function usePlaylistVideos(playlistId) {
  const [state, setState] = useState(EMPTY);
  const generation = useRef(0);
  const activeRequest = useRef(null);

  const load = useCallback(async () => {
    const gen = ++generation.current;
    const current = () => gen === generation.current;
    activeRequest.current?.abort();
    activeRequest.current = null;
    const id = Number(playlistId);
    if (!Number.isInteger(id) || id <= 0) {
      setState({ course: null, lessons: [], loading: false, error: null });
      return;
    }
    if (!isSupabaseConfigured) {
      setState({
        course: null, lessons: [], loading: false,
        error: "Course details aren’t available right now.",
      });
      return;
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    try {
      let playlistQuery = supabase
        .from("playlists")
        .select(
          "id, title, teacher, average_rating, ratings_count, language, content_type," +
          " difficulty, class_levels, last_verified_at, institutes_channels(name), subjects(name)," +
          " playlist_learning_goals(learning_goals(name, slug))," +
          " playlist_class_levels(class_levels(name, slug))",
        )
        .eq("id", id);
      if (typeof playlistQuery.abortSignal === "function") {
        playlistQuery = playlistQuery.abortSignal(controller.signal);
      }
      const [playlistRes, videosRes] = await Promise.all([
        playlistQuery.maybeSingle(),
        fetchAllCourseLessonRows(supabase, id, { signal: controller.signal }),
      ]);
      if (!current()) return;

      const failure = playlistRes.error || videosRes.error;
      if (failure) {
        console.error("course detail:", failure);
        setState({
          course: null, lessons: [], loading: false,
          error: "Couldn’t load this course.",
        });
        return;
      }
      const mapped = mapCourseDetail(playlistRes.data, videosRes.data);
      setState({ ...mapped, loading: false, error: null });
    } catch (failure) {
      if (!current() || controller.signal.aborted) return;
      console.error("course detail:", failure);
      setState({
        course: null, lessons: [], loading: false,
        error: "Couldn’t reach the course library.",
      });
    }
  }, [playlistId]);

  useEffect(() => {
    load();
    return () => {
      generation.current += 1;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [load]);

  return { ...state, reload: load };
}
