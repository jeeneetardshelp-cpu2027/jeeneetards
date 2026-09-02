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

/**
 * Is there anything to read in this review?
 *
 * The query asks the database for a review that is not null, which is not the
 * same question. On 2026-09-02 production held exactly one rating, and its
 * review was the string ",," — two commas, rendered verbatim under "What
 * students are saying" as the only thing any student had ever said about the
 * site. Punctuation is not a review, and quoting it as one is the same kind of
 * claim as an invented count.
 *
 * A review is readable when it contains at least one letter or digit in ANY
 * script — \p{L} covers Devanagari, so a review written in Hindi counts, which
 * a naive /[a-z0-9]/ test would have silently discarded.
 *
 * The star rating is NOT affected. A student who rated three stars and typed
 * nothing meaningful still rated three stars, and that still counts towards
 * the average. Only the quote is withheld.
 */
export function hasReadableReview(review) {
  return typeof review === "string" && /[\p{L}\p{N}]/u.test(review);
}

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
    // The NOT NULL check is the database's; this is the one that decides
    // whether a human wrote anything. Filtering here rather than in the list
    // component keeps every consumer — and the hook's own promise above —
    // honest.
    setReviews((data ?? []).filter((row) => hasReadableReview(row?.review)));
    setLoading(false);
  }, [playlistId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { reviews, loading, reload };
}
