// Catalogue-wide truth check for the popularity-driven sorts, mirroring
// useRatingsAvailability.
//
// "Most popular" orders by playlists.popularity_score and "Most viewed" by
// playlists.view_count_total. Both columns are filled by the video_stats
// rollup job (src/scripts/refreshVideoStats.js). Until that job has run they
// are null/0 on every course, so both sorts silently collapse to the tiebreak
// and rank nothing — a control that looks like it does something and does not.
// Measured 2026-08-10: 0 of 419 courses had view_count_total > 0.
//
// Each sort is hidden only after Supabase POSITIVELY confirms its column is
// empty catalogue-wide. A query failure stays "unknown" and never removes a
// control or breaks browsing — popularity is optional metadata.

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

async function anyPositive(client, column) {
  const { count, error } = await client
    .from("playlists")
    .select("id", { count: "exact", head: true })
    .gt(column, 0);
  if (error) throw error;
  return Number(count ?? 0) > 0;
}

// Returns { popular, views }: whether each sort has any real data behind it.
export async function fetchPopularityAvailability(client = supabase) {
  const [popular, views] = await Promise.all([
    anyPositive(client, "popularity_score"),
    anyPositive(client, "view_count_total"),
  ]);
  return { popular, views };
}

// null until the check resolves; { popular, views } once it does. On error the
// state stays null, so callers keep the controls rather than fail the page.
export function usePopularityAvailability() {
  const [state, setState] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;

    fetchPopularityAvailability()
      .then((result) => {
        if (active) setState(result);
      })
      .catch(() => {
        // Optional UI metadata. On a transient error, keep the controls.
      });

    return () => {
      active = false;
    };
  }, []);

  return state;
}
