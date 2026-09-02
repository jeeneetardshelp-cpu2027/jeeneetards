// useUniversalSearch.js — the client half of universal search.
//
// It does as little as possible on purpose. Ranking, grouping, counting and
// paging all happen in universal_search(); this hook debounces, cancels and
// renders. If you ever find yourself sorting or filtering results here, the
// query is wrong — the browser must never hold the catalogue (requirement 4).
//
// The two things it does beyond fetching, and they are mirror images:
//
//   * when a search SETTLES with nothing, it hands the query to
//     searchGapLog.js, because "students looked for this and we do not have
//     it" is the most useful thing this hook ever learns and it currently
//     evaporates. That path goes TO THE SERVER; it is fire-and-forget,
//     cancellable and silent — see the conditions guarding it below, and the
//     file itself for what does and does not leave the browser.
//   * when a search SETTLES WITH RESULTS, it hands the query to
//     searchHistory.js so the box can offer it again tomorrow. That path never
//     leaves the device: it is a localStorage write and nothing else.
//
// Neither one can delay, block or break the render, and neither one changes
// what is on screen for this search.

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { expandSearchQuery } from "./searchAliases.js";
import { scheduleSearchGapLog } from "./searchGapLog";
import { scheduleSearchMemory } from "./searchHistory.js";

// Requirement 6. The client checks so we don't spend a round trip learning it.
//
// THREE, not the two the RPC still allows. Measured against production on
// 2026-09-02: a two-character query cannot be served. It yields at most one or
// two trigrams, so the GIN index cannot narrow candidates and the planner
// scans — "ac" took 3887ms and "3d" 3217ms against a ~3s statement timeout,
// and both came back as HTTP 500 `57014 canceling statement due to statement
// timeout`. Not slow results: a failed request, where a student typing "ac"
// for Alternating Current sees an error. A non-alias "zq" failed the same way,
// so this is about query length, not the alias table.
//
// For comparison, at the same moment: "electromagnetic induction" 606ms,
// "kinematics" 861ms, "emi" 1770ms. The cliff is specific to two characters.
//
// Raising the floor here turns those failures into an instant empty result.
// The RPC's own floor is still `qlen < 2`, so a caller that bypasses this hook
// can still reach the cliff, and a LONGER query whose tokens are all tiny
// ("p and c") still times out — that one needs the RPC floor raised or the
// alias row retired, which is a migration, not a client change.
export const MIN_QUERY = 3;

// Requirement 7. 275ms sits in the asked-for 250-300ms band: long enough that
// a typed word is one request rather than six, short enough to feel live.
export const DEBOUNCE_MS = 275;

// The order here is the order results are drawn in and the order the arrow
// keys walk. `material` and `paper` are APPENDED, never inserted: a group the
// deployed universal_search does not know about simply returns no rows, and a
// group with no rows renders nothing at all — so this list is safe to ship
// before supabase/migrations/20260901160000_universal_search_materials.sql is
// applied, and the five video groups keep their existing positions either way.
export const GROUPS = [
  { key: "faculty",   label: "Faculty" },
  { key: "chapter",   label: "Chapters" },
  { key: "playlist",  label: "Playlists" },
  { key: "lecture",   label: "Lectures" },
  { key: "institute", label: "Institutes" },
  { key: "material",  label: "Notes & sheets" },
  { key: "paper",     label: "Previous-year papers" },
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

/**
 * Merge a LATER page's rows into the groups already on screen. Order is still
 * entirely the server's: earlier pages first, then this page's rows in the
 * order they arrived. A row the server repeats across pages (the result set
 * can shift underneath paging) is dropped rather than drawn twice.
 */
export function appendGroupRows(prev, rows) {
  const next = { ...prev };
  const incoming = groupRows(rows);
  for (const [key, bucket] of Object.entries(incoming)) {
    const before = next[key] ?? { rows: [], total: 0 };
    const seen = new Set(before.rows.map((r) => r.id));
    next[key] = {
      rows: [...before.rows, ...bucket.rows.filter((r) => !seen.has(r.id))],
      total: bucket.total,
    };
  }
  return next;
}

async function addChannelLogos(rows) {
  const ids = [...new Set(
    (rows ?? [])
      .filter((row) => row.group_key === "institute")
      .map((row) => Number(row.entity_id))
      .filter((id) => Number.isInteger(id) && id > 0),
  )];
  if (!ids.length) return rows;

  // One bounded lookup for every matched channel. A failed optional image
  // lookup must never make names or navigation disappear.
  const { data, error } = await supabase
    .from("institutes_channels")
    .select("id, logo_url")
    .in("id", ids);
  if (error) {
    console.error("channel logos:", error);
    return rows;
  }

  const byId = new Map((data ?? []).map((row) => [Number(row.id), row.logo_url ?? null]));
  return rows.map((row) => row.group_key === "institute"
    ? {
        ...row,
        extra: { ...(row.extra ?? {}), logo_url: byId.get(Number(row.entity_id)) ?? null },
      }
    : row);
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
  // Cancel handle for a pending "this search found nothing" log. Held in a ref
  // because it is created inside the RPC's .then(), long after the effect
  // returned its cleanup — and the cleanup is the only thing that can promise
  // a superseded search never becomes a row.
  const cancelGapLog = useRef(null);
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
          // The words a student types, in the language they type them. An
          // exact alias becomes its English equivalent; anything else reaches
          // the RPC exactly as typed. See searchAliases.js.
          p_query: expandSearchQuery(term),
          p_types: type ? [type] : null,
          p_limit: limit,
          p_offset: page * limit,
        })
        .then(async ({ data, error }) => {
          if (gen !== generation.current) return;      // obsolete — drop it
          if (error) {
            console.error("universal_search:", error);
            // Page 0 replaces; a failed LATER page keeps the rows already on
            // screen, so a retry appends instead of restarting from nothing.
            setState((s) => ({
              groups: page > 0 ? s.groups : EMPTY,
              loading: false, tooShort: false, query: term,
              error: "Search is unavailable. Please try again.",
            }));
            return;
          }
          const enriched = await addChannelLogos(data);
          if (gen !== generation.current) return;
          // "Show more" (page > 0) APPENDS below what is already shown; a new
          // query or type starts over at page 0 and replaces.
          setState((s) => ({
            groups: page > 0 ? appendGroupRows(s.groups, enriched) : groupRows(enriched),
            loading: false, error: null, tooShort: false, query: term,
          }));

          // A SETTLED first page of an unfiltered search that came back with
          // nothing is the one thing worth remembering about this request: it
          // names content the library does not have. Conditions, all of them
          // load-bearing:
          //   * gen === generation.current (checked twice above) — a stale
          //     response for a prefix of what the student has since typed must
          //     never be logged;
          //   * no error — a failed search is not an empty library;
          //   * page 0 — an exhausted "Show more" is not a zero-result search;
          //   * no type filter — a row saying "kinematics" is honest, a row
          //     saying "kinematics" when the student had narrowed to Faculty
          //     would not be, and this table stores no filter column.
          // Fire-and-forget: scheduleSearchGapLog starts a timer, returns
          // immediately and never touches state, so nothing here can delay,
          // block or break the render. The cleanup below cancels it.
          if (page === 0 && !type && (enriched ?? []).length === 0) {
            cancelGapLog.current?.();
            cancelGapLog.current = scheduleSearchGapLog(term, { resultCount: 0 });
          }

          // The other half of the same moment: a SETTLED first page that came
          // back with rows is a query worth offering the student again. Same
          // gen/error/page-0 guards as the gap log above — a stale response
          // for a prefix must not be remembered either — but deliberately NOT
          // restricted to the unfiltered view: a type-filtered search that
          // found rows is a subset of the unfiltered one, so re-running the
          // remembered query from a chip cannot come back empty.
          //
          // Not cancelled by the cleanup below, unlike the gap log. See the
          // note on scheduleSearchMemory: a gap log is a permanent shared row
          // and a superseded one must never be sent, while this is a
          // device-local note about a search that worked — and cancelling on
          // unmount would drop exactly the searches a student clicked straight
          // through. A later query supersedes it inside searchHistory.js.
          if (page === 0 && (enriched ?? []).length > 0) {
            scheduleSearchMemory(term, { resultCount: enriched.length });
          }
        });
    }, DEBOUNCE_MS);

    // Clearing the timer cancels a request that has not left yet; bumping the
    // generation discards one already in flight; cancelling the pending gap
    // log means a query the student kept typing past is never recorded as a
    // gap. All three are needed.
    return () => {
      clearTimeout(timer);
      cancelGapLog.current?.();
      cancelGapLog.current = null;
    };
  }, [query, type, limit, page, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, page, setPage, retry };
}
