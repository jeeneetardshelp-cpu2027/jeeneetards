// useAdminData.js
// Everything the admin forms need to fill their dropdowns, plus a
// reload() so a newly added row shows up in the next form immediately.

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const EMPTY = {
  channels: [],
  categories: [],
  subjects: [],
  chapters: [],
  videos: [],
  classLevelRows: [],
  learningGoals: [],
  boards: [],
};

export function useAdminData(enabled = true) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setData(EMPTY);
      setError(null);
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured) {
      setError("Supabase isn't configured. Add your keys to .env.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [channels, categories, subjects, chapters, videos, classLevels,
             learningGoals, boards] =
        await Promise.all([
          supabase.from("institutes_channels").select("id, name").order("name"),
          supabase.from("categories").select("id, name").order("display_order"),
          supabase.from("subjects").select("id, name").order("display_order"),
          supabase.from("chapters").select("id, name, subject_id").order("name"),
          supabase
            .from("videos")
            .select("id, title, youtube_video_id, chapter_id")
            .order("id", { ascending: false }),
          supabase.from("class_levels").select("id, slug").order("display_order"),
          supabase.from("learning_goals").select("id, name, slug").order("display_order"),
          supabase.from("boards").select("id, name, slug").order("display_order"),
        ]);

      // class_levels is optional — the app still works if that migration
      // hasn't run yet, so a failure there is tolerated (empty rows).
      const failed = [channels, categories, subjects, chapters, videos].find(
        (r) => r.error
      );
      if (failed) {
        setError(failed.error.message);
        setLoading(false);
        return;
      }

      setData({
        channels: channels.data ?? [],
        categories: categories.data ?? [],
        subjects: subjects.data ?? [],
        chapters: chapters.data ?? [],
        videos: videos.data ?? [],
        classLevelRows: classLevels.error ? [] : classLevels.data ?? [],
        learningGoals: learningGoals.error ? [] : learningGoals.data ?? [],
        boards: boards.error ? [] : boards.data ?? [],
      });
    } catch (err) {
      setError(err?.message ?? "Could not reach the database.");
    }

    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...data, loading, error, reload };
}
