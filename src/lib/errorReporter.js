// errorReporter.js — crash reporting, dormant until a DSN is configured.
//
// Audit finding (2026-08-10): nothing that breaks in a student's browser ever
// reached the operator. AppErrorBoundary only console.error'd, so a render
// crash on a real phone was invisible. This is the one place that changes.
//
// DESIGN, and the reasons behind each choice:
//
//   * DORMANT BY DEFAULT. Reads import.meta.env.VITE_SENTRY_DSN and does
//     absolutely nothing — installs no handlers, sends no request — when it is
//     absent. Shipping this file therefore transmits zero data. The operator
//     opts in by setting the env var, exactly as analytics.js is opt-in.
//
//   * NO DEPENDENCY. It speaks Sentry's envelope HTTP protocol directly (a
//     documented, stable format), so there is no @sentry/browser in the bundle
//     and no npm surface to maintain. When no DSN is set the cost is a few
//     bytes of dead code. A solo operator does not need session replay; they
//     need "something broke, here is where".
//
//   * NEVER BLOCKS, NEVER THROWS. Every send is fire-and-forget inside a
//     try/catch. A failing sink can never stop a lecture from opening.
//
//   * NO PERSONAL DATA. It sends the URL PATH (query and hash stripped, since
//     ?next=/?v= etc. are not needed and a stray token must never leave), the
//     error message and stack, and the browser string. No account id, no
//     cookies (fetch to a third-party origin sends none), no student input.
//
//   * RATE LIMITED. A render loop can throw hundreds of times a second; the
//     session cap stops that from flooding the project (and the operator's
//     quota) with one repeating fault.
//
// ⚠️ BEFORE SETTING VITE_SENTRY_DSN: the Privacy Policy must gain a line
// disclosing that anonymous crash diagnostics are sent to a monitoring
// provider. This module sends nothing until then, so the code and the policy
// stay honest as long as the two changes ship together. See analytics.js for
// the same discipline and src/legalTruth.test.js for how the policy is pinned.

const MAX_EVENTS_PER_SESSION = 10;
const MAX_MESSAGE_CHARS = 1000;
const MAX_STACK_CHARS = 4000;

let config = null; // { endpoint } once a valid DSN is parsed, else null
let sent = 0;
let installed = false;

// A Sentry DSN is https://<publicKey>@<host>/<projectId>. Turn it into the
// envelope endpoint the browser POSTs to. Returns null for anything malformed,
// so a typo in the env var disables reporting rather than throwing on boot.
export function parseDsn(dsn) {
  if (typeof dsn !== "string" || !dsn) return null;
  let url;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }
  const publicKey = url.username;
  const projectId = url.pathname.replace(/^\/+/, "");
  if (!publicKey || !projectId || url.protocol !== "https:") return null;
  return {
    endpoint: `${url.origin}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`,
  };
}

function eventId() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    // A best-effort id is fine; Sentry only needs 32 hex chars for dedup.
    let s = "";
    for (let i = 0; i < 32; i += 1) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }
}

// pathname only — never the query string or hash.
function safePath() {
  try {
    return window.location.pathname || "/";
  } catch {
    return "/";
  }
}

function clamp(value, max) {
  const s = String(value ?? "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// Build the newline-delimited Sentry envelope for one error.
export function buildEnvelope(error, context, now, release) {
  const id = eventId();
  const message = clamp(error?.message ?? String(error ?? "Unknown error"), MAX_MESSAGE_CHARS);
  const stack = clamp(error?.stack ?? "", MAX_STACK_CHARS);
  const event = {
    event_id: id,
    timestamp: now / 1000,
    platform: "javascript",
    level: "error",
    ...(release ? { release } : {}),
    logger: context?.source ?? "browser",
    exception: {
      values: [{
        type: error?.name ?? "Error",
        value: message,
      }],
    },
    request: { url: safePath() },
    extra: {
      stack,
      ...(context?.componentStack ? { componentStack: clamp(context.componentStack, MAX_STACK_CHARS) } : {}),
    },
    tags: { source: context?.source ?? "window" },
  };
  const headers = { event_id: id, sent_at: new Date(now).toISOString() };
  return `${JSON.stringify(headers)}\n${JSON.stringify({ type: "event" })}\n${JSON.stringify(event)}`;
}

// Fire-and-forget POST. keepalive lets it survive a navigation, and a failure
// is swallowed — a broken sink must never surface to the student.
function send(body) {
  if (!config) return;
  try {
    fetch(config.endpoint, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "Content-Type": "application/x-sentry-envelope" },
    }).catch(() => {});
  } catch {
    // Some environments reject keepalive with a large body; drop the event.
  }
}

// Report one error. Safe to call whether or not reporting is configured.
export function reportError(error, context = {}) {
  if (!config || sent >= MAX_EVENTS_PER_SESSION) return;
  sent += 1;
  try {
    const release = import.meta.env?.VITE_RELEASE_SHA || undefined;
    send(buildEnvelope(error, context, Date.now(), release));
  } catch {
    // buildEnvelope should never throw, but reporting must not be the thing
    // that breaks the page.
  }
}

// Called once from main.jsx. Installs global handlers only when a DSN exists.
// Idempotent, and returns whether reporting is active (used by a test).
export function initErrorReporter(dsn = import.meta.env?.VITE_SENTRY_DSN) {
  if (installed) return Boolean(config);
  installed = true;
  config = parseDsn(dsn);
  if (!config || typeof window === "undefined") return Boolean(config);

  window.addEventListener("error", (event) => {
    reportError(event.error ?? new Error(event.message ?? "window.onerror"), { source: "window.onerror" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const err = reason instanceof Error ? reason : new Error(clamp(reason, MAX_MESSAGE_CHARS));
    reportError(err, { source: "unhandledrejection" });
  });
  return true;
}

// Test-only: reset module state between cases.
export function __resetForTests() {
  config = null;
  sent = 0;
  installed = false;
}
