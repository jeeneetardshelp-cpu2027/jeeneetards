// useUniversalSearch.js — the client half of universal search.
//
// It does as little as possible on purpose. Ranking, grouping, counting and
// paging all happen in universal_search(); this hook debounces, cancels and
// renders. If you ever find yourself sorting or filtering results here, the
// query is wrong — the browser must never hold the catalogue (requirement 4).

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

// Requirement 6. Two characters is the floor the database enforces too; the
// client checks as well so we don't spend a round trip learning it.
export const MIN_QUERY = 2;

// Requirement 7. 275ms sits in the asked-for 250-300ms band: long enough that
// a typed word is one request rather than six, short enough to feel live.
export const DEBOUNCE_MS = 275;

export const GROUPS = [
  { key: "faculty",   label: "Faculty" },
  { key: "chapter",   label: "Chapters" },
  { key: "playlist",  label: "Playlists" },
  { key: "lecture",   label: "Lectures" },
  { key: "institute", label: "Institutes" },
];

const EMPTY = Object.freeze({});

/** Shape the flat RPC rows into { faculty: {rows, total}, ... }, order preserved. */
export function groupRows(rows) {
  const out = {};
  for (const r of rows ?? []) {
    const g = (out[r.group_key] ??= { rows: [], total: 0 });
    g.rows.push({
      id: r.entity_id,
      title: r.title,
      subtitle: r.subtitle,
      aka: r.aka,
      slug: r.slug,
      matchType: r.match_type,
      matchRank: r.match_rank,
      matchedOn: r.matched_on,
      // Requirement 2: the UI must not auto-select an ambiguous identity, so
      // this flag has to survive all the way to the component.
      isAmbiguous: r.is_ambiguous === true,
      extra: r.extra ?? {},
    });
    g.total = Number(r.group_total ?? g.rows.length);
  }
  return out;
}

export function useUniversalSearch(query, { type = null, limit = 5 } = {}) {
  const [state, setState] = useState({
    groups: EMPTY, loading: false, error: null, tooShort: false, query: "",
  });

  // Requirement 7: cancellation of obsolete requests. A monotonic id is more
  // reliable here than AbortController — supabase-js resolves rather than
  // rejects on some paths, and a stale resolve that arrives after a newer one
  // is exactly the bug that makes a search box show results for a prefix of
  // what you typed. Anything but the newest generation is discarded.
  const generation = useRef(0);
  const [page, setPage] = useState(0);
  // Retry needs its own state. setPage(p => p) looks like a re-run but React
  // bails out when the value is identical, so the effect never fires and the
  // "Try again" button does nothing at all.
  const [nonce, setNonce] = useState(0);

  // Changing the query or the type restarts paging; keeping the old offset
  // would silently show page 3 of a brand new result set.
  useEffect(() => { setPage(0); }, [query, type]);

  useEffect(() => {
    const term = (query ?? "").trim();
    const gen = ++generation.current;

    if (!term) {
      setState({ groups: EMPTY, loading: false, error: null, tooShort: false, query: "" });
      return;
    }
    if (term.length < MIN_QUERY) {
      setState({ groups: EMPTY, loading: false, error: null, tooShort: true, query: term });
      return;
    }
    if (!isSupabaseConfigured) {
      setState({ groups: EMPTY, loading: false, error: "Search isn't available right now.",
                 tooShort: false, query: term });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null, tooShort: false, query: term }));

    const timer = setTimeout(() => {
      supabase
        .rpc("universal_search", {
          p_query: term,
          p_types: type ? [type] : null,
          p_limit: limit,
          p_offset: page * limit,
        })
        .then(({ data, error }) => {
          if (gen !== generation.current) return;      // obsolete — drop it
          if (error) {
            console.error("universal_search:", error);
            setState({ groups: EMPTY, loading: false, tooShort: false, query: term,
                       error: "Search is unavailable. Please try again." });
            return;
          }
          setState({ groups: groupRows(data), loading: false, error: null,
                     tooShort: false, query: term });
        });
    }, DEBOUNCE_MS);

    // Clearing the timer cancels a request that has not left yet; bumping the
    // generation discards one already in flight. Both are needed.
    return () => clearTimeout(timer);
  }, [query, type, limit, page, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, page, setPage, retry };
}
