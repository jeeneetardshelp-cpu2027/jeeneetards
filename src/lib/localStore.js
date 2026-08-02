// localStore.js — a device-local key registry and reset helper.
//
// ⚠️ NOT WIRED UP. Nothing in the app imports this module, no test covers it,
// and none of the keys in REGISTRY below has ever been written by the product.
// Treat it as a proposal, not as a description of the running system.
//
// This warning exists because the header previously claimed to be "every piece
// of state this product keeps about a student", with "one registry of keys,
// one read/write path". Both claims were false and dangerously so: someone
// answering a data access or deletion request would have read REGISTRY as the
// authoritative on-device inventory and got it wrong in both directions.
//
// What the product ACTUALLY writes today, none of it through this module:
//   • lecture-library-theme  — src/theme.jsx
//   • ll_progress_v1         — src/progress.js  (also synced server-side for
//                              signed-in students, see progressSync.js)
//   • ll_player_prefs_v1     — src/progress.js
//   • returnTo:*             — src/returnTo.js   (sessionStorage)
//   • scroll:*               — src/App.jsx       (sessionStorage)
//
// Before wiring this up: make REGISTRY match that list, and make
// clearAllLocalData() actually clear those keys — as written it would miss
// every one of them, and would also promise to clear three `jn:` keys that do
// not exist. The authoritative student-facing inventory is the Privacy Policy
// (src/PrivacyPolicy.jsx sections 4 and 5), which is kept honest by
// src/legalTruth.test.js.

const PREFIX = "jn:";

/**
 * Every key this product writes, with a plain-English label. The labels are
 * shown to the student on the privacy page, so they are copy, not comments.
 */
export const REGISTRY = Object.freeze([
  { key: "lecture-library-theme", raw: true, label: "Your light or dark theme choice" },
  { key: "ll_progress_v1", raw: true, label: "Which lectures you have watched, and where you stopped" },
  { key: `${PREFIX}recent-searches`, label: "Your recent searches" },
  { key: `${PREFIX}saved-courses`, label: "Courses you have saved" },
  { key: `${PREFIX}compare`, label: "Courses in your comparison tray" },
]);

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Private mode, or the quota is full. Every caller treats persistence as
    // best-effort: the feature still works for the current session.
    return false;
  }
}

/* --------------------------------------------------------- recent searches */

const RECENT_KEY = `${PREFIX}recent-searches`;
const RECENT_MAX = 6;
// A search term is the most sensitive thing a student types here, so it is
// capped rather than stored verbatim at any length, and never leaves the
// device (see lib/analytics.js, which sends only the length).
const RECENT_MAX_LEN = 60;

export function getRecentSearches() {
  const list = read(RECENT_KEY, []);
  return Array.isArray(list) ? list.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : [];
}

export function addRecentSearch(term) {
  const text = String(term ?? "").trim().slice(0, RECENT_MAX_LEN);
  if (text.length < 2) return getRecentSearches();
  const next = [text, ...getRecentSearches().filter((x) => x.toLowerCase() !== text.toLowerCase())]
    .slice(0, RECENT_MAX);
  write(RECENT_KEY, next);
  return next;
}

export function clearRecentSearches() {
  write(RECENT_KEY, []);
  return [];
}

/* ------------------------------------------------------------ saved courses */

const SAVED_KEY = `${PREFIX}saved-courses`;

/** Ids only. A saved course is re-fetched by id, never cached wholesale. */
export function getSavedCourseIds() {
  const list = read(SAVED_KEY, []);
  return Array.isArray(list) ? list.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
}

export function isCourseSaved(id) {
  return getSavedCourseIds().includes(Number(id));
}

/** Returns the new list so a caller can render without a second read. */
export function toggleSavedCourse(id) {
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric <= 0) return getSavedCourseIds();
  const current = getSavedCourseIds();
  const next = current.includes(numeric)
    ? current.filter((x) => x !== numeric)
    : [numeric, ...current].slice(0, 100);
  write(SAVED_KEY, next);
  return next;
}

/* --------------------------------------------------------------- comparison */
//
// The comparison selection lives in the URL (?compare=) so it is shareable
// and survives a refresh. This mirror exists only so the tray can be restored
// when a student returns to the catalogue through a fresh navigation that has
// no query string — the URL stays the source of truth whenever it has one.

const COMPARE_KEY = `${PREFIX}compare`;

export function getStoredComparison() {
  const value = read(COMPARE_KEY, null);
  if (!value || typeof value !== "object") return null;
  const ids = Array.isArray(value.ids)
    ? value.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  if (ids.length === 0) return null;
  return { ids, chapterId: value.chapterId ?? null, goalId: value.goalId ?? null };
}

export function setStoredComparison({ ids, chapterId = null, goalId = null }) {
  const clean = (ids ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (clean.length === 0) {
    try { window.localStorage.removeItem(COMPARE_KEY); } catch { /* best effort */ }
    return null;
  }
  const value = { ids: clean, chapterId, goalId };
  write(COMPARE_KEY, value);
  return value;
}

/* -------------------------------------------------------------- reset + audit */

/** What is currently stored, for the privacy page. No values, only presence. */
export function describeStoredData() {
  return REGISTRY.map((entry) => {
    let present = false;
    try {
      present = window.localStorage.getItem(entry.key) != null;
    } catch {
      present = false;
    }
    return { ...entry, present };
  });
}

/**
 * Deletes everything this product has stored on the device. Theme is kept by
 * default: wiping it mid-session flips the page to the default theme under
 * the student, which reads as a bug rather than as a privacy action.
 */
export function clearAllLocalData({ includeTheme = false } = {}) {
  let cleared = 0;
  REGISTRY.forEach((entry) => {
    if (!includeTheme && entry.key === "lecture-library-theme") return;
    try {
      if (window.localStorage.getItem(entry.key) != null) cleared += 1;
      window.localStorage.removeItem(entry.key);
    } catch {
      // Nothing to do: the key is unreachable, so it is also unreadable.
    }
  });
  // Scroll-restoration entries are session-scoped and keyed individually.
  try {
    const stale = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith("scroll:")) stale.push(key);
    }
    stale.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Session storage may be unavailable; local data is already gone.
  }
  return cleared;
}
