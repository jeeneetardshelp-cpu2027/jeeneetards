// useVisibleReviews.js — public, read-only reviews for one course.
//
// "ratings are public" RLS already allows reading review text; this simply
// filters to what's actually fit to show: has real text, and was not hidden
// by an admin via admin_set_review_hidden (see rating_review_moderation.sql).
// Capped at the most recent 20 so one heavily-rated course can't make the
// watch page unbounded.

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const REVIEW_LIMIT = 20;

export function useVisibleReviews(playlistId) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured || !playlistId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("playlist_ratings")
      .select("id, rating, review, difficulty, best_for, created_at")
      .eq("playlist_id", playlistId)
      .eq("review_hidden", false)
      .not("review", "is", null)
      .order("created_at", { ascending: false })
      .limit(REVIEW_LIMIT);
    setReviews(data ?? []);
    setLoading(false);
  }, [playlistId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { reviews, loading, reload };
}
