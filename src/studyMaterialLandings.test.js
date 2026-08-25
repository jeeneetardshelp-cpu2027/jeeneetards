import { describe, expect, it } from "vitest";
import { paperIncludesSolutions, splitJeeMainPapers } from "./studyMaterialLandings.js";

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
    ]);
    expect(groups.questionOnly.map(({ id }) => id)).toEqual([1]);
    expect(groups.withSolutions.map(({ id }) => id)).toEqual([2]);
  });
});
