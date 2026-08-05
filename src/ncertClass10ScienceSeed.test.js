import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_ncert_class10_science_seed_2026-08-05.sql",
  "utf8",
);

const expected = new Map([
  ["jesc101", 16], ["jesc102", 20], ["jesc103", 21],
  ["jesc104", 21], ["jesc105", 21], ["jesc106", 13],
  ["jesc107", 15], ["jesc108", 6], ["jesc109", 27],
  ["jesc110", 10], ["jesc111", 24], ["jesc112", 13],
  ["jesc113", 10],
]);

describe("NCERT Class 10 Science seed", () => {
  it("contains all thirteen verified rationalised chapter PDFs and page counts", () => {
    for (const [code, pages] of expected) {
      expect(seed).toContain(`'${code}', ${pages},`);
    }
    expect(seed.match(/'jesc1\d{2}',/g)).toHaveLength(13);
    expect(seed).not.toMatch(/'jesc11[4-9]'/);
    expect(seed).toContain("https://ncert.nic.in/textbook/pdf/%s.pdf");
    expect(seed).toContain("'official_source'");
  });

  it("creates exact school chapter nodes and is transactional and rerunnable", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("insert into public.chapters");
    expect(seed).toContain("on conflict (subject_id, slug) do nothing");
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 13 materials");
    expect(seed).toContain("expected 13 scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("targets only School, CBSE and Class 10 across the three science subjects", () => {
    expect(seed).toContain("where slug = 'school'");
    expect(seed).toContain("where slug = 'cbse'");
    expect(seed).toContain("where slug = 'class-10'");
    expect(seed).toContain("'physics'");
    expect(seed).toContain("'chemistry'");
    expect(seed).toContain("'biology'");
    expect(seed).not.toContain("where slug = 'jee'");
    expect(seed).not.toContain("where slug = 'neet'");
  });
});
