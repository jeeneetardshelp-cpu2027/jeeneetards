// supabaseClient.js
// One shared client for the whole app.
//
// Get these two values from your Supabase dashboard:
//   Project Settings -> API -> Project URL  and  anon public key
// Put them in a file named ".env" in your project root (see .env.example).

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------------
// The request deadline
// ---------------------------------------------------------------------------
//
// WHY THIS EXISTS. createClient() used to be called with no options at all: no
// custom fetch, no deadline. A request that FAILS is fine — every read path in
// this app is written as `const { data, error } = await ...` and already shows
// a banner. A request that HANGS is not: the promise never settles, the hook's
// loading flag stays true, and the student stares at skeletons forever. For a
// student on metered mobile data on a train, a socket that opens and then goes
// quiet is an ordinary Tuesday, not an exotic failure.
//
// `global.fetch` is the one place that covers every call site that REACHES A
// SOCKET — 132 settlement points across 40 files in src/, plus storage —
// instead of adding a timer to each one. That is the accurate claim, and the
// qualifier is load-bearing: this file used to say "every call site at once",
// which is not true. supabase-js wraps every data request in `fetchWithAuth`
// (dist/index.mjs:355-380) and does `const realToken = await getAccessToken()`
// at :363, reaching the wrapped fetch only at :378. Anything that stalls
// INSIDE that await is in front of the deadline, not behind it — see note 3.
//
// WHAT AN EXPIRED DEADLINE LOOKS LIKE TO A CALLER. postgrest-js turns a fetch
// rejection into a RESOLVED envelope (dist/index.cjs, PostgrestBuilder.then:
// `if (!this.shouldThrowOnError) res = res.catch(...)`, and this repo never
// calls .throwOnError()). So a tripped deadline arrives as
//   { data: null, error: { message: "AbortError: <REQUEST_TIMEOUT_MESSAGE>",
//                          hint: "Request was aborted (...)", code: "" } }
// which flows into the `if (error)` branch each call site already has. No call
// site gains an unhandled rejection from this change. Note `code` is the EMPTY
// STRING, not a code — anything classifying this must key on the message.
//
// FOUR THINGS THIS HAD TO GET RIGHT, each one load-bearing:
//
// 1. THE ABORT REASON MUST BE NAMED "AbortError". postgrest-js retries GETs
//    three times with 1s/2s/4s backoff, and its fetch-rejection catch bails out
//    of that loop ONLY on `name === "AbortError" || code === "ABORT_ERR"`
//    (index.cjs:305). Measured: aborting with a TimeoutError-named reason ran
//    4 fetch attempts and took 7154ms where an AbortError-named reason ran 1
//    attempt and took 46ms. The obvious spelling — AbortSignal.timeout(), whose
//    reason is a TimeoutError — would quietly turn this 12s deadline into ~55s
//    on every browse GET. Hence the hand-built DOMException below.
//
// 2. IT COMPOSES WITH THE CALLER'S SIGNAL, IT DOES NOT REPLACE IT. Five hooks
//    (usePlaylistVideos, useStudyMaterials, useStudyMaterialCatalog,
//    useJeeMainPapers, and fetchAllCourseLessonRows) cancel on unmount or on
//    supersede via the builder's .abortSignal(), which supabase-js forwards as
//    init.signal. Overwriting it silently breaks every one of those cancels —
//    measured on the naive version: a caller abort at 5ms did not cancel, the
//    request ran to completion and delivered all 500 rows.
//
// 3. /auth/v1/ IS EXEMPT — EXCEPT grant_type=refresh_token AND GET
//    /auth/v1/user. supabase-js hands `settings.global.fetch` straight to the
//    auth client as well as to PostgREST, so an unexempted deadline would cut
//    short sign-in, sign-up and password reset. Being signed out mid-session on
//    a bad connection is worse than any stall, so those stay untouched. The
//    second exception, the user lookup behind a sign-in carried in the URL,
//    closes the same kind of hole on the page load after Google sign-in or an
//    emailed link, and is explained at USER_LOOKUP_DEADLINE_MS below. The
//    TOKEN REFRESH is the first, and it is not a nicety — a blanket exemption
//    made the whole deadline unreachable for the students it was written for:
//
//      `fetchWithAuth` awaits `getAccessToken()` (= `auth.getSession()`) BEFORE
//      it calls this wrapper. auth-js treats a session as expired within
//      EXPIRY_MARGIN_MS (90s, lib/constants.js) of expiry and awaits
//      `_callRefreshToken` -> POST /auth/v1/token?grant_type=refresh_token. If
//      that POST is exempt and the network is half-working, the data request
//      NEVER REACHES fetch, no timer is ever created, and the promise hangs.
//      Reproduced with the real library and this exact wrapper (deadline
//      shortened to 700ms, transport hangs unless aborted), a .from() select
//      and an .rpc() per arm:
//        anonymous              -> both settle,  7ms
//        signed in, token fresh -> both settle,  1ms
//        signed in, token STALE -> both STILL PENDING at 6x the deadline; the
//                                  only request issued in 4200ms was
//                                  /auth/v1/token?grant_type=refresh_token
//      auth-js single-flights the refresh through `refreshingDeferred`, so one
//      hung refresh stalls every panel on the page together. And this is not an
//      exotic window: `_onVisibilityChanged` runs `_recoverAndRefresh()` on
//      every hidden->visible transition and auto-refresh is stopped while
//      hidden, so a phone locked for 20 minutes lands in it by design, as does
//      any cold load with a stored expired session.
//
//    A DEADLINE HERE CANNOT SIGN ANYONE OUT. Verified against the installed
//    auth-js 2.110.7, not assumed. The only route to `_removeSession()` on this
//    path is gated on `if (!isAuthRetryableFetchError(error))`
//    (GoTrueClient.js:4192, `_removeSession` at :4209), and lib/fetch.js
//    catches EVERY throw from the transport and rethrows it as
//    `AuthRetryableFetchError` unconditionally — a DOMException named
//    AbortError included. So that branch is never taken, storage is never
//    cleared, and SIGNED_OUT is never emitted. Measured across every scenario:
//    storage present, refresh_token unchanged, zero SIGNED_OUT events.
//
//    WHAT IT CAN DO, stated plainly rather than glossed: if the access token
//    has expired by the time the refresh GIVES UP, `__loadSession` returns
//    `{ session: null, error }` and the UI renders its signed-out branch until
//    a refresh succeeds (REFRESH_FAILURE_COOLDOWN_MS = 60s caps the retry
//    storm). That is PRE-EXISTING behaviour, not new — with no deadline
//    anywhere, an offline refresh reaches the identical state in ~26s
//    (measured). This change adds "slow" as a trigger alongside "broken".
//    "By the time it gives up" is load-bearing, and an earlier version of
//    this note said "still inside its real expiry" instead, which is wrong:
//    the give-up comes ~30s after the refresh starts (see REFRESH_DEADLINE_MS),
//    so a token with under ~30s left when the refresh STARTS has expired when
//    it ENDS and takes the signed-out branch too. Only a token still valid at
//    the end gets the stored session back untouched (the proactive-preserve
//    branch), with nothing visible. Expired, +60s and +20s are each pinned in
//    supabaseDeadline.test.js.
//
//    NOT COVERED, so nobody reads more into this than it does: it does not fix
//    src/useSession.js, which cannot tell `{ session: null, error }` from a
//    genuine signed-out visitor, and data requests issued during the storm go
//    out with the anon key as bearer (dist/index.mjs:367-369) rather than
//    hanging — RLS-scoped, so a failed read, not a leak.
//
// 4. A REQUEST THAT FINISHES IN TIME IS UNTOUCHED. Same input, same init, same
//    Response object; the only trace is a timer that gets cleared.
//
// WHAT THIS DOES NOT COVER, stated plainly: the deadline bounds everything up
// to the response headers (DNS, TLS, request, server work, first byte). Once
// fetch resolves, the timer is cleared, so a connection that delivers headers
// and then stalls partway through the body is still unbounded. That is a
// narrower window than the bug this fixes — the heaviest payload in the app is
// ~15 KB on the wire (gzipped; 15.1 KB measured, see THE FLOOR below) — and
// closing it would mean wrapping and re-constructing every Response, which
// loses fields postgrest and auth read.
export const REQUEST_TIMEOUT_MESSAGE =
  "Request timeout: the server did not answer in time.";

// 12 seconds, PER FETCH ATTEMPT, and bounding TIME TO HEADERS only.
//
// Chosen from measurement, not feel. Against production: p50 815ms, p95 1490ms,
// max 1529ms over ~100 successful requests; the slowest routine call in the app
// is universal_search at 1.2-1.5s cold. 12s is ~8x that p95.
//
// THE FLOOR. Set by the one request a deadline must never kill first: /browse
// fetches the whole bounded match set on every sort during a search
// (useBrowse.js `.in("id", searchIds)`, capped at 500 ids). An earlier version
// of this comment sized the floor at ~8s from that request's END-TO-END time,
// "~0.5s server + ~1.4s handshake + ~6s transfer". That number was measuring
// something this deadline does not bound. The timer is cleared when fetch
// RESOLVES, which is at the response HEADERS (see WHAT THIS DOES NOT COVER
// above), and roughly six of those eight seconds are BODY TRANSFER, which
// happens after the timer is already gone. The floor was passing by luck.
//
// Re-measured against production 2026-09-08, search_video_ids("neet") -> the
// real 500-id select: request URL 3761 chars, 210.6 KB raw / 15.1 KB gzipped,
// HEADERS at 384-704ms and the body a further 27-42ms on a fast link. Splitting
// that by what the deadline can actually see, on a 20 kbps link (2500 B/s):
//   BOUNDED   ~1.4s cold handshake + ~1.5s to upload the 3761-char URL
//             + ~0.4-0.8s server            ~= 3.3-3.7s
//   UNBOUNDED ~6.2s of gzipped body
// So the honest floor is ~4s, not 8s, and 12s carries ~3x margin over it rather
// than the ~1.5x the old arithmetic implied. 12s is kept — it is the right
// value for the p95 argument above — but anyone lowering it should work from
// the ~4s figure and know that the 6s of body was never in scope.
//
// THE CEILING IS PER-ATTEMPT PATIENCE: past ~15s in one attempt a student has
// already decided the page is broken. Stated per-attempt deliberately, because
// end to end is not bounded by this number alone. postgrest-js retries a GET
// whose fetch REJECTS up to 3 times with 1s/2s/4s backoff (dist/index.mjs:
// 303-310), so a GET whose transport FAILS FAST three times and only then
// hangs spends 1+2+4s of backoff plus one full 12s deadline = 19s before the
// banner — measured through the real client in supabaseDeadline.test.js, not
// computed: attempts at 0/1000/3000/7000ms, settled at 19000ms. That case is
// accepted rather than fixed here: the bug this deadline exists for is the
// PURE HANG, and a pure hang aborts with an AbortError name, which postgrest
// bails out of its retry loop on (dist/index.mjs:303) — one attempt, 12s,
// inside the ceiling. Bringing the 19s case under 15s would take a deadline
// under 8s. An earlier version of this note said that "would push it below the
// /browse floor above"; against the re-measured ~4s floor it would not. What
// it would do is cut the margin over that floor from ~3x to under 2x, and over
// the p95 from ~8x to ~5x, to shorten a case that needs three fast failures
// followed by a hang. That trade is not taken.
//
// The database's own ~3s statement timeout bounds server work independently — a
// query too slow to finish FAILS server-side rather than hanging — so this
// deadline is covering handshake and transfer, not slow SQL.
export const REQUEST_DEADLINE_MS = 12000;

// 15 seconds for POST /auth/v1/token?grant_type=refresh_token, and NOT because
// a refresh is a small POST that deserves less patience. It deserves MORE, and
// the number is a measured local optimum rather than a round one.
//
// auth-js runs its own retry around the refresh (`_refreshAccessToken`,
// GoTrueClient.js:3939-3955): backoffs of 200/400/800ms..., retried while
// `Date.now() + nextBackOffInterval - startedAt < AUTO_REFRESH_TICK_DURATION_MS`
// (30000). Every attempt is bounded by THIS constant, so shrinking it buys more
// attempts, not a shorter stall. Measured, expired token, permanently hung
// /token, one panel — total stall / number of /token attempts:
//     50 -> 25990/8    500 -> 29515/8   2000 -> 26698/7   5000 -> 28066/5
//   8000 -> 33442/4  12000 -> 36679/3  14000 -> 42641/3  15000 -> 30232/2
//  20000 -> 40213/2  29000 -> 58220/2  30000 -> 30009/1  31000 -> 31006/1
// A sawtooth, not a curve, and with a FLOOR: even a 50ms deadline still stalls
// ~26s, because the 30s retry window is auth-js's, not ours. "Forever" becomes
// "about half a minute"; it does not become "fifteen seconds". If half a minute
// is unacceptable the lever is not in this file.
//
// 15000 is picked as the best point on that sawtooth: 30.2s and 2 attempts,
// where 12000 costs 36.7s in 3 attempts and 14000 costs 42.6s. It also beats
// them on the axis that actually hurts students. A deadline SHORTER than the
// link's real /token latency kills every attempt in turn and drops the student
// to signed-out chrome at ~30s on a network that works — measured: an 8s
// deadline against a 9s refresh gives session:null at 33451ms, while a 12s
// deadline against the same 9s refresh signs in at 9011ms on one attempt. 15s
// is ~10x the p95 recorded above, so it kills only refreshes that are already
// hopeless.
//
// Do not lower this to "match" REQUEST_DEADLINE_MS. They answer different
// questions: 12000 is sized by one /browse fetch's time to headers, 15000 by
// auth-js's 30s retry window. 30000 is the documented alternative — one attempt
// and a 30.0s stall, marginally the best in the sweep — but it holds only while
// `deadline >= AUTO_REFRESH_TICK_DURATION_MS`, and 29000 measures 58.2s one
// step away.
export const REFRESH_DEADLINE_MS = 15000;

// 30 seconds for GET /auth/v1/user, the most patient number in this file and on
// purpose. The owner's decision (2026-09-15): a GENEROUS deadline on the request
// a page waits on when a student returns from Google sign-in, an
// email-confirmation link or a password-reset link.
//
// WHY IT NEEDS ONE. supabase-js defaults flowType to "implicit" and this app
// sets none, so each of those returns lands with #access_token=... in the URL.
// auth-js reads it while initialising: `_initialize` -> `_getSessionFromURL`
// (GoTrueClient.js:390) -> `_getUser(access_token)` (:3261) -> GET
// /auth/v1/user (:2642). getSession() awaits that initialisation (:2362), and
// `fetchWithAuth` awaits getSession() before it ever reaches this wrapper (note
// 3), so that one GET holds EVERY request on the page. While it was exempt, a
// socket that never answered left a .from() select, an .rpc() and getSession()
// all still pending at 20s with zero data requests sent. No deadline anywhere
// else can reach it.
//
// ONE ATTEMPT, SO THIS IS THE WHOLE WAIT. `_getUser(jwt)` is one `_request` ->
// one `_handleRequest` -> one fetch (lib/fetch.js:85-115). auth-js's only retry
// wrapper, `retryable(...)` in `_refreshAccessToken` (GoTrueClient.js:3939-3955),
// wraps the refresh POST and nothing else, and postgrest's GET retry never sees
// auth's fetch. Per attempt and in total are the same number here.
//
// MEASURED 2026-09-15, READ-ONLY: GET /auth/v1/user against production with an
// invalid bearer (403 bad_jwt over the same network path; nobody signed in,
// nothing written):
//   cold, a new connection each   n=70  p50 427ms  p95 1031ms  max 6794ms
//   warm, one reused connection   n=38  p50 207ms  p95  240ms
// The 6794ms sample is a 6.5s DNS stall on an otherwise ordinary link, and a
// student opening a reset email in a mail app's browser starts exactly that
// cold. LIMIT OF THE METHOD: a bad token is refused before any database work,
// while a VALID token's lookup reads the user, so a real return's server time
// is nearer a data request's (p95 1490ms, above) than these. Composing the slow
// cases the way THE FLOOR does for /browse — 20 kbps, ~1.4s cold handshake,
// ~0.6s to upload ~1.5 KB of headers, ~1.5s of server, plus that 6.5s DNS
// stall — gives ~10s for a slow-but-working return. 30s is ~3x that, ~4x the
// slowest sample and ~30x the cold p95.
//
// WHY MORE PATIENT THAN THE OTHER TWO. Cutting a working sign-in short is the
// harm to avoid: the student has just done something deliberate, and a false
// trip costs them that sign-in (recoverable by a reload, below, but only once
// they are told), where a false trip on a data GET costs one Retry click. The
// price is stated rather than hidden: a lookup that truly never answers is now
// 30s of skeletons on every panel before the page renders, where it used to be
// forever. 60s would double that for a case already ~4x past anything measured.
//
// WHEN IT FIRES, verified through the real client (sessionFromUrlDeadline
// .test.js), not assumed. The abort reaches auth-js as AuthRetryableFetchError
// (lib/fetch.js:114). `_getUser` removes a session only for
// AuthSessionMissingError (GoTrueClient.js:2667), and `_initialize` returns
// `{ error }` before `_saveSession` ("Don't remove existing session on URL
// login failure", :401). So: no SIGNED_OUT; a stored session is kept and carried
// by INITIAL_SESSION; the data requests go out; and the #access_token hash STAYS
// in the URL (auth-js clears it only on success, :3275), so a reload checks the
// same link again. The failure shows only in auth.initialize()'s `{ error }` —
// getSession() looks the same as for a visitor who never clicked a link — so
// useSession exposes it as `urlSignInFailure`, and /reset (PasswordReset.jsx)
// and the sign-in form (StudentAuth.jsx) say what happened.
export const USER_LOOKUP_DEADLINE_MS = 30000;

// Auth is exempt: see note 3 above.
const AUTH_PATH = "/auth/v1/";

// ...with two exceptions. The first, the token refresh, is matched on BOTH
// halves, not on the path alone: the path alone would swallow
// grant_type=password and grant_type=pkce, which must stay exempt. auth-js
// builds this URL as `${this.url}/token?grant_type=refresh_token`
// (GoTrueClient.js:3944) with no other query string, so the literal is stable;
// testing two substrings just survives a future reordering of params.
const REFRESH_PATH = "/auth/v1/token";
const REFRESH_GRANT = "grant_type=refresh_token";

function isTokenRefresh(url) {
  return url.includes(REFRESH_PATH) && url.includes(REFRESH_GRANT);
}

// The second, the URL sign-in's user lookup, is matched on METHOD as well as
// path. PUT /auth/v1/user is updateUser — PasswordReset.jsx submitting the new
// password — which is user-initiated and stays unbounded like the rest of
// note 3. And the path must END there, so GET /auth/v1/user/identities/authorize
// and /auth/v1/user/oauth/grants (GoTrueClient.js:3806, :5077), both
// user-initiated, stay exempt too. auth-js sends the lookup as a string URL with
// init.method "GET" and no query string (lib/fetch.js:98, :109); the Request
// branch is for any other caller.
const USER_PATH = "/auth/v1/user";

function requestMethod(input, init) {
  // fetch lets init.method override a Request's own method, so init wins here too.
  const method =
    init?.method ?? (input !== null && typeof input === "object" ? input.method : undefined);
  return String(method ?? "GET").toUpperCase();
}

function isUserLookup(url, method) {
  return method === "GET" && url.split(/[?#]/, 1)[0].endsWith(USER_PATH);
}

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (input && typeof input.url === "string") return input.url;   // Request
  return String(input ?? "");                                     // URL, other
}

// Combine the caller's signal with ours so BOTH can cancel the request.
// AbortSignal.any is the right tool and is present in every browser this app
// supports, but if it is missing the fallback must still forward the abort
// REASON — the reason's .name is what keeps postgrest from retrying (note 1).
// If the fallback dropped the reason, the retry amplification would come back
// on exactly the old browsers least able to afford it.
function composeSignals(callerSignal, deadlineSignal) {
  if (!callerSignal) return { signal: deadlineSignal, release: () => {} };
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    return { signal: AbortSignal.any([callerSignal, deadlineSignal]), release: () => {} };
  }
  const merged = new AbortController();
  const handlers = [];
  for (const source of [callerSignal, deadlineSignal]) {
    if (source.aborted) {
      merged.abort(source.reason);
      break;
    }
    const onAbort = () => merged.abort(source.reason);
    source.addEventListener("abort", onAbort, { once: true });
    handlers.push([source, onAbort]);
  }
  // Without this, every request would leave a listener on the hook's
  // long-lived controller signal.
  const release = () => {
    for (const [source, onAbort] of handlers) source.removeEventListener("abort", onAbort);
  };
  return { signal: merged.signal, release };
}

/**
 * Build the fetch that createClient() is given.
 *
 * Exported so the tests can drive it with a fetch that never settles, which is
 * the only way to check a deadline without a real hung server.
 *
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl] transport (default: global fetch,
 *   resolved at CALL time so a polyfill or test double installed later wins)
 * @param {number} [options.deadlineMs] data requests (/rest/, /storage/, ...)
 * @param {number} [options.refreshDeadlineMs] the token refresh only; sized
 *   independently against auth-js's own 30s retry window, so it is a separate
 *   knob rather than a fraction of deadlineMs
 * @param {number} [options.userLookupDeadlineMs] GET /auth/v1/user only, the
 *   lookup behind a sign-in carried in the URL; one attempt with no retry, so
 *   sized as the whole wait
 */
export function createDeadlineFetch({
  fetchImpl,
  deadlineMs = REQUEST_DEADLINE_MS,
  refreshDeadlineMs = REFRESH_DEADLINE_MS,
  userLookupDeadlineMs = USER_LOOKUP_DEADLINE_MS,
} = {}) {
  const transport = fetchImpl ?? ((input, init) => globalThis.fetch(input, init));

  return function deadlineFetch(input, init) {
    const url = requestUrl(input);
    // Both auth exceptions are checked BEFORE the /auth/v1/ bail-out; the other
    // order would let the exemption swallow them (note 3).
    const refresh = isTokenRefresh(url);
    const userLookup = !refresh && isUserLookup(url, requestMethod(input, init));
    const ms = refresh ? refreshDeadlineMs : userLookup ? userLookupDeadlineMs : deadlineMs;

    // The rest of auth, and any environment without AbortController, gets the
    // untouched transport rather than a half-working deadline.
    if (
      (url.includes(AUTH_PATH) && !refresh && !userLookup) ||
      typeof AbortController === "undefined" ||
      !(ms > 0)
    ) {
      return transport(input, init);
    }

    const deadline = new AbortController();
    const timer = setTimeout(() => {
      // DOMException named "AbortError" — see note 1. Not AbortSignal.timeout().
      deadline.abort(
        typeof DOMException === "function"
          ? new DOMException(REQUEST_TIMEOUT_MESSAGE, "AbortError")
          : Object.assign(new Error(REQUEST_TIMEOUT_MESSAGE), { name: "AbortError" }),
      );
    }, ms);

    const { signal, release } = composeSignals(init?.signal, deadline.signal);
    const settle = () => {
      clearTimeout(timer);
      release();
    };

    try {
      return Promise.resolve(transport(input, { ...init, signal })).finally(settle);
    } catch (thrownSynchronously) {
      settle();
      throw thrownSynchronously;
    }
  };
}

// If .env is missing, createClient() throws — and because this file is
// imported at startup, that would blank out the WHOLE site rather than just
// breaking one panel. So we check first and let screens show a friendly
// message instead.
export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey) && supabaseUrl.startsWith("http");

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: createDeadlineFetch() },
    })
  : null;
