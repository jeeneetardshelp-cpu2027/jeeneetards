// examLectureLinks: the way back from a mock test or a past paper to the
// lectures for the chapter a student just lost marks in.
//
// Crawler-body assertions live here rather than in middlewareSeo.test.js on
// purpose: they test the pure render functions, and keeping them out of that
// file keeps this change clear of other work editing it.
import { describe, expect, it } from "vitest";
import {
  LECTURE_LINK_PROMPT,
  lectureLinkForExam,
  lectureLinkText,
} from "./examLectureLinks.js";
import { TEST_SECTIONS, findTestSection } from "./testPlatforms.js";
import { PAPER_LANDINGS } from "./studyMaterialLandings.js";
import { renderExamTestsBody, renderPaperYearBody } from "../ogInject.js";

// learning_goals in production, read with the anon key on 15 Sep 2026. A link
// to a goal outside this list would land on Explore's "not found" state.
const LIVE_GOAL_SLUGS = ["jee", "neet", "olympiad", "school"];
const meta = { description: "Test description." };

describe("which exams link back to lectures", () => {
  it("sends both JEE exams to the JEE chapter picker and NEET to NEET's", () => {
    expect(lectureLinkForExam("jee-main")?.path).toBe("/explore/jee");
    expect(lectureLinkForExam("jee-advanced")?.path).toBe("/explore/jee");
    expect(lectureLinkForExam("neet")?.path).toBe("/explore/neet");
  });

  it("leaves boards and olympiad unlinked instead of guessing a board or lane", () => {
    for (const id of ["class-10", "class-12", "olympiad"]) {
      expect(lectureLinkForExam(id), id).toBeNull();
    }
  });

  it("returns null for unknown ids and inherited object keys", () => {
    for (const id of ["nope", "constructor", "__proto__", "toString", "", null, undefined, 5]) {
      expect(lectureLinkForExam(id), String(id)).toBeNull();
    }
  });

  it("only ever points at an Explore goal that exists", () => {
    const ids = [...TEST_SECTIONS.map((s) => s.id), ...PAPER_LANDINGS.map((l) => l.id)];
    const linked = ids.map(lectureLinkForExam).filter(Boolean);
    expect(linked.length).toBeGreaterThan(0);
    for (const link of linked) {
      const [, root, slug, extra] = link.path.split("/");
      expect(root).toBe("explore");
      expect(extra).toBeUndefined();
      expect(LIVE_GOAL_SLUGS).toContain(slug);
    }
  });

  it("names the goal in the link text", () => {
    expect(lectureLinkText(lectureLinkForExam("neet"))).toBe("Find NEET lectures by chapter");
    expect(lectureLinkText(lectureLinkForExam("jee-main"))).toBe("Find JEE lectures by chapter");
  });
});

describe("crawlers get the same link the page shows", () => {
  it("puts the link in a mapped exam's mock-test body", () => {
    const html = renderExamTestsBody(findTestSection("jee-advanced"), meta);
    expect(html).toContain(
      `<p>${LECTURE_LINK_PROMPT} <a href="/explore/jee">Find JEE lectures by chapter</a></p>`,
    );
  });

  it("sends NEET's mock-test body to NEET lectures", () => {
    const html = renderExamTestsBody(findTestSection("neet"), meta);
    expect(html).toContain('<a href="/explore/neet">Find NEET lectures by chapter</a>');
    expect(html).not.toContain('href="/explore/jee"');
  });

  it("adds nothing to an unmapped exam's mock-test body", () => {
    const html = renderExamTestsBody(findTestSection("class-12"), meta);
    expect(html).not.toContain("/explore/");
    expect(html).not.toContain(LECTURE_LINK_PROMPT);
  });

  it("puts the matching link in every mapped paper-year body", () => {
    const mapped = PAPER_LANDINGS.filter((landing) => lectureLinkForExam(landing.id));
    // Today every registered paper landing is a JEE or NEET exam. If that stops
    // being true, this count says so instead of the loop quietly doing nothing.
    expect(mapped.map((landing) => landing.id).sort()).toEqual(["jee-advanced", "jee-main", "neet"]);
    for (const landing of mapped) {
      const html = renderPaperYearBody(meta, { landing, year: 2024 }, []);
      expect(html, landing.id).toContain(
        `<a href="${lectureLinkForExam(landing.id).path}">${lectureLinkText(lectureLinkForExam(landing.id))}</a>`,
      );
    }
  });
});
