// CourseVideoPage's structured-data wiring: not a re-test of the builders in
// structuredData.js (see structuredData.test.js) or the DOM upsert/cleanup
// mechanics in PageMetadata.jsx (see PageMetadata.structuredData.test.jsx) —
// just proof that CourseVideoPage calls them with the real, currently-visible
// course/lesson, and that an in-app navigation to a DIFFERENT course replaces
// rather than duplicates the markup (rule 4: no stale schema across routes).
//
// Mock scaffolding mirrors watchPage.test.jsx's usePlaylistVideos.js /
// YouTubePlayer.jsx / progress.js stubs rather than inventing a new shape.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

const catalogue = vi.hoisted(() => ({
  // Two distinct courses, keyed by the playlistId route param, so a test can
  // switch between them within ONE mounted app (the scenario stale schema
  // would show up in) rather than a fresh render per course.
  1: {
    course: {
      id: 1,
      title: "Complete Kinematics",
      teacher: "ABJ Sir",
      institute: "Mohit Tyagi",
      averageRating: null,
      ratingsCount: 0, // real site state today — must produce NO aggregateRating
    },
    lessons: [
      {
        id: 101, videoId: "video-one", title: "Lesson one", position: 1,
        chapter: { id: 1, name: "Kinematics", slug: "kinematics" },
        durationSeconds: 600, embeddingStatus: "allowed", subject: "Physics",
        description: null,
      },
    ],
  },
  2: {
    course: {
      id: 2,
      title: "Newton's Laws of Motion",
      teacher: "XYZ Sir",
      institute: "Competition Wallah",
      averageRating: 4.5,
      ratingsCount: 10, // a course WITH real ratings — the other branch
    },
    lessons: [
      {
        id: 201, videoId: "video-two", title: "Introducing force", position: 1,
        chapter: { id: 5, name: "Laws of Motion", slug: "laws-of-motion" },
        durationSeconds: 500, embeddingStatus: "allowed", subject: "Physics",
        description: "What a force is and how it changes motion.",
      },
    ],
  },
}));

vi.mock("./YouTubePlayer.jsx", () => ({
  default: ({ onPlay }) => <button onClick={onPlay}>Start playback</button>,
}));

vi.mock("./usePlaylistVideos.js", () => ({
  usePlaylistVideos: (playlistId) => {
    const entry = catalogue[playlistId];
    return {
      loading: false,
      error: null,
      course: entry?.course ?? null,
      lessons: entry?.lessons ?? [],
      forPlaylistId: playlistId,
      reload: () => {},
    };
  },
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
}));

vi.mock("./CourseRating.jsx", () => ({ default: () => null }));
vi.mock("./VideoReport.jsx", () => ({ default: () => null }));

import CourseVideoPage from "./CourseVideoPage.jsx";
import { ThemeProvider } from "./theme.jsx";

function schemaFor(key) {
  const el = document.head.querySelector(`script[type="application/ld+json"][data-schema-key="${key}"]`);
  return el ? JSON.parse(el.textContent) : null;
}
function schemaKeys() {
  return Array.from(
    document.head.querySelectorAll('script[type="application/ld+json"][data-schema-key]'),
  ).map((el) => el.getAttribute("data-schema-key")).sort();
}

// A same-app link between two courses — the scenario where React Router
// re-renders CourseVideoPage in place rather than unmounting it, which is
// exactly when a naive implementation would leave the old course's schema
// behind.
function SwitchCourseLink() {
  return <Link to="/course/2">Go to course 2</Link>;
}

function renderApp(initialEntry = "/course/1") {
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
        <SwitchCourseLink />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("CourseVideoPage structured data wiring", () => {
  it("writes Course, VideoObject and BreadcrumbList for the currently visible lesson, with no aggregateRating while ratingsCount is 0", async () => {
    renderApp("/course/1");
    await screen.findByRole("heading", { name: "Lesson one" });

    expect(schemaKeys()).toEqual(["BreadcrumbList", "Course", "VideoObject"]);

    const course = schemaFor("Course");
    expect(course.name).toBe("Complete Kinematics");
    // Honest provider/instructor split (rule 1): the teaching institute is
    // the provider, the teacher is the instructor — never this site.
    expect(course.provider).toEqual({ "@type": "Organization", name: "Mohit Tyagi" });
    expect(course.hasCourseInstance.instructor).toEqual({ "@type": "Person", name: "ABJ Sir" });
    expect(course.url).toBe("https://www.jeeneetard.com/course/1");
    // Real site state today: ratings_count is 0 everywhere, so this must be absent.
    expect(course.aggregateRating).toBeUndefined();

    const video = schemaFor("VideoObject");
    expect(video.name).toBe("Lesson one");
    expect(video.embedUrl).toContain("video-one");
    expect(video.uploadDate).toBeUndefined(); // never fabricated — see rule 1

    const crumbs = schemaFor("BreadcrumbList");
    expect(crumbs.itemListElement).toHaveLength(3);
    expect(crumbs.itemListElement[0]).toMatchObject({ name: "Browse courses", item: "https://www.jeeneetard.com/browse" });
    // Terminal crumb (current lesson) carries no separate url.
    const last = crumbs.itemListElement[crumbs.itemListElement.length - 1];
    expect(last.name).toBe("Lesson one");
    expect(last.item).toBeUndefined();
  });

  it("emits aggregateRating only for a course that actually has ratings", async () => {
    renderApp("/course/2");
    await screen.findByRole("heading", { name: "Introducing force" });

    const course = schemaFor("Course");
    expect(course.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.5,
      ratingCount: 10,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it("replaces rather than duplicates schema when navigating to a different course in place", async () => {
    renderApp("/course/1");
    await screen.findByRole("heading", { name: "Lesson one" });
    const firstCourseScript = document.head.querySelector('script[data-schema-key="Course"]');
    expect(schemaFor("Course").name).toBe("Complete Kinematics");

    fireEvent.click(screen.getByRole("link", { name: "Go to course 2" }));
    await screen.findByRole("heading", { name: "Introducing force" });

    // Exactly one script per key — never two Course nodes on screen at once.
    expect(schemaKeys()).toEqual(["BreadcrumbList", "Course", "VideoObject"]);
    // Same script element, upserted in place (matches applyStructuredData's
    // own contract), now describing the NEW course rather than the old one.
    expect(document.head.querySelector('script[data-schema-key="Course"]')).toBe(firstCourseScript);
    await waitFor(() => expect(schemaFor("Course").name).toBe("Newton's Laws of Motion"));
    expect(schemaFor("VideoObject").name).toBe("Introducing force");
  });

  it("writes nothing while the requested chapter does not exist in the course", async () => {
    renderApp("/course/1/chapter/999");
    await screen.findByText("Chapter not found in this course");
    expect(schemaKeys()).toEqual([]);
  });
});
