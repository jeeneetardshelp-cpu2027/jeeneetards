import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const phase = vi.hoisted(() => ({ record: vi.fn() }));

vi.mock("./YouTubePlayer.jsx", () => ({
  default: ({ onPlay }) => <button onClick={onPlay}>Start playback</button>,
}));

vi.mock("./usePlaylistVideos.js", () => ({
  usePlaylistVideos: () => ({
    loading: false,
    error: null,
    course: { id: 1, title: "Complete Kinematics", average_rating: 5, ratings_count: 1 },
    lessons: [
      { id: 101, videoId: "video-one", title: "Lesson one", position: 1 },
      { id: 102, videoId: "video-two", title: "Lesson two", position: 2 },
    ],
  }),
}));

vi.mock("./progress.js", () => ({
  getWatchedVideoIds: () => [],
  getCourseProgress: () => null,
  recordLessonView: phase.record,
  getContinueWatching: () => [],
  getRecentChapters: () => [],
}));

vi.mock("./CourseRating.jsx", () => ({ default: () => null }));
vi.mock("./VideoReport.jsx", () => ({ default: () => null }));

import App from "./App.jsx";

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname + location.search}</output>;
}

beforeEach(() => {
  window.scrollTo = vi.fn();
  phase.record.mockReset();
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
});
