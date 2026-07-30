import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./useSession.js", () => ({
  useSession: () => ({ session: null, loading: false }),
}));
vi.mock("./supabaseClient", () => ({
  supabase: {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    }),
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

import CourseRating from "./CourseRating.jsx";
import { ThemeProvider } from "./theme.jsx";

describe("course rating sign-in disclosure", () => {
  it("offers a real sign-in entry point now that rating submission is released", () => {
    render(
      <ThemeProvider>
        <CourseRating playlistId={1} initialAverage={0} initialCount={0} />
      </ThemeProvider>,
    );
    expect(screen.queryByLabelText("Email")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in to rate" }));
    expect(screen.getByLabelText("Email")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("still supports the pre-launch summary-only view via an explicit override", () => {
    render(
      <ThemeProvider>
        <CourseRating playlistId={1} initialAverage={0} initialCount={0} released={false} />
      </ThemeProvider>,
    );
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in to rate" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Student ratings" })).toBeTruthy();
  });
});
