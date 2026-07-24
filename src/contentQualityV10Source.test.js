import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync("./src/migrations/content_quality_v10.sql", "utf8");
const stagingBuilder = readFileSync("./src/scripts/buildStagingBootstrap.js", "utf8");
const productionBuilder = readFileSync("./src/scripts/buildProductionMigration.js", "utf8");

describe("content quality v10 source contract", () => {
  it("preserves source titles instead of destructively normalizing them", () => {
    expect(SQL).toContain("add column if not exists source_title text");
    expect(SQL).toContain("set source_title = title");
    expect(SQL).toContain("source_title_changed");
    expect(SQL).not.toMatch(/update public\.playlists\s+set title = initcap/i);
  });

  it("requires explicit faculty outcomes and delegates ids to the v7 validator", () => {
    expect(SQL).toContain("faculty_credit_status in ('pending','identified','team','unknown')");
    expect(SQL).toContain("identified faculty requires at least one teacher id");
    expect(SQL).toContain("team credit cannot carry individual teacher ids");
    expect(SQL).toContain("perform public.set_playlist_teachers(p.id, p_teacher_ids)");
  });

  it("keeps an append-only audit and blocks direct browser writes", () => {
    expect(SQL).toContain("create table if not exists public.playlist_quality_reviews");
    expect(SQL).toContain("before_state jsonb not null");
    expect(SQL).toContain("after_state jsonb not null");
    expect(SQL).toContain("revoke all on public.playlist_quality_reviews from public, anon, authenticated, service_role");
  });

  it("guards every admin entry point inside the function body", () => {
    for (const fn of ["content_quality_capability", "get_content_quality_queue", "review_playlist_quality"]) {
      const start = SQL.indexOf(`function public.${fn}`);
      const next = SQL.indexOf("create or replace function", start + 1);
      const body = SQL.slice(start, next === -1 ? SQL.length : next);
      expect(body).toContain("public.is_admin()");
      expect(body).toContain("raise exception 'not authorized'");
    }
  });

  it("stays isolated from both release builders until staging verification", () => {
    expect(stagingBuilder).not.toContain("content_quality_v10");
    expect(productionBuilder).not.toContain("content_quality_v10");
  });
});

