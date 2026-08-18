import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const directory = "production/forum_suspension_admin_v1_release";
const read = (name) => readFileSync(`${directory}/${name}`, "utf8");
const preflight = read("preflight.sql");
const audit = read("audit.sql");
const install = read("install.sql");
const postflight = read("postflight.sql");
const rollback = read("rollback.sql");
const readme = read("README.md");
const manifest = JSON.parse(read("source_manifest.json"));
const sums = read("SHA256SUMS.txt").trim().split("\n");
const baselineInstall = readFileSync("production/forum_v1_release/install.sql", "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const IDS = {
  admin: "52000000-0000-4000-8000-000000000001",
  student: "52000000-0000-4000-8000-000000000002",
};

const artifactNames = [
  "audit.sql",
  "install.sql",
  "postflight.sql",
  "preflight.sql",
  "README.md",
  "rollback.sql",
];

function migrationOperations(value) {
  const start = value.indexOf(
    "create function public.forum_admin_set_suspension_by_username(",
  );
  const end = value.indexOf("notify pgrst, 'reload schema';");
  return value.slice(start, end).trim();
}

async function productionDatabase({ marker = null } = {}) {
  const pg = new PGlite();
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
    grant select (id, username, full_name, avatar_url, created_at)
      on table public.profiles to anon, authenticated;
    grant insert, update on table public.profiles to anon, authenticated;
    insert into auth.users (id, email, created_at) values
      ('${IDS.admin}', 'moderator@example.invalid', now() - interval '1 day'),
      ('${IDS.student}', 'student@example.invalid', now() - interval '1 day');
    insert into public.profiles (id, username, full_name, is_admin) values
      ('${IDS.admin}', 'forum_admin', 'Forum admin', true),
      ('${IDS.student}', 'student_one', 'Student one', false);
  `);
  await pg.exec(baselineInstall);
  if (marker) {
    await pg.query(
      "insert into public.app_environment (id, name) values (true, $1)",
      [marker],
    );
  }
  return pg;
}

async function setAdmin(pg) {
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [IDS.admin]);
  await pg.query("select set_config('request.jwt.claim.role', 'authenticated', false)");
  await pg.exec("set role authenticated");
}

describe("Forum suspension-admin v1 production package", () => {
  it("pins every reviewed source and generated artifact without credentials", () => {
    expect(manifest.status).toBe("prepared-only-not-authorized-for-production-execution");
    expect(manifest.targetProjectRef).toBe("kezelafqhgqrprpadmlf");
    expect(manifest.generator).toEqual({
      path: "src/scripts/buildForumSuspensionAdminProductionPackage.js",
      sha256: sha256(readFileSync(
        "src/scripts/buildForumSuspensionAdminProductionPackage.js",
        "utf8",
      ).replace(/\r\n/g, "\n").trimEnd() + "\n"),
    });
    expect(sums).toHaveLength(artifactNames.length + 1);
    expect(sums).toContain(
      `${sha256(read("source_manifest.json"))}  source_manifest.json`,
    );

    for (const name of artifactNames) {
      const value = read(name);
      const hash = sha256(value);
      expect(sums).toContain(`${hash}  ${name}`);
      expect(manifest.artifacts[name]).toEqual({
        path: `${directory}/${name}`,
        sha256: hash,
      });
    }
    for (const source of Object.values(manifest.sources)) {
      const value = readFileSync(source.path, "utf8")
        .replace(/\r\n/g, "\n").trimEnd() + "\n";
      expect(sha256(value)).toBe(source.sha256);
    }
    for (const value of [preflight, audit, install, postflight, rollback, readme]) {
      expect(value).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
      expect(value).not.toMatch(/service[_-]?role[_-]?(?:key|secret)\s*=/i);
      expect(value).not.toMatch(/postgres(?:ql)?:\/\//i);
    }
  });

  it("keeps the production guard ahead of DDL and embeds reviewed SQL", () => {
    const guard = install.indexOf(
      "suspension-admin production install requires the empty production environment marker",
    );
    const firstDdl = install.indexOf(
      "create function public.forum_admin_set_suspension_by_username(",
    );
    expect(guard).toBeGreaterThan(-1);
    expect(firstDdl).toBeGreaterThan(guard);
    expect(install).not.toMatch(/create\s+function[\s\S]{0,80}\bif\s+not\s+exists\b/i);
    expect(install).toContain(migrationOperations(
      readFileSync(manifest.sources.migration.path, "utf8"),
    ));
    expect(preflight).toContain(
      readFileSync(manifest.sources.preflight.path, "utf8").trim(),
    );
    expect(audit).toContain(
      readFileSync(manifest.sources.audit.path, "utf8").trim(),
    );
    expect(postflight).toContain(
      readFileSync(manifest.sources.postflight.path, "utf8").trim(),
    );
    expect(install).toContain("staging_fixture_helper_absent");
    expect(install).not.toContain("create function public.forum_stage_prepare");
    expect(readme).toContain("not authorized for production execution");
    expect(readme).toContain("fresh verified PITR/backup restore point");
  });

  it("installs and rolls back without changing existing moderation history", async () => {
    const pg = await productionDatabase();
    try {
      await setAdmin(pg);
      await pg.query(
        "select public.forum_admin_set_suspension($1, now() + interval '7 days', $2)",
        [IDS.student, "Existing reviewed suspension"],
      );
      await pg.exec("reset role");

      const before = (await pg.query(`
        select
          (select count(*)::integer from public.forum_suspensions) as suspensions,
          (select count(*)::integer from public.forum_moderation_log) as log_entries
      `)).rows[0];
      expect(before.suspensions).toBe(1);
      expect(before.log_entries).toBeGreaterThan(0);

      await pg.exec(preflight);
      await pg.exec(audit);
      await pg.exec(install);
      await pg.exec(postflight);

      let state = (await pg.query(`
        select
          public.forum_mode() as mode,
          to_regprocedure(
            'public.forum_admin_set_suspension_by_username(text,integer,text)'
          ) is not null as set_wrapper,
          to_regprocedure('public.forum_admin_list_suspensions()') is not null
            as list_wrapper,
          to_regprocedure(
            'public.forum_stage_prepare_suspension_admin_fixtures(text,uuid[])'
          ) is null as helper_absent,
          (select count(*)::integer from public.forum_suspensions) as suspensions,
          (select count(*)::integer from public.forum_moderation_log) as log_entries
      `)).rows[0];
      expect(state).toEqual({
        mode: "off",
        set_wrapper: true,
        list_wrapper: true,
        helper_absent: true,
        suspensions: before.suspensions,
        log_entries: before.log_entries,
      });

      await pg.exec(rollback);
      state = (await pg.query(`
        select
          to_regprocedure(
            'public.forum_admin_set_suspension_by_username(text,integer,text)'
          ) as set_wrapper,
          to_regprocedure('public.forum_admin_list_suspensions()') as list_wrapper,
          to_regprocedure(
            'public.forum_admin_set_suspension(uuid,timestamptz,text)'
          ) is not null as reviewed_rpc,
          (select count(*)::integer from public.forum_suspensions) as suspensions,
          (select count(*)::integer from public.forum_moderation_log) as log_entries
      `)).rows[0];
      expect(state).toEqual({
        set_wrapper: null,
        list_wrapper: null,
        reviewed_rpc: true,
        suspensions: before.suspensions,
        log_entries: before.log_entries,
      });
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 60_000);

  it("refuses a staging-marked clone before creating either wrapper", async () => {
    const pg = await productionDatabase({ marker: "staging" });
    try {
      await expect(pg.exec(install)).rejects.toThrow(
        /empty production environment marker/i,
      );
      await pg.exec("rollback");
      const state = (await pg.query(`
        select
          to_regprocedure(
            'public.forum_admin_set_suspension_by_username(text,integer,text)'
          ) as set_wrapper,
          to_regprocedure('public.forum_admin_list_suspensions()') as list_wrapper
      `)).rows[0];
      expect(state).toEqual({ set_wrapper: null, list_wrapper: null });
    } finally {
      await pg.close();
    }
  }, 60_000);

  it("is deliberately non-idempotent and refuses an installed delta", async () => {
    const pg = await productionDatabase();
    try {
      await pg.exec(install);
      await expect(pg.exec(install)).rejects.toThrow(
        /already applied|wrappers already exist/i,
      );
      await pg.exec("rollback");
      expect((await pg.query(`
        select count(*)::integer as count from pg_proc
        where oid in (
          to_regprocedure(
            'public.forum_admin_set_suspension_by_username(text,integer,text)'
          ),
          to_regprocedure('public.forum_admin_list_suspensions()')
        )
      `)).rows[0].count).toBe(2);
    } finally {
      await pg.close();
    }
  }, 60_000);
});
