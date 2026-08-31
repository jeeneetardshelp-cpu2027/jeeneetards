// The header's streak chip: visible wherever studying happens (the shared
// header renders on every page, the watch page included), honest at zero
// (hidden), restored from the server on sign-in, and gone after the
// shared-machine sign-out wipe.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { ThemeProvider } from "./theme.jsx";

const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
const sessionState = vi.hoisted(() => ({ current: null }));
const pull = vi.hoisted(() => ({ fn: vi.fn(() => Promise.resolve([])) }));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { auth },
}));
vi.mock("./useSession.js", () => ({
  useSession: () => ({ session: sessionState.current, loading: false }),
}));
// streak.js itself stays REAL (the chip must read the true store); only the
// network half is stubbed. queueStudyDaySync is exported because streak.js
// imports it.
vi.mock("./streakSync.js", () => ({
  pullServerStudyDays: (...args) => pull.fn(...args),
  queueStudyDaySync: () => Promise.resolve(),
}));

import { GlobalHeader } from "./AppShell.jsx";
import { dayKey } from "./streak.js";

const KEY = "ll_streak_v1";
const dayAgo = (n) => dayKey(new Date(Date.now() - n * 86400000));
const seed = (days) => localStorage.setItem(KEY, JSON.stringify({ days, goal: 2 }));

function renderHeader() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <GlobalHeader />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionState.current = null;
  auth.signOut.mockReset();
  auth.signOut.mockResolvedValue({ error: null });
  pull.fn.mockReset();
  pull.fn.mockResolvedValue([]);
});

describe("header streak chip", () => {
  it("stays hidden at zero — no guilt badge, no server pull while signed out", () => {
    renderHeader();
    expect(screen.queryByRole("link", { name: /study streak/i })).toBeNull();
    expect(pull.fn).not.toHaveBeenCalled();
  });

  it("shows the current consecutive-day count and links home", () => {
    seed([dayAgo(2), dayAgo(1), dayAgo(0)]);
    renderHeader();
    const chip = screen.getByRole("link", { name: "Study streak: 3 days" });
    expect(chip.getAttribute("href")).toBe("/");
    expect(chip.textContent).toContain("3");
  });

  it("restores the streak from the server after sign-in (the pull + union)", async () => {
    // Post-sign-out state: the local store is empty, the server remembers.
    sessionState.current = { user: { id: "puller-1" } };
    pull.fn.mockResolvedValue([dayAgo(1), dayAgo(0)]);

    renderHeader();
    expect(await screen.findByRole("link", { name: "Study streak: 2 days" })).toBeTruthy();
    expect(pull.fn).toHaveBeenCalledWith("puller-1");
    // The union landed in the real store, not just in React state.
    expect(JSON.parse(localStorage.getItem(KEY)).days).toEqual([dayAgo(1), dayAgo(0)].sort());
  });

  it("disappears after a successful sign-out wipes the shared-device store", async () => {
    sessionState.current = { user: { id: "signer-1" } };
    seed([dayAgo(1), dayAgo(0)]);

    renderHeader();
    expect(screen.getByRole("link", { name: "Study streak: 2 days" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(localStorage.getItem(KEY)).toBeNull());
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: /study streak/i })).toBeNull());
  });
});
