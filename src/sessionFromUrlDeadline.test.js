// sessionFromUrlDeadline.test.js — the deadline on GET /auth/v1/user in
// src/supabaseClient.js, through the real client, on the page load that
// follows Google sign-in, an email-confirmation link or a password-reset link.
//
// THE HANG. supabase-js defaults flowType to "implicit" and the app sets none,
// so each of those returns lands with #access_token=... in the URL. auth-js
// reads it while initialising (_initialize -> _getSessionFromURL ->
// _getUser(access_token) -> GET /auth/v1/user); getSession() awaits that
// initialisation, and every data request awaits getSession(). While all of
// /auth/v1/ was exempt from the deadline, a /user that never answered held
// every panel on the page: that one GET was the only request issued, and
// nothing settled.
//
// Real client, built the way the app builds it — createClient with only
// global.fetch, so flowType, detectSessionInUrl, persistSession and
// autoRefreshToken are the library defaults — and the SHIPPED deadlines. ONLY
// THE CLOCK IS FAKE, because the deadline is 30s and the per-test budget is
// 15s: setTimeout/clearTimeout (our deadline), setInterval/clearInterval (the
// auto-refresh ticker) and Date (token expiry). Promises and Responses are real.
//
// How these tests know they drive auth-js's own URL handling and not a stub of
// it: nothing in this file calls /auth/v1/user. It is issued only when the URL
// carries the hash, with the hash's own token as its bearer; with no hash it is
// never issued; and when it answers, the same setup saves the URL's session and
// clears the hash, which only _getSessionFromURL does.

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Importing supabaseClient.js builds the app's own client, and auth-js reads the
// URL as that client is built. Blank the env first, so no client pointed at the
// real project exists in this file to read a hash this file puts there.
vi.hoisted(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
});

import {
  createDeadlineFetch,
  REQUEST_TIMEOUT_MESSAGE,
  supabase as appClient,
  USER_LOOKUP_DEADLINE_MS,
} from "./supabaseClient.js";

const FAKED = ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"];
const BASE = "https://example.supabase.co";
const ANON_KEY = "test-anon-key";
// What Supabase appends to redirectTo on an implicit-flow return.
const URL_SESSION =
  "access_token=AT-FROM-URL&expires_in=3600&refresh_token=RT-FROM-URL&token_type=bearer";
const RETURN_PATH = `/browse#${URL_SESSION}`;
const ROWS = [{ id: 1, title: "Rotational Mechanics" }];
const URL_USER = { id: "url-user", aud: "authenticated", email: "student@example.test" };
// Past the 30s deadline with room to spare. Nothing else in this setup issues a
// request by then: every session here is an hour from expiry, so the
// auto-refresh ticker's tick at 30s finds nothing to do.
const HORIZON_MS = 45000;

let seq = 0;
let clients = [];
let consoleError = null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: FAKED });
  // auth-js lib/fetch.js console.errors every transport throw; the aborted
  // lookup is the expected path here, not news.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  // Stops each client's auto-refresh ticker and closes its BroadcastChannel.
  for (const client of clients) await client.auth.dispose();
  clients = [];
  consoleError.mockRestore();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

const json = (body) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/**
 * One page load: put the URL in place (unless keepUrl), build the client the
 * way the app does, and issue what a page mounts at once — a .from() select,
 * an .rpc() and getSession() — plus the initialize() result useSession reads.
 *
 * GET /auth/v1/user never settles on its own unless userAnswersAfterMs is set,
 * and rejects with its signal's reason if that signal aborts: a dead socket.
 */
function loadPage({ path = RETURN_PATH, keepUrl = false, storedSession = false, userAnswersAfterMs = null, store = null } = {}) {
  if (!keepUrl) window.history.replaceState(null, "", path);
  const t0 = Date.now();
  const at = () => Date.now() - t0;
  const storage = store ?? { key: `url-return-test-${++seq}`, items: new Map() };
  if (storedSession) {
    storage.items.set(storage.key, JSON.stringify({
      access_token: "AT-STORED",
      refresh_token: "RT-STORED",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(t0 / 1000) + 3600,
      user: { id: "stored-user", aud: "authenticated", email: "stored@example.test" },
    }));
  }

  const userLookups = [];
  const dataRequests = [];
  const unexpected = [];
  const transport = (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const method = init?.method ?? "GET";
    const authorization = new Headers(init?.headers).get("Authorization");
    if (method === "GET" && url === `${BASE}/auth/v1/user`) {
      const lookup = { at: at(), authorization, hadSignal: Boolean(init?.signal), abortedAt: null, reason: null };
      userLookups.push(lookup);
      return new Promise((resolve, reject) => {
        if (userAnswersAfterMs !== null) setTimeout(() => resolve(json(URL_USER)), userAnswersAfterMs);
        const signal = init?.signal;
        if (!signal) return;
        const onAbort = () => {
          lookup.abortedAt = at();
          lookup.reason = signal.reason;
          reject(signal.reason);
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      });
    }
    if (url.startsWith(`${BASE}/rest/v1/`)) {
      dataRequests.push({ url, at: at(), authorization });
      return Promise.resolve(json(ROWS));
    }
    unexpected.push(`${method} ${url}`);
    return Promise.reject(new TypeError(`unexpected request in this test: ${method} ${url}`));
  };

  const client = createClient(BASE, ANON_KEY, {
    auth: {
      storageKey: storage.key,
      storage: {
        getItem: (key) => storage.items.get(key) ?? null,
        setItem: (key, value) => { storage.items.set(key, value); },
        removeItem: (key) => { storage.items.delete(key); },
      },
    },
    global: { fetch: createDeadlineFetch({ fetchImpl: transport }) },
  });
  clients.push(client);

  const events = [];
  client.auth.onAuthStateChange((event, session) => {
    events.push({ event, user: session?.user?.id ?? null });
  });

  const settled = {};
  client.from("videos").select("id, title").then((result) => {
    settled.select = { ...result, at: at() };
  });
  client.rpc("search_video_ids", { p_query: "neet" }).then((result) => {
    settled.rpc = { ...result, at: at() };
  });
  client.auth.getSession().then((result) => {
    settled.getSession = { user: result.data.session?.user?.id ?? null, error: result.error, at: at() };
  });
  client.auth.initialize().then((result) => {
    settled.initialize = { error: result.error, at: at() };
  });

  return {
    client,
    storage,
    events,
    settled,
    userLookups,
    dataRequests,
    unexpected,
    stored: () => (storage.items.has(storage.key) ? JSON.parse(storage.items.get(storage.key)) : null),
    advanceTo: (ms) => vi.advanceTimersByTimeAsync(Math.max(0, t0 + ms - Date.now())),
  };
}

it("builds no client for the real project in this file", () => {
  // The precondition for putting a token hash in the URL at all.
  expect(appClient).toBeNull();
});

describe("through the real supabase-js client: a return from sign-in whose GET /auth/v1/user never answers", () => {
  it("the page's .from() select, .rpc() and getSession() SETTLE at the deadline, nobody is signed out, and a stored session is kept", async () => {
    const page = loadPage({ storedSession: true });

    await page.advanceTo(HORIZON_MS);

    // 1. THE BUG. Everything the page issued settles, carrying the rows.
    expect(page.settled.select, "the .from() select never settled").toBeDefined();
    expect(page.settled.rpc, "the .rpc() never settled").toBeDefined();
    expect(page.settled.getSession, "getSession() never settled").toBeDefined();
    expect(page.settled.select.error).toBeNull();
    expect(page.settled.select.data).toEqual(ROWS);
    expect(page.settled.rpc.error).toBeNull();
    expect(page.settled.rpc.data).toEqual(ROWS);

    // 2. WHAT MUST NOT HAPPEN. The abort reaches auth-js as
    // AuthRetryableFetchError; _getUser removes a session only for
    // AuthSessionMissingError, and _initialize returns before _saveSession
    // ("Don't remove existing session on URL login failure"). A student already
    // signed in on this device stays signed in, and the data goes out as them.
    expect(page.events.map(({ event }) => event)).not.toContain("SIGNED_OUT");
    expect(page.events).toEqual([{ event: "INITIAL_SESSION", user: "stored-user" }]);
    expect(page.settled.getSession.user).toBe("stored-user");
    expect(page.stored()).toMatchObject({ access_token: "AT-STORED", refresh_token: "RT-STORED" });
    expect(page.dataRequests.map(({ authorization }) => authorization))
      .toEqual(["Bearer AT-STORED", "Bearer AT-STORED"]);

    // 3. WHAT THE PAGE CAN TELL THE STUDENT, and that it is true. initialize()
    // carries the failure (useSession reads it from there), and the link is
    // still in the URL, so a reload checks it again (the reload test below).
    expect(page.settled.initialize.error.name).toBe("AuthRetryableFetchError");
    expect(page.settled.initialize.error.message).toBe(REQUEST_TIMEOUT_MESSAGE);
    expect(window.location.hash).toBe(`#${URL_SESSION}`);

    // 4. THE REAL PATH, with the deadline as its trigger. One lookup, issued by
    // auth-js with the hash's own token, aborted at exactly the deadline with
    // the AbortError-named reason; the data requests reach the transport only
    // after it.
    expect(page.userLookups).toHaveLength(1);
    expect(page.userLookups[0]).toMatchObject({
      at: 0,
      authorization: "Bearer AT-FROM-URL",
      hadSignal: true,
      abortedAt: USER_LOOKUP_DEADLINE_MS,
    });
    expect(page.userLookups[0].reason.name).toBe("AbortError");
    expect(page.dataRequests).toHaveLength(2);
    expect(page.dataRequests.every(({ at }) => at >= USER_LOOKUP_DEADLINE_MS)).toBe(true);
    expect(page.settled.select.at).toBeGreaterThanOrEqual(USER_LOOKUP_DEADLINE_MS);
    expect(page.unexpected).toEqual([]);
  });

  it("with nobody stored on the device the page renders signed out: INITIAL_SESSION null, data under the anon key, nothing written, link kept", async () => {
    const page = loadPage();

    await page.advanceTo(HORIZON_MS);

    expect(page.settled.select, "the .from() select never settled").toBeDefined();
    expect(page.settled.rpc, "the .rpc() never settled").toBeDefined();
    expect(page.settled.initialize, "initialisation never settled").toBeDefined();
    expect(page.events).toEqual([{ event: "INITIAL_SESSION", user: null }]);
    expect(page.settled.getSession.user).toBeNull();
    expect(page.dataRequests.map(({ authorization }) => authorization))
      .toEqual([`Bearer ${ANON_KEY}`, `Bearer ${ANON_KEY}`]);
    expect(page.stored()).toBeNull();
    expect(page.settled.initialize.error.name).toBe("AuthRetryableFetchError");
    expect(window.location.hash).toBe(`#${URL_SESSION}`);
  });

  it("a reload after the deadline is a working retry: the link is still in the URL, and a fresh client signs in with it", async () => {
    const first = loadPage();
    await first.advanceTo(HORIZON_MS);
    expect(first.settled.initialize, "initialisation never settled").toBeDefined();
    expect(first.settled.initialize.error.name).toBe("AuthRetryableFetchError");
    await first.client.auth.dispose();
    clients = clients.filter((client) => client !== first.client);

    // The reload: the URL exactly as the failure left it, the same storage, a
    // new client — and this time /auth/v1/user answers.
    const second = loadPage({ keepUrl: true, store: first.storage, userAnswersAfterMs: 0 });
    await second.advanceTo(1000);

    expect(second.userLookups).toMatchObject([{ authorization: "Bearer AT-FROM-URL" }]);
    expect(second.settled.initialize.error).toBeNull();
    expect(second.stored()).toMatchObject({
      access_token: "AT-FROM-URL",
      refresh_token: "RT-FROM-URL",
      user: URL_USER,
    });
    expect(second.events.map(({ event }) => event)).toContain("SIGNED_IN");
    expect(second.events.map(({ event }) => event)).not.toContain("SIGNED_OUT");
    expect(window.location.hash).toBe("");
    expect(second.dataRequests.map(({ authorization }) => authorization))
      .toEqual(["Bearer AT-FROM-URL", "Bearer AT-FROM-URL"]);
  });

  it("GUARD: a lookup still inside the deadline still looks PENDING — nothing settled, no data request, nothing aborted", async () => {
    // The other half of the rule: a deadline that made a slow check look
    // failed early would be a regression, not a fix.
    const page = loadPage({ storedSession: true });

    await page.advanceTo(USER_LOOKUP_DEADLINE_MS - 1);

    expect(page.settled).toEqual({});
    expect(page.dataRequests).toEqual([]);
    expect(page.events).toEqual([]);
    expect(page.userLookups).toMatchObject([{ abortedAt: null }]);
  });

  it("GUARD: a slow sign-in that answers inside the deadline is not cut short", async () => {
    const answersAt = USER_LOOKUP_DEADLINE_MS - 1000;
    const page = loadPage({ userAnswersAfterMs: answersAt });

    await page.advanceTo(HORIZON_MS);

    expect(page.userLookups).toMatchObject([{ abortedAt: null }]);
    expect(page.settled.initialize.error).toBeNull();
    expect(page.stored()).toMatchObject({ access_token: "AT-FROM-URL", user: URL_USER });
    expect(page.events.map(({ event }) => event)).toContain("SIGNED_IN");
    expect(page.settled.select.at).toBeGreaterThanOrEqual(answersAt);
    expect(page.settled.select.at).toBeLessThan(USER_LOOKUP_DEADLINE_MS);
  });

  it("CONTROL: with no hash in the URL there is no /auth/v1/user request at all, and the page settles at once", async () => {
    const page = loadPage({ path: "/browse", storedSession: true });

    await page.advanceTo(10);

    expect(page.userLookups).toEqual([]);
    expect(page.settled.select.at).toBe(0);
    expect(page.settled.rpc.at).toBe(0);
    expect(page.settled.initialize.error).toBeNull();
    // With no link to try, auth-js recovers the stored session and announces it
    // (SIGNED_IN, then INITIAL_SESSION). The failed-lookup tests above see
    // INITIAL_SESSION alone: _initialize returned on the URL error before it
    // ever reached that recovery, which is the branch the deadline sends it down.
    expect(page.events).toEqual([
      { event: "SIGNED_IN", user: "stored-user" },
      { event: "INITIAL_SESSION", user: "stored-user" },
    ]);
  });
});
