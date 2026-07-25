import { describe, expect, it } from "vitest";
import {
  buildCatalogInventory,
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
});
