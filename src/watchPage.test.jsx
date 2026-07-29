// Watch-page wiring: resume points, autoplay-after-selection, speed memory,
// and the end-of-lesson overlays (up-next countdown / course complete).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const watch = vi.hoisted(() => ({
  resume: {},
  rate: null,
  watched: [],
  recordLessonPosition: vi.fn(),
  savePlayerPrefs: vi.fn(),
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
    {
      id: 103, videoId: "video-three", title: "Lesson three", position: 3,
      chapter: { id: 1, name: "Kinematics", slug: "kinematics" },
      durationSeconds: 1200, embeddingStatus: "allowed", subject: "Physics",
    },
  ],
}));

// The player stub surfaces every new callback as a clickable button and every
// new pass-through prop as readable text, so tests drive the exact contract.
// Payloads carry the stub's own videoId, exactly like the real player — plus
// "stale" variants simulating an old player's report arriving after a switch.
vi.mock("./YouTubePlayer.jsx", () => ({
  default: ({
    videoId, onPlay, onPlaying, onEnded, onProgress, onPlaybackRateChange,
    startSeconds, autoplay, playbackRate, playSignal,
  }) => (
    <div>
      <button onClick={() => onPlay?.()}>Start playback</button>
      <button onClick={() => onPlaying?.({ videoId })}>Resume playback</button>
      <button onClick={() => onEnded?.({ videoId })}>Finish video</button>
      <button onClick={() => onEnded?.({ videoId: "video-stale" })}>
        Finish stale video
      </button>
      <button onClick={() => onProgress?.({ videoId, seconds: 120, duration: 640 })}>
        Report progress
      </button>
      <button onClick={() => onProgress?.({ videoId: "video-stale", seconds: 500, duration: 900 })}>
        Report stale progress
      </button>
      <button onClick={() => onPlaybackRateChange?.(1.5)}>
        Report speed change
      </button>
      <output aria-label="Player start">{String(startSeconds ?? 0)}</output>
      <output aria-label="Player autoplay">{String(Boolean(autoplay))}</output>
      <output aria-label="Player rate">{String(playbackRate)}</output>
      <output aria-label="Player play signal">{String(playSignal ?? 0)}</output>
    </div>
  ),
}));

vi.mock("./progress.js", () => ({
  getWatchedVideoIds: () => watch.watched,
  getCourseProgress: () => null,
  recordLessonView: () => null,
  getContinueWatching: () => [],
  getRecentChapters: () => [],
  getLessonPosition: (playlistId, videoId) => watch.resume[videoId] ?? 0,
  getPlayerPrefs: () => ({ rate: watch.rate }),
  recordLessonPosition: watch.recordLessonPosition,
  savePlayerPrefs: watch.savePlayerPrefs,
}));

vi.mock("./usePlaylistVideos.js", () => ({
  usePlaylistVideos: () => ({
    loading: false,
    error: null,
    course: watch.course,
    lessons: watch.lessons,
    forPlaylistId: "1",
    reload: () => {},
  }),
}));

vi.mock("./CourseRating.jsx", () => ({ default: () => null }));
vi.mock("./VideoReport.jsx", () => ({ default: () => null }));

import CourseVideoPage from "./CourseVideoPage.jsx";
import { ThemeProvider } from "./theme.jsx";

function renderPage(initialEntry = "/course/1") {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/course/:playlistId" element={<CourseVideoPage />} />
          <Route
            path="/course/:playlistId/chapter/:chapterId"
            element={<CourseVideoPage />}
          />
          <Route path="/browse" element={<p>Browse destination</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  watch.resume = {};
  watch.rate = null;
  watch.watched = [];
  watch.recordLessonPosition.mockClear();
  watch.savePlayerPrefs.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resume, autoplay and speed memory", () => {
  it("passes the saved resume point to the player and keeps deep links autoplay-off", () => {
    watch.resume = { "video-one": 42 };
    renderPage("/course/1?v=video-one");

    expect(screen.getByLabelText("Player start").textContent).toBe("42");
    expect(screen.getByLabelText("Player autoplay").textContent).toBe("false");
  });

  it("turns autoplay on only after an in-page lesson selection", async () => {
    renderPage();
    expect(screen.getByLabelText("Player autoplay").textContent).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: /2\s*Lesson two/i }));

    await screen.findByRole("heading", { name: "Lesson two" });
    expect(screen.getByLabelText("Player autoplay").textContent).toBe("true");
  });

  it("records every progress report against the active lesson", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Report progress" }));

    expect(watch.recordLessonPosition).toHaveBeenCalledWith({
      playlistId: "1", videoId: "video-one", seconds: 120, duration: 640,
    });
  });

  it("stores a finished lesson at its catalogue duration so it restarts next time", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));

    expect(watch.recordLessonPosition).toHaveBeenCalledWith({
      playlistId: "1", videoId: "video-one", seconds: 600, duration: 600,
    });
  });

  it("prefers the player-reported duration when recording a finished lesson", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Report progress" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));

    expect(watch.recordLessonPosition).toHaveBeenLastCalledWith({
      playlistId: "1", videoId: "video-one", seconds: 640, duration: 640,
    });
  });

  it("passes the saved playback rate and persists changes", () => {
    watch.rate = 2;
    renderPage();
    expect(screen.getByLabelText("Player rate").textContent).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: "Report speed change" }));

    expect(watch.savePlayerPrefs).toHaveBeenCalledWith({ rate: 1.5 });
    expect(screen.getByLabelText("Player rate").textContent).toBe("1.5");
  });
});

describe("up-next overlay", () => {
  it("appears on ended and advances when the countdown expires", () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));

    expect(screen.getByText("Lesson complete")).toBeTruthy();
    expect(screen.getByText("Up next: Lesson 2 · Lesson two")).toBeTruthy();
    expect(screen.getByText("Playing in 5s")).toBeTruthy();

    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText("Playing in 3s")).toBeTruthy();

    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByRole("heading", { name: "Lesson two" })).toBeTruthy();
    expect(screen.queryByText("Lesson complete")).toBeNull();
    // Auto-advance is an in-page navigation, so the next lesson may autoplay.
    expect(screen.getByLabelText("Player autoplay").textContent).toBe("true");
  });

  it("advances immediately on Play now", () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));
    fireEvent.click(screen.getByRole("button", { name: "Play now" }));

    expect(screen.getByRole("heading", { name: "Lesson two" })).toBeTruthy();
    expect(screen.queryByText("Lesson complete")).toBeNull();
  });

  it("stays on the finished lesson after Cancel, with no timer left running", () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Lesson complete")).toBeNull();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole("heading", { name: "Lesson one" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Lesson two" })).toBeNull();
  });

  it("clears the overlay and its countdown when the lesson changes mid-count", () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));
    expect(screen.getByText("Lesson complete")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /3\s*Lesson three/i }));
    expect(screen.queryByText("Lesson complete")).toBeNull();

    // A leaked countdown would advance to the stale "next" lesson (two).
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole("heading", { name: "Lesson three" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Lesson two" })).toBeNull();
  });

  it("shows the course-complete overlay on the last lesson", () => {
    vi.useFakeTimers();
    watch.watched = ["video-one", "video-two", "video-three"];
    renderPage("/course/1?v=video-three");
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));

    expect(screen.getByText("Course complete")).toBeTruthy();
    expect(screen.getByText("You watched 3 of 3 lessons in this course.")).toBeTruthy();
    // The page's back affordance plus the overlay's copy of it.
    expect(screen.getAllByRole("button", { name: "Back to results" })).toHaveLength(2);
    expect(screen.queryByText("Play now")).toBeNull();

    // There is no next lesson, so nothing may count down or navigate.
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole("heading", { name: "Lesson three" })).toBeTruthy();
    expect(screen.getByText("Course complete")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Course complete")).toBeNull();
  });
});

describe("stale player reports (lesson-switch race)", () => {
  it("drops a progress report whose videoId is not in this course", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Report stale progress" }));

    expect(watch.recordLessonPosition).not.toHaveBeenCalled();
  });

  it("ignores a stale ENDED: no finished write, no overlay", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Finish stale video" }));

    expect(watch.recordLessonPosition).not.toHaveBeenCalled();
    expect(screen.queryByText("Lesson complete")).toBeNull();
  });
});

describe("overlay accessibility and replay", () => {
  it("moves focus to Cancel when the countdown appears, and back to the player on Cancel", () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(document.getElementById("course-player"));
  });

  it("dismisses the overlay when the student replays the ended lesson", () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));
    expect(screen.getByText("Lesson complete")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Resume playback" }));
    expect(screen.queryByText("Lesson complete")).toBeNull();

    // The abandoned countdown must not navigate away from the replay.
    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByRole("heading", { name: "Lesson one" })).toBeTruthy();
  });

  it("announces the up-next state once through a status line that never ticks", () => {
    vi.useFakeTimers();
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));

    const status = screen.getByText(/Plays automatically in 5 seconds/);
    expect(status.getAttribute("role")).toBe("status");
    const announced = status.textContent;
    expect(announced).toContain("Up next: lesson 2");
    act(() => { vi.advanceTimersByTime(2000); });
    // The visible countdown ticks; the announcement must not.
    expect(screen.getByText("Playing in 3s")).toBeTruthy();
    expect(status.textContent).toBe(announced);
  });
});

describe("selecting the already-active lesson", () => {
  it("bumps playSignal so the loaded player starts, instead of a no-op URL write", () => {
    renderPage();
    expect(screen.getByLabelText("Player play signal").textContent).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: /1\s*Lesson one/i }));

    expect(screen.getByLabelText("Player play signal").textContent).toBe("1");
    expect(screen.getByRole("heading", { name: "Lesson one" })).toBeTruthy();
  });
});

describe("document structure", () => {
  it("keeps the course title as the page's first and only h1", () => {
    renderPage();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("Complete Kinematics");
    // The visible overview title demoted to h2 alongside the lesson headings.
    expect(
      screen.getAllByRole("heading", { level: 2 }).some(
        (h) => h.id === "course-title",
      ),
    ).toBe(true);
  });
});
