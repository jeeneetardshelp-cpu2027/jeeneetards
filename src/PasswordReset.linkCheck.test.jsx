// PasswordReset.linkCheck.test.jsx — what /reset shows once auth-js has
// checked, or failed to check, the recovery link in the URL.
//
// A recovery link lands here as #access_token=...&type=recovery. auth-js checks
// the token with GET /auth/v1/user while initialising. On success it saves the
// session and clears the hash, and the new-password form works. On failure it
// saves nothing and LEAVES THE HASH, and the page used to reason "a link is
// present, so offer the form": a form whose submit could only fail ("Auth
// session missing!") or — with another account still signed in on this device
// — would change THAT account's password.
//
// Real supabase-js client, real useSession, real PasswordReset. Only the
// transport is scripted, and reload, which jsdom will not let a test observe
// (window.location.reload is non-configurable there, so spyOn throws).

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { ThemeProvider } from "./theme.jsx";

const holder = vi.hoisted(() => {
  // supabaseClient.js builds the app's own client when first imported, and
  // auth-js reads the URL as it is built. Blank the env so that client is never
  // built against the real project.
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  return { client: null };
});

vi.mock("./supabaseClient.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isSupabaseConfigured: true,
    get supabase() {
      return holder.client;
    },
  };
});

import PasswordReset from "./PasswordReset.jsx";
import { createDeadlineFetch, REQUEST_TIMEOUT_MESSAGE } from "./supabaseClient.js";

const BASE = "https://example.supabase.co";
const RECOVERY_HASH =
  "#access_token=AT-FROM-LINK&expires_in=3600&refresh_token=RT-FROM-LINK&token_type=bearer&type=recovery";
const RECOVERY_PATH = `/reset${RECOVERY_HASH}`;
const CHECKING = "Checking the recovery link...";

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

// How GET /auth/v1/user behaves, per test.
const lookup = {
  // A dead socket: never settles unless its signal aborts.
  hangs: (init) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  // Exactly what the deadline in supabaseClient.js hands auth-js when it trips.
  timesOut: () =>
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new DOMException(REQUEST_TIMEOUT_MESSAGE, "AbortError")), 20);
    }),
  // The status and body production returned for a bad token, measured
  // read-only on 2026-09-15.
  refuses: () =>
    Promise.resolve(json(
      {
        code: "bad_jwt",
        message: "invalid JWT: unable to parse or verify signature, token signature is invalid: signature is invalid",
      },
      403,
      { "x-supabase-api-version": "2024-01-01" },
    )),
  answers: () =>
    Promise.resolve(json({ id: "link-user", aud: "authenticated", email: "student@example.com" })),
};

let seq = 0;
let consoleError = null;

beforeEach(() => {
  localStorage.clear();
  // auth-js lib/fetch.js console.errors every transport throw.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  cleanup();
  await holder.client?.auth.dispose();
  holder.client = null;
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  consoleError.mockRestore();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

function startClient({ userLookup, userLookupDeadlineMs, signedInElsewhere = false }) {
  window.history.replaceState(null, "", RECOVERY_PATH);
  const storageKey = `reset-link-test-${++seq}`;
  if (signedInElsewhere) {
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: "AT-OTHER-ACCOUNT",
      refresh_token: "RT-OTHER-ACCOUNT",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "other-account", aud: "authenticated", email: "sibling@example.com" },
    }));
  }
  const transport = (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if ((init?.method ?? "GET") === "GET" && url === `${BASE}/auth/v1/user`) return userLookup(init);
    return Promise.resolve(json([]));
  };
  holder.client = createClient(BASE, "test-anon-key", {
    auth: { storageKey },
    global: {
      fetch: createDeadlineFetch({
        fetchImpl: transport,
        ...(userLookupDeadlineMs ? { userLookupDeadlineMs } : {}),
      }),
    },
  });
}

// Records whether matching text was EVER added to the page, even if a later
// render took it away again: a flash of the form counts.
function watchForText(pattern) {
  const hits = [];
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (pattern.test(node.textContent ?? "")) hits.push(node.textContent);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return { hits, stop: () => observer.disconnect() };
}

function renderReset() {
  const reloadPage = vi.fn();
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[RECOVERY_PATH]}>
        <PasswordReset reloadPage={reloadPage} />
      </MemoryRouter>
    </ThemeProvider>,
  );
  return reloadPage;
}

const checkFinished = () =>
  waitFor(() => expect(screen.queryByText(CHECKING)).toBeNull());

describe("/reset when the recovery link could not be checked", () => {
  it("says it is checking while the lookup is PENDING, then — once the deadline cuts it short — that the link could not be checked, with a Try again that reloads", async () => {
    startClient({ userLookup: lookup.hangs, userLookupDeadlineMs: 150 });
    const form = watchForText(/New password/);
    const reloadPage = renderReset();

    // Pending looks pending: the checking line, no error, no form.
    expect(screen.getByText(CHECKING)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/could not be checked/i);
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(form.hits).toEqual([]);

    // A WORKING retry: auth-js left the link in the URL, so a reload checks it
    // again (sessionFromUrlDeadline.test.js proves a fresh client signs in).
    expect(window.location.hash).toBe(RECOVERY_HASH);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadPage).toHaveBeenCalledTimes(1);
    form.stop();
  });

  it("shows the retry and never the form when the lookup fails with the AbortError the deadline raises", async () => {
    startClient({ userLookup: lookup.timesOut });
    const form = watchForText(/New password/);
    renderReset();

    await checkFinished();

    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.queryByRole("button", { name: "Update password" })).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/could not be checked/i);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(form.hits).toEqual([]);
    form.stop();
  });

  it("does not hand the form to whoever else is signed in on this device, and signs nobody out", async () => {
    startClient({ userLookup: lookup.timesOut, signedInElsewhere: true });
    const form = watchForText(/New password/);
    renderReset();

    await checkFinished();

    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/could not be checked/i);
    expect(form.hits).toEqual([]);
    const { data } = await holder.client.auth.getSession();
    expect(data.session?.user?.id).toBe("other-account");
    form.stop();
  });

  it("says a link the server REFUSED could not be verified and offers a new one, with no Try again (the same link would be refused again)", async () => {
    startClient({ userLookup: lookup.refuses });
    const form = watchForText(/New password/);
    renderReset();

    await checkFinished();

    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/could not be verified/i);
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(form.hits).toEqual([]);
    form.stop();
  });

  it("ORDER GUARD: with getSession() answering BEFORE initialize(), the form still never flashes for a link that failed", async () => {
    // useSession waits for both before it clears `loading`. The real client
    // cannot prove that: auth-js settles a second initialize() call before
    // getSession(), so a hook that cleared `loading` on getSession alone passes
    // every test above (measured by mutation). This double reverses the order.
    // Only the ordering is scripted; the error carries auth-js's real class name.
    window.history.replaceState(null, "", RECOVERY_PATH);
    const retryable = Object.assign(new Error(REQUEST_TIMEOUT_MESSAGE), {
      name: "AuthRetryableFetchError",
      status: 0,
    });
    holder.client = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        initialize: () =>
          new Promise((resolve) => setTimeout(() => resolve({ error: retryable }), 30)),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        dispose: async () => {},
      },
    };
    const form = watchForText(/New password/);
    renderReset();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/could not be checked/i);
    expect(form.hits).toEqual([]);
    form.stop();
  });

  it("CONTROL: a link that checks out gets the new-password form, and no failure copy ever flashes", async () => {
    startClient({ userLookup: lookup.answers });
    const failure = watchForText(/could not be (checked|verified)/i);
    renderReset();

    expect(await screen.findByLabelText("New password")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(failure.hits).toEqual([]);
    failure.stop();
  });
});
