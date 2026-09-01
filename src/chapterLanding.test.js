// Chapter landing pages: the copy and the indexing rule.
//
// These are the strings a search engine reads and the decision about which
// pages it is offered at all, so they are worth pinning exactly. Three callers
// share this module — the edge middleware, the React view and the sitemap
// builder — and a disagreement between them means the canonical URL says one
// thing and the sitemap another.
import { describe, expect, it } from "vitest";

import {
  MIN_INDEXABLE_COURSES, chapterLandingMeta, isIndexableChapter,
} from "./chapterLanding.js";

const SCOPE = {
  chapterName: "Kinematics",
  subjectName: "Physics",
  className: "Class 11",
  goalName: "JEE",
};

describe("which chapters are worth offering to a search engine", () => {
  it("needs a real comparison on the page", () => {
    expect(MIN_INDEXABLE_COURSES).toBe(3);
    expect(isIndexableChapter(2)).toBe(false);
    expect(isIndexableChapter(3)).toBe(true);
    expect(isIndexableChapter(22)).toBe(true);
  });

  it("treats absent or unusable counts as not indexable", () => {
    for (const value of [undefined, null, 0, "", NaN, "many"]) {
      expect(isIndexableChapter(value), String(value)).toBe(false);
    }
  });

  it("keeps a thin chapter crawlable so its links still count", () => {
    // noindex, not nofollow: the page works for anyone who follows a link, it
    // is only kept out of the index.
    expect(chapterLandingMeta({ ...SCOPE, courseCount: 1 }).robots)
      .toBe("noindex, follow");
    expect(chapterLandingMeta({ ...SCOPE, courseCount: 5 }).robots)
      .toBe("index, follow");
  });
});

describe("what the page says about itself", () => {
  it("leads with the chapter and states the count it measured", () => {
    const meta = chapterLandingMeta({ ...SCOPE, courseCount: 13 });
    expect(meta.title).toBe("Kinematics — 13 free courses for JEE Class 11 Physics");
    expect(meta.description).toContain("Compare 13 free YouTube courses covering Kinematics");
    expect(meta.indexable).toBe(true);
  });

  it("says 'course', not 'courses', for one", () => {
    expect(chapterLandingMeta({ ...SCOPE, courseCount: 1 }).title)
      .toBe("Kinematics — 1 free course for JEE Class 11 Physics");
  });

  it("omits a lane it does not know rather than guessing one", () => {
    const meta = chapterLandingMeta({
      chapterName: "Kinematics", courseCount: 4,
      goalName: null, className: null, subjectName: null,
    });
    expect(meta.title).toBe("Kinematics — 4 free courses");
    expect(meta.title).not.toMatch(/for\s*$|undefined|null/);
  });

  it("makes no claim about quality", () => {
    // The site cannot rank these — there are no ratings — so the copy must not
    // imply it can. "Compare" is a fact about the page; "best" would be a lie.
    const meta = chapterLandingMeta({ ...SCOPE, courseCount: 13 });
    expect(`${meta.title} ${meta.description}`)
      .not.toMatch(/best|top|recommended|highest.rated|ranked/i);
  });

  it("renders nothing at all for a chapter it cannot name", () => {
    expect(chapterLandingMeta({ ...SCOPE, chapterName: "", courseCount: 9 })).toBeNull();
    expect(chapterLandingMeta(null)).toBeNull();
  });

  it("degrades to an honest title when the count is unknown", () => {
    const meta = chapterLandingMeta({ ...SCOPE, courseCount: 0 });
    expect(meta.title).toBe("Kinematics — JEE Class 11 Physics");
    expect(meta.title).not.toMatch(/\b0\b/);
    expect(meta.indexable).toBe(false);
  });
});

