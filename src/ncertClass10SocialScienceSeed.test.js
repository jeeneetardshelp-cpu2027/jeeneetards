import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class10_social_science_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["jess101", 12], ["jess102", 6], ["jess103", 11],
  ["jess104", 12], ["jess105", 16], ["jess106", 13], ["jess107", 13],
  ["jess201", 16], ["jess202", 20], ["jess203", 16],
  ["jess204", 20], ["jess205", 19],
  ["jess301", 28], ["jess302", 22], ["jess303", 28],
  ["jess304", 24], ["jess305", 26],
  ["jess401", 12], ["jess402", 16], ["jess403", 17],
  ["jess404", 17], ["jess405", 12],
]);

describe("NCERT Class 10 Social Science seed", () => {
  it("contains all twenty-two verified rationalised chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages},`);
    }
    expect(seed.match(/'jess\d{3}',/g)).toHaveLength(22);
    expect(seed).not.toMatch(/'jess(20[6-9]|30[6-9]|40[6-9])'/);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 22 materials");
    expect(seed).toContain("expected 22 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("targets only School, CBSE, Class 10 and Social Science", () => {
    expect(seed).toContain("where slug = 'school'");
    expect(seed).toContain("where slug = 'cbse'");
    expect(seed).toContain("where slug = 'class-10'");
    expect(seed).toContain("where slug = 'social-science'");
    expect(seed).not.toContain("where slug = 'jee'");
    expect(seed).not.toContain("where slug = 'neet'");
  });
});
