// useVideoSearch.js — find an existing lecture by title, from the whole table.
//
// The admin course builder used to filter a preloaded array. That array came
// from one unbounded `.select()` on `videos`, and PostgREST silently caps such
// a request at 1000 rows — measured on production 2026-09-02, `videos` holds
// 5471. Ordered `id DESC`, the 4471 it never fetched were the OLDEST, so an
// admin searching for an older lecture got "No videos match": indistinguishable
// from the lecture not existing, on a form whose whole job is to find it.
//
// Paging that read would fix the truncation and cost 6 requests, 649 KB and
// 2.5 s on EVERY admin panel load — measured — for data one form uses. Asking
// the database instead answers in about 200 ms and only when somebody types.
//
// ilike, not the search_video_ids RPC that /browse uses. That RPC is
// typo-tolerant and alias-aware, which is right for a student guessing at a
// chapter name and wrong here: an admin knows the title they are looking for,
// and fuzzy matches would put lectures they did not ask for in a list they are
// about to attach to a course.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

// The picker shows 25. Asking for more would be fetching rows to discard.
export const VIDEO_SEARCH_LIMIT = 25;

// Same as the main search box, so the two feel like one product.
export const VIDEO_SEARCH_DEBOUNCE_MS = 275;

const EMPTY = { results: [], loading: false, error: null };

/**
 * `%` and `_` are ILIKE wildcards and `\` escapes them, so a title containing
 * any of the three has to be escaped or the admin's literal text silently
 * becomes a pattern. Searching for "100%" would otherwise match everything.
 */
export function escapeLikePattern(value) {
  return String(value ?? "").replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Debounced title search over the whole `videos` table.
 *
 * An empty query lists the newest lectures, which is what the form showed
 * before this existed — opening it should not present a blank list.
 */
export function useVideoSearch(query) {
  const [state, setState] = useState({ ...EMPTY, loading: true });
  // Monotonic, so a slow answer for "kin" cannot overwrite a fast one for
  // "kinematics". The picker is a search box; out-of-order results in it would
  // show the admin lectures that do not match what they typed.
  const generation = useRef(0);

  const run = useCallback(async (term) => {
    const gen = ++generation.current;
    if (!isSupabaseConfigured) {
      setState({ results: [], loading: false, error: "Supabase isn't configured." });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    let request = supabase
      .from("videos")
      .select("id, title, youtube_video_id, chapter_id")
      .order("id", { ascending: false })
      .limit(VIDEO_SEARCH_LIMIT);
    if (term) request = request.ilike("title", `%${escapeLikePattern(term)}%`);

    const { data, error } = await request;
    if (gen !== generation.current) return;
    if (error) {
      console.error("video search:", error);
      setState({ results: [], loading: false, error: "Couldn't search lectures." });
      return;
    }
    setState({ results: data ?? [], loading: false, error: null });
  }, []);

  useEffect(() => {
    const term = (query ?? "").trim();
    // No debounce on the empty query: that is the form opening, not typing.
    if (!term) {
      run("");
      return undefined;
    }
    const timer = setTimeout(() => run(term), VIDEO_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, run]);

  return state;
}
