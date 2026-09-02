// The course watch page's one-tap share. What is guarded here:
//
//   1. The shared URL is the course's CANONICAL address plus ?ref=share —
//      /course/:id/:slug, never the chapter sub-URL, never the active lesson's
//      ?v= — so every share lands on the one indexable page the /api/og preview
//      renders for, AND reads as the course's title in the message itself
//      rather than only after the recipient's browser follows a 308.
//   2. The message is honest and specific, and drops whichever part (lecture
//      count, teacher) the page has not actually loaded.
//   3. The always-available share row and the ChapterCleared finish card never
//      stack two share affordances: when the cleared card is showing, the row
//      steps aside.
//
// Mock scaffolding mirrors CourseVideoPage.structuredData.test.jsx rather than
// inventing a new shape.
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { courseShareText, courseShareUrl } from "./CourseVideoPage.jsx";

const catalogue = vi.hoisted(() => ({
  course: {
    id: 1,
    title: "Complete Kinematics",
    teacher: "ABJ Sir",
    institute: "Mohit Tyagi",
    averageRating: null,
    ratingsCount: 0,
  },
  lessons: [
    {
      id: 101, videoId: "video-one", title: "Lesson one", position: 1,
      chapter: { id: 1, name: "Kinematics", slug: "kinematics" },
      durationSeconds: 600, embeddingStatus: "allowed", subject: "Physics",
    },
    {
      id: 102, videoId: "video-two", title: "Lesson two", position: 2,
      chapter: { id: 1, name: "Kinematics", slug: "kinematics" },
      durationSeconds: 500, embeddingStatus: "allowed", subject: "Physics",
    },
  ],
}));

// Mutable per-test progress, so one suite can see both the not-cleared and the
// cleared chapter without a second mock module.
const progressState = vi.hoisted(() => ({ completed: [] }));

vi.mock("./YouTubePlayer.jsx", () => ({
  default: ({ onPlay }) => <button onClick={onPlay}>Start playback</button>,
}));

vi.mock("./usePlaylistVideos.js", () => ({
  usePlaylistVideos: (playlistId) => ({
    loading: false,
    error: null,
    course: catalogue.course,
    lessons: catalogue.lessons,
    forPlaylistId: playlistId,
    reload: () => {},
  }),
  useLessonDescription: () => null,
}));

vi.mock("./progress.js", () => ({
  getWatchedVideoIds: () => [],
  getCompletedVideoIds: () => progressState.completed,
  getCourseProgress: () => null,
  recordLessonView: () => null,
  getLessonPosition: () => 0,
  getPlayerPrefs: () => ({ rate: null }),
  recordLessonPosition: () => null,
  savePlayerPrefs: () => {},
  mergeRemoteEntry: () => {},
  // ChapterCleared asks WHEN the finish happened; "unknown" is a fine answer.
  getLastWatchedAt: () => null,
  // Zero keeps the goal-met line out of these assertions.
  countLessonsStudiedToday: () => 0,
}));

vi.mock("./CourseRating.jsx", () => ({ default: () => null }));
vi.mock("./VideoReport.jsx", () => ({ default: () => null }));
// Siblings with their own data fetching, irrelevant to sharing. ChapterCleared
// stays REAL: the no-stacking rule below is about it.
vi.mock("./ChapterRevision.jsx", () => ({ default: () => null }));
vi.mock("./ChapterChampions.jsx", () => ({ default: () => null }));
vi.mock("./ChapterTeachers.jsx", () => ({ default: () => null }));
vi.mock("./StudyMaterialPanel.jsx", () => ({ default: () => null }));
vi.mock("./NotesPanel.jsx", () => ({ default: () => null }));

import CourseVideoPage from "./CourseVideoPage.jsx";
import { ThemeProvider } from "./theme.jsx";

function renderApp(initialEntry) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/course/:playlistId" element={<CourseVideoPage />} />
          <Route
            path="/course/:playlistId/chapter/:chapterId"
            element={<CourseVideoPage />}
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const whatsappLink = () =>
  screen.getByRole("link", { name: "Share this course on WhatsApp" });

beforeEach(() => {
  progressState.completed = [];
  localStorage.clear(); // ChapterCleared writes a revision record when it fires
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("courseShareUrl", () => {
  it("is the canonical SLUGGED course address plus ?ref=share", () => {
    expect(courseShareUrl(374, "Complete Kinematics", "https://www.jeeneetard.com"))
      .toBe("https://www.jeeneetard.com/course/374/complete-kinematics?ref=share");
  });

  // The whole point of putting the slug in the shared link: the friend reading
  // it in WhatsApp reads the title, not an id, before any redirect runs.
  it("carries the keywords in the link itself, not only after a redirect", () => {
    expect(courseShareUrl(374, "Complete Kinematics", "https://www.jeeneetard.com"))
      .toContain("complete-kinematics");
  });

  // A Devanagari title yields no ASCII slug, and canonicalUrl.js refuses to
  // guess a transliteration — the bare id IS that course's canonical address.
  it("stays the bare id for a title with no ASCII, never a percent-encoded one", () => {
    const url = courseShareUrl(212, "कबीर की साखी", "https://www.jeeneetard.com");
    expect(url).toBe("https://www.jeeneetard.com/course/212?ref=share");
    expect(url).not.toContain("%");
  });

  it("still returns a working address when the title has not loaded", () => {
    expect(courseShareUrl(374, null, "https://www.jeeneetard.com"))
      .toBe("https://www.jeeneetard.com/course/374?ref=share");
  });
});

describe("courseShareText", () => {
  it("carries the title, the count and the teacher", () => {
    expect(courseShareText({
      title: "Complete Kinematics", lectures: 14,
      teacher: "ABJ Sir", institute: "Mohit Tyagi",
    })).toBe("Watch Complete Kinematics free — 14 lectures by ABJ Sir — Mohit Tyagi on JEENEETARD");
  });

  it("drops the teacher rather than naming an unknown one", () => {
    const text = courseShareText({ title: "Fluids", lectures: 1, teacher: null, institute: null });
    expect(text).toBe("Watch Fluids free — 1 lecture on JEENEETARD");
    expect(text).not.toMatch(/by/);
  });

  it("drops the count rather than claiming zero lectures", () => {
    expect(courseShareText({ title: "Fluids", lectures: 0, teacher: "ABJ Sir", institute: null }))
      .toBe("Watch Fluids free — by ABJ Sir on JEENEETARD");
  });

  it("still says something honest when only the title is known", () => {
    expect(courseShareText({ title: "Fluids" })).toBe("Watch Fluids free on JEENEETARD");
  });
});

describe("the watch page share row", () => {
  it("shares the canonical course URL with ?ref=share and the honest message", async () => {
    renderApp("/course/1");
    await screen.findByRole("heading", { name: "Lesson one" });

    const href = whatsappLink().getAttribute("href");
    const message = decodeURIComponent(href.replace("https://wa.me/?text=", ""));
    expect(message).toBe(
      "Watch Complete Kinematics free — 2 lectures by ABJ Sir — Mohit Tyagi on JEENEETARD "
      + `${window.location.origin}/course/1/complete-kinematics?ref=share`,
    );
    // Never the active lesson: a shared link must land on the course page.
    expect(message).not.toContain("v=");
  });

  it("copies that same canonical URL, not the chapter sub-URL, from a chapter-scoped page", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    renderApp("/course/1/chapter/1");
    await screen.findByRole("heading", { name: "Lesson one" });
    fireEvent.click(screen.getByRole("button", { name: "Copy a link to this course" }));

    // The chapter sub-URL canonicalizes to the course root, and the course root
    // is the SLUGGED address — so that is what travels, not /course/1/chapter/1
    // and not the bare id the student's own URL bar happens to show.
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/course/1/complete-kinematics?ref=share`,
    );
  });

  it("steps aside while the ChapterCleared card is showing its own share button", async () => {
    progressState.completed = ["video-one", "video-two"];

    renderApp("/course/1");
    await screen.findByRole("heading", { name: "Lesson one" });

    // The finish-moment card is on screen with its own share…
    expect(await screen.findByText("Chapter cleared")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Share this/ })).toBeTruthy();
    // …so the always-available row does not stack a second one above it.
    expect(screen.queryByRole("link", { name: "Share this course on WhatsApp" })).toBeNull();
  });
});
