import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class10_mathematics_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["jemh101", 9], ["jemh102", 14], ["jemh103", 14],
  ["jemh104", 11], ["jemh105", 24], ["jemh106", 26],
  ["jemh107", 14], ["jemh108", 20], ["jemh109", 11],
  ["jemh110", 10], ["jemh111", 7], ["jemh112", 10],
  ["jemh113", 31], ["jemh114", 16],
]);

describe("NCERT Class 10 Mathematics seed", () => {
  it("contains all fourteen verified rationalised chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages},`);
    }
    expect(seed.match(/'jemh1\d{2}',/g)).toHaveLength(14);
    expect(seed).not.toMatch(/'jemh11[5-9]'/);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 14 materials");
    expect(seed).toContain("expected 14 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("targets only School, CBSE, Class 10 and Mathematics", () => {
    expect(seed).toContain("where slug = 'school'");
    expect(seed).toContain("where slug = 'cbse'");
    expect(seed).toContain("where slug = 'class-10'");
    expect(seed).toContain("where slug = 'mathematics'");
    expect(seed).not.toContain("where slug = 'jee'");
    expect(seed).not.toContain("where slug = 'neet'");
  });
});
