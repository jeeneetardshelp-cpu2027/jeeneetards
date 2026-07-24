import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "./theme.jsx";
import CourseOverview from "./CourseOverview.jsx";
import { mapCourseDetail } from "./usePlaylistVideos.js";
import { getCourseProgress, recordLessonView } from "./progress.js";

const playlist = (overrides = {}) => ({
  id: 4,
  title: "Complete Kinematics",
  teacher: "ABJ Sir",
  average_rating: 4.8,
  ratings_count: 12,
  language: "hinglish",
  content_type: "full-course",
  difficulty: "advanced",
  class_levels: [],
  last_verified_at: "2026-07-20T00:00:00Z",
  institutes_channels: { name: "Competishun" },
  subjects: { name: "Physics" },
  playlist_learning_goals: [{ learning_goals: { name: "JEE", slug: "jee" } }],
  playlist_class_levels: [{ class_levels: { name: "Class 11", slug: "class-11" } }],
  ...overrides,
});

const row = (id, position, overrides = {}) => ({
  position,
  videos: {
    id,
    youtube_video_id: `video-${id}`,
    title: `Lesson ${position}`,
    description: null,
    duration_seconds: 1800,
    embedding_status: "embeddable",
    last_verified_at: "2026-07-20T00:00:00Z",
    chapters: { id: 7, name: "Kinematics", slug: "kinematics" },
    subjects: { name: "Physics" },
    ...overrides,
  },
});

describe("course detail mapping", () => {
  it("deduplicates real chapter scope and totals duration only when complete", () => {
    const mapped = mapCourseDetail(playlist(), [row(1, 1), row(2, 2)]);
    expect(mapped.course.syllabus).toEqual([
      { id: 7, name: "Kinematics", slug: "kinematics", subject: "Physics" },
    ]);
    expect(mapped.course.totalDurationSeconds).toBe(3600);
    expect(mapped.course.classLevels).toEqual(["Class 11"]);
    expect(mapped.course.learningGoals).toEqual(["JEE"]);
  });

  it("never turns incomplete duration or availability into a plausible zero", () => {
    const mapped = mapCourseDetail(playlist(), [
      row(1, 1),
      row(2, 2, { duration_seconds: null, embedding_status: "blocked" }),
    ]);
    expect(mapped.course.totalDurationSeconds).toBeNull();
    expect(mapped.course.blockedLessons).toBe(1);
  });
});

describe("course overview truthfulness", () => {
  const lessons = [
    { id: 1, videoId: "video-1", position: 1 },
    { id: 2, videoId: "video-2", position: 2 },
  ];

  it("shows decision metadata, scope, availability and a Continue action", () => {
    const onStart = vi.fn();
    const { course } = mapCourseDetail(playlist(), [
      row(1, 1), row(2, 2, { embedding_status: "blocked" }),
    ]);
    render(
      <ThemeProvider>
        <CourseOverview
          course={course}
          lessons={lessons}
          watchedIds={["video-1"]}
          continueLesson={lessons[1]}
          onStart={onStart}
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Complete Kinematics" })).toBeTruthy();
    expect(screen.getByText("ABJ Sir")).toBeTruthy();
    expect(screen.getByText("1h 0m")).toBeTruthy();
    expect(screen.getByText("Kinematics")).toBeTruthy();
    expect(screen.getByText(/not a claim of complete syllabus coverage/i)).toBeTruthy();
    expect(screen.getByText(/marked as unavailable in the embedded player/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue at lesson 2" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("shows one rating as a count, never as a comparative score", () => {
    const { course } = mapCourseDetail(playlist({ average_rating: 5, ratings_count: 1 }), [row(1, 1)]);
    render(
      <ThemeProvider>
        <CourseOverview course={course} lessons={[lessons[0]]} onStart={() => {}} />
      </ThemeProvider>,
    );
    expect(screen.getByText("1 student rating")).toBeTruthy();
    expect(screen.queryByText("5.0")).toBeNull();
  });

  it("omits duration and coverage claims when the data is incomplete", () => {
    const { course } = mapCourseDetail(playlist({ last_verified_at: null }), [
      row(1, 1, { duration_seconds: null }),
    ]);
    render(
      <ThemeProvider>
        <CourseOverview course={course} lessons={[lessons[0]]} onStart={() => {}} />
      </ThemeProvider>,
    );
    expect(screen.queryByText("0m")).toBeNull();
    expect(screen.queryByText(/% coverage/i)).toBeNull();
  });
});

describe("course progress", () => {
  beforeEach(() => localStorage.clear());

  it("exists only after a genuine playback record", () => {
    expect(getCourseProgress(4)).toBeNull();
    recordLessonView({
      playlistId: 4, chapterId: 7, courseTitle: "Complete Kinematics",
      videoId: "video-2", videoTitle: "Lesson 2", position: 2, totalLessons: 3,
    });
    expect(getCourseProgress(4)).toMatchObject({
      lastVideoId: "video-2", lastPosition: 2, watched: ["video-2"],
    });
  });
});
