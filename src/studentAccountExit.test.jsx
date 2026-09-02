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

  // Same shared-device reasoning as the watch history above, and the same
  // failure mode: without this, deleting clearRevision() from AppShell leaves
  // the suite green while a school-lab machine hands the next student the
  // names of every chapter the last one finished.
  it("clears this device's revision queue after a successful sign-out", async () => {
    localStorage.setItem("ll_revision_v1", JSON.stringify({ pausedOn: null, items: [{ courseId: 374, chapterId: 27, chapterName: "Rotational Motion", clearedAt: 1700000000000 }] }));

    render(
      <ThemeProvider>
        <MemoryRouter>
          <GlobalHeader />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(localStorage.getItem("ll_revision_v1")).toBeNull());
  });

  it("keeps this device's revision queue when sign-out FAILS", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "network" } });
    localStorage.setItem("ll_revision_v1", JSON.stringify({ pausedOn: null, items: [{ courseId: 374, chapterId: 27, chapterName: "Rotational Motion", clearedAt: 1700000000000 }] }));

    render(
      <ThemeProvider>
        <MemoryRouter>
          <GlobalHeader />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
    expect(localStorage.getItem("ll_revision_v1")).not.toBeNull();
  });

  // The same shared-device reasoning a third time, and the most literal case
  // of it: this key holds up to eight things the student TYPED. Deleting
  // clearRecentSearches() from AppShell must not leave the suite green, which
  // is exactly what happened to clearProgress() before the test above existed.
  it("clears this device's recent searches after a successful sign-out", async () => {
    localStorage.setItem(
      "ll_search_history_v1",
      JSON.stringify([{ q: "hindi class 10 notes", at: 1700000000000 }]),
    );

    render(
      <ThemeProvider>
        <MemoryRouter>
          <GlobalHeader />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(localStorage.getItem("ll_search_history_v1")).toBeNull());
  });

  it("keeps this device's recent searches when sign-out FAILS", async () => {
    auth.signOut.mockResolvedValue({ error: { message: "network" } });
    localStorage.setItem(
      "ll_search_history_v1",
      JSON.stringify([{ q: "hindi class 10 notes", at: 1700000000000 }]),
    );

    render(
      <ThemeProvider>
        <MemoryRouter>
          <GlobalHeader />
        </MemoryRouter>
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
    // Still signed in. Wiping a student's own searches out from under a failed
    // sign-out would be the same bug pointed the other way.
    expect(localStorage.getItem("ll_search_history_v1")).not.toBeNull();
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
