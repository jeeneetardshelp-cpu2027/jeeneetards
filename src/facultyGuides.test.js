import { describe, expect, it } from "vitest";
import { FACULTY_GUIDES, getFacultyGuide } from "./facultyGuides.js";

const PILOT_SLUGS = [
  "amit-bijarnia",
  "alok-kumar",
  "mohit-tyagi",
  "anoop-vashishtha",
  "pradeep-singh",
];

describe("source-backed faculty guides", () => {
  it("contains only the five reviewed pilot profiles", () => {
    expect(Object.keys(FACULTY_GUIDES).sort()).toEqual([...PILOT_SLUGS].sort());
  });

  it.each(PILOT_SLUGS)("keeps %s complete and publicly sourced", (slug) => {
    const guide = getFacultyGuide(slug);
    expect(guide.metaDescription.length).toBeGreaterThan(80);
    expect(guide.metaDescription.length).toBeLessThanOrEqual(160);
    expect(guide.summary.length).toBeGreaterThan(80);
    expect(guide.facts.length).toBeGreaterThanOrEqual(3);
    expect(guide.sources.length).toBeGreaterThanOrEqual(2);
    expect(guide.sources.every((source) => /^https:\/\//.test(source.href))).toBe(true);
    expect(new Set(guide.sources.map((source) => source.href)).size)
      .toBe(guide.sources.length);
    expect(guide.sourceChecked).toBe("2026-08-25");
  });

  it("does not invent a guide for an unreviewed slug", () => {
    expect(getFacultyGuide("not-reviewed")).toBeNull();
  });
});
