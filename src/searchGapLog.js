// searchGapLog.js — best-effort record of the searches that found nothing.
//
// WHY. A zero-result search is the library's clearest statement about itself:
// it names the aliases that are missing and, more usefully, the content
// students came for and did not find. Today that fact vanishes the moment the
// student retypes or leaves.
//
// WHAT LEAVES THE BROWSER. The query text and a result count. Nothing else.
// No user id, no session id, no page, no filter, no timing — the RPC
// (supabase/migrations/20260902210000_search_gap_log.sql) takes no identity
// argument at all, so there is nothing here for a later change to start
// attaching by accident. Signed-in and signed-out students send exactly the
// same thing.
//
// FAILURE IS SILENT, exactly the way progressSync.pushNow is silent: a search
// that found nothing is already the student's problem, and turning a failed
// bookkeeping call into console noise or a visible error would make a bad
// moment worse. supabase-js RESOLVES rather than rejects for a missing
// function, so "the migration is not applied yet" costs one ignored 404 and
// changes nothing on screen.
//
// TWO DEFENCES AGAINST LOGGING THE SAME GAP SIX TIMES:
//
//   1. A settle delay. useUniversalSearch already debounces the REQUEST by
//      275ms, but a student typing "kinemat" with pauses still produces
//      several settled zero-result searches. Nothing is logged until the query
//      has sat unchanged for GAP_LOG_DELAY_MS after its result arrived, and
//      the caller cancels the pending log the instant anything changes. So
//      "k-i-n-e-m-a-t" logs "kinemat", once, and only if the student stopped
//      there.
//   2. A per-tab dedupe window. The same query is not sent again for
//      GAP_LOG_DEDUPE_MS, so a remount, a back-navigation or a reload of the
//      same /browse URL does not add rows.
//
// Both are conveniences, not the boundary: the ceilings that actually stop a
// flood are in the database function, because a cap in the browser is a
// suggestion.

import { supabase, isSupabaseConfigured } from "./supabaseClient";

const RPC = "log_search_gap";

// Matches MIN_QUERY in useUniversalSearch.js and the floor inside the RPC.
export const GAP_LOG_MIN_LENGTH = 2;
// Matches the 120-character cap the column enforces. Truncating here as well
// keeps the request small; the database is still the one that decides.
export const GAP_LOG_MAX_LENGTH = 120;
// How long a settled zero-result query must stay unchanged before it counts as
// a gap rather than a keystroke on the way to something else.
export const GAP_LOG_DELAY_MS = 1200;
// How long one query stays deduped within this tab.
export const GAP_LOG_DEDUPE_MS = 10 * 60 * 1000;

// query -> last-sent timestamp. Module-level, like progressSync's throttle map.
const sentAt = new Map();
// A cap so a very long session cannot grow this without bound.
const MAX_TRACKED = 500;

function dedupeKey(term) {
  // Lowercasing is a no-op for Devanagari and correct for Latin; the real
  // script-neutral grouping is search_latin_key, and that runs server-side.
  return term.toLowerCase();
}

function prune(now) {
  for (const [key, at] of sentAt) {
    if (now - at >= GAP_LOG_DEDUPE_MS) sentAt.delete(key);
  }
  // Still oversized after expiry (a scripted flood): drop oldest-first.
  while (sentAt.size > MAX_TRACKED) {
    const oldest = sentAt.keys().next();
    if (oldest.done) break;
    sentAt.delete(oldest.value);
  }
}

async function send(term, resultCount) {
  try {
    await supabase.rpc(RPC, { p_query: term, p_result_count: resultCount });
  } catch {
    // Offline, blocked, or the migration is not applied yet. There is nothing
    // to retry and nothing to tell the student.
  }
}

/**
 * Send one gap now, subject to the per-tab dedupe window.
 * Returns true if a request was actually started — tests assert on that
 * rather than on the network.
 */
export function logSearchGap(query, resultCount = 0) {
  if (!isSupabaseConfigured || !supabase) return false;

  const term = (query ?? "").trim().slice(0, GAP_LOG_MAX_LENGTH);
  if (term.length < GAP_LOG_MIN_LENGTH) return false;

  const key = dedupeKey(term);
  const now = Date.now();
  const last = sentAt.get(key);
  if (last !== undefined && now - last < GAP_LOG_DEDUPE_MS) return false;

  sentAt.set(key, now);
  prune(now);

  // Never trust a count into the request either: the column is clamped
  // server-side, and sending a NaN would only produce a rejected call.
  const n = Number(resultCount);
  send(term, Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0);
  return true;
}

/**
 * Schedule a gap log for a query that has just settled with zero results.
 * Returns a cancel function — call it from an effect cleanup so a superseded
 * or in-flight search never becomes a row.
 */
export function scheduleSearchGapLog(query, { resultCount = 0, delay = GAP_LOG_DELAY_MS } = {}) {
  const term = (query ?? "").trim();
  if (!isSupabaseConfigured || term.length < GAP_LOG_MIN_LENGTH) return () => {};
  const timer = setTimeout(() => logSearchGap(term, resultCount), delay);
  return () => clearTimeout(timer);
}
