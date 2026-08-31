// The watch page must issue ONE request for the chapter's courses.
//
// "Revise in one sitting" and "Other institutes teaching this chapter" answer
// different questions from the SAME rows. Each used to run its own
// usePlaylistBrowse call, so every watch page paid two round trips for one
// answer. They now take the rows as props from a single query in
// CourseVideoPage.
//
// This is a structural test on purpose: the regression is silent. Re-adding a
// hook call inside either panel breaks nothing visible and no behavioural test
// would notice — the page would simply get slower again.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Repo-relative, like legalTruth.test.js — vitest runs from the repo root.
const read = (path) => readFileSync(`src/${path}`, "utf8");

describe("one chapter query, shared", () => {
  for (const panel of ["ChapterTeachers.jsx", "ChapterRevision.jsx"]) {
    it(`${panel} takes the rows as props and does not fetch`, () => {
      const source = read(panel);
      expect(source).not.toMatch(/usePlaylistBrowse\s*\(/);
      expect(source).toMatch(/chapterCourses/);
    });
  }

  it("CourseVideoPage runs exactly one chapter-courses query", () => {
    const source = read("CourseVideoPage.jsx");
    const calls = source.match(/usePlaylistBrowse\s*\(/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  it("that query is big enough to hold a chapter whole", () => {
    // The default PAGE_SIZE of 12 truncates: the busiest chapter has 22 courses
    // and 18 of 249 populated chapters exceed 12. Truncation is invisible —
    // the panels would just quietly stop offering some one-shots.
    const source = read("CourseVideoPage.jsx");
    const size = Number(source.match(/CHAPTER_COURSES_PAGE_SIZE = (\d+)/)?.[1]);
    expect(size).toBeGreaterThanOrEqual(22);
    expect(source).toMatch(/pageSize: CHAPTER_COURSES_PAGE_SIZE/);
  });

  it("hands the same rows to both panels", () => {
    const source = read("CourseVideoPage.jsx");
    expect(source.match(/chapterCourses=\{chapterCourses\}/g) ?? []).toHaveLength(2);
    expect(source.match(/loading=\{chapterCoursesLoading\}/g) ?? []).toHaveLength(2);
  });
});
