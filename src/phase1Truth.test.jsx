import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useSearchParams } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const phase = vi.hoisted(() => ({
  record: vi.fn(),
  progress: null,
  error: null,
  course: {
    id: 1,
    title: "Complete Kinematics",
    average_rating: 5,
    ratings_count: 1,
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
      durationSeconds: 900, embeddingStatus: "allowed", subject: "Physics",
    },
    {
      id: 103, videoId: "video-three", title: "Lesson three", position: 3,
      chapter: { id: 2, name: "Laws of Motion", slug: "laws-of-motion" },
      durationSeconds: 1200, embeddingStatus: "allowed", subject: "Physics",
    },
  ],
}));

vi.mock("./YouTubePlayer.jsx", () => ({
  default: ({ onPlay }) => <button onClick={onPlay}>Start playback</button>,
}));

vi.mock("./usePlaylistVideos.js", () => ({
  usePlaylistVideos: () => ({
    loading: false,
    error: phase.error,
    course: phase.error ? null : phase.course,
    lessons: phase.error ? [] : phase.lessons,
  }),
}));

vi.mock("./progress.js", () => ({
  getWatchedVideoIds: () => [],
  getCourseProgress: () => phase.progress,
  recordLessonView: phase.record,
  getContinueWatching: () => [],
  getRecentChapters: () => [],
  getLessonPosition: () => 0,
  getPlayerPrefs: () => ({ rate: null }),
  recordLessonPosition: () => null,
  savePlayerPrefs: () => {},
}));

vi.mock("./CourseRating.jsx", () => ({ default: () => null }));
vi.mock("./VideoReport.jsx", () => ({ default: () => null }));

import App from "./App.jsx";

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname + location.search}</output>;
}

function QueryMutationButton() {
  const [params, setParams] = useSearchParams();
  return (
    <button
      type="button"
      onClick={() => {
        const next = new URLSearchParams(params);
        next.set("source", "test");
        setParams(next);
      }}
    >
      Change query
    </button>
  );
}

beforeEach(() => {
  window.scrollTo = vi.fn();
  phase.record.mockReset();
  phase.progress = null;
  phase.error = null;
  phase.record.mockImplementation(({ videoId }) => ({ watched: [videoId] }));
});

describe("truthful course entry", () => {
  it("renders no fabricated notes or comments", async () => {
    render(<MemoryRouter initialEntries={["/course/1/chapter/1"]}><App /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Lesson one" });

    expect(screen.queryByRole("button", { name: "Chapter Notes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Comments" })).toBeNull();
    expect(screen.queryByText("What is kinematics?")).toBeNull();
  });

  it("does not mark route entry or lesson selection as watched", async () => {
    render(<MemoryRouter initialEntries={["/course/1/chapter/1"]}><App /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Lesson one" });
    expect(phase.record).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /2\s*Lesson two/i }));
    await screen.findByRole("heading", { name: "Lesson two" });
    expect(phase.record).not.toHaveBeenCalled();
  });

  it("writes the selected lesson to a shareable course URL", async () => {
    render(
      <MemoryRouter initialEntries={["/course/1/chapter/1"]}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Lesson one" });

    fireEvent.click(screen.getByRole("button", { name: /2\s*Lesson two/i }));

    await screen.findByRole("heading", { name: "Lesson two" });
    expect(screen.getByLabelText("Current route").textContent).toBe(
      "/course/1/chapter/1?v=video-two",
    );
    expect(phase.record).not.toHaveBeenCalled();
  });

  it("replaces an invalid lesson query with the lesson actually displayed", async () => {
    render(
      <MemoryRouter initialEntries={["/course/1/chapter/1?v=missing-video&source=share"]}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Lesson one" });
    await waitFor(() => expect(screen.getByLabelText("Current route").textContent).toBe(
      "/course/1/chapter/1?v=video-one&source=share",
    ));
  });

  it("keeps one page-level heading on the course screen", async () => {
    render(<MemoryRouter initialEntries={["/course/1/chapter/1"]}><App /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Lesson one" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("marks the active lesson only after playback starts", async () => {
    render(<MemoryRouter initialEntries={["/course/1/chapter/1"]}><App /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Lesson one" });

    fireEvent.click(screen.getByRole("button", { name: "Start playback" }));
    await waitFor(() => expect(phase.record).toHaveBeenCalledTimes(1));
    expect(phase.record).toHaveBeenCalledWith(expect.objectContaining({
      playlistId: "1", videoId: "video-one", position: 1,
    }));
    expect(screen.getAllByText("1 of 2 watched")).toHaveLength(2);
  });

  it("scopes a chapter-qualified route to that chapter", async () => {
    render(<MemoryRouter initialEntries={["/course/1/chapter/2"]}><App /></MemoryRouter>);

    await screen.findByRole("heading", { name: "Lesson three" });
    expect(screen.queryByRole("button", { name: /Lesson one/i })).toBeNull();
    expect(screen.getAllByText("Laws of Motion")).toHaveLength(2);
    expect(screen.getByText("1 lesson")).not.toBeNull();
    expect(screen.getByText("Lesson 1 of 1")).not.toBeNull();
  });

  it("does not let progress from another chapter override chapter entry", async () => {
    phase.progress = { lastVideoId: "video-two" };
    render(<MemoryRouter initialEntries={["/course/1/chapter/2"]}><App /></MemoryRouter>);

    await screen.findByRole("heading", { name: "Lesson three" });
  });

  it("persists one course-global ordinal independent of the entry route", async () => {
    const chapterEntry = render(
      <MemoryRouter initialEntries={["/course/1/chapter/2"]}><App /></MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Lesson three" });
    fireEvent.click(screen.getByRole("button", { name: "Start playback" }));
    await waitFor(() => expect(phase.record).toHaveBeenCalledWith(
      expect.objectContaining({
        playlistId: "1",
        chapterId: 2,
        videoId: "video-three",
        position: 3,
        totalLessons: 3,
      }),
    ));

    chapterEntry.unmount();
    phase.record.mockClear();
    phase.progress = { lastVideoId: "video-three" };
    render(<MemoryRouter initialEntries={["/course/1"]}><App /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Lesson three" });
    fireEvent.click(screen.getByRole("button", { name: "Start playback" }));
    await waitFor(() => expect(phase.record).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterId: 2,
        videoId: "video-three",
        position: 3,
        totalLessons: 3,
      }),
    ));
  });

  it("canonicalizes a cross-chapter lesson query within the requested chapter", async () => {
    render(
      <MemoryRouter initialEntries={["/course/1/chapter/2?v=video-one&source=share"]}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Lesson three" });
    await waitFor(() => expect(screen.getByLabelText("Current route").textContent).toBe(
      "/course/1/chapter/2?v=video-three&source=share",
    ));
    await waitFor(() => expect(document.title).toBe(
      "Complete Kinematics | JEENEETARD",
    ));
    expect(document.head.querySelector('meta[name="robots"]')?.content)
      .toBe("index, follow");
  });

  it("rejects a chapter that is not represented by the course", async () => {
    render(<MemoryRouter initialEntries={["/course/1/chapter/999"]}><App /></MemoryRouter>);

    expect(await screen.findByText("Chapter not found in this course")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Lesson one" })).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')?.content)
      .toBe("noindex, nofollow");
    expect(document.head.querySelector('link[rel="canonical"]')?.href)
      .toMatch(/\/course\/1$/);
  });

  it("keeps invalid chapter metadata after query-only navigation", async () => {
    render(
      <MemoryRouter initialEntries={["/course/1/chapter/999"]}>
        <App />
        <QueryMutationButton />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Chapter not found in this course")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change query" }));
    await waitFor(() => expect(document.head.querySelector('meta[name="robots"]')?.content)
      .toBe("noindex, nofollow"));
    expect(document.title).toBe("Chapter not found | JEENEETARD");
  });

  it("preserves chapter return context when course loading fails", async () => {
    phase.error = "network failed";
    render(
      <MemoryRouter initialEntries={["/course/1/chapter/2"]}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByText("Couldn't load course");
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    await waitFor(() => expect(screen.getByLabelText("Current route").textContent)
      .toBe("/browse?ch=2"));
  });

  it("keeps the chapterless route in full-course mode", async () => {
    phase.progress = { lastVideoId: "video-three" };
    render(<MemoryRouter initialEntries={["/course/1"]}><App /></MemoryRouter>);

    await screen.findByRole("heading", { name: "Lesson three" });
    expect(screen.getByRole("button", { name: /Lesson one/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Lesson two/i })).not.toBeNull();
  });
});
