import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync("src/migrations/forum_v1.sql", "utf8");
const PREFLIGHT = readFileSync("src/migrations/forum_v1_preflight.sql", "utf8");
const POSTFLIGHT = readFileSync("src/migrations/forum_v1_postflight.sql", "utf8");
const ROLLBACK = readFileSync("src/migrations/forum_v1_rollback.sql", "utf8");
const stagingBuilder = readFileSync("src/scripts/buildStagingBootstrap.js", "utf8");
const productionBuilder = readFileSync("src/scripts/buildProductionMigration.js", "utf8");

describe("forum v1 SQL source contract", () => {
  it("uses existing Supabase identity and no second user table", () => {
    expect(SQL).toContain("references public.profiles(id)");
    expect(SQL).toContain("join auth.users u on u.id = p.id");
    expect(SQL).not.toMatch(/create table (?:public\.)?(?:forum_)?users\b/i);
    expect(SQL).not.toContain("service_role key");
  });

  it("starts closed and seeds only the six owner-approved topics", () => {
    expect(SQL).toContain("mode text not null default 'off'");
    for (const slug of [
      "physics", "chemistry", "mathematics", "biology", "strategy", "exam-admissions",
    ]) expect(SQL).toContain(`('${slug}',`);
    expect(SQL).not.toMatch(/\('motivation',/);
    expect(SQL).not.toMatch(/\('general',/);
    expect(POSTFLIGHT).toContain("expected six active launch topics");
  });

  it("keeps browser roles off base tables and exposes bounded RPCs", () => {
    expect(SQL).toContain("no browser role gets direct table access");
    expect(SQL).toMatch(/revoke all on table public\.forum_settings,[\s\S]+from public, anon, authenticated/);
    expect(SQL).toContain("limit least(greatest(coalesce($7::integer, 25), 1), 25)");
    expect(POSTFLIGHT).toContain("direct browser table privilege leaked");
    expect(POSTFLIGHT).toContain("anonymous create RPC leaked");
  });

  it("treats search metacharacters literally and uses concrete indexed sort branches", () => {
    expect(SQL).toContain("chr(92) || '%'");
    expect(SQL).toContain("chr(92) || '_'");
    expect(SQL).toContain("ilike $2::text escape E'\\\\'");
    expect(SQL).toContain("order_sql := 'p.hot_rank desc, p.created_at desc, p.id desc'");
    expect(SQL).toContain("order_sql := 'p.score desc, p.created_at desc, p.id desc'");
    expect(SQL).not.toContain("case when effective_sort = 'hot' then p.hot_rank end desc");
    expect(SQL).toContain("incomplete forum cursor for");
  });

  it("enforces structural vote, thread, moderation and throttling invariants", () => {
    expect(SQL).toContain("forum_votes_exactly_one_target");
    expect(SQL).toContain("forum_votes_unique_post");
    expect(SQL).toContain("forum_votes_unique_comment");
    expect(SQL).toContain("target_author_id uuid references public.profiles(id) on delete set null");
    expect(SQL).toContain("vote identity and target are immutable");
    expect(SQL).toContain("forum_comments_parent_same_post");
    expect(SQL).toContain("maximum comment depth is 10");
    expect(SQL).toContain("create table public.forum_rate_events");
    expect(SQL).toContain("create or replace function public.forum_recount_karma");
    expect(SQL).toContain("forum_require_reporter");
    expect(SQL).toContain("report does not match the moderation target");
    expect(SQL).toContain("forum posting is temporarily suspended");
    expect(SQL).toContain("action <> 'remove'");
    expect(SQL).toContain("reason <> 'self_harm'");
  });

  it("has review gates and remains isolated from release builders", () => {
    expect(PREFLIGHT).toContain("begin transaction read only");
    expect(PREFLIGHT).toContain("existing forum objects require drift review");
    expect(POSTFLIGHT).toContain("begin transaction read only");
    expect(ROLLBACK).toContain("app_environment is missing");
    expect(ROLLBACK).toContain("not in ('staging', 'test')");
    expect(stagingBuilder).not.toContain("forum_v1");
    expect(productionBuilder).not.toContain("forum_v1");
  });
});
