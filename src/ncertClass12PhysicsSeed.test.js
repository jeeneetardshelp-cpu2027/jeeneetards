import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class12_physics_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["leph101", 44], ["leph102", 36], ["leph103", 26], ["leph104", 29],
  ["leph105", 18], ["leph106", 23], ["leph107", 24], ["leph108", 14],
  ["leph201", 34], ["leph202", 19], ["leph203", 16], ["leph204", 16],
  ["leph205", 17], ["leph206", 21],
]);

describe("NCERT Class 12 Physics seed", () => {
  it("contains the fourteen verified official chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages}, array[`);
    }
    expect(seed.match(/'leph(?:1|2)\d{2}',/g)).toHaveLength(14);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
    expect(seed).toContain("Linked only; not mirrored or redistributed");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 14 materials");
    expect(seed).toContain("expected 54 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("maps shared NCERT chapters to every matching site chapter", () => {
    expect(seed).toContain("array['electrostatics', 'capacitance']");
    expect(seed).toContain("array['dual-nature-of-radiation-and-matter', 'modern-physics']");
    expect(seed).toContain("array['atoms', 'modern-physics']");
    expect(seed).toContain("array['semiconductor-electronics', 'modern-physics']");
    expect(seed.match(/'modern-physics'/g)).toHaveLength(4);
    for (const goal of ["jee", "neet", "school"]) {
      expect(seed).toContain(`where slug = '${goal}'`);
    }
    expect(seed).toContain("where slug = 'cbse'");
  });
});
