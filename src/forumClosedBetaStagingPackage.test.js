import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const directory = "staging/forum_closed_beta_v1_rehearsal";
const artifact = readFileSync(`${directory}/rollback_rehearsal.sql`, "utf8");
const hashLine = readFileSync(`${directory}/rollback_rehearsal.sha256.txt`, "utf8").trim();
const manifest = JSON.parse(readFileSync(`${directory}/source_manifest.json`, "utf8"));
const readme = readFileSync(`${directory}/README.md`, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const baselineSources = [
  "src/migrations/forum_v1.sql",
  "src/migrations/forum_username_claim_v1.sql",
  "src/migrations/forum_moderation_context_v1.sql",
  "src/migrations/forum_report_dismissal_v1.sql",
];

describe("forum closed-beta staging rehearsal package", () => {
  it("pins every reviewed source and the generated artifact", () => {
    const artifactHash = sha256(artifact);
    expect(hashLine).toBe(`${artifactHash}  rollback_rehearsal.sql`);
    expect(manifest.status).toBe("rollback-only-not-authorized-for-persistent-apply");
    expect(manifest.artifact.sha256).toBe(artifactHash);
    for (const source of Object.values(manifest.sources)) {
      expect(source.sha256).toBe(sha256(read(source.path)));
    }
    expect(artifact).toContain(
      `Exact migration SHA-256: ${manifest.sources.migration.sha256}`,
    );
  });

  it("is staging-only, exercises real browser roles, and ends in rollback", () => {
    expect(artifact).toContain("requires exactly one staging marker");
    expect(artifact).toContain("set local role authenticated;");
    expect(artifact).toContain("set local role anon;");
    expect(artifact).toContain("outsider_write_denied");
    expect(artifact).toContain("outsider_report");
    expect(artifact).toContain("member_read_only_denied");
    expect(artifact).toContain("-- All fields in this final row must be true.");
    expect(artifact).toContain("rollback;\n\n-- All fields");
    expect(artifact).not.toMatch(/^\s*commit;\s*$/gim);
    expect(artifact.match(/^\s*rollback;\s*$/gim)).toHaveLength(3);
    expect(readme).toContain("Nothing in this package authorizes that remote step");
    expect(readme).toContain("every field is `true`");
    expect(readme).toContain("provision_test_accounts.sql");
    expect(readme).toContain("teardown_test_accounts.sql");
    expect(readme).toContain("@staging.invalid");
  });

  it("runs the complete delta proof and restores the persistent baseline", async () => {
    const pg = new PGlite();
    try {
      await pg.exec(`
        create role anon;
        create role authenticated;
        create role service_role;
        create schema auth;
        create table auth.users (
          id uuid primary key,
          created_at timestamptz not null default now()
        );
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
        create function auth.role() returns text language sql stable as $$
          select nullif(current_setting('request.jwt.claim.role', true), '')
        $$;
        create table public.profiles (
          id uuid primary key references auth.users(id) on delete cascade,
          username text,
          full_name text,
          avatar_url text,
          is_admin boolean not null default false,
          created_at timestamptz not null default now()
        );
        create function public.is_admin() returns boolean
        language sql stable security definer set search_path = '' as $$
          select exists (
            select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
          )
        $$;
        create table public.app_environment (
          id boolean primary key default true check (id),
          name text not null check (name in ('production','staging','test'))
        );
        insert into public.app_environment (id, name) values (true, 'staging');
        insert into auth.users (id, created_at) values
          ('32000000-0000-4000-8000-000000000001', now() - interval '1 day'),
          ('32000000-0000-4000-8000-000000000002', now() - interval '1 day'),
          ('32000000-0000-4000-8000-000000000003', now() - interval '1 day');
        insert into public.profiles (id, username, is_admin) values
          ('32000000-0000-4000-8000-000000000001', 'stage_admin', true),
          ('32000000-0000-4000-8000-000000000002', 'stage_member', false),
          ('32000000-0000-4000-8000-000000000003', 'stage_outsider', false);
      `);
      for (const source of baselineSources) await pg.exec(read(source));

      await pg.exec(artifact);

      const restored = await pg.query(`
        select
          public.forum_mode() as mode,
          to_regclass('public.forum_beta_members') as beta_table,
          to_regprocedure('public.forum_is_beta_member()') as beta_check,
          (select count(*)::integer from public.forum_posts) as posts,
          (select count(*)::integer from public.forum_comments) as comments,
          (select count(*)::integer from public.forum_reports) as reports,
          (select count(*)::integer from public.profiles
            where username like 'cb_%') as changed_usernames
      `);
      expect(restored.rows[0]).toEqual({
        mode: "off",
        beta_table: null,
        beta_check: null,
        posts: 0,
        comments: 0,
        reports: 0,
        changed_usernames: 0,
      });
    } finally {
      await pg.close();
    }
  }, 60_000);
});
