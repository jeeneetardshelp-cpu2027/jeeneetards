import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class10_hindi_a_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["jhks101", 9], ["jhks102", 7], ["jhks103", 5], ["jhks104", 6],
  ["jhks105", 7], ["jhks106", 8], ["jhks107", 9], ["jhks108", 9],
  ["jhks109", 6], ["jhks110", 12], ["jhks111", 12], ["jhks112", 8],
  ["jhkr101", 9], ["jhkr102", 14], ["jhkr103", 5],
]);

describe("NCERT Class 10 Hindi A seed", () => {
  it("contains all fifteen verified rationalised PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages},`);
    }
    expect(seed.match(/'jhk[rs]\d{3}',/g)).toHaveLength(15);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
    expect(seed).toContain("'Hindi'");
  });

  it("maps both combined poetry PDFs to both curriculum chapters", () => {
    expect(seed).toContain("array['utsah', 'at-nahin-rahi-hai']");
    expect(seed).toContain("array['yah-danturit-muskan', 'fasal']");
    expect(seed).toContain("expected 15 materials");
    expect(seed).toContain("expected 17 scopes");
  });

  it("is transactional, rerunnable and limited to School CBSE Class 10", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("where slug = 'school'");
    expect(seed).toContain("where slug = 'cbse'");
    expect(seed).toContain("where slug = 'class-10'");
    expect(seed).toContain("where slug = 'hindi-a'");
    expect(seed).not.toContain("where slug = 'jee'");
    expect(seed).not.toContain("where slug = 'neet'");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
