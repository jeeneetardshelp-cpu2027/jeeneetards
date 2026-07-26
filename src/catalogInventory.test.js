import { describe, expect, it } from "vitest";
import {
  buildCatalogInventory,
  findPlaylistOverlaps,
  normalizeCatalogCourse,
} from "./scripts/catalogInventory.js";

const complete = {
  id: 1,
  youtube_playlist_id: "PL-1",
  title: "Kinematics",
  teacher: "A. Sharma",
  language: "hinglish",
  content_type: "full-course",
  difficulty: "advanced",
  average_rating: 4.5,
  ratings_count: 2,
  subjects: { name: "Physics", slug: "physics" },
  institutes_channels: { name: "Example Institute" },
  playlist_videos: [{ count: 12 }],
  playlist_learning_goals: [{ learning_goals: { name: "JEE", slug: "jee" } }],
  playlist_class_levels: [{ class_levels: { name: "Class 11", slug: "class-11" } }],
};

describe("read-only catalogue inventory", () => {
  it("normalizes public course metadata without inventing missing values", () => {
    expect(normalizeCatalogCourse(complete)).toMatchObject({
      id: 1,
      title: "Kinematics",
      teacher: "A. Sharma",
      subject: "Physics",
      institute: "Example Institute",
      goals: ["jee"],
      classLevels: ["class-11"],
      lectures: 12,
      rating: 4.5,
      missing: [],
      issues: [],
    });
  });

  it("reports missing metadata, title issues and coverage totals", () => {
    const report = buildCatalogInventory([
      complete,
      {
        ...complete,
        id: 2,
        title: "rectilinear  motion",
        teacher: null,
        ratings_count: 0,
        average_rating: 0,
        playlist_videos: [{ count: 3 }],
        playlist_class_levels: [],
      },
    ], "2026-07-25T00:00:00.000Z");

    expect(report.readOnly).toBe(true);
    expect(report.summary).toMatchObject({
      totalCourses: 2,
      totalLectures: 15,
      coursesNeedingMetadata: 1,
      coursesNeedingTitleReview: 1,
      coursesWithoutTeacher: 1,
      coursesWithoutRatings: 1,
      classCoverage: { "class-11": 1 },
      goalCoverage: { jee: 2 },
      subjectCoverage: { Physics: 2 },
    });
    expect(report.courses[1]).toMatchObject({
      rating: null,
      missing: ["teacher", "class-level"],
      issues: ["title-capitalization", "title-spacing"],
    });
  });

  it("flags duplicate titles case-insensitively", () => {
    const report = buildCatalogInventory([
      complete,
      { ...complete, id: 2, title: "KINEMATICS" },
    ]);

    expect(report.courses.every((course) => course.issues.includes("duplicate-title"))).toBe(true);
  });

  it("flags a missing source playlist id as a provenance gap", () => {
    const course = normalizeCatalogCourse({
      ...complete,
      youtube_playlist_id: null,
    });

    expect(course.missing).toContain("source-playlist-id");
  });

  it("proves when one playlist is fully contained inside another", () => {
    const overlaps = findPlaylistOverlaps([
      { playlist_id: 1, video_id: 10, videos: { youtube_video_id: "a", title: "One" } },
      { playlist_id: 1, video_id: 11, videos: { youtube_video_id: "b", title: "Two" } },
      { playlist_id: 4, video_id: 10, videos: { youtube_video_id: "a", title: "One" } },
      { playlist_id: 4, video_id: 11, videos: { youtube_video_id: "b", title: "Two" } },
      { playlist_id: 4, video_id: 12, videos: { youtube_video_id: "c", title: "Three" } },
      { playlist_id: 5, video_id: 20, videos: { youtube_video_id: "d", title: "Other" } },
    ], [
      { id: 1, title: "Complete Kinematics" },
      { id: 4, title: "Rectilinear Motion" },
      { id: 5, title: "Rectilinear Motion (Kinematics)" },
    ]);

    expect(overlaps).toEqual([expect.objectContaining({
      leftId: 1,
      leftTitle: "Complete Kinematics",
      rightId: 4,
      rightTitle: "Rectilinear Motion",
      sharedCount: 2,
      leftCount: 2,
      rightCount: 3,
      leftFullyContained: true,
      rightFullyContained: false,
    })]);
    expect(overlaps[0].sharedVideos).toHaveLength(2);
  });

  it("does not report playlists that share no videos", () => {
    expect(findPlaylistOverlaps([
      { playlist_id: 1, video_id: 10 },
      { playlist_id: 2, video_id: 20 },
    ])).toEqual([]);
  });

  it("finds an overlap whose evidence appears after row 1,000", () => {
    const firstThousand = Array.from({ length: 1000 }, (_, index) => ({
      playlist_id: 1,
      video_id: index + 1,
    }));
    const overlaps = findPlaylistOverlaps([
      ...firstThousand,
      { playlist_id: 2, video_id: 1000 },
    ]);

    expect(overlaps).toEqual([expect.objectContaining({
      leftId: 1,
      rightId: 2,
      sharedCount: 1,
      leftCount: 1000,
      rightCount: 1,
      leftFullyContained: false,
      rightFullyContained: true,
    })]);
  });
});
