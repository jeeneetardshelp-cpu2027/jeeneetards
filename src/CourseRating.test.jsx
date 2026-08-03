import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queriedTables } = vi.hoisted(() => ({ queriedTables: [] }));

vi.mock("./useSession.js", () => ({
  useSession: () => ({ session: null, loading: true }),
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table) => {
      queriedTables.push(table);
      return {
        select() { return this; },
        eq() { return this; },
        not() { return this; },
        order() { return this; },
        limit() { return Promise.resolve({ data: [], error: null }); },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      };
    },
  },
}));

import CourseRating from "./CourseRating.jsx";
import { ThemeProvider } from "./theme.jsx";

const show = (average, count) => render(
  <ThemeProvider>
    <CourseRating playlistId={1} initialAverage={average} initialCount={count} />
  </ThemeProvider>
);

describe("course-page rating confidence", () => {
  beforeEach(() => {
    queriedTables.length = 0;
  });

  it("does not show 5.0 from one rating", () => {
    show(5, 1);
    expect(screen.getByText("1 student rating")).toBeTruthy();
    expect(screen.queryByText(/5\.0/)).toBeNull();
  });

  it("shows the score after five ratings", () => {
    show(4.6, 5);
    expect(screen.getByText(/4\.6 · 5 ratings/)).toBeTruthy();
  });

  it("uses course-query totals on mount and on course navigation without refetching them", async () => {
    const view = show(4.6, 5);
    await waitFor(() => expect(queriedTables).toContain("playlist_ratings"));
    expect(queriedTables).not.toContain("playlists");

    view.rerender(
      <ThemeProvider>
        <CourseRating playlistId={2} initialAverage={4.8} initialCount={10} />
      </ThemeProvider>,
    );

    expect(await screen.findByText(/4\.8.*10 ratings/)).toBeTruthy();
    expect(queriedTables).not.toContain("playlists");
  });
});
