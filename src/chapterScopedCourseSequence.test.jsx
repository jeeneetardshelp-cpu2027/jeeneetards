// A chapter-scoped watch page must not mistake its chapter for the whole course.
//
// THE DEFECT THIS PINS. /course/:id/chapter/:chapterId shows one chapter's slice
// in the lesson list, which is the point of the route. But VideoView derived
// prev/next, the end-of-lesson overlay and the lesson counter from that slice,
// so on a one-lesson chapter the first video ended with:
//
//   • "Course complete"
//   • "You watched 1 of 1 lesson in this course."
//   • no prev/next nav at all (it was gated on lessons.length > 1)
//
// Measured against production on 2026-08-10: 672 of 1,217 (course, chapter)
// pairs hold exactly one lesson — 55.2%, median 1. So a student one video into a
// 68-lesson course was congratulated and given nowhere to go, on the majority of
// watch pages, and this route is where continue-watching, browse cards and
// search results all land.
//
// The fix passes the full course sequence as `courseLessons` while `lessons`
// stays the visible slice. These tests fail against the pre-fix code.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Three lessons across THREE chapters, so the middle chapter is the 55% case:
// exactly one lesson, with course lessons on either side of it.
const watch = vi.hoisted(() => ({
  watched: [],
  course: { id: 1, title: "Complete Physics", lectures: 3 },
  lessons: [
    {
      id: 101, videoId: "video-one", title: "Lesson one", position: 1,
      chapter: { id: 1, name: "Kinematics", slug: "kinematics" },
      durationSeconds: 600, embeddingStatus: "allowed", subject: "Physics",
    },
    {
      id: 102, videoId: "video-two", title: "Lesson two", position: 2,
      chapter: { id: 2, name: "Laws of Motion", slug: "laws-of-motion" },
      durationSeconds: 900, embeddingStatus: "allowed", subject: "Physics",
    },
    {
      id: 103, videoId: "video-three", title: "Lesson three", position: 3,
      chapter: { id: 3, name: "Friction", slug: "friction" },
      durationSeconds: 1200, embeddingStatus: "allowed", subject: "Physics",
    },
  ],
}));

vi.mock("./YouTubePlayer.jsx", () => ({
  default: ({ videoId, onEnded }) => (
    <div>
      <button onClick={() => onEnded?.({ videoId })}>Finish video</button>
      <output aria-label="Playing">{videoId}</output>
    </div>
  ),
}));

vi.mock("./progress.js", () => ({
  getWatchedVideoIds: () => watch.watched,
  getCompletedVideoIds: () => watch.completed ?? [],
  getCourseProgress: () => null,
  recordLessonView: () => null,
  getContinueWatching: () => [],
  getRecentChapters: () => [],
  getLessonPosition: () => 0,
  getPlayerPrefs: () => ({ rate: null }),
  recordLessonPosition: () => null,
  savePlayerPrefs: () => null,
}));

vi.mock("./usePlaylistVideos.js", () => ({
  usePlaylistVideos: () => ({
    loading: false, error: null,
    course: watch.course, lessons: watch.lessons,
    forPlaylistId: "1", reload: () => {},
  }),
}));

vi.mock("./CourseRating.jsx", () => ({ default: () => null }));
vi.mock("./VideoReport.jsx", () => ({ default: () => null }));
vi.mock("./StudyMaterialPanel.jsx", () => ({ default: () => null }));

import CourseVideoPage from "./CourseVideoPage.jsx";
import { ThemeProvider } from "./theme.jsx";

function renderPage(entry) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
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

beforeEach(() => { watch.watched = []; });
afterEach(() => { vi.useRealTimers(); });

describe("a one-lesson chapter is not a one-lesson course", () => {
  const ONE_LESSON_CHAPTER = "/course/1/chapter/2?v=video-two";

  it("finishing it offers the next lesson instead of claiming the course is complete", () => {
    renderPage(ONE_LESSON_CHAPTER);
    fireEvent.click(screen.getByText("Finish video"));

    // The whole point: the course continues, so say so.
    expect(screen.getByText("Lesson complete")).toBeTruthy();
    expect(screen.getByText(/Up next: Lesson 3 · Lesson three/)).toBeTruthy();
    expect(screen.queryByText("Course complete")).toBeNull();
    expect(screen.queryByText(/1 of 1 lesson in this course/)).toBeNull();
  });

  it("still shows lesson navigation, with Next enabled", () => {
    renderPage(ONE_LESSON_CHAPTER);
    const nav = screen.getByLabelText("Lesson navigation");
    expect(nav).toBeTruthy();
    const next = screen.getByRole("button", { name: /Next lesson/ });
    const previous = screen.getByRole("button", { name: /Previous lesson/ });
    // Both neighbours live in OTHER chapters; before the fix neither existed.
    expect(next.disabled).toBe(false);
    expect(previous.disabled).toBe(false);
  });

  it("counts the lesson within its chapter AND within the course", () => {
    renderPage(ONE_LESSON_CHAPTER);
    expect(
      screen.getByText("Lesson 1 of 1 in this chapter · 2 of 3 in the course"),
    ).toBeTruthy();
  });

  it("Next lesson crosses into the next chapter instead of silently doing nothing", () => {
    renderPage(ONE_LESSON_CHAPTER);
    fireEvent.click(screen.getByRole("button", { name: /Next lesson/ }));

    // Writing only ?v= would be reverted by the out-of-scope guard in
    // CourseVideoPage, leaving the student on the same video. The scope has to
    // move with them.
    expect(screen.getByLabelText("Playing").textContent).toBe("video-three");
    expect(
      screen.getByText("Lesson 1 of 1 in this chapter · 3 of 3 in the course"),
    ).toBeTruthy();
  });

  it("auto-advance also crosses the chapter boundary", () => {
    vi.useFakeTimers();
    renderPage(ONE_LESSON_CHAPTER);
    fireEvent.click(screen.getByText("Finish video"));
    act(() => { vi.advanceTimersByTime(6000); });
    expect(screen.getByLabelText("Playing").textContent).toBe("video-three");
  });
});

describe("the real end of the course still reports completion", () => {
  it("claims completion only on the last lesson, and counts over the course", () => {
    watch.watched = ["video-one", "video-two", "video-three"];
    renderPage("/course/1/chapter/3?v=video-three");
    fireEvent.click(screen.getByText("Finish video"));

    expect(screen.getByText("Course complete")).toBeTruthy();
    // Counted over the course (3), never over the visible chapter slice (1).
    expect(screen.getByText(/You started 3 of 3 lessons in this course/)).toBeTruthy();
  });
});

describe("the unscoped course route is unchanged", () => {
  it("keeps the plain lesson counter and needs no chapter wording", () => {
    renderPage("/course/1?v=video-two");
    expect(screen.getByText("Lesson 2 of 3")).toBeTruthy();
    expect(screen.queryByText(/in this chapter/)).toBeNull();
  });
});
