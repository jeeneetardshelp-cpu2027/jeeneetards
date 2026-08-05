import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class11_physics_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["keph101", 12], ["keph102", 14], ["keph103", 22], ["keph104", 22],
  ["keph105", 21], ["keph106", 35], ["keph107", 17], ["keph201", 13],
  ["keph202", 22], ["keph203", 24], ["keph204", 18], ["keph205", 15],
  ["keph206", 19], ["keph207", 22],
]);

describe("NCERT Class 11 Physics seed", () => {
  it("contains the fourteen verified official chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages}, array[`);
    }
    expect(seed.match(/'keph(?:1|2)\d{2}',/g)).toHaveLength(14);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
    expect(seed).toContain("Linked only; not mirrored or redistributed");
  });

  it("is transactional, rerunnable and asserts its final cardinality", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 14 materials");
    expect(seed).toContain("expected 51 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("maps shared NCERT chapters to every matching site chapter", () => {
    expect(seed).toContain("array['laws-of-motion', 'newtons-laws-of-motion-nlm', 'friction']");
    expect(seed).toContain("array['system-of-particles-and-centre-of-mass', 'rotational-motion']");
    expect(seed.match(/array\['oscillations-and-waves'\]/g)).toHaveLength(2);
    for (const goal of ["jee", "neet", "school"]) {
      expect(seed).toContain(`where slug = '${goal}'`);
    }
    expect(seed).toContain("where slug = 'cbse'");
  });
});
