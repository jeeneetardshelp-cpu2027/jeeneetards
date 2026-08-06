import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("src/migrations/study_materials_v2_catalog.sql", "utf8");
const rollback = readFileSync("src/migrations/study_materials_v2_catalog_rollback.sql", "utf8");

describe("study materials v2 curriculum contract", () => {
  it("ships a guarded, reversible, material-backed curriculum RPC", () => {
    expect(migration).toContain("STUDY MATERIALS V2 PREFLIGHT");
    expect(migration).toContain("create or replace function public.get_study_material_curriculum");
    expect(migration).toMatch(/join public\.study_materials m on m\.id = s\.material_id/i);
    expect(migration).toMatch(/m\.review_status = 'approved'/i);
    expect(migration).toMatch(/m\.published_at <= now\(\)/i);
    expect(migration).toContain("count(distinct s.material_id)::bigint");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("to anon, authenticated, service_role");
    expect(migration.trimEnd()).toMatch(/commit;$/i);
    expect(rollback).toContain("drop function if exists public.get_study_material_curriculum");
  });

  it("returns each cascade level with upstream filters only", () => {
    for (const level of ["goal", "board", "class", "subject", "chapter"]) {
      expect(migration).toContain(`'${level}'`);
    }
    expect(migration).toContain("p_goal_slug text default null");
    expect(migration).toContain("p_board_slug text default null");
    expect(migration).toContain("p_class_slug text default null");
    expect(migration).toContain("p_subject_slug text default null");
  });
});
