// Tests for the strict class-filter logic that backs the guided Explore
// cascade. These cover review requirements 1–3 (a JEE/Class-11 playlist shows
// under Class 11, not Class 12; an unclassified playlist shows nowhere).
//
// Run: npm test
//
// Requirements 4–7 (no duplicate rows on re-import, classification sync,
// full rollback on failure, preserved multi-goal/multi-class on reused
// videos) are guarantees of the import_playlist RPC and are exercised as
// integration checks against the live function — see the import_rpc migration.

import { describe, it, expect } from "vitest";
import { playlistMatchesClass, CLASS_LEVELS_BY_GOAL } from "./classLevels.js";

describe("playlistMatchesClass (strict)", () => {
  it("1. a Class-11 playlist matches Class 11", () => {
    expect(playlistMatchesClass("11th", ["11th"])).toBe(true);
  });

  it("2. a Class-11 playlist does NOT match Class 12", () => {
    expect(playlistMatchesClass("12th", ["11th"])).toBe(false);
  });

  it("3. an unclassified playlist matches nothing", () => {
    for (const cls of ["10th", "11th", "12th", "Dropper"]) {
      expect(playlistMatchesClass(cls, [])).toBe(false);
      expect(playlistMatchesClass(cls, null)).toBe(false);
    }
  });

  it("Dropper includes Class 11 & 12 material, but a specific class does not include Dropper-only", () => {
    expect(playlistMatchesClass("Dropper", ["11th"])).toBe(true);
    expect(playlistMatchesClass("Dropper", ["12th"])).toBe(true);
    expect(playlistMatchesClass("Dropper", ["Dropper"])).toBe(true);
    expect(playlistMatchesClass("11th", ["Dropper"])).toBe(false);
  });
});

describe("valid class levels per learning goal", () => {
  it("entrance exams never offer Class 10", () => {
    for (const goal of ["jee", "neet", "olympiad"]) {
      expect(CLASS_LEVELS_BY_GOAL[goal]).not.toContain("class-10");
      expect(CLASS_LEVELS_BY_GOAL[goal]).toEqual(
        expect.arrayContaining(["class-11", "class-12", "dropper"])
      );
    }
  });

  it("school boards include Class 10", () => {
    expect(CLASS_LEVELS_BY_GOAL.school).toContain("class-10");
  });
});
