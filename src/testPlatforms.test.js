// Guards the mock-test directory's data invariants.
//
// This file exists because testPlatforms.js is edited BY HAND every time a
// new test source is added. A typo there ships a dead or unsafe link to
// students, and no component test would catch it — the page renders whatever
// it is given. These assertions are the check.

import { describe, it, expect } from "vitest";
import {
  TEST_SECTIONS,
  ACCESS,
  totalTestResources,
  freeTestResources,
  sectionIsAllFree,
  linkHost,
} from "./testPlatforms.js";
import { renderTestsBody, renderExamTestsBody } from "../ogInject.js";
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

  // Per SECTION, not globally: one platform can legitimately run tests for
  // several exams (Quizrr covers both JEE Main and JEE Advanced), and listing
  // it under each is correct. Twice inside one section is the real bug.
  it("never lists the same URL twice within a section", () => {
    for (const s of TEST_SECTIONS) {
      const urls = s.resources.map((r) => r.url);
      expect(new Set(urls).size, `duplicate in ${s.id}: ${urls.join(", ")}`).toBe(
        urls.length,
      );
    }
  });

  // The directory lists paid products alongside free ones. The whole safety
  // of that rests on the badge, so an entry without a valid `access` must
  // fail here rather than render as an unlabelled card a student reads as free.
  it("labels every resource with a valid access level", () => {
    for (const r of allResources) {
      expect(Object.keys(ACCESS), `${r.url} access`).toContain(r.access);
    }
  });

  it("never lets a paid source be described as free", () => {
    for (const r of allResources.filter((x) => x.access === "paid")) {
      expect(r.description, `${r.url}`).not.toMatch(/\bfree\b/i);
      expect(r.name, `${r.url}`).not.toMatch(/\bfree\b/i);
    }
  });

  it("counts free sources without counting the paid ones", () => {
    const paid = allResources.filter((r) => r.access === "paid").length;
    expect(freeTestResources()).toBe(allResources.length - paid);
    expect(paid).toBeGreaterThan(0); // the distinction is actually exercised
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

// The site server-renders body content for every public landing so the AI
// crawlers (GPTBot, ClaudeBot, PerplexityBot) — which do not run JavaScript —
// can read it. /tests shipped without that and served them a blank page.
describe("crawler-readable /tests body", () => {
  it("names every section, so coverage is readable without JavaScript", () => {
    const html = renderTestsBody({ description: "d" });
    for (const s of TEST_SECTIONS) expect(html).toContain(s.label);
  });

  it("includes the real outbound link for sections that have one", () => {
    const html = renderTestsBody({ description: "d" });
    for (const r of TEST_SECTIONS.flatMap((s) => s.resources)) {
      expect(html).toContain(r.url);
      expect(html).toContain(r.provider);
    }
  });

  it("says an empty section is empty rather than omitting it", () => {
    const html = renderTestsBody({ description: "d" });
    const empty = TEST_SECTIONS.filter((s) => !s.resources.length);
    expect(empty.length).toBeGreaterThan(0);
    for (const s of empty) {
      // The label is now a link to the exam's own page, so match on the
      // statement rather than on "Label: ..." being adjacent text.
      expect(html).toContain(`>${s.label}</a>: no test source listed yet`);
    }
  });

  it("links every exam to its own page, for crawlers that cannot run JS", () => {
    const html = renderTestsBody({ description: "d" });
    for (const s of TEST_SECTIONS) {
      expect(html).toContain(`href="/tests/${s.id}"`);
    }
  });

  it("states we do not conduct the tests, in the served HTML", () => {
    expect(renderTestsBody({ description: "d" })).toMatch(
      /does not conduct these tests/i,
    );
  });

  it("escapes data rather than interpolating it raw", () => {
    // A future entry with an ampersand or quote must not break the markup.
    const html = renderTestsBody({ description: 'a & "b"' });
    expect(html).toContain("a &amp; &quot;b&quot;");
    expect(html).not.toContain('a & "b"');
  });
});

describe("cost is visible to non-JS crawlers too", () => {
  it("puts the access label next to every link in the served HTML", () => {
    const html = renderTestsBody({ description: "d" });
    for (const r of TEST_SECTIONS.flatMap((s) => s.resources)) {
      expect(html).toContain(ACCESS[r.access].label);
    }
  });

  it("does not let a model read the paid series as free", () => {
    const html = renderTestsBody({ description: "d" });
    const paid = TEST_SECTIONS.flatMap((s) => s.resources).filter(
      (r) => r.access === "paid",
    );
    expect(paid.length).toBeGreaterThan(0);
    for (const r of paid) {
      // Locate the paid entry's own list item and assert the label rides
      // along inside it — string slicing rather than a built regex, so a
      // provider name containing regex metacharacters cannot break the test.
      const at = html.indexOf(r.url);
      expect(at, `${r.url} missing from served HTML`).toBeGreaterThan(-1);
      const entry = html.slice(at, html.indexOf("</li>", at));
      expect(entry, `${r.provider} not marked Paid`).toContain("Paid");
      expect(entry).not.toMatch(/\bFree\b/);
    }
  });
});

// Each exam is its own page so it can own a title, description and canonical.
// That is the entire point of the split — assert it actually happened.
describe("/tests/:examId metadata", () => {
  it("gives every exam a self-canonical URL", () => {
    for (const s of TEST_SECTIONS) {
      expect(metadataForLocation(`/tests/${s.id}`, "").canonicalPath).toBe(
        `/tests/${s.id}`,
      );
    }
  });

  it("gives every exam a distinct title naming that exam", () => {
    const titles = TEST_SECTIONS.map(
      (s) => metadataForLocation(`/tests/${s.id}`, "").title,
    );
    expect(new Set(titles).size).toBe(titles.length);
    for (const s of TEST_SECTIONS) {
      expect(metadataForLocation(`/tests/${s.id}`, "").title).toContain(s.label);
    }
  });

  it("only says 'Free' when nothing on that page costs money", () => {
    for (const s of TEST_SECTIONS) {
      const { title } = metadataForLocation(`/tests/${s.id}`, "");
      const hasPaid = s.resources.some((r) => r.access === "paid");
      if (hasPaid) expect(title, `${s.id}`).not.toMatch(/^Free/);
      if (sectionIsAllFree(s)) expect(title, `${s.id}`).toMatch(/^Free/);
    }
  });

  it("does not ask Google to index an exam with nothing on it", () => {
    for (const s of TEST_SECTIONS) {
      const { robots } = metadataForLocation(`/tests/${s.id}`, "");
      expect(robots, `${s.id}`).toBe(
        s.resources.length ? "index, follow" : "noindex, follow",
      );
    }
  });

  it("treats an unknown exam as a real 404, not a page", () => {
    const meta = metadataForLocation("/tests/not-an-exam", "");
    expect(meta.title).toMatch(/not found/i);
    expect(meta.robots).toBe("noindex, nofollow");
  });
});

// `findIt` exists because a link that lands on a dashboard strands the
// student. If it is present it must be usable, and it must reach the pages.
describe("findIt navigation hints", () => {
  const withHint = allResources.filter((r) => r.findIt);

  it("is in use for at least one app-based source", () => {
    expect(withHint.length).toBeGreaterThan(0);
  });

  it("is a non-empty string naming a real step", () => {
    for (const r of withHint) {
      expect(typeof r.findIt, `${r.url}`).toBe("string");
      expect(r.findIt.trim().length, `${r.url}`).toBeGreaterThan(10);
    }
  });

  it("reaches the crawler-readable exam HTML", () => {
    for (const section of TEST_SECTIONS) {
      const hinted = section.resources.filter((r) => r.findIt);
      if (!hinted.length) continue;
      const html = renderExamTestsBody(section, { description: "d" });
      for (const r of hinted) expect(html).toContain("Find it:");
    }
  });

  it("escapes the quotes a course name usually contains", () => {
    // The Competishun hint quotes a course title; unescaped it would break
    // out of the surrounding markup.
    const section = TEST_SECTIONS.find((s) =>
      s.resources.some((r) => r.findIt?.includes('"')),
    );
    if (!section) return;
    const html = renderExamTestsBody(section, { description: "d" });
    expect(html).toContain("&quot;");
  });
});
