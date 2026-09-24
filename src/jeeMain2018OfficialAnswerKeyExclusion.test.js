import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const exclusion = readFileSync(
  "docs/study-materials/jee-main-2018-official-answer-key-exclusion-2026-09-15.md",
  "utf8",
);

describe("JEE Main 2018 official answer-key exclusion", () => {
  it("anchors the decision to the preserved official bulletin and homepage", () => {
    expect(exclusion).toContain(
      "https://web.archive.org/web/20180823205033id_/https://jeemain.nic.in/WebInfo/Handler/FileHandler.ashx?i=File&ii=88&iii=Y",
    );
    expect(exclusion).toContain(
      "https://web.archive.org/web/20180430165923id_/https://jeemain.nic.in/webinfo/Public/Home.aspx",
    );
    expect(exclusion).toContain("from 24 to 27 April 2018");
    expect(exclusion).toMatch(/stable public\s+answer-key PDF/);
  });

  it("records the inspected official-host PDF as a notice rather than a key", () => {
    expect(exclusion).toContain(
      "https://web.archive.org/web/20180430144139id_/https://jeemain.nic.in/WebInfo/Handler/FileHandler.ashx?i=File&ii=93&iii=Y",
    );
    expect(exclusion).toContain("two-page notice");
    expect(exclusion).toContain("dated 9 March 2018");
    expect(exclusion).toContain("No complete public Paper 1 answer-key PDF");
  });

  it("fails closed instead of substituting unofficial material", () => {
    expect(exclusion).toContain("No JEE Main 2018 Paper 1 answer key or worked solution");
    expect(exclusion).toContain("No coaching-site key");
    expect(exclusion).toContain("candidate response record");
    expect(exclusion).toContain("third-party worked solution");
    expect(exclusion).toMatch(/permission that\s+clearly covers redistribution/);
  });

  it("stays aligned with the official-paper exclusion", () => {
    expect(exclusion).toContain("separate 2018 question-paper exclusion remains unchanged");
    expect(exclusion).toMatch(/complete\s+official Paper 1 set is unavailable/);
    expect(exclusion).toMatch(/no answer key is attached to an\s+incomplete or unofficial paper record/);
  });
});
