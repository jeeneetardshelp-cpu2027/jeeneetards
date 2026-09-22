// StudentAuth.linkCheck.test.jsx — the sign-in form a student lands back on
// when auth-js could not check the sign-in carried in the URL.
//
// Google sign-in returns to the page the student started from (redirectTo is
// the current page) with #access_token=... in the URL, and auth-js checks it
// with GET /auth/v1/user. When that check fails nothing is saved, so /signin
// renders this form again — and used to render it with nothing to say that the
// sign-in the student had just finished did not take. auth-js leaves the link
// in the URL on failure, so a reload is a real retry
// (sessionFromUrlDeadline.test.js proves a fresh client then signs in).
//
// Real supabase-js client and real useSession; only the transport is scripted,
// and reload, which jsdom will not let a test observe.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { ThemeProvider } from "./theme.jsx";

const holder = vi.hoisted(() => {
  // Keep the app's own client from ever being built against the real project.
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

import StudentAuth from "./StudentAuth.jsx";
import { useSession } from "./useSession.js";
import { REQUEST_TIMEOUT_MESSAGE } from "./supabaseClient.js";

const BASE = "https://example.supabase.co";
const GOOGLE_RETURN =
  "/signin?next=%2Fcourses#access_token=AT-FROM-GOOGLE&expires_in=3600&provider_token=PT-GOOGLE&refresh_token=RT-FROM-GOOGLE&token_type=bearer";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const lookup = {
  // Exactly what the deadline in supabaseClient.js hands auth-js when it trips.
  timesOut: () =>
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new DOMException(REQUEST_TIMEOUT_MESSAGE, "AbortError")), 20);
    }),
  refuses: () =>
    Promise.resolve(new Response(
      JSON.stringify({ code: "bad_jwt", message: "invalid JWT: unable to parse or verify signature, token signature is invalid: signature is invalid" }),
      { status: 403, headers: { "content-type": "application/json", "x-supabase-api-version": "2024-01-01" } },
    )),
  answers: () => Promise.resolve(json({ id: "google-user", aud: "authenticated", email: "student@example.com" })),
};

let seq = 0;
let consoleError = null;

beforeEach(() => {
  localStorage.clear();
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

function startClient({ path, userLookup }) {
  window.history.replaceState(null, "", path);
  const requests = [];
  holder.client = createClient(BASE, "test-anon-key", {
    auth: { storageKey: `student-auth-link-test-${++seq}` },
    global: {
      fetch: (input, init) => {
        const url = typeof input === "string" ? input : input.url;
        const method = init?.method ?? "GET";
        requests.push(`${method} ${url.replace(BASE, "")}`);
        if (method === "GET" && url === `${BASE}/auth/v1/user`) return userLookup();
        return Promise.resolve(json([]));
      },
    },
  });
  return { requests };
}

// A second useSession on the page, so a test can wait for auth to have settled
// before asserting that the form shows NOTHING.
function SessionSettled() {
  const { loading } = useSession();
  return loading ? null : <span data-testid="session-settled" />;
}

function renderForm() {
  const reloadPage = vi.fn();
  render(
    <ThemeProvider>
      <SessionSettled />
      <StudentAuth enabled reloadPage={reloadPage} />
    </ThemeProvider>,
  );
  return reloadPage;
}

async function authSettled() {
  await screen.findByTestId("session-settled");
  await act(async () => {});
}

describe("StudentAuth after a sign-in in the URL could not be checked", () => {
  it("says the sign-in could not be finished, offers a Try again that reloads, and keeps the form usable", async () => {
    startClient({ path: GOOGLE_RETURN, userLookup: lookup.timesOut });
    const reloadPage = renderForm();

    await authSettled();

    expect(screen.getByRole("alert").textContent).toMatch(/could not be finished/i);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toContain("access_token=AT-FROM-GOOGLE");
    // Still a working form: the email route and Google again are both there.
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeTruthy();
  });

  it("says a sign-in the server REFUSED could not be verified, with no Try again", async () => {
    startClient({ path: GOOGLE_RETURN, userLookup: lookup.refuses });
    renderForm();

    await authSettled();

    expect(screen.getByRole("alert").textContent).toMatch(/could not be verified/i);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("CONTROL: with no sign-in in the URL it shows no notice, and nothing was looked up", async () => {
    const { requests } = startClient({ path: "/signin", userLookup: lookup.timesOut });
    renderForm();

    await authSettled();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(requests).not.toContain("GET /auth/v1/user");
  });

  it("CONTROL: a sign-in in the URL that checks out shows no notice", async () => {
    startClient({ path: GOOGLE_RETURN, userLookup: lookup.answers });
    renderForm();

    await authSettled();
    await waitFor(() => expect(window.location.hash).toBe(""));

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
