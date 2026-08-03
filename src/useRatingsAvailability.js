// One small catalogue-wide truth check for rating-dependent controls.
// A sorting option that cannot change the order is misleading, so callers
// hide it only after Supabase has positively confirmed that no course has a
// genuine rating. Query failures stay "unknown" and never break browsing.

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import { RATING_CONFIDENCE_MIN } from "./ratingConfidence.js";

export async function fetchRatingsAvailability(client = supabase) {
  // Gate on the SAME confidence minimum every other rating surface uses, not on
  // "> 0". A course with a single vote has no displayable score — ratingDisplay
  // deliberately returns kind "low" below RATING_CONFIDENCE_MIN, and
  // structuredData withholds aggregateRating on the same rule — so arming the
  // "Highest rated" sort at one vote would let a single rating reorder the whole
  // catalogue by a raw average the site refuses to show anywhere else.
  const { count, error } = await client
    .from("playlists")
    .select("id", { count: "exact", head: true })
    .gte("ratings_count", RATING_CONFIDENCE_MIN);

  if (error) throw error;
  return Number(count ?? 0) > 0;
}

export function useRatingsAvailability() {
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;

    fetchRatingsAvailability()
      .then((result) => {
        if (active) setAvailable(result);
      })
      .catch(() => {
        // Ratings availability is optional UI metadata. On a transient error,
        // keep the existing controls instead of making the catalogue fail.
      });

    return () => {
      active = false;
    };
  }, []);

  return available;
}
