import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class12_biology_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["lebo101", 25], ["lebo102", 15], ["lebo103", 10],
  ["lebo104", 28], ["lebo105", 31], ["lebo106", 17],
  ["lebo107", 22], ["lebo108", 12], ["lebo109", 16],
  ["lebo110", 11], ["lebo111", 17], ["lebo112", 11],
  ["lebo113", 13],
]);

describe("NCERT Class 12 Biology seed", () => {
  it("contains all thirteen verified rationalised chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages},`);
    }
    expect(seed.match(/'lebo1\d{2}',/g)).toHaveLength(13);
    expect(seed).not.toMatch(/'lebo11[4-9]'/);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 13 materials");
    expect(seed).toContain("expected 26 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("targets NEET and CBSE Class 12 without adding Biology to JEE", () => {
    expect(seed).toContain("where slug = 'neet'");
    expect(seed).toContain("where slug = 'school'");
    expect(seed).toContain("where slug = 'cbse'");
    expect(seed).toContain("where slug = 'class-12'");
    expect(seed).toContain("where slug = 'biology'");
    expect(seed).not.toContain("where slug = 'jee'");
  });
});
