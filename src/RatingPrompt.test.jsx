// RatingPrompt — the one-tap "was this helpful?" ask shown when a lesson ends.
// These pin the behaviour that makes it worth adding without being a nag: a
// signed-in student rates in one tap (the exact upsert the full panel uses), a
// student who already rated never sees it, and a signed-out student is pointed
// at sign-in with a return path rather than shown stars that can't save.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const state = vi.hoisted(() => ({
  session: { session: null, loading: false },
  existing: null,
  upsertError: null,
  upsertCalls: [],
}));

vi.mock("./useSession.js", () => ({ useSession: () => state.session }));
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      maybeSingle() { return Promise.resolve({ data: state.existing, error: null }); },
      upsert(row, opts) { state.upsertCalls.push({ row, opts }); return Promise.resolve({ error: state.upsertError }); },
    }),
  },
}));

import RatingPrompt from "./RatingPrompt.jsx";
import { ThemeProvider } from "./theme.jsx";

const renderAt = (entry, props = {}) => render(
  <MemoryRouter initialEntries={[entry]}>
    <ThemeProvider>
      <RatingPrompt playlistId={5} {...props} />
    </ThemeProvider>
  </MemoryRouter>,
);

beforeEach(() => {
  state.session = { session: null, loading: false };
  state.existing = null;
  state.upsertError = null;
  state.upsertCalls = [];
});
afterEach(() => cleanup());

describe("signed out", () => {
  it("points to sign-in with a return path, and shows no rating stars", async () => {
    const onDismiss = vi.fn();
    renderAt("/course/5?v=abc", { onDismiss });
    const link = await screen.findByRole("link", { name: /sign in to rate/i });
    expect(link.getAttribute("href")).toBe("/signin?next=%2Fcourse%2F5%3Fv%3Dabc");
    expect(screen.queryByRole("button", { name: /rate \d star/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe("signed in", () => {
  beforeEach(() => { state.session = { session: { user: { id: "u1" } }, loading: false }; });

  it("saves an overall rating in one tap, with the minimal upsert", async () => {
    renderAt("/course/5", {});
    const four = await screen.findByRole("button", { name: /rate 4 stars/i });
    fireEvent.click(four);
    expect(await screen.findByText(/thanks/i)).toBeTruthy();
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.upsertCalls[0].row).toMatchObject({ playlist_id: 5, user_id: "u1", rating: 4 });
    expect(state.upsertCalls[0].opts).toEqual({ onConflict: "playlist_id,user_id" });
  });

  it("shows a friendly error and no thanks when the save fails", async () => {
    state.upsertError = { message: "permission denied" };
    renderAt("/course/5", {});
    fireEvent.click(await screen.findByRole("button", { name: /rate 3 stars/i }));
    expect(await screen.findByText(/sign in again/i)).toBeTruthy();
    expect(screen.queryByText(/thanks/i)).toBeNull();
  });

  it("self-hides for a student who has already rated", async () => {
    state.existing = { rating: 5 };
    const { container } = renderAt("/course/5", {});
    // Give the existing-rating check a tick to resolve, then assert nothing rendered.
    await waitFor(() => expect(state.upsertCalls).toHaveLength(0));
    expect(container.querySelector("section")).toBeNull();
    expect(screen.queryByRole("button", { name: /rate \d star/i })).toBeNull();
  });
});
