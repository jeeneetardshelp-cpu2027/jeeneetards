// useChapterName.js — the display name for a chapter the URL only knows by id.
//
// Search chapter results deep-link /browse?ch=<id> because universal_search
// returns just the chapter's id (extra.chapter_id) — no chapter, subject or
// goal slugs — so searchDestinations.js cannot build the canonical
// ?chapter=<slug> URL. Dashboard's other label sources both miss that link:
//
//   * useCanonicalFilters resolves SLUGS to ids; a numeric id passes straight
//     through with no name attached
//   * useFilterOptions loads the chapter list only once a subject is selected
//
// so the filter chip read "27 ×" and the heading stayed "All courses". This is
// one bounded primary-key lookup to fill that gap. On failure the name stays
// null — the chip then shows the raw value, which is honest, and removing the
// chip still works (removeChip clears ch/chapter regardless of the label).

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export function useChapterName(chapterId, { enabled = true } = {}) {
  const [name, setName] = useState(null);

  useEffect(() => {
    let active = true;
    setName(null);
    if (!enabled || chapterId == null || !isSupabaseConfigured) return undefined;

    supabase
      .from("chapters")
      .select("id, name")
      .eq("id", chapterId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          // A failed lookup is a missing label, not a broken page. The caller
          // falls back to the raw value rather than inventing a name.
          console.error("chapter name:", error);
          return;
        }
        setName(data?.name ?? null);
      });

    return () => { active = false; };
  }, [chapterId, enabled]);

  return name;
}
