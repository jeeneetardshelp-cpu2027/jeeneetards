import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class10_english_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["jeff101", 15], ["jeff102", 16], ["jeff103", 16],
  ["jeff104", 15], ["jeff105", 17], ["jeff106", 14],
  ["jeff107", 17], ["jeff108", 9], ["jeff109", 21],
  ["jefp101", 7], ["jefp102", 6], ["jefp103", 6],
  ["jefp104", 6], ["jefp105", 6], ["jefp106", 7],
  ["jefp107", 8], ["jefp108", 9], ["jefp109", 15],
]);

describe("NCERT Class 10 English seed", () => {
  it("contains all eighteen verified rationalised chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages},`);
    }
    expect(seed.match(/'(jeff|jefp)1\d{2}',/g)).toHaveLength(18);
    expect(seed).not.toMatch(/'(jeff|jefp)11[0-9]'/);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 18 materials");
    expect(seed).toContain("expected 18 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("targets only School, CBSE, Class 10 and English", () => {
    expect(seed).toContain("where slug = 'school'");
    expect(seed).toContain("where slug = 'cbse'");
    expect(seed).toContain("where slug = 'class-10'");
    expect(seed).toContain("where slug = 'english'");
    expect(seed).not.toContain("where slug = 'jee'");
    expect(seed).not.toContain("where slug = 'neet'");
  });
});
