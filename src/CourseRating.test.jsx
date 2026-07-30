import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./useSession.js", () => ({
  useSession: () => ({ session: null, loading: true }),
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      not() { return this; },
      order() { return this; },
      limit() { return Promise.resolve({ data: [], error: null }); },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    }),
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
  it("does not show 5.0 from one rating", () => {
    show(5, 1);
    expect(screen.getByText("1 student rating")).toBeTruthy();
    expect(screen.queryByText(/5\.0/)).toBeNull();
  });

  it("shows the score after five ratings", () => {
    show(4.6, 5);
    expect(screen.getByText(/4\.6 · 5 ratings/)).toBeTruthy();
  });
});
