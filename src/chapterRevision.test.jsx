// The revision strip on the watch page. It is the only route to 69 catalogued
// one-shot/revision courses, so the selection rules are worth pinning: it must
// not offer the course the student is already on, must not offer full courses,
// and must not state a length or a rating it does not have.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import ChapterRevision, { pickRevisionCourses } from "./ChapterRevision.jsx";
import { ThemeProvider } from "./theme.jsx";

const course = (id, extra = {}) => ({
  id,
  title: `Course ${id}`,
  teacher: "Manish Raj",
  institute: "Unacademy NEET",
  contentType: "one-shot",
  durationSeconds: 2820, // 47m
  rating: null,
  ratingCount: 0,
  ...extra,
});

// The strip no longer fetches: the watch page makes ONE request for the
// chapter's courses and shares the rows with every panel below the player.
const show = (chapterCourses, currentCourseId = 999) => render(
  <ThemeProvider>
    <MemoryRouter initialEntries={["/"]}>
      <ChapterRevision
        chapterId={27}
        chapterName="Rotational Motion"
        currentCourseId={currentCourseId}
        chapterCourses={chapterCourses}
        loading={false}
      />
    </MemoryRouter>
  </ThemeProvider>,
);

describe("pickRevisionCourses", () => {
  it("keeps only one-shot and revision courses", () => {
    const picked = pickRevisionCourses([
      course(1, { contentType: "one-shot" }),
      course(2, { contentType: "revision" }),
      course(3, { contentType: "full-course" }),
      course(4, { contentType: "pyq" }),
      course(5, { contentType: "practice" }),
      course(6, { contentType: null }),
    ], 999);
    expect(picked.map((c) => c.id).sort()).toEqual([1, 2]);
  });

  it("never offers the course the student is already watching", () => {
    const picked = pickRevisionCourses([course(1), course(2)], 1);
    expect(picked.map((c) => c.id)).toEqual([2]);
  });

  it("puts a confidently rated course above an unrated one", () => {
    // ratingConfidence needs 5 votes before a score may be shown at all.
    const picked = pickRevisionCourses([
      course(1, { rating: null, ratingCount: 0 }),
      course(2, { rating: 4.6, ratingCount: 40 }),
      course(3, { rating: 4.9, ratingCount: 2 }), // too few votes to count
    ], 999);
    expect(picked[0].id).toBe(2);
  });

  it("prefers the shorter sitting between two unrated courses", () => {
    const picked = pickRevisionCourses([
      course(1, { durationSeconds: 18000 }),
      course(2, { durationSeconds: 2820 }),
    ], 999);
    expect(picked.map((c) => c.id)).toEqual([2, 1]);
  });

  it("shows at most four", () => {
    expect(pickRevisionCourses(
      Array.from({ length: 9 }, (_, i) => course(i + 1)), 999,
    )).toHaveLength(4);
  });
});

describe("<ChapterRevision>", () => {
  it("renders nothing when the chapter has no revision material", () => {
    // 74 of 263 chapters. An empty panel would be worse than silence.
    const { container } = show([course(1, { contentType: "full-course" })]);
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders nothing without a usable chapter id", () => {
    const { container } = render(
      <ThemeProvider>
        <MemoryRouter>
          <ChapterRevision chapterId={null} currentCourseId={999} chapterCourses={[course(1)]} />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(container.querySelector("section")).toBeNull();
  });

  it("offers the one-shot with its measured length", () => {
    show([course(1, { title: "Complete Mechanics in One Shot", durationSeconds: 2820 })]);
    expect(screen.getByText("Complete Mechanics in One Shot")).toBeTruthy();
    expect(document.body.textContent).toMatch(/Manish Raj · 47m/);
    expect(screen.getByRole("link", { name: /Complete Mechanics in One Shot/ })
      .getAttribute("href")).toBe("/course/1/chapter/27");
  });

  it("omits a length it does not have rather than printing a zero", () => {
    show([course(1, { durationSeconds: null })]);
    expect(document.body.textContent).not.toMatch(/0m|NaN/);
    expect(document.body.textContent).toMatch(/Manish Raj/);
  });

  it("omits a rating that has not earned confidence", () => {
    show([course(1, { rating: 4.9, ratingCount: 2 })]);
    expect(document.body.textContent).not.toMatch(/4\.9/);
  });
});
