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

  it("blocks blank and overlong titles but leaves warnings for human judgement", () => {
    expect(titleCanBeApproved(" ")).toBe(false);
    expect(titleCanBeApproved("x".repeat(91))).toBe(false);
    expect(titleCanBeApproved("Kinematics | JEE")).toBe(true);
  });
});

