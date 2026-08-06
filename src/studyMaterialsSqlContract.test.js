import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("src/migrations/study_materials_v1.sql", "utf8");
const rollback = readFileSync("src/migrations/study_materials_v1_rollback.sql", "utf8");

describe("study materials v1 database contract", () => {
  it("is a guarded, data-free migration with a separate rollback", () => {
    expect(migration).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(migration).toContain("STUDY MATERIALS PREFLIGHT");
    expect(migration).toContain("to_regclass('public.chapters')");
    expect(migration).toContain("to_regprocedure('public.is_admin()')");
    expect(migration).not.toMatch(/insert\s+into\s+public\.study_materials/i);
    expect(migration.trimEnd()).toMatch(/commit;$/i);
    expect(rollback).toContain("drop table if exists public.study_materials");
  });

  it("models one source once and reuses it across exact curriculum scopes", () => {
    expect(migration).toContain("create table if not exists public.study_materials");
    expect(migration).toContain("create table if not exists public.study_material_scopes");
    expect(migration).toContain("create table if not exists public.study_material_videos");
    expect(migration).toMatch(/learning_goal_id\s+bigint references public\.learning_goals/i);
    expect(migration).toMatch(/board_id\s+bigint references public\.boards/i);
    expect(migration).toMatch(/class_level_id\s+bigint references public\.class_levels/i);
    expect(migration).toMatch(/subject_id\s+bigint references public\.subjects/i);
    expect(migration).toMatch(/chapter_id\s+bigint references public\.chapters/i);
    expect(migration).toMatch(/video_id\s+bigint not null references public\.videos/i);
    expect(migration).toContain("Study material chapter and subject do not match");
    expect(migration).toContain("Board-scoped material must use the School learning goal");
  });

  it("supports only the four student-facing v1 material types", () => {
    for (const type of [
      "short_notes", "formula_sheet", "full_notes", "previous_year_paper",
    ]) {
      expect(migration).toContain(`'${type}'`);
    }
  });

  it("requires an HTTPS source and explicit publication rights", () => {
    expect(migration).toContain("study_materials_https_source");
    expect(migration).toMatch(/source_url\s+~\s+'\^https:\/\//i);
    for (const right of ["official_source", "open_license", "creator_permission"]) {
      expect(migration).toContain(`'${right}'`);
    }
    expect(migration).toContain("study_materials_publish_gate");
    expect(migration).toMatch(/review_status = 'approved' and published_at is not null/i);
  });

  it("lets the public read approved material but never write it", () => {
    expect(migration).toContain('create policy "public reads approved study materials"');
    expect(migration).toMatch(/review_status = 'approved' and published_at <= now\(\)/i);
    expect(migration).toContain(
      "revoke all on table public.study_materials from public, anon, authenticated",
    );
    expect(migration).toContain("grant select on table public.study_materials to anon, authenticated");
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)[^;]*\s+to\s+anon/i);
    expect(migration).toContain("with check (public.is_admin())");
  });

  it("ships one bounded RPC for the directory and active lecture context", () => {
    expect(migration).toContain("create or replace function public.get_study_materials");
    expect(migration).toContain("p_chapter_id bigint default null");
    expect(migration).toContain("p_video_id bigint default null");
    expect(migration).toContain("p_material_type text default null");
    expect(migration).toContain("chapter_scope.chapter_id = p_chapter_id");
    expect(migration).toContain("mv.video_id = p_video_id");
    expect(migration).toMatch(/limit least\(greatest\(coalesce\(p_limit, 60\), 1\), 100\)/i);
    expect(migration).toContain("grant execute on function public.get_study_materials");
  });
});
