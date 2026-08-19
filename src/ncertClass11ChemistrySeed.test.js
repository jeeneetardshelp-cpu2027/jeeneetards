import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class11_chemistry_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["kech101", 28], ["kech102", 45], ["kech103", 26],
  ["kech104", 36], ["kech105", 32], ["kech106", 53],
  ["kech201", 21], ["kech202", 39], ["kech203", 33],
]);

describe("NCERT Class 11 Chemistry seed", () => {
  it("contains the nine verified rationalised chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages}, array[`);
    }
    expect(seed.match(/'kech(?:1|2)\d{2}',/g)).toHaveLength(9);
    expect(seed).not.toMatch(/'kech10[789]'/);
    expect(seed).not.toMatch(/'kech20[4-9]'/);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 9 materials");
    expect(seed).toContain("expected 48 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("maps combined NCERT chapters to the site's split Chemistry topics", () => {
    expect(seed).toContain("array['introduction-to-chemistry', 'mole-concept']");
    expect(seed).toContain("array['thermodynamics', 'thermochemistry']");
    expect(seed).toContain("array['chemical-equilibrium', 'ionic-equilibrium']");
    expect(seed).toContain("'purification-and-characterisation-of-organic-compounds'");
    expect(seed).toContain("'stereoisomerism'");
    expect(seed).toContain("'organic-reaction-mechanisms'");
    for (const goal of ["jee", "neet", "school"]) {
      expect(seed).toContain(`where slug = '${goal}'`);
    }
    expect(seed).toContain("where slug = 'cbse'");
  });
});
