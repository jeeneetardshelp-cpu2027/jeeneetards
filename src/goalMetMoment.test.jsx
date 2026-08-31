// The goal-met moment on the watch page: one gentle line when a finished
// lesson crosses the student's own daily goal — once per calendar day,
// dismissible, and never louder than the rating ask sharing its slot.
// Scaffolding mirrors watchPage.test.jsx (player stub, mocked catalogue).
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  today: 0,
  course: { id: 1, title: "Complete Kinematics" },
  lessons: [
    {
      id: 101, videoId: "video-one", title: "Lesson one", position: 1,
      chapter: { id: 1, name: "Kinematics", slug: "kinematics" },
      durationSeconds: 600, embeddingStatus: "allowed", subject: "Physics",
    },
    {
      id: 102, videoId: "video-two", title: "Lesson two", position: 2,
      chapter: { id: 1, name: "Kinematics", slug: "kinematics" },
      durationSeconds: 900, embeddingStatus: "allowed", subject: "Physics",
    },
  ],
}));

vi.mock("./YouTubePlayer.jsx", () => ({
  default: ({ videoId, onEnded }) => (
    <button onClick={() => onEnded?.({ videoId })}>Finish video</button>
  ),
}));

vi.mock("./progress.js", () => ({
  getWatchedVideoIds: () => [],
  getCompletedVideoIds: () => [],
  getCourseProgress: () => null,
  recordLessonView: () => null,
  getContinueWatching: () => [],
  getRecentChapters: () => [],
  getLessonPosition: () => 0,
  getPlayerPrefs: () => ({ rate: null }),
  recordLessonPosition: () => null,
  savePlayerPrefs: () => {},
  // The number the goal comparison reads; each test sets it.
  countLessonsStudiedToday: () => state.today,
}));

vi.mock("./usePlaylistVideos.js", () => ({
  usePlaylistVideos: () => ({
    loading: false,
    error: null,
    course: state.course,
    lessons: state.lessons,
    forPlaylistId: "1",
    reload: () => {},
  }),
  useLessonDescription: () => null,
}));

vi.mock("./CourseRating.jsx", () => ({ default: () => null }));
vi.mock("./VideoReport.jsx", () => ({ default: () => null }));

// streak.js stays REAL: the once-per-day memory (ll_goal_met_v1) and the
// day arithmetic are exactly what this suite exercises.
import CourseVideoPage, { goalMetMessage } from "./CourseVideoPage.jsx";
import { dayKey } from "./streak.js";
import { ThemeProvider } from "./theme.jsx";

const STREAK_KEY = "ll_streak_v1";
const dayAgo = (n) => dayKey(new Date(Date.now() - n * 86400000));
const seedStreak = (days, goal = 2) =>
  localStorage.setItem(STREAK_KEY, JSON.stringify({ days, goal }));

function renderPage() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/course/1?v=video-one"]}>
        <Routes>
          <Route path="/course/:playlistId" element={<CourseVideoPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  state.today = 0;
});

describe("goalMetMessage", () => {
  it("keeps an ongoing streak and welcomes a new one, plainly", () => {
    expect(goalMetMessage({ today: 2, goal: 2, current: 5 }))
      .toBe("2 of 2 done — day 5 kept.");
    expect(goalMetMessage({ today: 3, goal: 2, current: 1 }))
      .toBe("3 of 2 done — day 1 of a new streak.");
  });
});

describe("the goal-met moment", () => {
  // NOTE: queried by text, not by role="status" — the watch page already
  // carries other status live regions (ShareControl's copy confirmation,
  // the up-next overlay's announcement), so role alone is ambiguous here.
  it("appears when a finished lesson crosses the daily goal", () => {
    seedStreak([dayAgo(2), dayAgo(1), dayAgo(0)]);
    state.today = 2;
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));
    expect(screen.getByText("2 of 2 done — day 3 kept.")).toBeTruthy();
  });

  it("stays away while the goal is not yet met", () => {
    seedStreak([dayAgo(0)]);
    state.today = 1; // goal defaults to 2
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));
    expect(screen.queryByText(/done — day/)).toBeNull();
    // And the once-per-day memory was NOT burned by the non-showing.
    expect(localStorage.getItem("ll_goal_met_v1")).toBeNull();
  });

  it("is dismissible, without red or guilt", () => {
    seedStreak([dayAgo(0)]);
    state.today = 2;
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));
    expect(screen.getByText("2 of 2 done — day 1 of a new streak.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss streak message" }));
    expect(screen.queryByText(/done — day/)).toBeNull();
  });

  it("shows at most once per calendar day, across visits", () => {
    seedStreak([dayAgo(1), dayAgo(0)]);
    state.today = 2;

    const first = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));
    expect(screen.getByText("2 of 2 done — day 2 kept.")).toBeTruthy();
    expect(localStorage.getItem("ll_goal_met_v1")).toBe(dayKey(new Date()));
    first.unmount();

    // A fresh visit the same day: further finishes stay quiet.
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));
    expect(screen.queryByText(/done — day/)).toBeNull();
  });

  it("shares the slot with the rating ask as one quiet line, not a second card", async () => {
    seedStreak([dayAgo(0)]);
    state.today = 2;
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));
    // The ask keeps its card…
    expect(await screen.findByText("Was this course helpful?")).toBeTruthy();
    // …and the goal moment is a single line beneath it.
    expect(screen.getByText(/2 of 2 done/)).toBeTruthy();
  });
});
