import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(import.meta.dirname, "migrations/chapter_class_scopes_v14_draft.sql"),
  "utf8",
);

const mappings = [...sql.matchAll(
  /\('([^']+)', '([^']+)', '(class-(?:11|12))'\)/g,
)].map((match) => ({
  subject: match[1],
  chapter: match[2],
  classSlug: match[3],
}));

function count(subject, classSlug) {
  return mappings.filter(
    (mapping) => mapping.subject === subject && mapping.classSlug === classSlug,
  ).length;
}

describe("chapter class scopes v14 review draft", () => {
  it("fails closed before the preflight or insert can execute", () => {
    expect(sql.indexOf("NOT APPROVED: chapter class scopes v14"))
      .toBeLessThan(sql.indexOf("do $preflight$"));
    expect(sql).toContain("PREPARED FOR REVIEW. NOT APPROVED OR APPLIED ANYWHERE.");
  });

  it("contains exactly 85 unique, single-class reviewed mappings", () => {
    expect(mappings).toHaveLength(85);
    expect(new Set(mappings.map(({ subject, chapter }) => `${subject}:${chapter}`)).size)
      .toBe(85);

    expect(count("physics", "class-11")).toBe(13);
    expect(count("physics", "class-12")).toBe(9);
    expect(count("chemistry", "class-11")).toBe(15);
    expect(count("chemistry", "class-12")).toBe(9);
    expect(count("mathematics", "class-11")).toBe(4);
    expect(count("mathematics", "class-12")).toBe(3);
    expect(count("biology", "class-11")).toBe(19);
    expect(count("biology", "class-12")).toBe(13);
  });

  it("keeps shared or ambiguous chapters out of the draft", () => {
    const chapters = new Set(mappings.map(({ chapter }) => chapter));
    for (const deferred of [
      "probability",
      "p-block-elements",
      "surface-chemistry",
      "qualitative-analysis",
    ]) {
      expect(chapters.has(deferred)).toBe(false);
    }
  });

  it("is additive data only and does not replace browse functions", () => {
    expect(sql).not.toMatch(/\b(?:update|delete\s+from|truncate|drop\s+|alter\s+table)\b/i);
    expect(sql).not.toContain("create or replace function public.get_browse_curriculum");
    expect(sql).not.toContain("create or replace function public.browse_facet_counts");
    expect(sql).toContain("insert into public.chapter_class_levels");
  });

  it("pins the v13 baseline and the expected additive postflight", () => {
    expect(sql).toContain("expected exactly five v13 rows");
    expect(sql).toContain("expected 90 total rows and 85 v14 rows");
    expect(sql).toContain("a deliberately deferred chapter was mapped");
  });

  it("records current official CBSE provenance for every subject", () => {
    for (const file of [
      "Physics_SecP2_2026-27.pdf",
      "Chemistry_SecP2_2026-27.pdf",
      "Maths_SecP2_2026-27.pdf",
      "Biology_SecP2_2026-27.pdf",
    ]) {
      expect(sql).toContain(file);
    }
    expect(sql).toContain("date '2026-08-02'");
  });
});
