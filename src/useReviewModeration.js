// useReviewModeration.js — admin-only browsing/hiding of written reviews.
//
// Reviews have no public display surface yet (see CourseRating.jsx), but the
// existing "ratings are public" RLS policy already means review text is
// technically readable via the anon key. This exists so an admin can spot
// and hide anything inappropriate before any display UI ever ships, not
// after. Both RPCs are admin-only server-side (is_admin()); this hook does
// not add its own authorization, it relies on the RPC to enforce it.

import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export function useReviewModeration() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc("admin_list_reviews");
    if (error) {
      setError(error.message);
      setReviews([]);
    } else {
      setReviews(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setHidden = async (ratingId, hidden) => {
    const { error } = await supabase.rpc("admin_set_review_hidden", {
      p_rating_id: ratingId,
      p_hidden: hidden,
    });
    if (!error) {
      setReviews((prev) =>
        prev.map((r) =>
          r.id === ratingId ? { ...r, review_hidden: hidden, review_hidden_at: hidden ? new Date().toISOString() : null } : r,
        ),
      );
    }
    return error;
  };

  return { reviews, loading, error, reload, setHidden };
}
