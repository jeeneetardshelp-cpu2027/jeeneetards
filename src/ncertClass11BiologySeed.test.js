import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class11_biology_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["kebo101", 9], ["kebo102", 13], ["kebo103", 14],
  ["kebo104", 18], ["kebo105", 16], ["kebo106", 8],
  ["kebo107", 6], ["kebo108", 19], ["kebo109", 16],
  ["kebo110", 11], ["kebo111", 22], ["kebo112", 13],
  ["kebo113", 15], ["kebo114", 12], ["kebo115", 12],
  ["kebo116", 12], ["kebo117", 13], ["kebo118", 9],
  ["kebo119", 14],
]);

describe("NCERT Class 11 Biology seed", () => {
  it("contains all nineteen verified rationalised chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages},`);
    }
    expect(seed.match(/'kebo1\d{2}',/g)).toHaveLength(19);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 19 materials");
    expect(seed).toContain("expected 38 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("targets NEET and CBSE Class 11 without adding Biology to JEE", () => {
    expect(seed).toContain("where slug = 'neet'");
    expect(seed).toContain("where slug = 'school'");
    expect(seed).toContain("where slug = 'cbse'");
    expect(seed).toContain("where slug = 'class-11'");
    expect(seed).toContain("where slug = 'biology'");
    expect(seed).not.toContain("where slug = 'jee'");
  });
});
