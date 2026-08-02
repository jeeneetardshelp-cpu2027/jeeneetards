// analytics.js — the ONE place a product event is emitted.
//
// Why this exists: without a single choke point, event names drift, PII leaks
// in by accident, and a slow beacon ends up blocking a navigation. Everything
// here is deliberately boring.
//
// RULES, enforced by this module rather than by convention:
//   1. Never blocks. Emission is fire-and-forget inside a try/catch; a failing
//      sink can never prevent a lecture from opening or a link from working.
//   2. Never sends personal data. Payloads are allow-listed to primitives and
//      run through a scrubber that drops anything looking like an email, a
//      phone number or a long free-text blob.
//   3. Never sends raw search text. A query is reduced to its length and
//      whether it matched — enough to tune ranking, useless for profiling.
//   4. No identifiers. No user id, no device id, no cross-site cookie. This
//      holds even though accounts now exist: a signed-in student is still
//      never tied to an event here. It is a policy, not a side effect of
//      there being nobody to identify.
//
// There is no sink wired up by default: `setAnalyticsSink` is the integration
// point. Until a sink is set this is a no-op with a dev-only console trace.
//
// ⚠️ STATUS: NOT WIRED UP. No module imports this file, no test covers it, and
// no sink is set anywhere — so today it emits nothing at all. Before wiring it
// up, note that rule 3 above ("never sends raw search text") is aspirational:
// scrub() is a key DENY-list, not the value allow-list the header describes,
// so any free-text value under 64 characters that isn't an email or phone
// number is forwarded verbatim. Rule 4's key filter was also broken until
// 31 July 2026 (see scrub below) — it matched only snake_case while this
// codebase names everything in camelCase. If this is ever switched on, the
// Privacy Policy must be updated in the same change; src/legalTruth.test.js
// derives its checks from the code and should be extended to cover it.

/** Canonical event names. Anything not in here is rejected in development. */
export const EVENTS = Object.freeze({
  SEARCH_STARTED: "search_started",
  SEARCH_RESULT_SELECTED: "search_result_selected",
  SEARCH_NO_RESULTS: "search_no_results",
  EXAM_SELECTED: "exam_selected",
  SUBJECT_SELECTED: "subject_selected",
  CHAPTER_SELECTED: "chapter_selected",
  FILTER_APPLIED: "filter_applied",
  COURSE_VIEWED: "course_viewed",
  COURSE_COMPARE_ADDED: "course_compare_added",
  COURSE_COMPARE_REMOVED: "course_compare_removed",
  COMPARISON_OPENED: "comparison_opened",
  COURSE_SAVED: "course_saved",
  COURSE_UNSAVED: "course_unsaved",
  LECTURE_STARTED: "lecture_started",
  LECTURE_COMPLETED: "lecture_completed",
  THEME_CHANGED: "theme_changed",
  FAQ_OPENED: "faq_opened",
  REPORT_ISSUE_STARTED: "report_issue_started",
  LOCAL_DATA_CLEARED: "local_data_cleared",
});

const KNOWN = new Set(Object.values(EVENTS));

let sink = null;

/**
 * Register the destination. Call once at startup with a privacy-respecting
 * analytics client. The sink receives (name, props) and must not throw; if it
 * does, the error is swallowed here rather than reaching the UI.
 */
export function setAnalyticsSink(fn) {
  sink = typeof fn === "function" ? fn : null;
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(?:\+?\d[\s-]?){7,}/;

/**
 * Drops anything that could carry personal data:
 *   • non-primitive values (objects/arrays can nest anything)
 *   • strings over 64 chars (free text, not a category)
 *   • strings that look like an email or a phone number
 *   • keys that name an identifier
 */
function scrub(props) {
  const safe = {};
  if (!props || typeof props !== "object") return safe;

  for (const [key, value] of Object.entries(props)) {
    // Normalise camelCase to snake_case BEFORE matching. The deny-list is
    // anchored on `_` or string edge, so against this codebase's actual naming
    // (userId, sessionId, ipAddress, userEmail, authToken) it matched nothing
    // at all — the module header's "No identifiers" rule was enforced by
    // literally zero code. Verified: all five of those keys used to pass
    // straight through to the sink.
    const normalisedKey = String(key).replace(/([a-z0-9])([A-Z])/g, "$1_$2");
    if (/(^|_)(email|phone|mobile|name|user|session|token|ip|address)(_|$)/i.test(normalisedKey)) continue;
    if (value == null) continue;

    const type = typeof value;
    if (type === "number" || type === "boolean") {
      safe[key] = value;
      continue;
    }
    if (type !== "string") continue;
    if (value.length > 64) continue;
    if (EMAIL.test(value) || PHONE.test(value)) continue;
    safe[key] = value;
  }
  return safe;
}

/**
 * Emit an event. Safe to call from a click handler immediately before a
 * navigation — it never awaits and never throws.
 */
export function track(name, props = {}) {
  if (!KNOWN.has(name)) {
    if (import.meta.env?.DEV) console.warn(`[analytics] unknown event "${name}"`);
    return;
  }
  const payload = scrub(props);
  try {
    if (sink) sink(name, payload);
    else if (import.meta.env?.DEV) console.debug("[analytics]", name, payload);
  } catch {
    // A broken analytics sink must never surface to a student.
  }
}

/**
 * Search is the one case where the obvious payload would be the sensitive
 * one. The query itself never leaves the device; only its shape does.
 */
export function trackSearch(query, { results = null, scope = null } = {}) {
  const text = String(query ?? "").trim();
  track(results === 0 ? EVENTS.SEARCH_NO_RESULTS : EVENTS.SEARCH_STARTED, {
    queryLength: text.length,
    hasResults: results == null ? undefined : results > 0,
    resultCount: results ?? undefined,
    scope: scope ?? undefined,
  });
}
