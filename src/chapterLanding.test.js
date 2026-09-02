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
  isIndexableChapterScope, canonicalChapterView,
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

  // Dropper is the union of Class 11 and Class 12, so a Dropper chapter page
  // is nearly always a second address for a class page: 171 of 177 in
  // production rendered identical courses. One address per chapter, and it
  // is the class one — that is what a student types into a search box.
  it("offers a chapter under its class, never under Dropper", () => {
    expect(isIndexableChapterScope("class-11")).toBe(true);
    expect(isIndexableChapterScope("11")).toBe(true);
    expect(isIndexableChapterScope("class-12")).toBe(true);
    expect(isIndexableChapterScope("dropper")).toBe(false);
  });

  // `verified` is what a caller passes once it has CONFIRMED the chapter
  // against the catalogue. Without it a chapter view is never indexable, so
  // every case below that expects "index, follow" must supply one.
  const VERIFIED = { chapterName: "Kinematics", courseCount: 13 };

  it("marks the Dropper chapter view noindex while the class view stays indexable", () => {
    const view = (cls) => canonicalChapterView(
      new URLSearchParams(`goal=jee&class=${cls}&subject=physics&chapter=kinematics`),
      (v) => v,
      VERIFIED,
    );
    expect(view("11").robots).toBe("index, follow");
    // Crawlable, not indexed: the page works for anyone who follows a link.
    expect(view("dropper").robots).toBe("noindex, follow");
    // Still a canonical chapter shape — the title and query are unchanged.
    expect(view("dropper").query).toBe("goal=jee&class=dropper&subject=physics&chapter=kinematics");
  });

  it("never indexes a chapter no caller has confirmed exists", () => {
    // The regression this guards: the shape check bounds the query KEYS, and
    // that was mistaken for bounding the space. A fabricated slug came back
    // "index, follow" under an invented title, so anyone could mint unlimited
    // indexable soft-404s — measured live on production before this fix.
    const fabricated = canonicalChapterView(
      new URLSearchParams("goal=banana&class=11&subject=physics&chapter=not-a-real-chapter-xyz"),
    );
    expect(fabricated.robots).toBe("noindex, follow");

    // And a REAL chapter is equally unindexable until someone confirms it —
    // the URL is identical either way, which is the whole point.
    const unconfirmed = canonicalChapterView(
      new URLSearchParams("goal=jee&class=11&subject=physics&chapter=kinematics"),
    );
    expect(unconfirmed.robots).toBe("noindex, follow");
  });

  it("uses the catalogue's own chapter name, not the URL's prettified slug", () => {
    const view = canonicalChapterView(
      new URLSearchParams("goal=jee&class=11&subject=physics&chapter=rotational-motion"),
      (v) => v,
      { chapterName: "Rotational Motion", courseCount: 8 },
    );
    expect(view.title).toContain("Rotational Motion");
    expect(view.title).toContain("8 free courses");
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

