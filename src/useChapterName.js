// useChapterName.js — the display name for a chapter the URL only knows by id.
//
// Search chapter results deep-link /browse?ch=<id> because universal_search
// returns just the chapter's id (extra.chapter_id) — no chapter, subject or
// goal slugs — so searchDestinations.js cannot build the canonical
// ?chapter=<slug> URL. BrowsePage's other label sources both miss that link:
//
//   * useCanonicalFilters resolves SLUGS to ids; a numeric id passes straight
//     through with no name attached
//   * useFilterOptions loads the chapter list only once a subject is selected
//
// so the filter chip read "27 ×" and the heading stayed "All courses". This is
// one bounded primary-key lookup to fill that gap. On failure the name stays
// null — the chip then shows the raw value, which is honest, and removing the
// chip still works (removeChip clears ch/chapter regardless of the label).
//
// A FAILURE IS REPORTED, NOT ONLY LOGGED. The chip's raw value was honest; the
// heading was not. With only this lookup aborted, /browse?ch=7 headed its
// chapter-7 course cards "All courses", and nothing on the page could ask for
// the name again — the effect re-ran only when the id changed. The page can
// only tell a failure from a lookup still on its way if it is told, so:
//
//   pending   name null, error null   say nothing: an answer is coming
//   failed    name null, error set    say so, and offer retry()
//   no row    name null, error null   not a failure: asking again would
//                                      return the same nothing
//
// No automatic retry. postgrest already retries a GET; retry() is for a button.

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export function useChapterName(chapterId, { enabled = true } = {}) {
  const [name, setName] = useState(null);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setName(null);
    // Cleared on every run, including when the caller switches the lookup off
    // because another source now knows the name: a stale failure must not keep
    // offering Try again for a label that is already on screen.
    setError(null);
    if (!enabled || chapterId == null || !isSupabaseConfigured) return undefined;

    supabase
      .from("chapters")
      .select("id, name")
      .eq("id", chapterId)
      .maybeSingle()
      .then(({ data, error: lookupError }) => {
        if (!active) return;
        if (lookupError) {
          // A failed lookup is a missing label, not a broken page. The caller
          // falls back to the raw value rather than inventing a name.
          console.error("chapter name:", lookupError);
          setError(lookupError);
          return;
        }
        setName(data?.name ?? null);
      });

    return () => { active = false; };
  }, [chapterId, enabled, nonce]);

  return { name, error, retry: () => setNonce((n) => n + 1) };
}
