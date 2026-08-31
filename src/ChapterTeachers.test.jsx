// ChapterTeachers: the "who else teaches this chapter" strip on the watch page.
//
// The audit's finding: the watch page had no lateral link to another institute
// for the same chapter — the one thing this site can do that YouTube cannot,
// missing exactly where a student decides they dislike the teacher. These tests
// pin the selection logic and the honesty rule (hide, never show an empty box).
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import ChapterTeachers, { pickOtherTeachers } from "./ChapterTeachers.jsx";
import { ThemeProvider } from "./theme.jsx";

const course = (over) => ({
  id: 1, institute: "Physics Wallah", instituteId: 5, lectures: 8,
  rating: null, ratingCount: 0, instituteLogoUrl: null, ...over,
});

describe("pickOtherTeachers", () => {
  it("drops the course being watched and the same institute's other courses", () => {
    const items = [
      course({ id: 1, instituteId: 5 }),            // the one being watched
      course({ id: 2, instituteId: 5 }),            // same institute — not "another teacher"
      course({ id: 3, instituteId: 8, institute: "ALLEN" }),
    ];
    const got = pickOtherTeachers(items, 1, 5);
    expect(got.map((c) => c.id)).toEqual([3]);
  });

  it("keeps only one course per other institute — the higher-ranked entry point", () => {
    const items = [
      course({ id: 10, instituteId: 8, institute: "ALLEN", lectures: 3, rating: null, ratingCount: 0 }),
      course({ id: 11, instituteId: 8, institute: "ALLEN", lectures: 20, rating: null, ratingCount: 0 }),
    ];
    const got = pickOtherTeachers(items, 1, 5);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe(11); // more lectures wins when neither has a shown rating
  });

  it("prefers a course whose rating clears the confidence floor", () => {
    const items = [
      course({ id: 20, instituteId: 8, institute: "ALLEN", lectures: 40, rating: null, ratingCount: 0 }),
      course({ id: 21, instituteId: 9, institute: "eSaral", lectures: 5, rating: 4.6, ratingCount: 50 }),
    ];
    const got = pickOtherTeachers(items, 1, 5);
    // A trustworthy rating outranks a bigger-but-unrated course.
    expect(got[0].id).toBe(21);
  });

  it("ignores an institute with no name and caps the list", () => {
    const items = [
      course({ id: 2, instituteId: 8, institute: "ALLEN" }),
      course({ id: 3, instituteId: 9, institute: "eSaral" }),
      course({ id: 4, instituteId: 10, institute: "Mohit Tyagi" }),
      course({ id: 5, instituteId: 11, institute: "Aakash" }),
      course({ id: 6, instituteId: 12, institute: "Motion" }),
      course({ id: 7, instituteId: 13, institute: null }), // unnamed — not a credible teacher
    ];
    const got = pickOtherTeachers(items, 1, 5, 4);
    expect(got).toHaveLength(4);
    expect(got.every((c) => c.institute)).toBe(true);
  });
});

const show = (props) => render(
  <ThemeProvider>
    <MemoryRouter>
      <ChapterTeachers
        chapterId={82} chapterName="Laws of Motion"
        currentCourseId={1} currentInstituteId={5}
        chapterCourses={[]} loading={false}
        {...props}
      />
    </MemoryRouter>
  </ThemeProvider>,
);

// The strip no longer fetches. The watch page makes ONE request for the
// chapter's courses and hands the same rows to every panel below the player, so
// these tests feed those rows in directly rather than mocking a query.
describe("ChapterTeachers rendering", () => {
  it("renders nothing when this chapter has no other institute", () => {
    const { container } = show({
      chapterCourses: [course({ id: 1, instituteId: 5 }), course({ id: 2, instituteId: 5 })],
    });
    expect(container.textContent).toBe("");
  });

  it("renders nothing while the shared query is loading", () => {
    const { container } = show({ chapterCourses: [], loading: true });
    expect(container.textContent).toBe("");
  });

  it("names the chapter, counts the institutes, and links into each course scoped to the chapter", () => {
    show({
      chapterCourses: [
        course({ id: 1, instituteId: 5 }),
        course({ id: 3, instituteId: 8, institute: "ALLEN", lectures: 12 }),
        course({ id: 4, instituteId: 9, institute: "eSaral", lectures: 6 }),
      ],
    });
    expect(screen.getByText(/2 other institutes teach/i)).toBeTruthy();
    expect(screen.getByText("Laws of Motion")).toBeTruthy();
    const allen = screen.getByRole("link", { name: /ALLEN/ });
    // Link carries the OTHER course id and the SAME chapter, so the student
    // lands on that institute's take on this exact chapter.
    expect(allen.getAttribute("href")).toBe("/course/3/chapter/82");
    expect(screen.getByRole("link", { name: /eSaral/ }).getAttribute("href"))
      .toBe("/course/4/chapter/82");
  });

  it("uses the singular when exactly one other institute teaches it", () => {
    show({
      chapterCourses: [
        course({ id: 1, instituteId: 5 }),
        course({ id: 3, instituteId: 8, institute: "ALLEN" }),
      ],
    });
    expect(screen.getByText(/1 other institute teaches/i)).toBeTruthy();
  });
});
