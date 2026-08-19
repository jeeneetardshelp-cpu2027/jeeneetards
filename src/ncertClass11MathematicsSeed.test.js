import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class11_mathematics_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["kemh101", 23], ["kemh102", 19], ["kemh103", 33],
  ["kemh104", 13], ["kemh105", 11], ["kemh106", 26],
  ["kemh107", 9], ["kemh108", 16], ["kemh109", 25],
  ["kemh110", 32], ["kemh111", 9], ["kemh112", 40],
  ["kemh113", 32], ["kemh114", 25],
]);

describe("NCERT Class 11 Mathematics seed", () => {
  it("contains all fourteen verified rationalised chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages}, array[`);
    }
    expect(seed.match(/'kemh1\d{2}',/g)).toHaveLength(14);
    expect(seed).not.toMatch(/'kemh11[5-9]'/);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 14 materials");
    expect(seed).toContain("expected 38 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("maps combined chapters and adds the two missing exact nodes", () => {
    expect(seed).toContain("array['complex-numbers', 'quadratic-equations']");
    expect(seed).toContain("array['circles', 'parabola', 'ellipse', 'hyperbola']");
    expect(seed).toContain("array['limits-continuity-and-differentiability', 'differentiation']");
    expect(seed).toContain("'Sets', 'sets'");
    expect(seed).toContain("'Linear Inequalities', 'linear-inequalities'");
    expect(seed).toContain("where slug = 'jee'");
    expect(seed).toContain("where slug = 'school'");
    expect(seed).not.toContain("where slug = 'neet'");
  });
});
