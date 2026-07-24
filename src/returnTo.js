// returnTo.js — proof that the previous page was OUR results page.
//
// THE PROBLEM THIS REPLACES
//
// The course page decided how to go "back" with `window.history.length > 1`.
// That number counts entries in the tab's session history, not entries in this
// app: a student who was reading another site, then opened a shared course
// link, has history.length > 1 and would be thrown OUT of the app by our own
// Back button. history.length also never decreases, so it can never be
// evidence about where the previous entry actually points.
//
// THE CONTRACT
//
// Browse stamps an explicit marker into the navigation state when it opens a
// course. The course page trusts Back ONLY if that marker is present and its
// URL passes validation. Absence of the marker is treated as "arrived from
// outside", which is the safe default.
//
// The marker is not a security boundary — a user can craft history state for
// their own tab — it is a correctness signal. It is still validated, because
// the value ends up in navigate() and an unchecked string there is an open
// redirect.

export const RETURN_MARKER = "browse-results";

/** Stamp the current Browse URL as the trusted origin. */
export function makeReturnState(pathname, search = "") {
  return { from: RETURN_MARKER, url: `${pathname}${search || ""}` };
}

/**
 * Is this a safe INTERNAL path back into our own results?
 *
 * Rejects, deliberately:
 *   - anything absolute ("https://evil.test/x") — leaves the app
 *   - protocol-relative ("//evil.test") — browsers treat this as absolute,
 *     and it is the classic open-redirect bypass
 *   - backslash variants ("/\evil.test") — normalised to "//" by some browsers
 *   - any path that is not our results page
 */
export function isTrustedReturnUrl(url) {
  if (typeof url !== "string" || url.length === 0) return false;
  if (url[0] !== "/") return false;                       // must be root-relative
  if (url[1] === "/" || url[1] === "\\") return false;    // protocol-relative
  if (/[\\]/.test(url.split("?")[0])) return false;       // no backslashes in the path
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false;     // no scheme
  const path = url.split("?")[0];
  return path === "/browse";
}

/**
 * The trusted return URL, or null.
 *
 * `state` is whatever the router hands us; anything unexpected yields null
 * rather than throwing, because this runs during render on a page a stranger
 * may have linked to.
 */
export function readReturnUrl(state) {
  if (!state || typeof state !== "object") return null;
  if (state.from !== RETURN_MARKER) return null;
  return isTrustedReturnUrl(state.url) ? state.url : null;
}

// ---- reload survival ------------------------------------------------------
// history.state normally survives a reload, but not every browser and privacy
// mode agrees, and a hard navigation to the same URL drops it. Mirroring into
// sessionStorage keyed by the COURSE path means a reload of that exact course
// still knows where it came from, while a different course does not inherit it.

const storageKey = (coursePath) => `returnTo:${coursePath}`;

export function rememberReturn(coursePath, url) {
  if (!isTrustedReturnUrl(url)) return;
  try { sessionStorage.setItem(storageKey(coursePath), url); } catch {}
}

export function recallReturn(coursePath) {
  let url = null;
  try { url = sessionStorage.getItem(storageKey(coursePath)); } catch {}
  return isTrustedReturnUrl(url) ? url : null;
}

/**
 * Resolve where "Back to results" should go.
 *
 * Returns { mode: "back" } when the previous entry is provably our own results
 * page — only then does history.back() give scroll restoration. Otherwise a
 * direct navigation, narrowing to the chapter when we know it.
 */
export function resolveBack({ state, coursePath, chapterId }) {
  const trusted = readReturnUrl(state) ?? recallReturn(coursePath);
  if (trusted) return { mode: "back", url: trusted };
  if (chapterId != null && chapterId !== "") return { mode: "push", url: `/browse?ch=${chapterId}` };
  return { mode: "push", url: "/browse" };
}
