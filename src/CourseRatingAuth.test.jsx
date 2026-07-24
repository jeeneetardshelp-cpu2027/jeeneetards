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
  it("exposes no account or contribution controls in the browse-only release", () => {
    render(
      <ThemeProvider>
        <CourseRating playlistId={1} initialAverage={0} initialCount={0} />
      </ThemeProvider>,
    );
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in to rate" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Student ratings" })).toBeTruthy();
  });

  it("keeps the reviewed interactive flow available behind an explicit future gate", () => {
    render(
      <ThemeProvider>
        <CourseRating playlistId={1} initialAverage={0} initialCount={0} released />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in to rate" }));
    expect(screen.getByLabelText("Email")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Email")).toBeNull();
  });
});
