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
  localStorage.clear();
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


  // The shared-device privacy fix. Without this wiring test, deleting the
  // clearProgress() call from AppShell left the entire suite green -- the
  // helper was only ever exercised in isolation in progress.test.js.
  it("clears this device's watch history after a successful sign-out", async () => {
    localStorage.setItem("ll_progress_v1", JSON.stringify({
      12: {
        playlistId: 12, chapterId: 7, courseTitle: "Optics",
        lastVideoId: "vidA", lastVideoTitle: "Lesson A",
        watched: ["vidA"],
        positions: { vidA: { t: 400, d: 1800, at: 1700000000000 } },
        updatedAt: 1700000000000,
      },
    }));

    render(
      <ThemeProvider>
        <MemoryRouter>
          <GlobalHeader />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(localStorage.getItem("ll_progress_v1")).toBeNull());
  });

  it("keeps this device's watch history when sign-out FAILS", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "network" } });
    localStorage.setItem("ll_progress_v1", JSON.stringify({
      12: {
        playlistId: 12, chapterId: 7, courseTitle: "Optics",
        lastVideoId: "vidA", lastVideoTitle: "Lesson A",
        watched: ["vidA"], updatedAt: 1700000000000,
      },
    }));

    render(
      <ThemeProvider>
        <MemoryRouter>
          <GlobalHeader />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
    // Still signed in, so the history must survive.
    expect(localStorage.getItem("ll_progress_v1")).not.toBeNull();
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
