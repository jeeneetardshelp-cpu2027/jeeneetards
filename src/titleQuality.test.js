import { describe, expect, it } from "vitest";
import {
  normalizeTitleWhitespace, suggestEditorialTitle, titleCanBeApproved, titleQualityIssues,
} from "./titleQuality.js";

describe("editorial title quality", () => {
  it("normalizes whitespace without deleting source words", () => {
    expect(normalizeTitleWhitespace("  Complete\t Kinematics  ")).toBe("Complete Kinematics");
  });

  it("normalizes the current catalogue capitalization and academic acronyms", () => {
    expect(suggestEditorialTitle("newton's laws of motion")).toBe("Newton's Laws of Motion");
    expect(suggestEditorialTitle("rectilinear motion (kinematics)")).toBe("Rectilinear Motion (Kinematics)");
    expect(suggestEditorialTitle("jee and neet physics")).toBe("JEE and NEET Physics");
  });

  it("does not damage Devanagari titles", () => {
    expect(suggestEditorialTitle("  सरल रेखीय गति  ")).toBe("सरल रेखीय गति");
  });

  it("warns about YouTube keyword lists and lecture numbering", () => {
    const codes = titleQualityIssues("#1 Lecture | Kinematics | JEE").map((issue) => issue.code);
    expect(codes).toContain("pipe-list");
    expect(codes).toContain("episode-prefix");
  });

  it("warns about a BARE leading position number, not just #1 or Lecture 1", () => {
    // These shipped as "clean" in the first title pass and left lessons 1-3 of
    // a course reading "1- Rectilinear motion" beside cleaned siblings.
    for (const title of [
      "1- Rectilinear motion",
      "2 - Rectilinear motion",
      "22 Questions on Line spectrum of atomic hydrogen",
      "3) Nature of Roots",
      "04. Motion Under Gravity",
      "5 सरल रेखीय गति",
    ]) {
      expect(titleQualityIssues(title).map((i) => i.code)).toContain("episode-prefix");
    }
  });

  it("does not mistake a number that belongs to the topic for numbering", () => {
    for (const title of [
      "3D Geometry Basics",
      "12th Chemistry Revision",
      "Pair of Linear Equations in 2 Variables",
      "2026 Question Paper Analysis",
    ]) {
      expect(titleQualityIssues(title).map((i) => i.code)).not.toContain("episode-prefix");
    }
  });

  it("blocks blank and overlong titles but leaves warnings for human judgement", () => {
    expect(titleCanBeApproved(" ")).toBe(false);
    expect(titleCanBeApproved("x".repeat(91))).toBe(false);
    expect(titleCanBeApproved("Kinematics | JEE")).toBe(true);
  });
});

