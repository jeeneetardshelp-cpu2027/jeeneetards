// One small catalogue-wide truth check for rating-dependent controls.
// A sorting option that cannot change the order is misleading, so callers
// hide it only after Supabase has positively confirmed that no course has a
// genuine rating. Query failures stay "unknown" and never break browsing.

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

export async function fetchRatingsAvailability(client = supabase) {
  const { count, error } = await client
    .from("playlists")
    .select("id", { count: "exact", head: true })
    .gt("ratings_count", 0);

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
