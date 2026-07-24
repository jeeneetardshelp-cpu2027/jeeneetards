// Contextual catalogue counts from one bounded database call.
//
// The RPC excludes a facet's own current selection while applying every other
// active filter. That lets a student switch alternatives without a second
// catalogue download, and DISTINCT playlist counts keep multi-tag courses from
// appearing twice under Dropper.

import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";
import { isMissingCatalogRpc } from "./useExplore.js";

const EMPTY = {
  counts: null,
  loading: false,
  error: null,
  unavailable: false,
};

export function facetRowsToCounts(rows) {
  const counts = {};
  for (const row of rows ?? []) {
    if (!row?.facet || row.value == null) continue;
    (counts[row.facet] ??= {})[String(row.value)] = Number(row.n ?? 0);
  }
  return counts;
}

export function useBrowseFacets({
  goal = null,
  stage = null,
  subject = null,
  chapter = null,
  channelId = null,
  language = null,
  contentType = null,
  difficulty = null,
  search = "",
  enabled = true,
} = {}) {
  const [state, setState] = useState({ ...EMPTY, loading: enabled });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState(EMPTY);
      return;
    }
    if (!isSupabaseConfigured) {
      setState({ ...EMPTY, unavailable: true });
      return;
    }

    setState((previous) => ({
      ...previous,
      loading: true,
      error: null,
      unavailable: false,
    }));

    supabase.rpc("browse_facet_counts", {
      p_goal: goal || null,
      p_class: stage || null,
      p_subject: subject || null,
      p_chapter: chapter || null,
      p_channel: channelId ? Number(channelId) : null,
      p_language: language?.length ? language : null,
      p_type: contentType?.length ? contentType : null,
      p_difficulty: difficulty?.length ? difficulty : null,
      p_search: search.trim() || null,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error) {
        if (isMissingCatalogRpc(error)) {
          // Capability fallback: filters still work on production before v9 is
          // deliberately deployed; only their contextual counts are omitted.
          setState({ ...EMPTY, unavailable: true });
          return;
        }
        console.error("browse facet counts:", error);
        setState({ ...EMPTY, error: "Filter counts couldn't be loaded." });
        return;
      }
      setState({
        counts: facetRowsToCounts(data),
        loading: false,
        error: null,
        unavailable: false,
      });
    }).catch((reason) => {
      if (!active) return;
      console.error("browse facet counts:", reason);
      setState({ ...EMPTY, error: "Filter counts couldn't be reached." });
    });

    return () => { active = false; };
  }, [
    goal, stage, subject, chapter, channelId,
    JSON.stringify(language), JSON.stringify(contentType), JSON.stringify(difficulty),
    search, enabled, nonce,
  ]);

  return { ...state, retry: () => setNonce((value) => value + 1) };
}
