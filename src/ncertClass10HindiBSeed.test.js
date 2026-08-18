import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class10_hindi_b_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["jhsp101", 7], ["jhsp102", 5], ["jhsp103", 7], ["jhsp104", 6],
  ["jhsp105", 5], ["jhsp106", 5], ["jhsp107", 5], ["jhsp108", 17],
  ["jhsp109", 9], ["jhsp110", 12], ["jhsp111", 10], ["jhsp112", 8],
  ["jhsp113", 10], ["jhsp114", 10],
  ["jhsy101", 19], ["jhsy102", 12], ["jhsy103", 13],
]);

describe("NCERT Class 10 Hindi B seed", () => {
  it("contains all seventeen verified rationalised chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages},`);
    }
    expect(seed.match(/'jhs[py]\d{3}',/g)).toHaveLength(17);
    expect(seed).not.toMatch(/'jhsp1(1[5-9]|[2-9]\d)'/);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
    expect(seed).toContain("'Hindi'");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 17 materials");
    expect(seed).toContain("expected 17 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("targets only School, CBSE, Class 10 and Hindi B", () => {
    expect(seed).toContain("where slug = 'school'");
    expect(seed).toContain("where slug = 'cbse'");
    expect(seed).toContain("where slug = 'class-10'");
    expect(seed).toContain("where slug = 'hindi-b'");
    expect(seed).not.toContain("where slug = 'jee'");
    expect(seed).not.toContain("where slug = 'neet'");
  });
});
