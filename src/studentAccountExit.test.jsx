import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { ThemeProvider } from "./theme.jsx";

const auth = vi.hoisted(() => ({
  signOut: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { auth },
}));

vi.mock("./useSession.js", () => ({
  useSession: () => ({
    session: { user: { id: "student-1", email: "student@example.com" } },
    loading: false,
  }),
}));

import { GlobalHeader } from "./AppShell.jsx";
import StudentAuth from "./StudentAuth.jsx";

beforeEach(() => {
  auth.signOut.mockReset();
  auth.signOut.mockResolvedValue({ error: null });
});

describe("student account safety", () => {
  it("gives a signed-in student a visible sign-out action in the shared header", async () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <GlobalHeader />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
  });

  it("links the sign-in form to the password-reset route", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <StudentAuth enabled />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(
      screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href"),
    ).toBe("/reset");
  });
});
