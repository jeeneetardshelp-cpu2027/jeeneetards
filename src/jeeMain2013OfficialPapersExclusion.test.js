import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const exclusion = readFileSync(
  "docs/study-materials/jee-main-2013-official-papers-exclusion-2026-08-13.md",
  "utf8",
);

describe("JEE Main 2013 official-paper exclusion", () => {
  it("records the complete official Paper 1 schedule", () => {
    expect(exclusion).toContain("7 April 2013 - offline");
    expect(exclusion).toContain("9 April 2013 - online");
    expect(exclusion).toContain("22 April 2013 - online");
    expect(exclusion).toContain("23 April 2013 - online");
    expect(exclusion).toContain("25 April 2013 - online");
    expect(exclusion).toContain("different question-paper sets");
    expect(exclusion).toContain("Mathematics, Physics and Chemistry");
  });

  it("anchors the decision to independent official CBSE evidence", () => {
    expect(exclusion).toContain(
      "https://web.archive.org/web/20130405000000id_/https://www.cbse.gov.in/pub%20not%201_jee13_2013.pdf",
    );
    expect(exclusion).toContain(
      "https://www.cbse.gov.in/cbsenew/annual-report/CBSE_Annual_Report_2013-14.pdf",
    );
    expect(exclusion).toContain("relevant JEE Main pages 30-31 were rendered");
    expect(exclusion).toContain("original `jeemain.nic.in`");
  });

  it("fails closed instead of substituting unofficial reconstructions", () => {
    expect(exclusion).toContain("No JEE Main 2013 B.E./B.Tech. Paper 1 PDF");
    expect(exclusion).toContain("official-source-only");
    expect(exclusion).toContain("None was substituted");
    expect(exclusion).toMatch(/all five complete\s+official Paper 1 sets/);
    expect(exclusion).toContain("hashed, page-counted and visually");
  });

  it("distinguishes the existing JEE Advanced records from missing JEE Main", () => {
    expect(exclusion).toMatch(/two 2013\s+previous-year papers/);
    expect(exclusion).toContain("both correctly identified as JEE Advanced");
    expect(exclusion).toContain("no JEE Main 2013 Paper 1 record");
  });
});
