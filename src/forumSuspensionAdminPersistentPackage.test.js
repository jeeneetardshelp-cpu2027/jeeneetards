import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const directory = "staging/forum_suspension_admin_v1_persistent";
const install = readFileSync(`${directory}/install.sql`, "utf8");
const rollback = readFileSync(`${directory}/rollback.sql`, "utf8");
const hashLines = readFileSync(`${directory}/artifacts.sha256.txt`, "utf8")
  .trim().split("\n");
const manifest = JSON.parse(readFileSync(`${directory}/source_manifest.json`, "utf8"));
const forumV1 = readFileSync("src/migrations/forum_v1.sql", "utf8");
const usernameClaim = readFileSync("src/migrations/forum_username_claim_v1.sql", "utf8");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function baseline(environment = "staging") {
  const pg = new PGlite();
  await pg.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role', true), '')
    $$;
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      username text, full_name text, avatar_url text,
      is_admin boolean not null default false,
      created_at timestamptz not null default now()
    );
    create function public.is_admin() returns boolean
    language sql stable security definer set search_path = '' as $$
      select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    $$;
    create table public.app_environment (
      id boolean primary key default true check (id),
      name text not null check (name in ('production','staging','test'))
    );
    insert into public.app_environment (id, name) values (true, '${environment}');
  `);
  await pg.exec(forumV1);
  await pg.exec(usernameClaim);
  return pg;
}

describe("forum suspension-admin persistent staging package", () => {
  it("pins the reviewed sources and both generated artifacts", () => {
    expect(manifest.status).toBe("prepared-local-only-not-authorized-for-execution");
    expect(hashLines).toEqual([
      `${sha256(install)}  install.sql`,
      `${sha256(rollback)}  rollback.sql`,
    ]);
    for (const [name, source] of Object.entries(manifest.sources)) {
      expect(sha256(readFileSync(source.path, "utf8")), name).toBe(source.sha256);
    }
    expect(manifest.artifacts["install.sql"].sha256).toBe(sha256(install));
    expect(manifest.artifacts["rollback.sql"].sha256).toBe(sha256(rollback));
  });

  it("places the staging and forum-off guard inside the DDL transaction", () => {
    const migrationHeader = install.indexOf("-- Forum suspension admin v1.");
    const migrationBegin = install.indexOf("\nbegin;", migrationHeader);
    const guard = install.indexOf(
      "suspension-admin install requires exactly one staging marker",
      migrationBegin,
    );
    const firstDdl = install.indexOf(
      "create function public.forum_admin_set_suspension_by_username",
      migrationBegin,
    );
    expect(migrationHeader).toBeGreaterThan(-1);
    expect(migrationBegin).toBeGreaterThan(migrationHeader);
    expect(guard).toBeGreaterThan(migrationBegin);
    expect(firstDdl).toBeGreaterThan(guard);
    expect(install).toContain("forum mode must remain off during suspension-admin installation");
    const baseline = install.indexOf("create temporary table forum_suspension_admin_stage_baseline");
    expect(baseline).toBeGreaterThan(guard);
    expect(firstDdl).toBeGreaterThan(baseline);
    expect(install).toContain("as suspension_rows_unchanged");
    expect(install).toContain("as moderation_log_rows_unchanged");
    expect(install).toContain("as posts_unchanged");
    expect(install).toContain("as comments_unchanged");
    expect(install).toContain("as reports_unchanged");
  });

  it("installs and rolls back cleanly on staging-shaped PostgreSQL", async () => {
    const pg = await baseline();
    try {
      await pg.exec(install);
      let state = await pg.query(`
        select
          to_regprocedure(
            'public.forum_admin_set_suspension_by_username(text,integer,text)'
          ) is not null as setter,
          to_regprocedure('public.forum_admin_list_suspensions()') is not null as lister,
          (select mode from public.forum_settings where id = true) as mode,
          (select count(*)::integer from public.forum_suspensions) as rows
      `);
      expect(state.rows[0]).toEqual({ setter: true, lister: true, mode: "off", rows: 0 });

      await pg.exec(rollback);
      state = await pg.query(`
        select
          to_regprocedure(
            'public.forum_admin_set_suspension_by_username(text,integer,text)'
          ) as setter,
          to_regprocedure('public.forum_admin_list_suspensions()') as lister,
          to_regprocedure(
            'public.forum_admin_set_suspension(uuid,timestamptz,text)'
          ) is not null as reviewed_rpc
      `);
      expect(state.rows[0]).toEqual({ setter: null, lister: null, reviewed_rpc: true });
    } finally {
      await pg.close();
    }
  }, 60_000);

  it("fails closed on a production marker before creating either wrapper", async () => {
    const pg = await baseline("production");
    try {
      await expect(pg.exec(install)).rejects.toThrow(/requires exactly one staging marker/i);
      await pg.exec("rollback").catch(() => {});
      const state = await pg.query(`
        select
          to_regprocedure(
            'public.forum_admin_set_suspension_by_username(text,integer,text)'
          ) as setter,
          to_regprocedure('public.forum_admin_list_suspensions()') as lister
      `);
      expect(state.rows[0]).toEqual({ setter: null, lister: null });
    } finally {
      await pg.close();
    }
  }, 60_000);
});
