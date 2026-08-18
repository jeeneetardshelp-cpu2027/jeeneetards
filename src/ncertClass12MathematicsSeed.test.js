import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class12_mathematics_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["lemh101", 17], ["lemh102", 16], ["lemh103", 42],
  ["lemh104", 28], ["lemh105", 43], ["lemh106", 40],
  ["lemh201", 67], ["lemh202", 8], ["lemh203", 38],
  ["lemh204", 39], ["lemh205", 17], ["lemh206", 12],
  ["lemh207", 33],
]);

describe("NCERT Class 12 Mathematics seed", () => {
  it("contains all thirteen verified rationalised chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages}, array[`);
    }
    expect(seed.match(/'lemh(?:1|2)\d{2}',/g)).toHaveLength(13);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
    expect(seed).toContain("Linked only; not mirrored or redistributed");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 13 materials");
    expect(seed).toContain("expected 32 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("maps split lecture topics and adds the missing Linear Programming node", () => {
    expect(seed).toContain("array['limits-continuity-and-differentiability', 'continuity', 'differentiation']");
    expect(seed).toContain("array['indefinite-integration', 'definite-integration']");
    expect(seed.match(/array\['vectors-and-three-dimensional-geometry'\]/g)).toHaveLength(2);
    expect(seed).toContain("'Linear Programming', 'linear-programming'");
    expect(seed).toContain("where slug = 'jee'");
    expect(seed).toContain("where slug = 'school'");
    expect(seed).toContain("where slug = 'cbse'");
    expect(seed).not.toContain("where slug = 'neet'");
  });
});
