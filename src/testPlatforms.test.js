// Guards the mock-test directory's data invariants.
//
// This file exists because testPlatforms.js is edited BY HAND every time a
// new test source is added. A typo there ships a dead or unsafe link to
// students, and no component test would catch it — the page renders whatever
// it is given. These assertions are the check.

import { describe, it, expect } from "vitest";
import { TEST_SECTIONS, totalTestResources, linkHost } from "./testPlatforms.js";
import { metadataForLocation } from "./pageMetadata.js";

const allResources = TEST_SECTIONS.flatMap((s) =>
  s.resources.map((r) => ({ ...r, section: s.id })),
);

describe("test sections", () => {
  it("covers the six exams the page promises", () => {
    expect(TEST_SECTIONS.map((s) => s.id)).toEqual([
      "jee-main",
      "jee-advanced",
      "neet",
      "olympiad",
      "class-10",
      "class-12",
    ]);
  });

  it("gives every section an id, label and blurb", () => {
    for (const s of TEST_SECTIONS) {
      expect(s.id, "id").toMatch(/^[a-z0-9-]+$/);
      expect(s.label?.trim(), `${s.id} label`).toBeTruthy();
      expect(s.blurb?.trim(), `${s.id} blurb`).toBeTruthy();
      expect(Array.isArray(s.resources), `${s.id} resources`).toBe(true);
    }
  });

  it("uses section ids that are unique (they are anchor targets)", () => {
    const ids = TEST_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("test resources", () => {
  it("has at least the JEE Main entry we launched with", () => {
    const jeeMain = TEST_SECTIONS.find((s) => s.id === "jee-main");
    expect(jeeMain.resources.length).toBeGreaterThanOrEqual(1);
    expect(jeeMain.resources.some((r) => r.url === "https://www.nta.ac.in/Quiz")).toBe(
      true,
    );
  });

  it("describes every resource fully", () => {
    for (const r of allResources) {
      expect(r.name?.trim(), `${r.url} name`).toBeTruthy();
      expect(r.provider?.trim(), `${r.url} provider`).toBeTruthy();
      expect(r.description?.trim(), `${r.url} description`).toBeTruthy();
    }
  });

  it("only links over https to a parseable absolute URL", () => {
    // http:// would be downgraded/blocked from an https page, and a relative
    // path would silently point back at JEENEETARD instead of the platform.
    for (const r of allResources) {
      expect(() => new URL(r.url), `${r.url} parses`).not.toThrow();
      expect(new URL(r.url).protocol, `${r.url} scheme`).toBe("https:");
    }
  });

  it("never lists the same URL twice", () => {
    const urls = allResources.map((r) => r.url);
    expect(new Set(urls).size, `duplicates in ${urls.join(", ")}`).toBe(urls.length);
  });

  it("keeps `official` a real boolean claim, not a marketing flag", () => {
    for (const r of allResources) {
      if ("official" in r) expect(typeof r.official, `${r.url}`).toBe("boolean");
    }
    // The one official entry today is the exam conductor itself.
    const official = allResources.filter((r) => r.official);
    for (const r of official) expect(r.provider).toMatch(/NTA|Board|Agency|Ministry/i);
  });

  it("counts what it actually holds", () => {
    expect(totalTestResources()).toBe(allResources.length);
  });
});

describe("linkHost", () => {
  it("strips the scheme and www so a student sees the destination", () => {
    expect(linkHost("https://www.nta.ac.in/Quiz")).toBe("nta.ac.in");
    expect(linkHost("https://quizrr.in/test")).toBe("quizrr.in");
  });

  it("degrades to the raw string instead of throwing on a bad entry", () => {
    expect(linkHost("not a url")).toBe("not a url");
    expect(linkHost(null)).toBe("");
  });
});

describe("/tests page metadata", () => {
  it("is indexable and self-canonical", () => {
    const meta = metadataForLocation("/tests", "");
    expect(meta.canonicalPath).toBe("/tests");
    expect(meta.robots).toBe("index, follow");
  });

  it("names the exams students actually search for", () => {
    const { title, description } = metadataForLocation("/tests", "");
    expect(title).toContain("JEENEETARD");
    expect(description).toMatch(/JEE Main/);
    expect(description).toMatch(/NEET/);
  });

  it("does not turn the trailing-slash form into a 404", () => {
    expect(metadataForLocation("/tests/", "").canonicalPath).toBe("/tests");
  });
});
