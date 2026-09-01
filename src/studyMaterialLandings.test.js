import { describe, expect, it } from "vitest";
import {
  JEE_MAIN_PAPERS_PATH,
  PAPER_LANDINGS,
  findPaperLanding,
  paperIncludesAnswerKey,
  paperIncludesSolutions,
  paperYearPath,
  paperYears,
  parsePaperYearPath,
  splitJeeMainPapers,
} from "./studyMaterialLandings.js";

describe("JEE Main paper grouping", () => {
  it("does not mistake an explicit no-solutions statement for a solved paper", () => {
    expect(paperIncludesSolutions({
      title: "JEE Main 2026 paper",
      description: "Questions only; no answer key or worked solutions are included.",
    })).toBe(false);
  });

  it("requires an explicit statement that worked solutions are included", () => {
    expect(paperIncludesSolutions({
      title: "JEE Main 2024 paper with solutions",
      description: "The question paper and worked solutions are included.",
    })).toBe(true);

    const groups = splitJeeMainPapers([
      { id: 1, description: "No solutions are included." },
      { id: 2, description: "Worked solutions are included." },
      { id: 3, title: "JEE Main 2025 Session 1 final answer key" },
    ]);
    expect(groups.questionOnly.map(({ id }) => id)).toEqual([1]);
    expect(groups.answerKeys.map(({ id }) => id)).toEqual([3]);
    expect(groups.withSolutions.map(({ id }) => id)).toEqual([2]);
  });

  it("does not mistake a no-answer-key statement for an answer key", () => {
    expect(paperIncludesAnswerKey({
      description: "Questions only; no answer key or solutions are included.",
    })).toBe(false);
    expect(paperIncludesAnswerKey({
      title: "JEE Main 2026 Session 2 final answer key",
    })).toBe(true);
  });
});

// The registry is what makes a sibling exam (NEET UG, JEE Advanced) a data
// change rather than a code change. An exam is registered ONLY once its papers
// are confirmed present in production — a seed file in docs/sql is history,
// not evidence, and registering on the strength of one ships an empty page.
describe("paper landings and their year pages", () => {
  it("registers only exams whose papers this site actually holds", () => {
    expect(PAPER_LANDINGS.map((landing) => landing.id)).toEqual(["jee-main"]);
    expect(findPaperLanding(JEE_MAIN_PAPERS_PATH)).toMatchObject({
      examLabel: "JEE Main",
      titlePattern: "JEE Main%",
    });
    expect(findPaperLanding("/materials/neet/previous-year-papers")).toBeNull();
  });

  it("addresses one exam year as a child of its landing", () => {
    const landing = findPaperLanding(JEE_MAIN_PAPERS_PATH);
    expect(paperYearPath(landing, 2024))
      .toBe("/materials/jee-main/previous-year-papers/2024");
    expect(parsePaperYearPath("/materials/jee-main/previous-year-papers/2024"))
      .toEqual({ landing, year: 2024 });
  });

  it("refuses a year segment that is not a year, or a landing it does not have", () => {
    for (const path of [
      "/materials/jee-main/previous-year-papers",
      "/materials/jee-main/previous-year-papers/latest",
      "/materials/jee-main/previous-year-papers/20244",
      "/materials/jee-main/previous-year-papers/1899",
      "/materials/neet/previous-year-papers/2024",
      "",
    ]) {
      expect([path, parsePaperYearPath(path)]).toEqual([path, null]);
    }
  });

  it("lists the years present, newest first, ignoring papers with no year", () => {
    expect(paperYears([
      { exam_year: 2022 },
      { examYear: 2024 },
      { exam_year: 2024 },
      { exam_year: null },
      { exam_year: "not a year" },
    ])).toEqual([2024, 2022]);
  });
});
