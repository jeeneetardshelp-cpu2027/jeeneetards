// Home.jsx pulls a signed-in student's server-side watch progress on the
// homepage, so "Continue watching" works cross-device — not only after the
// student manually re-opens a course page (which was the whole bug: the
// homepage, the first surface a returner sees, read localStorage once and so
// forgot a student who signed in on a new device).
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./usePlaylistBrowse.js", () => ({
  usePlaylistBrowse: () => ({ items: [], loading: false, error: null }),
}));
vi.mock("./useUniversalSearch.js", () => ({
  useUniversalSearch: () => ({
    groups: {}, loading: false, error: null, tooShort: false, retry: () => {},
  }),
  MIN_QUERY: 3,
}));
vi.mock("./useExplore.js", () => ({
  useLearningGoals: () => ({ goals: [], loading: false, error: null }),
}));

// The server round trip and the localStorage store are the two collaborators
// under test; both are mocked so the test asserts only Home's wiring between
// them: pull → merge → re-read → render.
const getContinueWatching = vi.fn();
const mergeRemoteEntry = vi.fn();
const pullServerProgress = vi.fn();
const useSession = vi.fn();

vi.mock("./progress.js", () => ({
  getContinueWatching: (...a) => getContinueWatching(...a),
  mergeRemoteEntry: (...a) => mergeRemoteEntry(...a),
  // PrepToday's streak piece reads today's lesson count from the same module;
  // zero keeps that piece hidden so it cannot disturb these assertions.
  countLessonsStudiedToday: () => 0,
}));
vi.mock("./progressSync.js", () => ({
  pullServerProgress: (...a) => pullServerProgress(...a),
}));
vi.mock("./useSession.js", () => ({ useSession: () => useSession() }));

import { ThemeProvider } from "./theme.jsx";
import Home from "./Home.jsx";

const SERVER_ROW = {
  playlistId: 374, chapterId: 27, courseTitle: "Rotational Motion",
  videoId: "abcdEFGH123", videoTitle: "Rotational Motion — L1",
  position: 512, duration: 3240, watched: false, updatedAt: 1_000_000,
};
const MERGED_ENTRY = {
  playlistId: 374, chapterId: 27, courseTitle: "Rotational Motion",
  lastVideoId: "abcdEFGH123", lastVideoTitle: "Rotational Motion — L1",
  updatedAt: 1_000_000,
};

function renderHome() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Home />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("Home cross-device continue-watching", () => {
  it("pulls, merges and shows server progress the local store did not have", async () => {
    // Local store empty at mount (fresh device); populated only after the merge.
    getContinueWatching
      .mockReturnValueOnce([])          // initial useState snapshot
      .mockReturnValue([MERGED_ENTRY]); // re-read after merge
    pullServerProgress.mockResolvedValue([SERVER_ROW]);
    useSession.mockReturnValue({ session: { user: { id: "student-1" } }, loading: false });

    renderHome();

    // The rail is absent before the async pull resolves...
    expect(screen.queryByText("Continue watching")).toBeNull();

    // ...and appears once the server rows are merged and the rail re-read.
    expect(await screen.findByText("Continue watching")).toBeTruthy();
    expect(pullServerProgress).toHaveBeenCalledWith("student-1");
    expect(mergeRemoteEntry).toHaveBeenCalledWith(SERVER_ROW);
    const link = screen.getByRole("link", { name: /Rotational Motion/ });
    expect(link.getAttribute("href")).toBe("/course/374/chapter/27?v=abcdEFGH123");
  });

  it("does not pull for a signed-out visitor", async () => {
    getContinueWatching.mockReturnValue([]);
    useSession.mockReturnValue({ session: null, loading: false });

    renderHome();
    await waitFor(() => expect(useSession).toHaveBeenCalled());
    expect(pullServerProgress).not.toHaveBeenCalled();
    expect(screen.queryByText("Continue watching")).toBeNull();
  });
});
