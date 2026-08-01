import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(import.meta.dirname, "migrations/chapter_class_scopes_v13_browse_draft.sql"),
  "utf8",
);

describe("chapter class scope browse review draft", () => {
  it("fails closed before it creates or replaces any function", () => {
    expect(sql.indexOf("NOT APPROVED: chapter class scope browse delta"))
      .toBeLessThan(sql.indexOf("create or replace function"));
    expect(sql).toContain("PREPARED FOR CLONE REVIEW. NOT APPROVED OR APPLIED ANYWHERE.");
  });

  it("preserves the public RPC signatures without dropping them", () => {
    expect(sql).toContain("create or replace function public.get_browse_curriculum(");
    expect(sql).toContain("create or replace function public.browse_facet_counts(");
    expect(sql).not.toMatch(/drop\s+function/i);
    expect(sql).not.toMatch(/\b(?:update|delete\s+from|truncate)\b/i);
  });

  it("uses reviewed chapter scope before the playlist fallback", () => {
    const helperStart = sql.indexOf("create or replace function public.chapter_matches_class_scope");
    const helperEnd = sql.indexOf("comment on function public.chapter_matches_class_scope");
    const helper = sql.slice(helperStart, helperEnd);

    expect(helper).toMatch(/when exists \([\s\S]*public\.chapter_class_levels reviewed/);
    expect(helper).toMatch(/reviewed\.chapter_id = p_chapter_id[\s\S]*cl\.slug = p_class/);
    expect(helper).toMatch(/else exists \([\s\S]*public\.playlist_class_levels pcl/);
  });

  it("keeps Dropper as the existing audience superset for this narrow gate", () => {
    expect(sql).toContain("when p_class = 'dropper'");
    expect(sql).toContain("array['dropper','class-11','class-12']::text[]");
    expect(sql).toContain("separating target cohort is a later migration");
  });

  it("applies one shared predicate to navigation, selected-chapter counts, and chapter facets", () => {
    expect(sql.match(/public\.chapter_matches_class_scope\(/g)?.length).toBeGreaterThanOrEqual(6);
    expect(sql).toContain("and public.chapter_matches_class_scope(ch.id, pl.id, p_class)");
    expect(sql).toContain("and public.chapter_matches_class_scope(c.id, pl.id, p_class)");
    expect(sql).toContain("and public.chapter_matches_class_scope(c.id, b.id, co.value)");
    expect(sql).toContain("and public.chapter_matches_class_scope(c.id, b.id, p_class)");
  });

  it("postflights both navigation and chapter-facet separation", () => {
    expect(sql).toContain("Class 11 still exposes reviewed Class 12 Physics chapters");
    expect(sql).toContain("Class 12 still exposes reviewed Class 11 Physics chapters");
    expect(sql).toContain("Class 11 chapter facets disagree with canonical navigation");
    expect(sql).toContain("Class 12 chapter facets disagree with canonical navigation");
  });
});
