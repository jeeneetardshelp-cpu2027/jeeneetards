// "Continue with Google" on the shared StudentAuth form. Gated behind
// RELEASE_FEATURES.googleAuth so it stays hidden until the owner finishes the
// Supabase/Google provider setup (docs/auth/google_oauth_setup.md) — showing it
// before then would just error.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const flags = vi.hoisted(() => ({ studentAccounts: true, googleAuth: true }));
const oauth = vi.hoisted(() => ({ calls: [], error: null }));

vi.mock("./releaseCapabilities.js", () => ({
  RELEASE_FEATURES: flags,
  RELEASE_CAPABILITIES: {},
  hasReleaseCapability: () => false,
}));
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: (args) => { oauth.calls.push(args); return Promise.resolve({ error: oauth.error }); },
    },
  },
}));

import StudentAuth from "./StudentAuth.jsx";
import { ThemeProvider } from "./theme.jsx";

const renderAuth = () => render(<ThemeProvider><StudentAuth enabled /></ThemeProvider>);

beforeEach(() => { flags.googleAuth = true; oauth.calls = []; oauth.error = null; });
afterEach(() => cleanup());

describe("Continue with Google", () => {
  it("starts the Google OAuth flow, returning to the current page", () => {
    renderAuth();
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(oauth.calls).toHaveLength(1);
    expect(oauth.calls[0].provider).toBe("google");
    expect(typeof oauth.calls[0].options.redirectTo).toBe("string");
    expect(oauth.calls[0].options.redirectTo.startsWith("http")).toBe(true);
  });

  it("is hidden when the googleAuth flag is off, leaving email intact", () => {
    flags.googleAuth = false;
    renderAuth();
    expect(screen.queryByRole("button", { name: /continue with google/i })).toBeNull();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("shows a friendly message if the flow can't even start", async () => {
    oauth.error = { message: "provider is not enabled" };
    renderAuth();
    fireEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(await screen.findByText(/isn't available right now/i)).toBeTruthy();
    // Never leaks the raw provider error to a student.
    expect(screen.queryByText(/provider is not enabled/i)).toBeNull();
  });
});
