// supabaseDeadline.test.js — the request deadline in src/supabaseClient.js.
//
// The bug being guarded is a HANG, not a failure: a socket that opens and then
// never answers leaves the promise unsettled, the hook's loading flag true, and
// the student on skeletons forever. You cannot check that against a real
// server, so every test here drives the wrapper with a transport that never
// settles unless its signal aborts — which is exactly how fetch behaves on a
// dead connection, and is the only stand-in a test can trust.
//
// The integration half uses the REAL @supabase/supabase-js. That matters: the
// two claims this change rests on — that an aborted request RESOLVES into the
// `{ data, error }` envelope every call site already handles, and that an
// AbortError-named reason does not trigger postgrest's 3x retry backoff — are
// properties of that library, not of this file. Asserting them against a mock
// would prove nothing. The same goes for the stale-token scenario at the end,
// which is the one that actually failed in the field: it runs auth-js's own
// refresh retry loop, with only the clock faked.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  createDeadlineFetch,
  REFRESH_DEADLINE_MS,
  REQUEST_DEADLINE_MS,
  REQUEST_TIMEOUT_MESSAGE,
  USER_LOOKUP_DEADLINE_MS,
} from "./supabaseClient.js";
import { ratingErrorMessage } from "./CourseRating.jsx";
import { pollActionError } from "./polls/pollErrorMessages.js";
import { forumContributionError } from "./forum/forumErrorMessages.js";

// Short deadlines keep the suite fast. The shape under test is identical; only
// the number changes, and the number itself is asserted separately below.
const TEST_DEADLINE_MS = 60;

/**
 * A transport that behaves like fetch against a hung connection: it NEVER
 * settles on its own, and rejects with the abort reason if its signal fires.
 * Every call is recorded so we can assert what the wrapper actually passed on.
 */
function hangingTransport(calls) {
  return (input, init) =>
    new Promise((_resolve, reject) => {
      calls.push({ input, init, signal: init?.signal });
      const signal = init?.signal;
      if (!signal) return; // no signal at all -> hangs forever, as today
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createDeadlineFetch: the deadline itself", () => {
  it("settles a fetch that never settles, inside the deadline", async () => {
    const calls = [];
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: hangingTransport(calls),
      deadlineMs: TEST_DEADLINE_MS,
    });

    const started = Date.now();
    // The whole point: this await would never return without the deadline.
    const failure = await deadlineFetch("https://example.test/rest/v1/playlists")
      .then(() => null, (reason) => reason);
    const elapsed = Date.now() - started;

    expect(failure).toBeTruthy();
    expect(failure.message).toBe(REQUEST_TIMEOUT_MESSAGE);
    expect(elapsed).toBeLessThan(TEST_DEADLINE_MS + 2000);
    expect(calls).toHaveLength(1);
  });

  it("aborts with a reason NAMED AbortError, which is what stops postgrest retrying", async () => {
    // Not cosmetic. postgrest-js bails out of its 1s/2s/4s retry loop only on
    // `name === "AbortError" || code === "ABORT_ERR"` (dist/index.cjs:305).
    // Spelling this as AbortSignal.timeout() — whose reason is a TimeoutError —
    // measured 4 fetch attempts and 7154ms where AbortError measured 1 and 46ms,
    // i.e. it would turn a 12s deadline into ~55s on every browse GET.
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: hangingTransport([]),
      deadlineMs: TEST_DEADLINE_MS,
    });

    const reason = await deadlineFetch("https://example.test/rest/v1/playlists")
      .then(() => null, (caught) => caught);

    expect(reason.name).toBe("AbortError");
    expect(reason.name).not.toBe("TimeoutError");
  });

  it("reads as a connection problem to every error classifier the app already ships", () => {
    // Do not invent a new error surface: three already exist, and all three key
    // on the LITERAL word "timeout". postgrest reports the abort as
    // `${reason.name}: ${reason.message}`, so the message has to contain that
    // word — spelling it "Request timed out" instead would silently fall
    // through to "Couldn't save your rating", which tells a student on a bad
    // train connection nothing they can act on.
    const asPostgrestReports = { message: `AbortError: ${REQUEST_TIMEOUT_MESSAGE}` };
    // forum/polls wrap the envelope as `cause`, so they read it from there.
    const asApiErrorWraps = { code: null, cause: asPostgrestReports };

    expect(ratingErrorMessage(asPostgrestReports))
      .toBe("Couldn't reach the server. Check your connection and try again.");
    expect(pollActionError(asApiErrorWraps, "record your vote"))
      .toBe("Could not reach the server. Check your connection and try again.");
    expect(forumContributionError(asApiErrorWraps, "post this reply"))
      .toBe("Could not reach the server. Check your connection and try again; your draft is saved.");
  });

  it("uses a 12s per-attempt deadline on time to HEADERS, clear of the p95 and of the /browse floor", () => {
    // p95 of a successful production request is 1490ms and the slowest routine
    // call (universal_search, cold) is ~1.5s, so 12s is ~8x p95.
    //
    // THE FLOOR is time to HEADERS, not end to end. The timer is cleared when
    // fetch resolves, which is at the headers (pinned by "stops bounding at the
    // response HEADERS" below), so body transfer is never bounded. The
    // heaviest request, /browse's 500-id select on a 20 kbps link, spends
    // ~3.3-3.7s before its headers (cold handshake, uploading a 3761-char URL,
    // server work); its ~6.2s of gzipped body arrives after the timer is gone.
    // So the floor is ~4s, and 12s carries ~3x over it. (This test used to
    // assert >= 8s from that request's end-to-end time, which counted body the
    // deadline never sees.)
    //
    // THE CEILING is ~15s of patience in ONE attempt, not an end-to-end bound:
    // a GET that fails fast three times and then hangs costs 1+2+4s of
    // postgrest backoff plus one deadline, ~19s — measured through the real
    // client below. The pure hang this exists for is one attempt, 12s.
    expect(REQUEST_DEADLINE_MS).toBe(12000);
    expect(REQUEST_DEADLINE_MS).toBeGreaterThanOrEqual(4000);
    expect(REQUEST_DEADLINE_MS).toBeLessThanOrEqual(15000);
  });
});

describe("createDeadlineFetch: the caller's own signal still cancels", () => {
  it("cancels on the caller's abort, long before the deadline", async () => {
    // Note 2 in supabaseClient.js. supabase-js forwards the builder's
    // .abortSignal() as init.signal; a wrapper that REPLACES it silently breaks
    // every unmount cancel in the app — measured on the naive version, a caller
    // abort at 5ms did not cancel and the request ran to completion.
    const calls = [];
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: hangingTransport(calls),
      deadlineMs: 30000, // far away: only the caller can end this
    });

    const caller = new AbortController();
    const started = Date.now();
    const pending = deadlineFetch("https://example.test/rest/v1/playlists", {
      signal: caller.signal,
    });
    const callerReason = new DOMException("unmounted", "AbortError");
    caller.abort(callerReason);

    const reason = await pending.then(() => null, (caught) => caught);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(reason).toBe(callerReason);
    // And the transport genuinely saw the cancel, rather than us short-circuiting.
    expect(calls[0].signal.aborted).toBe(true);
  });

  it("passes a signal that is already aborted straight through", async () => {
    const calls = [];
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: hangingTransport(calls),
      deadlineMs: 30000,
    });

    const caller = new AbortController();
    caller.abort(new DOMException("already gone", "AbortError"));

    const reason = await deadlineFetch("https://example.test/rest/v1/x", {
      signal: caller.signal,
    }).then(() => null, (caught) => caught);

    expect(reason.name).toBe("AbortError");
    expect(calls[0].signal.aborted).toBe(true);
  });

  it("the deadline still fires for a caller whose signal never aborts", async () => {
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: hangingTransport([]),
      deadlineMs: TEST_DEADLINE_MS,
    });
    const caller = new AbortController(); // never aborted

    const reason = await deadlineFetch("https://example.test/rest/v1/x", {
      signal: caller.signal,
    }).then(() => null, (caught) => caught);

    expect(reason.message).toBe(REQUEST_TIMEOUT_MESSAGE);
  });
});

describe("createDeadlineFetch: a request that finishes in time is untouched", () => {
  it("returns the transport's own Response and forwards every init field unchanged", async () => {
    const response = { marker: "the exact object the transport returned" };
    let seen = null;
    const headers = { apikey: "anon" };
    const body = '{"q":1}';

    const deadlineFetch = createDeadlineFetch({
      fetchImpl: (input, init) => {
        seen = { input, init };
        return Promise.resolve(response);
      },
      deadlineMs: TEST_DEADLINE_MS,
    });

    const result = await deadlineFetch("https://example.test/rest/v1/playlists", {
      method: "POST",
      headers,
      body,
    });

    expect(result).toBe(response);
    expect(seen.input).toBe("https://example.test/rest/v1/playlists");
    expect(seen.init.method).toBe("POST");
    expect(seen.init.headers).toBe(headers);
    expect(seen.init.body).toBe(body);
    // The signal is the only addition, and it is not aborted.
    expect(Object.keys(seen.init).sort()).toEqual(["body", "headers", "method", "signal"]);
    expect(seen.init.signal.aborted).toBe(false);
  });

  it("clears the deadline timer once the response arrives", async () => {
    vi.useFakeTimers();
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: () => Promise.resolve({ ok: true }),
      deadlineMs: REQUEST_DEADLINE_MS,
    });

    await deadlineFetch("https://example.test/rest/v1/playlists");

    // A left-armed timer would hold a reference for 12s on every request.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops bounding at the response HEADERS: a body that stalls afterwards is never aborted", async () => {
    // This is what the /browse floor is sized on. fetch resolves when the
    // headers arrive; real fetch errors an in-flight body only if its signal
    // aborts, and past this point nothing is left that could abort it.
    vi.useFakeTimers();
    let signal = null;
    const stalledBody = new ReadableStream({ start() {} }); // never enqueues, never closes
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: (_input, init) => {
        signal = init.signal;
        return Promise.resolve(new Response(stalledBody, { status: 200 }));
      },
      deadlineMs: TEST_DEADLINE_MS,
    });

    const response = await deadlineFetch("https://example.test/rest/v1/videos?id=in.(1,2,3)");
    await vi.advanceTimersByTimeAsync(TEST_DEADLINE_MS * 100);

    expect(response.status).toBe(200);
    expect(vi.getTimerCount()).toBe(0);
    expect(signal.aborted).toBe(false);
  });

  it("leaves no listener behind on a long-lived caller signal", async () => {
    // The five cancelling hooks hold one controller per render pass and issue
    // several requests against it. Leaking a listener per request would grow
    // without bound. (AbortSignal.any handles this itself; this covers the
    // fallback path too.)
    const caller = new AbortController();
    const added = [];
    const original = caller.signal.addEventListener.bind(caller.signal);
    const removed = [];
    caller.signal.addEventListener = (type, fn, opts) => {
      added.push(fn);
      return original(type, fn, opts);
    };
    const originalRemove = caller.signal.removeEventListener.bind(caller.signal);
    caller.signal.removeEventListener = (type, fn, opts) => {
      removed.push(fn);
      return originalRemove(type, fn, opts);
    };

    const deadlineFetch = createDeadlineFetch({
      fetchImpl: () => Promise.resolve({ ok: true }),
      deadlineMs: REQUEST_DEADLINE_MS,
    });
    await deadlineFetch("https://example.test/rest/v1/a", { signal: caller.signal });
    await deadlineFetch("https://example.test/rest/v1/b", { signal: caller.signal });

    // Either nothing was added (AbortSignal.any path) or everything added was
    // removed (fallback path). Both are leak-free; a leak is added > removed.
    expect(added.length - removed.length).toBe(0);
  });
});

describe("createDeadlineFetch: the fallback for browsers without AbortSignal.any", () => {
  // AbortSignal.any landed in Chrome 116 / Safari 17.4. An older phone is
  // exactly the device this whole change is for, and there the wrapper takes a
  // hand-rolled path. Without stubbing the method away these lines never run in
  // this suite at all — jsdom has AbortSignal.any, so every test above takes
  // the fast path and a broken fallback would ship green.
  const realAny = AbortSignal.any;
  beforeEach(() => {
    Object.defineProperty(AbortSignal, "any", {
      value: undefined, configurable: true, writable: true,
    });
  });
  afterEach(() => {
    Object.defineProperty(AbortSignal, "any", {
      value: realAny, configurable: true, writable: true,
    });
  });

  it("is actually the path under test", () => {
    expect(typeof AbortSignal.any).not.toBe("function");
  });

  it("still fires the deadline, carrying the reason (name AND message) through", async () => {
    // The name is what keeps postgrest from retrying; the message is what tells
    // a timeout apart from an unmount cancel and picks the student's copy. A
    // bare merged.abort() would keep the name and silently lose the message.
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: hangingTransport([]),
      deadlineMs: TEST_DEADLINE_MS,
    });
    const caller = new AbortController(); // present, so the merge path is taken

    const reason = await deadlineFetch("https://example.test/rest/v1/x", {
      signal: caller.signal,
    }).then(() => null, (caught) => caught);

    expect(reason.name).toBe("AbortError");
    expect(reason.message).toBe(REQUEST_TIMEOUT_MESSAGE);
  });

  it("still cancels on the caller's abort", async () => {
    const calls = [];
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: hangingTransport(calls),
      deadlineMs: 30000,
    });
    const caller = new AbortController();
    const pending = deadlineFetch("https://example.test/rest/v1/x", { signal: caller.signal });
    const callerReason = new DOMException("unmounted", "AbortError");
    caller.abort(callerReason);

    const reason = await pending.then(() => null, (caught) => caught);
    expect(reason).toBe(callerReason);
    expect(calls[0].signal.aborted).toBe(true);
  });

  it("removes its listener from a long-lived caller signal on every completed request", async () => {
    const caller = new AbortController();
    let live = 0;
    const add = caller.signal.addEventListener.bind(caller.signal);
    const remove = caller.signal.removeEventListener.bind(caller.signal);
    caller.signal.addEventListener = (...args) => { live += 1; return add(...args); };
    caller.signal.removeEventListener = (...args) => { live -= 1; return remove(...args); };

    const deadlineFetch = createDeadlineFetch({
      fetchImpl: () => Promise.resolve({ ok: true }),
      deadlineMs: REQUEST_DEADLINE_MS,
    });
    for (let i = 0; i < 5; i += 1) {
      await deadlineFetch(`https://example.test/rest/v1/${i}`, { signal: caller.signal });
    }

    // The cancelling hooks hold one controller across many requests; one
    // listener left per request is an unbounded leak.
    expect(live).toBe(0);
  });
});

describe("createDeadlineFetch: /auth/v1/ is exempt, except the token refresh and GET /auth/v1/user", () => {
  it("gives grant_type=refresh_token a composed signal and a timer that trips at REFRESH_DEADLINE_MS, not REQUEST_DEADLINE_MS", async () => {
    // This test used to assert the opposite: the refresh got the untouched init
    // and no timer. That exemption was the bug. supabase-js awaits
    // auth.getSession() BEFORE it calls fetch, a stale token turns that await
    // into this POST, and with the POST unbounded no data request ever reached
    // a deadline (note 3 in supabaseClient.js; the end-to-end scenario is the
    // last describe block in this file).
    vi.useFakeTimers();
    const calls = [];
    const caller = new AbortController();
    const init = { method: "POST", body: '{"refresh_token":"RT-1"}', signal: caller.signal };
    // No knobs: the shipped defaults are what is under test.
    const deadlineFetch = createDeadlineFetch({ fetchImpl: hangingTransport(calls) });

    let outcome = null;
    deadlineFetch("https://x.supabase.co/auth/v1/token?grant_type=refresh_token", init)
      .then(() => { outcome = "resolved"; }, (reason) => { outcome = reason; });

    // A copy carrying a composed signal: every field forwarded, the caller's
    // own signal wrapped rather than replaced, the caller's object unmutated.
    expect(calls).toHaveLength(1);
    expect(calls[0].init).not.toBe(init);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.body).toBe(init.body);
    expect(init.signal).toBe(caller.signal);
    expect(calls[0].signal).toBeDefined();
    expect(calls[0].signal).not.toBe(caller.signal);
    expect(calls[0].signal.aborted).toBe(false);
    expect(vi.getTimerCount()).toBe(1);

    // The checkpoint at REQUEST_DEADLINE_MS only discriminates if they differ.
    expect(REFRESH_DEADLINE_MS).toBe(15000);
    expect(REFRESH_DEADLINE_MS).toBeGreaterThan(REQUEST_DEADLINE_MS);

    await vi.advanceTimersByTimeAsync(REQUEST_DEADLINE_MS);
    expect(outcome).toBeNull();
    expect(calls[0].signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(REFRESH_DEADLINE_MS - REQUEST_DEADLINE_MS - 1);
    expect(outcome).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(outcome.name).toBe("AbortError");
    expect(outcome.message).toBe(REQUEST_TIMEOUT_MESSAGE);
    expect(calls[0].signal.aborted).toBe(true);
    expect(caller.signal.aborted).toBe(false); // ours tripped, the caller's did not
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not let a slow password sign-in (grant_type=password) be aborted by either deadline", async () => {
    // The regression test for the exemption that remains. The refresh is
    // matched on BOTH "/auth/v1/token" and "grant_type=refresh_token"; matching
    // the path alone would swallow this one. Both knobs are set short, so a
    // matcher that did would trip well inside the wait below.
    const calls = [];
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: hangingTransport(calls),
      deadlineMs: TEST_DEADLINE_MS,
      refreshDeadlineMs: TEST_DEADLINE_MS,
    });

    let settled = false;
    deadlineFetch("https://x.supabase.co/auth/v1/token?grant_type=password").then(
      () => { settled = true; },
      () => { settled = true; },
    );
    await new Promise((r) => setTimeout(r, TEST_DEADLINE_MS * 4));

    // Deliberate: a student typing a password on a slow link would rather wait
    // than be told sign-in failed, and a sign-in abandoned mid-flight has no
    // retry loop behind it the way the refresh does. So it is left alone.
    expect(settled).toBe(false);
    expect(calls[0].signal).toBeUndefined();
  });

  // Every URL here is one auth-js 2.110.7 actually issues (GoTrueClient.js,
  // GoTrueAdminApi.js), not a guess at what it might.
  it.each([
    ["the PKCE code exchange", "/auth/v1/token?grant_type=pkce"],
    ["sign-out", "/auth/v1/logout?scope=global"],
    ["password sign-in", "/auth/v1/token?grant_type=password"],
    ["id_token sign-in", "/auth/v1/token?grant_type=id_token"],
    ["sign-up", "/auth/v1/signup"],
    ["password recovery", "/auth/v1/recover"],
  ])("leaves %s (%s) untouched: the caller's own init, no signal, no timer", (_label, path) => {
    vi.useFakeTimers();
    let seen = null;
    const init = { method: "POST", body: "{}" };
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: (_input, received) => {
        seen = received;
        return new Promise(() => {}); // still in flight when we look
      },
    });

    deadlineFetch(`https://x.supabase.co${path}`, init);

    // Same object, not a copy: nothing was added, nothing was replaced. The
    // timer count is read while the request is still in flight, because a
    // timer armed and then cleared on settle would also read 0 after an await.
    expect(seen).toBe(init);
    expect(seen.signal).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  // GET /auth/v1/user is the other exception. With the implicit flow (the
  // supabase-js default) it is the request auth-js sends while reading
  // #access_token=... after Google sign-in, an email confirmation or a reset
  // link, and every request on the page waits behind it. The end-to-end
  // scenario is sessionFromUrlDeadline.test.js; these pin the matcher.
  it.each([
    ["as auth-js sends it (string URL, init.method GET)", (url) => [url, { method: "GET", headers: { Authorization: "Bearer AT" } }]],
    ["with no init at all (fetch's own default is GET)", (url) => [url, undefined]],
    ["as a GET Request object", (url) => [new Request(url), undefined]],
  ])("gives GET /auth/v1/user %s a timer that trips at USER_LOOKUP_DEADLINE_MS, past both other deadlines", async (_label, args) => {
    vi.useFakeTimers();
    const calls = [];
    // No knobs: the shipped defaults are what is under test.
    const deadlineFetch = createDeadlineFetch({ fetchImpl: hangingTransport(calls) });

    let outcome = null;
    deadlineFetch(...args("https://x.supabase.co/auth/v1/user"))
      .then(() => { outcome = "resolved"; }, (reason) => { outcome = reason; });

    expect(calls).toHaveLength(1);
    expect(calls[0].signal).toBeDefined();
    expect(vi.getTimerCount()).toBe(1);

    // The checkpoints only discriminate because the three values differ.
    await vi.advanceTimersByTimeAsync(REFRESH_DEADLINE_MS);
    expect(outcome).toBeNull();
    await vi.advanceTimersByTimeAsync(USER_LOOKUP_DEADLINE_MS - REFRESH_DEADLINE_MS - 1);
    expect(outcome).toBeNull();
    expect(calls[0].signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(outcome.name).toBe("AbortError");
    expect(outcome.message).toBe(REQUEST_TIMEOUT_MESSAGE);
    expect(calls[0].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  // Matched on METHOD as well as path. PUT /auth/v1/user is updateUser —
  // PasswordReset.jsx submitting a new password — which is user-initiated and
  // stays unbounded. And on the EXACT path, so the /user/... routes stay out.
  it.each([
    ["updateUser, the new-password submit (PUT)", () => ["https://x.supabase.co/auth/v1/user", { method: "PUT", body: '{"password":"correct-horse"}' }]],
    ["a lower-case put", () => ["https://x.supabase.co/auth/v1/user", { method: "put", body: "{}" }]],
    ["a PUT Request object", () => [new Request("https://x.supabase.co/auth/v1/user", { method: "PUT", body: "{}" }), undefined]],
    ["a GET Request sent with init.method PUT (init wins, as it does in fetch)", () => [new Request("https://x.supabase.co/auth/v1/user"), { method: "PUT", body: "{}" }]],
    ["identity linking (GET /auth/v1/user/identities/authorize)", () => ["https://x.supabase.co/auth/v1/user/identities/authorize?provider=google", { method: "GET" }]],
    ["the OAuth grants list (GET /auth/v1/user/oauth/grants)", () => ["https://x.supabase.co/auth/v1/user/oauth/grants", { method: "GET" }]],
  ])("leaves %s untouched: the caller's own arguments, no signal, no timer", (_label, args) => {
    vi.useFakeTimers();
    let seen = null;
    const [input, init] = args();
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: (receivedInput, receivedInit) => {
        seen = { input: receivedInput, init: receivedInit };
        return new Promise(() => {}); // still in flight when we look
      },
    });

    deadlineFetch(input, init);

    expect(seen.input).toBe(input);
    expect(seen.init).toBe(init);
    expect(seen.init?.signal).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sizes USER_LOOKUP_DEADLINE_MS generously from measurement: one attempt, so a total, and well past the slowest lookup seen", () => {
    // Measured read-only against production, 2026-09-15: GET /auth/v1/user with
    // an invalid bearer, 70 cold round trips p50 427ms / p95 1031ms / max
    // 6794ms (a 6.5s DNS stall). auth-js sends it once, no retry, so this is
    // the whole wait. Reasoning at the constant in supabaseClient.js.
    expect(USER_LOOKUP_DEADLINE_MS).toBe(30000);
    expect(USER_LOOKUP_DEADLINE_MS).toBeGreaterThan(REFRESH_DEADLINE_MS);
    expect(USER_LOOKUP_DEADLINE_MS).toBeGreaterThanOrEqual(4 * 6794);
  });

  it("still applies the deadline to /rest/v1/ on the same host", async () => {
    const deadlineFetch = createDeadlineFetch({
      fetchImpl: hangingTransport([]),
      deadlineMs: TEST_DEADLINE_MS,
    });
    const reason = await deadlineFetch("https://x.supabase.co/rest/v1/playlists?select=id")
      .then(() => null, (caught) => caught);
    expect(reason.message).toBe(REQUEST_TIMEOUT_MESSAGE);
  });
});

describe("through the real supabase-js client", () => {
  // Each test gets its own storage key; sharing one makes GoTrue warn about
  // multiple clients in the same context and drown the run in stderr.
  let clientSeq = 0;
  const authOptions = () => ({
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: `deadline-test-${++clientSeq}`,
  });

  function clientWith(calls, deadlineMs = TEST_DEADLINE_MS) {
    return createClient("https://example.supabase.co", "test-anon-key", {
      auth: authOptions(),
      global: { fetch: createDeadlineFetch({ fetchImpl: hangingTransport(calls), deadlineMs }) },
    });
  }

  it("a hung builder query RESOLVES into the { data, error } envelope call sites already handle", async () => {
    const calls = [];
    const client = clientWith(calls);

    // No try/catch on purpose: this is the shape of ~130 call sites in src/. If
    // a deadline could reject, this line would be an unhandled rejection.
    const { data, error } = await client.from("playlists").select("id, title").limit(1);

    expect(data).toBeNull();
    expect(error).toBeTruthy();
    expect(String(error.message).toLowerCase()).toContain("timeout");
    expect(error.message).toContain("AbortError");
    // ONE attempt. Four would mean the abort reason lost its AbortError name and
    // postgrest ran its 1s/2s/4s retry backoff on top of the deadline.
    expect(calls).toHaveLength(1);
  });

  it("a hung .rpc() resolves the same way", async () => {
    const calls = [];
    const client = clientWith(calls);

    const { data, error } = await client.rpc("universal_search", { p_query: "neet" });

    expect(data).toBeNull();
    expect(String(error.message).toLowerCase()).toContain("timeout");
    expect(calls).toHaveLength(1);
  });

  it("a hung .maybeSingle() resolves the same way", async () => {
    const calls = [];
    const client = clientWith(calls);
    const { data, error } = await client.from("playlists").select("id").eq("id", 1).maybeSingle();
    expect(data).toBeNull();
    expect(String(error.message).toLowerCase()).toContain("timeout");
  });

  it("a GET that fails fast three times and THEN hangs settles at 1+2+4s of backoff plus one deadline, ~19s", async () => {
    // Why REQUEST_DEADLINE_MS's ~15s ceiling is stated PER ATTEMPT. A fast
    // failure is not named AbortError, so postgrest retries it with its own
    // backoff before the attempt that hangs ever meets the deadline. Measured
    // here with the shipped 12s deadline, not computed.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const t0 = Date.now();
    const attempts = [];
    const hang = hangingTransport([]);
    const client = createClient("https://example.supabase.co", "test-anon-key", {
      auth: authOptions(),
      global: {
        fetch: createDeadlineFetch({
          fetchImpl: (input, init) => {
            attempts.push(Date.now() - t0);
            return attempts.length <= 3
              ? Promise.reject(new TypeError("fetch failed"))
              : hang(input, init);
          },
        }),
      },
    });

    let settled = null;
    client.from("playlists").select("id").then((result) => {
      settled = { ...result, at: Date.now() - t0 };
    });

    const backoff = 1000 + 2000 + 4000;
    await vi.advanceTimersByTimeAsync(backoff + REQUEST_DEADLINE_MS - 1);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);

    expect(attempts).toEqual([0, 1000, 3000, 7000]);
    expect(settled.error.message).toContain(REQUEST_TIMEOUT_MESSAGE);
    expect(settled.at).toBe(backoff + REQUEST_DEADLINE_MS);
    // Over the per-attempt ceiling end to end — accepted, see supabaseClient.js.
    expect(settled.at).toBeGreaterThan(15000);
  });

  it(".abortSignal() cancellation still reaches the transport and is distinguishable from a timeout", async () => {
    // The five cancelling hooks depend on this, and both cases arrive as
    // name "AbortError" with status 0 — the message is the only thing that
    // tells a cancel apart from a deadline.
    const calls = [];
    const client = clientWith(calls, 30000); // deadline far away
    const controller = new AbortController();

    const pending = client.from("playlists").select("id").abortSignal(controller.signal);
    // Let supabase-js reach the transport before cancelling.
    await new Promise((r) => setTimeout(r, 10));
    controller.abort();

    const { error } = await pending;

    expect(calls).toHaveLength(1);
    expect(calls[0].signal.aborted).toBe(true);
    expect(error.message).toContain("AbortError");
    expect(error.message).not.toContain(REQUEST_TIMEOUT_MESSAGE);
    expect(String(error.message).toLowerCase()).not.toContain("timeout");
  });

  it("a request that answers in time is unaffected end to end", async () => {
    const client = createClient("https://example.supabase.co", "test-anon-key", {
      auth: authOptions(),
      global: {
        fetch: createDeadlineFetch({
          fetchImpl: async () =>
            new Response(JSON.stringify([{ id: 7, title: "Thermodynamics" }]), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          deadlineMs: TEST_DEADLINE_MS,
        }),
      },
    });

    const { data, error } = await client.from("playlists").select("id, title");

    expect(error).toBeNull();
    expect(data).toEqual([{ id: 7, title: "Thermodynamics" }]);
  });
});

describe("through the real supabase-js client: a signed-in student whose access token went stale", () => {
  // THE SCENARIO THAT ACTUALLY FAILED. supabase-js awaits auth.getSession()
  // BEFORE it calls global.fetch (fetchWithAuth, dist/index.mjs:363 vs :378).
  // With a stale access token that await IS the refresh POST, so while
  // /auth/v1/token was exempt a hung refresh held every data request in front
  // of the deadline: nothing reached the wrapper, no timer was armed, and every
  // panel on the page spun forever (a phone unlocked on a train, a tab waking).
  //
  // Real client, real auth-js retry loop, real postgrest; a persisting,
  // auto-refreshing browser client, as the app builds one. ONLY THE CLOCK IS
  // FAKE, and that is not optional. auth-js keeps retrying the refresh while
  // `Date.now() + backoff - startedAt < AUTO_REFRESH_TICK_DURATION_MS`, a
  // hard-coded 30000 (GoTrueClient.js:3949-3954), so the storm lasts ~30s of
  // wall time whatever deadline this file picks — 30296ms measured with this
  // wrapper against real timers — and the per-test budget is 15s. Shrinking
  // our deadline does not shrink it (a 50ms deadline still stalls ~26s; see
  // the sweep at REFRESH_DEADLINE_MS). So vi.useFakeTimers fakes exactly what
  // that loop reads, and nothing else: setTimeout/clearTimeout (auth-js
  // `sleep`, our deadline), setInterval/clearInterval (the auto-refresh
  // ticker), and Date (the retry window, expires_at, the failure cooldown).
  // Promises, microtasks and Response bodies stay real.
  //
  // How these tests know they are driving the real loop and not a stub of it:
  // the second /token attempt goes out at exactly REFRESH_DEADLINE_MS + 200,
  // which is auth-js's `sleep(200 * 2 ** (attempt - 1))`; the loop stops
  // because the NEXT backoff would overflow 30s, not because anything here
  // told it to; and a 12s deadline reproduces the recorded sawtooth point (3
  // attempts, 36.6s) instead of a shorter stall.
  const FAKED = ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"];
  // Past the storm at either deadline tested here (30.2s, 36.6s), and short of
  // both the next auto-refresh interval tick (30s after init settles) and the
  // end of auth-js's 60s failure cooldown, so no third /token attempt can
  // appear for a reason unrelated to the loop under test.
  const HORIZON_MS = 45000;
  const ROWS = [{ id: 1, title: "Rotational Mechanics" }];
  const ANON_KEY = "test-anon-key";
  let storageSeq = 0;
  let client = null;
  let consoleError = null;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: FAKED });
    // auth-js lib/fetch.js console.errors every transport throw; the aborted
    // refresh attempts are the expected path here, not news.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    // Stops the auto-refresh ticker and closes the BroadcastChannel that a
    // persisting browser client opens, so nothing outlives the test.
    await client?.auth.dispose();
    client = null;
    consoleError.mockRestore();
    vi.useRealTimers();
  });

  function startStaleSession({ expiresInSeconds, deadlines = {} }) {
    const t0 = Date.now();
    const storageKey = `stale-token-test-${++storageSeq}`;
    const stored = new Map([[storageKey, JSON.stringify({
      access_token: "AT-STALE",
      refresh_token: "RT-1",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(t0 / 1000) + expiresInSeconds,
      user: { id: "student-1", aud: "authenticated", email: "student@example.test" },
    })]]);
    const storage = {
      getItem: (key) => (stored.has(key) ? stored.get(key) : null),
      setItem: (key, value) => { stored.set(key, value); },
      removeItem: (key) => { stored.delete(key); },
    };

    const tokenAttempts = [];
    const dataRequests = [];
    const transport = (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/auth/v1/token")) {
        const attempt = { at: Date.now() - t0, abortedAt: null, reason: null };
        tokenAttempts.push(attempt);
        // Hangs unless aborted, exactly like fetch on a dead socket.
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          const onAbort = () => {
            attempt.abortedAt = Date.now() - t0;
            attempt.reason = signal.reason;
            reject(signal.reason);
          };
          if (signal.aborted) onAbort();
          else signal.addEventListener("abort", onAbort, { once: true });
        });
      }
      dataRequests.push({
        url,
        at: Date.now() - t0,
        authorization: new Headers(init?.headers).get("Authorization"),
      });
      return Promise.resolve(new Response(JSON.stringify(ROWS), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    };

    client = createClient("https://example.supabase.co", ANON_KEY, {
      auth: {
        storage,
        storageKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: { fetch: createDeadlineFetch({ fetchImpl: transport, ...deadlines }) },
    });

    const events = [];
    client.auth.onAuthStateChange((event, session) => {
      events.push({ event, session: session ? "present" : null });
    });

    // Both issued at once, the way a page mounts several panels together.
    const settled = {};
    client.from("videos").select("id, title").then((result) => {
      settled.select = { ...result, at: Date.now() - t0 };
    });
    client.rpc("search_video_ids", { p_query: "neet" }).then((result) => {
      settled.rpc = { ...result, at: Date.now() - t0 };
    });

    return {
      events,
      settled,
      tokenAttempts,
      dataRequests,
      storedSession: () => (stored.has(storageKey) ? JSON.parse(stored.get(storageKey)) : null),
      advanceTo: (ms) => vi.advanceTimersByTimeAsync(Math.max(0, t0 + ms - Date.now())),
      timeline: () => tokenAttempts.map(({ at, abortedAt }) => ({ at, abortedAt })),
      snapshot: () => ({
        select: "select" in settled,
        rpc: "rpc" in settled,
        token: tokenAttempts.map(({ at, abortedAt }) => ({ at, abortedAt })),
        data: dataRequests.length,
      }),
    };
  }

  it("with the token EXPIRED and /token hung, a .from() select and an .rpc() both SETTLE, and nobody is signed out", async () => {
    const run = startStaleSession({ expiresInSeconds: -600 }); // shipped deadlines
    const storm = 2 * REFRESH_DEADLINE_MS + 200;

    await run.advanceTo(REFRESH_DEADLINE_MS - 1);
    const beforeFirstAbort = run.snapshot();
    await run.advanceTo(REFRESH_DEADLINE_MS + 199);
    const inBackoff = run.snapshot();
    await run.advanceTo(storm - 1);
    const beforeSecondAbort = run.snapshot();
    await run.advanceTo(HORIZON_MS);

    // 1. THE BUG. Both settle, carrying the rows /rest/v1/ answered with.
    expect(run.settled.select, "the .from() select never settled").toBeDefined();
    expect(run.settled.rpc, "the .rpc() never settled").toBeDefined();
    expect(run.settled.select.error).toBeNull();
    expect(run.settled.select.data).toEqual(ROWS);
    expect(run.settled.rpc.error).toBeNull();
    expect(run.settled.rpc.data).toEqual(ROWS);

    // 2. WHAT MUST NOT HAPPEN. A tripped refresh deadline reaches auth-js as
    // AuthRetryableFetchError (lib/fetch.js), and _removeSession on this path
    // is gated on !isAuthRetryableFetchError (GoTrueClient.js:4192). No
    // SIGNED_OUT, and the refresh token is still there for the next attempt.
    expect(run.events.map(({ event }) => event)).not.toContain("SIGNED_OUT");
    expect(run.storedSession()).toMatchObject({
      access_token: "AT-STALE",
      refresh_token: "RT-1",
    });

    // 3. THE REAL RETRY LOOP, checkpoint by checkpoint. The data requests do
    // not reach the transport at all until the refresh gives up: that is the
    // mechanism of the original hang, now bounded.
    expect(beforeFirstAbort).toEqual({
      select: false, rpc: false, data: 0,
      token: [{ at: 0, abortedAt: null }],
    });
    expect(inBackoff).toEqual({
      select: false, rpc: false, data: 0,
      token: [{ at: 0, abortedAt: REFRESH_DEADLINE_MS }],
    });
    expect(beforeSecondAbort).toEqual({
      select: false, rpc: false, data: 0,
      token: [
        { at: 0, abortedAt: REFRESH_DEADLINE_MS },
        { at: REFRESH_DEADLINE_MS + 200, abortedAt: null },
      ],
    });
    expect(run.timeline()).toEqual([
      { at: 0, abortedAt: REFRESH_DEADLINE_MS },
      { at: REFRESH_DEADLINE_MS + 200, abortedAt: storm },
    ]);
    for (const attempt of run.tokenAttempts) {
      expect(attempt.reason.name).toBe("AbortError");
      expect(attempt.reason.message).toBe(REQUEST_TIMEOUT_MESSAGE);
    }
    expect(run.dataRequests).toHaveLength(2);
    expect(run.dataRequests.every(({ at }) => at >= storm)).toBe(true);
    expect(run.settled.select.at).toBeGreaterThanOrEqual(storm);
    expect(run.settled.rpc.at).toBeGreaterThanOrEqual(storm);

    // 4. RECORDED COST, pinned so it cannot change silently — not endorsed.
    // With the access token genuinely expired, getSession yields null once the
    // refresh fails: INITIAL_SESSION reports no session and the data goes out
    // under the anon key (RLS-scoped) until a refresh succeeds. The same state
    // a BROKEN network already reached with no deadline at all; the deadline
    // makes a merely SLOW one reach it too. See note 3 in supabaseClient.js.
    expect(run.events).toEqual([{ event: "INITIAL_SESSION", session: null }]);
    expect(run.dataRequests.map(({ authorization }) => authorization))
      .toEqual([`Bearer ${ANON_KEY}`, `Bearer ${ANON_KEY}`]);
  });

  it("a SHORTER refresh deadline buys more attempts, not a shorter stall: the 30s window is auth-js's", async () => {
    // The 12000 point of the sweep recorded at REFRESH_DEADLINE_MS (36679ms, 3
    // attempts, against real timers). A stub of the loop would not produce it.
    const run = startStaleSession({ expiresInSeconds: -600, deadlines: { refreshDeadlineMs: 12000 } });

    await run.advanceTo(36599);
    const beforeLastAbort = run.snapshot();
    await run.advanceTo(HORIZON_MS);

    expect(run.settled.select, "the .from() select never settled").toBeDefined();
    expect(run.settled.rpc, "the .rpc() never settled").toBeDefined();
    expect(beforeLastAbort.select).toBe(false);
    expect(run.timeline()).toEqual([
      { at: 0, abortedAt: 12000 },
      { at: 12200, abortedAt: 24200 },
      { at: 24600, abortedAt: 36600 },
    ]);
    // Longer than the shipped deadline's storm, which is why 15000 was chosen.
    expect(run.settled.select.at).toBeGreaterThan(2 * REFRESH_DEADLINE_MS + 200);
    expect(run.events.map(({ event }) => event)).not.toContain("SIGNED_OUT");
  });

  it("a token still valid when the storm ENDS is preserved, and the data goes out with it", async () => {
    // expires_at 60s out: inside auth-js's 90s EXPIRY_MARGIN_MS, so a refresh
    // fires, but still genuinely valid at ~30.2s when the refresh gives up.
    // __loadSession's proactive-preserve branch hands the stored session back.
    const run = startStaleSession({ expiresInSeconds: 60 });

    await run.advanceTo(HORIZON_MS);

    expect(run.settled.select, "the .from() select never settled").toBeDefined();
    expect(run.settled.rpc, "the .rpc() never settled").toBeDefined();
    expect(run.settled.select.error).toBeNull();
    expect(run.settled.rpc.error).toBeNull();
    expect(run.tokenAttempts).toHaveLength(2);
    expect(run.events).toEqual([{ event: "INITIAL_SESSION", session: "present" }]);
    expect(run.dataRequests.map(({ authorization }) => authorization))
      .toEqual(["Bearer AT-STALE", "Bearer AT-STALE"]);
    expect(run.storedSession()).toMatchObject({ refresh_token: "RT-1" });
  });

  it("RECORDED COST: a token with under ~30s left when the storm STARTS has expired by the time it ends", async () => {
    // expires_at 20s out: valid when the refresh fires, expired at ~30.2s when
    // it gives up, so the preserve branch no longer applies and the student
    // sees the signed-out branch exactly as with an expired token. Storage
    // survives, and one successful refresh restores everything. Pinned so the
    // trade is visible, not because it is wanted.
    const run = startStaleSession({ expiresInSeconds: 20 });

    await run.advanceTo(HORIZON_MS);

    expect(run.settled.select, "the .from() select never settled").toBeDefined();
    expect(run.settled.rpc, "the .rpc() never settled").toBeDefined();
    expect(run.tokenAttempts).toHaveLength(2);
    expect(run.events).toEqual([{ event: "INITIAL_SESSION", session: null }]);
    expect(run.dataRequests.map(({ authorization }) => authorization))
      .toEqual([`Bearer ${ANON_KEY}`, `Bearer ${ANON_KEY}`]);
    expect(run.events.map(({ event }) => event)).not.toContain("SIGNED_OUT");
    expect(run.storedSession()).toMatchObject({ refresh_token: "RT-1" });
  });
});
