import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { reviewRows, calls } = vi.hoisted(() => ({
  reviewRows: { current: [] },
  calls: { current: [] },
}));

vi.mock("./useSession.js", () => ({
  useSession: () => ({ session: null, loading: false }),
}));

// This mock RECORDS its filter arguments instead of discarding them. The
// previous version returned `this` from eq()/not() without looking at the
// arguments, so the test named after the review_hidden filter could only prove
// that a row handed to the component renders -- deleting the filter from
// useVisibleReviews.js left the suite green while every admin-hidden review
// rendered publicly. Same tautology class this project already shipped once in
// VideoReport.test.jsx.
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from(table) {
      const rec = { table, eq: {}, not: null };
      calls.current.push(rec);
      const b = {
        select() { return b; },
        eq(k, v) { rec.eq[k] = v; return b; },
        not(k, op, v) { rec.not = [k, op, v]; return b; },
        order() { return b; },
        limit() { return Promise.resolve({ data: reviewRows.current, error: null }); },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      };
      return b;
    },
  },
}));

import CourseRating from "./CourseRating.jsx";
import { ThemeProvider } from "./theme.jsx";

const show = () => render(
  <ThemeProvider>
    <CourseRating playlistId={1} initialAverage={0} initialCount={0} />
  </ThemeProvider>,
);

describe("public review display", () => {
  it("renders nothing when there are no reviews to show", async () => {
    reviewRows.current = [];
    show();
    expect(screen.queryByText("What students are saying")).toBeNull();
  });

  it("shows a review's stars, tags, text and date -- with no reviewer name", async () => {
    reviewRows.current = [
      {
        id: 7, rating: 4, review: "Clear explanations, could use more practice problems.",
        difficulty: "moderate", best_for: "revision", created_at: "2026-07-01T00:00:00Z",
      },
    ];
    show();
    expect(await screen.findByText("What students are saying")).toBeTruthy();
    expect(screen.getByText(/Clear explanations/)).toBeTruthy();
    expect(screen.getByText("Moderate")).toBeTruthy();
    expect(screen.getByText("· Revision")).toBeTruthy();
    // No display name anywhere -- sign-up never collects one, so none should
    // ever be shown, invented or otherwise.
    expect(screen.queryByText(/anonymous/i)).toBeNull();
  });

  it("only ever queries for non-hidden reviews with real text", async () => {
    // Asserts on the QUERY, not just on what rendered. Admin-hidden reviews
    // must never reach the client in the first place: the server filter is the
    // real guard, because CourseRating renders whatever rows it is given with
    // no client-side backstop.
    reviewRows.current = [
      { id: 1, rating: 5, review: "Great course.", difficulty: null, best_for: null, created_at: "2026-07-01T00:00:00Z" },
    ];
    calls.current = [];
    show();
    await screen.findByText("Great course.");

    const ratingsQuery = calls.current.find((c) => c.table === "playlist_ratings");
    expect(ratingsQuery).toBeTruthy();
    expect(ratingsQuery.eq.review_hidden).toBe(false);
    expect(ratingsQuery.eq.playlist_id).toBe(1);
    expect(ratingsQuery.not).toEqual(["review", "is", null]);
  });
});
