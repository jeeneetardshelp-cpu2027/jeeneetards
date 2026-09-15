import { describe, expect, it } from "vitest";
import { RETIRED_FACULTY_SLUGS, retiredFacultyTarget } from "./retiredFacultySlugs.js";

// The same shape the slug trigger produces: lowercase words joined by hyphens.
const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("retired faculty slugs", () => {
  const entries = Object.entries(RETIRED_FACULTY_SLUGS);

  it("lists exactly the 40 duplicate profiles removed on 2026-09-15", () => {
    expect(entries).toHaveLength(40);
    expect(entries.filter(([from]) => from.endsWith("-2"))).toHaveLength(31);
  });

  it("uses real slug shapes on both sides", () => {
    for (const [from, to] of entries) {
      expect(from).toMatch(SLUG_SHAPE);
      expect(to).toMatch(SLUG_SHAPE);
    }
  });

  it("never points a slug at itself or at another retired slug", () => {
    for (const [from, to] of entries) {
      expect(to).not.toBe(from);
      expect(Object.hasOwn(RETIRED_FACULTY_SLUGS, to)).toBe(false);
    }
  });

  it("sends each numbered copy to the slug it was numbered after", () => {
    for (const [from, to] of entries.filter(([slug]) => slug.endsWith("-2"))) {
      expect(to).toBe(from.slice(0, -"-2".length));
    }
  });

  it("cannot be changed at runtime", () => {
    expect(Object.isFrozen(RETIRED_FACULTY_SLUGS)).toBe(true);
  });

  it("answers only its own entries", () => {
    expect(retiredFacultyTarget("abj")).toBe("amit-bijarnia");
    expect(retiredFacultyTarget("alakh-pandey-2")).toBe("alakh-pandey");
    expect(retiredFacultyTarget("amit-bijarnia")).toBeNull();
    expect(retiredFacultyTarget("constructor")).toBeNull();
    expect(retiredFacultyTarget("toString")).toBeNull();
  });
});
