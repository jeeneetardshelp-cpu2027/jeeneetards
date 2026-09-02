// searchHistory.js — the last few searches that actually worked, on this
// device and nowhere else.
//
// WHY. The search box started cold every single day. A student who found
// "rotational motion" on Monday retyped it on Tuesday, and a student opening
// /search for the first time was told "Type at least 2 characters" and left to
// guess what the box understands. Both are fixed here: the searches that
// worked come back as chips, and when there are none yet a small curated list
// shows what the box can do.
//
// THIS IS NOT THE SEARCH-GAP LOG, and the difference is the whole point.
// searchGapLog.js sends a query TO THE SERVER when it finds nothing, because
// "students looked for this and we do not have it" is a fact about the
// library. This file is its mirror image and its opposite:
//
//   * only SUCCESSFUL queries — a settled search that returned at least one
//     row. A query that found nothing is never remembered; offering a student
//     their own dead ends back is worse than offering nothing;
//   * the text NEVER LEAVES THE BROWSER. There is no network call in this
//     file, no id of any kind is stored beside the query, and no server ever
//     sees a row of it. Clearing site data deletes it completely, and so does
//     the Clear button on the chips themselves.
//
// STORAGE DISCIPLINE follows streak.js and examLane.js exactly: one versioned
// ll_* key, every read and write wrapped, and a blocked or corrupt store
// degrades to "no history" rather than to an error. Nothing here may ever
// throw into a render — a search box that crashes because a school-lab machine
// blocks localStorage is a far worse bug than a search box with no memory.
//
// Like every ll_* key, this one is listed in the Privacy Policy's local-storage
// inventory (PrivacyPolicy.jsx section 4), and src/legalTruth.test.js derives
// that requirement from this file so the two cannot drift apart.

const KEY = "ll_search_history_v1";

/** Exported so the policy test and the UI can name the key without copying it. */
export const SEARCH_HISTORY_KEY = KEY;

// Eight is a row or two of chips on a phone and a couple of hundred bytes on
// disk. Beyond that the list stops being "what I was working on" and becomes a
// log, which is not what this is for.
export const MAX_RECENT_SEARCHES = 8;

// A floor of this file's own, deliberately NOT imported from
// useUniversalSearch.js — that module imports this one, and two test suites
// mock it wholesale, so reaching back into it would be a cycle and a
// mock-shaped trap. It only has to be no LONGER than the shortest query the
// box will actually run: anything shorter than MIN_QUERY never reaches
// rememberSearch in the first place, because a search that was never run
// cannot have settled with results.
//
// MIN_QUERY has already moved once (2 -> 3, when two-character searches were
// found to be unservable), which is why searchHistory.test.js asserts the
// relationship rather than the number, and asserts every starter is long
// enough for the box to run it.
export const RECENT_SEARCH_MIN_LENGTH = 2;

// The same ceiling searchGapLog.js uses. A pasted essay is not a search.
export const RECENT_SEARCH_MAX_LENGTH = 120;

// How long a settled, successful query must stay unchanged before it is worth
// remembering. Same reasoning — and the same number — as GAP_LOG_DELAY_MS:
// without it, a student typing "kinema… tics" with one pause stores "kinema"
// as well, and half-typed prefixes are exactly what makes a recent-search list
// feel like junk. See scheduleSearchMemory below for how it is superseded.
export const HISTORY_SETTLE_MS = 1200;

/** Trimmed, internal whitespace collapsed, capped. Never null. */
const clean = (value) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, RECENT_SEARCH_MAX_LENGTH)
    : "";

// Case-insensitive for Latin, a no-op for Devanagari — the same rule
// searchGapLog.js uses for its dedupe, for the same reason: real script-neutral
// grouping is search_latin_key and that runs server-side, which is somewhere
// this data deliberately never goes.
const dedupeKey = (term) => term.toLowerCase();

/**
 * The remembered queries, most recent first, de-duplicated and capped.
 *
 * Returns [] for blocked storage, absent storage, corrupt JSON, or a stored
 * shape this version does not recognise. Garbage is dropped on the way out
 * rather than trusted, so a hand-edited key cannot put anything on screen that
 * this file would not have written itself.
 */
export function getRecentSearches() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const stored = Array.isArray(raw?.queries) ? raw.queries : [];
    const out = [];
    const seen = new Set();
    for (const value of stored) {
      const term = clean(value);
      if (term.length < RECENT_SEARCH_MIN_LENGTH) continue;
      const key = dedupeKey(term);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(term);
      if (out.length >= MAX_RECENT_SEARCHES) break;
    }
    return out;
  } catch {
    // Blocked, disabled or corrupt storage must not break the search box; an
    // empty list is the honest reading of "we cannot tell".
    return [];
  }
}

/**
 * Remember one query that SUCCEEDED.
 *
 * `resultCount` is load-bearing, not decoration: a settled search that
 * returned nothing is never stored, so the chips can only ever offer a student
 * something that worked at least once. Returns the resulting list, so a caller
 * can render it without a second read.
 */
export function rememberSearch(query, { resultCount = 0 } = {}) {
  const term = clean(query);
  if (term.length < RECENT_SEARCH_MIN_LENGTH) return getRecentSearches();

  const n = Number(resultCount);
  if (!Number.isFinite(n) || n < 1) return getRecentSearches();

  const key = dedupeKey(term);
  // Most recent first, and the newest spelling of a repeated query wins — a
  // student who searched "shm" and later "SHM" should see the one they last
  // typed, not a stale casing.
  const next = [term, ...getRecentSearches().filter((row) => dedupeKey(row) !== key)]
    .slice(0, MAX_RECENT_SEARCHES);

  try {
    localStorage.setItem(KEY, JSON.stringify({ queries: next }));
  } catch {
    // Storage blocked — the search simply is not remembered. Returning `next`
    // anyway would let a caller render a chip that vanishes on reload.
    return getRecentSearches();
  }
  return next;
}

/**
 * Forget every remembered search on this device. The Clear button, and sign-out.
 *
 * Cancels the scheduled write below as well as removing the stored list. A
 * search that settled moments ago still holds that timer, and it calls
 * rememberSearch() on a delay — so without this, clearing lasts only until the
 * timer fires and the term the student just cleared writes itself straight
 * back. It is the same 1200ms window for the Clear button and for sign-out,
 * and on a shared machine the sign-out case is the one that matters.
 */
export function clearRecentSearches() {
  clearTimeout(pending);
  pending = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — there was nothing stored to clear */
  }
  return [];
}

// One pending slot, module level. A NEW schedule replaces the one before it,
// which is what stops "kine" from being stored on the way to "kinematics":
// the hook re-schedules as soon as the longer query settles, well inside
// HISTORY_SETTLE_MS.
let pending = null;

/**
 * Schedule a remember for a query that has just settled WITH results.
 *
 * Deliberately NOT cancelled from the hook's effect cleanup, unlike
 * scheduleSearchGapLog. A gap log is a permanent shared row, so a superseded
 * one must never be sent; this is a device-local note about a search that
 * genuinely worked, and cancelling on unmount would throw away precisely the
 * best searches — the ones the student clicked a result from within a second.
 * Superseding is handled by the single slot above instead.
 *
 * Returns a cancel function anyway, for tests and for a caller that has a real
 * reason to withdraw one.
 */
export function scheduleSearchMemory(query, { resultCount = 0, delay = HISTORY_SETTLE_MS } = {}) {
  const term = clean(query);
  const n = Number(resultCount);
  if (term.length < RECENT_SEARCH_MIN_LENGTH || !Number.isFinite(n) || n < 1) {
    return () => {};
  }

  clearTimeout(pending);
  const timer = setTimeout(() => {
    pending = null;
    rememberSearch(term, { resultCount: n });
  }, delay);
  pending = timer;

  return () => {
    clearTimeout(timer);
    if (pending === timer) pending = null;
  };
}

// ---------------------------------------------------------------- starters
//
// What a first-time student sees instead of an empty box. Shown ONLY while
// there is no history, because a student who has their own searches back does
// not need to be taught the box any more.
//
// EVERY ONE OF THESE RETURNS RESULTS IN PRODUCTION, and each line below names
// where that is written down. Nothing here is invented: a suggestion that
// finds nothing would be a worse first impression than no suggestion at all,
// and any candidate that could not be tied to evidence in this repository was
// dropped rather than guessed at.
//
//   * shm / goc / pnc — seeded curated shorthand in
//     supabase/migrations/20260902170000_search_aliases.sql (applied). That
//     migration's self-test runs universal_search on every seeded alias AND on
//     its expansion inside the transaction and ABORTS if either points at
//     nothing, so these three reaching results is a property of the deployed
//     database, not a hope. They also teach the most useful thing about this
//     box: the shorthand a coaching classroom says out loud works.
//   * "gravitation class 11" and "projectile motion numericals" — two of the
//     six queries in section D of that same self-test ("nothing that worked
//     broke"), which aborts if any of them returns zero rows.
//   * "biology" — measured against production on 2026-09-02 at 21 rows; the
//     measurement is recorded in the header of src/searchAliases.js beside the
//     Hindi words it was taken to justify.
//
// Deliberately NOT here: a previous-year-paper query. Paper titles are seeded
// data rather than schema, so nothing in this repository proves a particular
// one exists in production, and the rule above says drop it.
export const STARTER_QUERIES = Object.freeze([
  "shm",
  "goc",
  "pnc",
  "gravitation class 11",
  "projectile motion numericals",
  "biology",
]);
