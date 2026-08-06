import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const install = readFileSync("staging/forum_v1_persistent/install.sql", "utf8");
const hashLine = readFileSync(
  "staging/forum_v1_persistent/install.sql.sha256.txt",
  "utf8",
).trim();
const manifest = JSON.parse(readFileSync(
  "staging/forum_v1_persistent/source_manifest.json",
  "utf8",
));
const helper = readFileSync(
  "staging/forum_v1_persistent/http_fixture_helper.sql",
  "utf8",
);
const helperRollback = readFileSync(
  "staging/forum_v1_persistent/http_fixture_helper_rollback.sql",
  "utf8",
);
const rollback = readFileSync("src/migrations/forum_v1_rollback.sql", "utf8");
const verifier = readFileSync("src/scripts/verifyForumV1JwtStaging.js", "utf8");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

describe("forum v1 persistent staging and JWT package", () => {
  it("pins exact reviewed sources behind a pre-DDL staging guard", () => {
    expect(hashLine).toBe(`${sha256(install)}  install.sql`);
    expect(manifest.status).toBe("persistent-disposable-staging-only");
    expect(install).toContain(`Preflight SHA-256: ${manifest.sources.preflight.sha256}`);
    expect(install).toContain(`Core SHA-256: ${manifest.sources.core.sha256}`);
    expect(install).toContain(`Postflight SHA-256: ${manifest.sources.postflight.sha256}`);
    const guard = install.indexOf("persistent forum install requires exactly one staging marker");
    const firstForumDdl = install.indexOf("create table public.forum_settings");
    expect(guard).toBeGreaterThan(-1);
    expect(firstForumDdl).toBeGreaterThan(guard);
    expect(install).toContain("insert into public.forum_settings (id, mode) values (true, 'off')");
    expect(install).toContain("as forum_mode");
  });

  it("keeps the staging-only admin helper narrowly scoped and removable", () => {
    const guard = helper.indexOf("name = 'staging'");
    const create = helper.indexOf("create function public.forum_stage_prepare_http_fixtures");
    expect(guard).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(guard);
    expect(helper).toContain("auth.role() <> 'service_role'");
    expect(helper).toContain("forum mode must remain off");
    expect(helper).toContain("exactly five distinct fixture user ids are required");
    expect(helper).toContain("@staging.invalid");
    expect(helper).toContain("to service_role;");
    expect(helperRollback).toContain("drop function if exists public.forum_stage_prepare_http_fixtures");
  });

  it("uses real Auth password sessions and PostgREST while redacting credentials", () => {
    expect(verifier).toContain("auth.admin.createUser");
    expect(verifier).toContain("auth.signInWithPassword");
    expect(verifier).toContain("decodeJwtPayload");
    expect(verifier).toContain("get_forum_feed");
    expect(verifier).toContain("authenticated JWT cannot select forum base table");
    expect(verifier).toContain("serviceKey");
    expect(verifier).toContain("[REDACTED]");
    expect(verifier).toMatch(/rpc\("get_forum_post", \{ p_post_id: postId \}\)\s*\.single\(\)/);
    expect(verifier).toContain("raw_response_shape");
    expect(verifier).toContain("evidence detail missing raw_response_shape");
    expect(verifier).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(verifier).not.toMatch(/postgres(?:ql)?:\/\//i);
  });

  it("installs persistently and rolls back cleanly in ephemeral PostgreSQL", async () => {
    const pg = new PGlite();
    try {
      await pg.exec(`
        create role anon;
        create role authenticated;
        create role service_role;
        create schema auth;
        create table auth.users (
          id uuid primary key,
          email text,
          raw_app_meta_data jsonb,
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
          username text unique,
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
      `);

      await pg.exec(install);
      let state = await pg.query(`
        select
          (select mode from public.forum_settings where id) as mode,
          to_regclass('public.forum_posts') is not null as posts_installed,
          (select count(*)::integer from public.forum_topics where is_active) as topics
      `);
      expect(state.rows[0]).toEqual({ mode: "off", posts_installed: true, topics: 6 });

      await pg.exec(helper);
      state = await pg.query(`
        select
          to_regprocedure('public.forum_stage_prepare_http_fixtures(text,uuid[])') is not null
            as helper_installed,
          has_function_privilege(
            'authenticated',
            'public.forum_stage_prepare_http_fixtures(text,uuid[])',
            'EXECUTE'
          ) as authenticated_execute
      `);
      expect(state.rows[0]).toEqual({ helper_installed: true, authenticated_execute: false });

      await pg.exec(helperRollback);
      await pg.exec(rollback);
      state = await pg.query(`
        select
          to_regclass('public.forum_posts') as posts,
          to_regprocedure('public.forum_stage_prepare_http_fixtures(text,uuid[])') as helper
      `);
      expect(state.rows[0]).toEqual({ posts: null, helper: null });
    } finally {
      await pg.close();
    }
  }, 60_000);
});
