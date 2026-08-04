import { describe, expect, it } from "vitest";
import { exploreStepHeading } from "./exploreHeading.js";

describe("Explore step headings", () => {
  it.each([
    ["board", ["School Boards"], "Choose a school board"],
    ["class", ["JEE"], "Choose a stage for JEE"],
    ["subject", ["JEE", "Class 11"], "Choose a subject for JEE Class 11"],
    [
      "chapter",
      ["JEE", "Class 11", "Physics"],
      "Choose a chapter for JEE Class 11 Physics",
    ],
  ])("describes the %s step with its stable scope", (step, scope, expected) => {
    expect(exploreStepHeading(step, scope)).toBe(expected);
  });

  it("falls back safely when scope data has not loaded", () => {
    expect(exploreStepHeading("subject", [null, " "])).toBe("Choose a subject");
  });
});
