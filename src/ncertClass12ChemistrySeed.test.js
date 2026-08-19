import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class12_chemistry_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["lech101", 30], ["lech102", 30], ["lech103", 28],
  ["lech104", 29], ["lech105", 23], ["lech201", 34],
  ["lech202", 34], ["lech203", 32], ["lech204", 22], ["lech205", 22],
]);

describe("NCERT Class 12 Chemistry seed", () => {
  it("contains the ten verified rationalised chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages}, array[`);
    }
    expect(seed.match(/'lech(?:1|2)\d{2}',/g)).toHaveLength(10);
    expect(seed).not.toMatch(/'lech10[6-9]'/);
    expect(seed).not.toMatch(/'lech20[6-9]'/);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 10 materials");
    expect(seed).toContain("expected 36 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("maps combined organic chapters to the site's split Chemistry topics", () => {
    expect(seed).toContain("array['organic-compounds-containing-oxygen', 'carboxylic-acids-and-derivatives']");
    expect(seed).toContain("array['organic-compounds-containing-nitrogen', 'amines']");
    expect(seed.match(/'organic-compounds-containing-oxygen'/g)).toHaveLength(2);
    for (const goal of ["jee", "neet", "school"]) {
      expect(seed).toContain(`where slug = '${goal}'`);
    }
    expect(seed).toContain("where slug = 'cbse'");
  });
});
