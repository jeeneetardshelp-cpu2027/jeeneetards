import { describe, expect, it } from "vitest";
import {
  buildChapterClassScopeReport,
  chapterMatchesClassScope,
} from "./chapterClassScopeAudit.js";

const chapter = (entity_id, slug, name = slug) => ({ entity_id, slug, name });

describe("chapter/class cross-product audit", () => {
  it("lets reviewed chapter scope override a mixed-class playlist", () => {
    expect(chapterMatchesClassScope({
      selectedClass: "class-11",
      canonicalClasses: ["class-12"],
      playlistClasses: ["class-11", "class-12"],
    })).toBe(false);
    expect(chapterMatchesClassScope({
      selectedClass: "class-12",
      canonicalClasses: ["class-12"],
      playlistClasses: ["class-11"],
    })).toBe(true);
  });

  it("falls back for unreviewed chapters and preserves Dropper semantics", () => {
    expect(chapterMatchesClassScope({
      selectedClass: "class-11",
      playlistClasses: ["class-11"],
    })).toBe(true);
    expect(chapterMatchesClassScope({
      selectedClass: "dropper",
      canonicalClasses: ["class-12"],
      playlistClasses: ["class-11"],
    })).toBe(true);
    expect(chapterMatchesClassScope({
      selectedClass: "dropper",
      canonicalClasses: ["class-12"],
      playlistClasses: ["class-10"],
    })).toBe(false);
  });

  it("identifies chapters exposed under more than one academic class", () => {
    const kinematics = chapter(1, "kinematics", "Kinematics");
    const optics = chapter(2, "ray-optics", "Ray Optics");
    const report = buildChapterClassScopeReport(
      [kinematics, optics],
      {
        "class-10": [],
        "class-11": [kinematics, optics],
        "class-12": [optics],
      },
    );

    expect(report.totals).toEqual({
      chapters: 2, class10: 0, class11: 2, class12: 1, multiClass: 1, unclassified: 0,
    });
    expect(report.multiClass).toEqual([{
      id: 2, slug: "ray-optics", name: "Ray Optics", classes: ["class-11", "class-12"],
    }]);
  });

  it("keeps truly unclassified reference chapters visible in the report", () => {
    const empty = chapter(9, "future-chapter", "Future chapter");
    const report = buildChapterClassScopeReport(
      [empty],
      { "class-10": [], "class-11": [], "class-12": [] },
    );

    expect(report.totals.unclassified).toBe(1);
    expect(report.unclassified[0]).toMatchObject({ slug: "future-chapter", classes: [] });
  });
});
