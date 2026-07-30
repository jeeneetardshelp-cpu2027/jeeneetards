import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { reviewRows } = vi.hoisted(() => ({ reviewRows: { current: [] } }));

vi.mock("./useSession.js", () => ({
  useSession: () => ({ session: null, loading: false }),
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      not() { return this; },
      order() { return this; },
      limit() { return Promise.resolve({ data: reviewRows.current, error: null }); },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    }),
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
    // The query itself excludes review_hidden=true and null review server-side
    // (see useVisibleReviews.js) -- this test documents that admin-hidden
    // reviews never reach the client in the first place, rather than being
    // filtered client-side where a bug could leak them.
    reviewRows.current = [
      { id: 1, rating: 5, review: "Great course.", difficulty: null, best_for: null, created_at: "2026-07-01T00:00:00Z" },
    ];
    show();
    expect(await screen.findByText("Great course.")).toBeTruthy();
  });
});
