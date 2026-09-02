import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const forumV1 = readFileSync("src/migrations/forum_v1.sql", "utf8");
const usernameClaim = readFileSync("src/migrations/forum_username_claim_v1.sql", "utf8");
const preflight = readFileSync("src/migrations/forum_closed_beta_v1_preflight.sql", "utf8");
const audit = readFileSync("src/migrations/forum_closed_beta_v1_audit.sql", "utf8");
const migration = readFileSync("src/migrations/forum_closed_beta_v1.sql", "utf8");
const postflight = readFileSync("src/migrations/forum_closed_beta_v1_postflight.sql", "utf8");
const rollback = readFileSync("src/migrations/forum_closed_beta_v1_rollback.sql", "utf8");

const IDS = {
  admin: "31000000-0000-4000-8000-000000000001",
  member: "31000000-0000-4000-8000-000000000002",
  outsider: "31000000-0000-4000-8000-000000000003",
};

async function setIdentity(pg, id, role = "authenticated") {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  await pg.query("select set_config('request.jwt.claim.role', $1, false)", [role]);
  await pg.exec(`set role ${role}`);
}

async function database(environment = "test") {
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
    insert into auth.users (id, created_at) values
      ('${IDS.admin}', now() - interval '1 day'),
      ('${IDS.member}', now() - interval '1 day'),
      ('${IDS.outsider}', now() - interval '1 day');
    insert into public.profiles (id, username, is_admin) values
      ('${IDS.admin}', 'forum_admin', true),
      ('${IDS.member}', 'beta_student', false),
      ('${IDS.outsider}', 'outside_student', false);
  `);
  await pg.exec(forumV1);
  await pg.exec(usernameClaim);
  return pg;
}

async function setMode(pg, mode) {
  await setIdentity(pg, IDS.admin);
  const result = await pg.query("select public.forum_admin_set_mode($1) as mode", [mode]);
  return result.rows[0].mode;
}

async function createPost(pg, identity, title = "A beta question about friction") {
  await setIdentity(pg, identity);
  const result = await pg.query(`
    select public.forum_create_post(
      'physics', $1,
      'I drew the free-body diagram and need help checking the direction.'
    ) as id
  `, [title]);
  return result.rows[0].id;
}

describe("forum closed-beta SQL delta", () => {
  it("is atomic, deliberately non-idempotent, read-only auditable, and rollback-guarded", () => {
    expect(preflight).toContain("begin transaction read only");
    expect(preflight).toContain("forum mode must be off");
    expect(preflight).toContain("already exist; review drift before retrying");
    expect(audit).toContain("begin transaction read only");
    expect(audit).toContain("moderation_admin_ready");
    expect(audit).not.toMatch(/\b(email|full_name|avatar_url|user_id)\b/);
    expect(migration).toContain("begin;");
    expect(migration).toContain("create table public.forum_beta_members");
    expect(migration).not.toMatch(/if not exists/i);
    expect(migration).toContain("'off', 'read_only', 'beta', 'open'");
    expect(migration).toContain("closed beta access is required");
    expect(rollback).toContain("app_environment is missing");
    expect(rollback).toContain("not in ('staging', 'test')");
    expect(rollback).toContain("forum mode must be off");
  });

  it("installs with mode off, no members, fail-closed grants, and the reviewed constraints", async () => {
    const pg = await database();
    try {
      await pg.exec(preflight);
      await pg.exec(audit);
      await pg.exec(migration);
      await pg.exec(postflight);
      const state = await pg.query(`
        select
          public.forum_mode() as mode,
          (select count(*)::integer from public.forum_beta_members) as members,
          has_table_privilege('authenticated', 'public.forum_beta_members', 'select') as browser_reads,
          has_function_privilege('anon', 'public.forum_is_beta_member()', 'execute') as anon_check,
          has_function_privilege('authenticated', 'public.forum_is_beta_member()', 'execute') as user_check
      `);
      expect(state.rows[0]).toEqual({
        mode: "off", members: 0, browser_reads: false, anon_check: false, user_check: true,
      });
    } finally {
      await pg.close();
    }
  });

  it("allows only beta members to write in beta mode while public reads and reports remain available", async () => {
    const pg = await database();
    try {
      await pg.exec(migration);
      await setIdentity(pg, IDS.admin);
      expect((await pg.query(
        "select public.forum_admin_set_beta_member('BETA_STUDENT', true) as enabled",
      )).rows[0]).toEqual({ enabled: true });
      expect(await setMode(pg, "beta")).toBe("beta");

      await setIdentity(pg, IDS.member);
      expect((await pg.query("select public.forum_is_beta_member() as member")).rows[0])
        .toEqual({ member: true });
      const postId = await createPost(pg, IDS.member);

      await setIdentity(pg, IDS.outsider);
      expect((await pg.query("select public.forum_is_beta_member() as member")).rows[0])
        .toEqual({ member: false });
      await expect(createPost(pg, IDS.outsider, "An outsider cannot publish this"))
        .rejects.toThrow(/closed beta access is required/i);
      await expect(pg.query(
        "select public.forum_create_comment($1, null, 'This write must stay private to the beta.')",
        [postId],
      )).rejects.toThrow(/closed beta access is required/i);
      await expect(pg.query(
        "select * from public.forum_cast_vote('post', $1::bigint, 1::smallint)", [postId],
      )).rejects.toThrow(/closed beta access is required/i);
      await expect(pg.query(
        "select public.forum_edit_post($1, 'An outsider edit is rejected', 'This body must not replace the member post.')",
        [postId],
      )).rejects.toThrow(/closed beta access is required/i);
      await expect(pg.query(
        "select public.forum_toggle_solved($1)", [postId],
      )).rejects.toThrow(/closed beta access is required/i);
      const report = await pg.query(
        "select public.forum_submit_report('post', $1, 'other', 'Safety reports remain available') as id",
        [postId],
      );
      expect(report.rows[0].id).toBeTruthy();

      await setIdentity(pg, null, "anon");
      const topics = await pg.query("select slug from public.get_forum_topics()");
      const feed = await pg.query("select id from public.get_forum_feed(p_sort => 'new')");
      expect(topics.rows).toHaveLength(6);
      expect(feed.rows).toEqual([{ id: postId }]);

      expect(await setMode(pg, "read_only")).toBe("read_only");
      await expect(createPost(pg, IDS.member, "A member cannot write while paused"))
        .rejects.toThrow(/not open for contributions/i);

      expect(await setMode(pg, "open")).toBe("open");
      await expect(createPost(pg, IDS.outsider, "Public mode permits this student"))
        .resolves.toBeTruthy();
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 60_000);

  it("keeps beta membership admin-only, case-insensitive, auditable, and idempotent", async () => {
    const pg = await database();
    try {
      await pg.exec(migration);
      await setIdentity(pg, IDS.outsider);
      await expect(pg.query(
        "select public.forum_admin_set_beta_member('beta_student', true)",
      )).rejects.toThrow(/not authorized/i);
      await expect(pg.query("select * from public.forum_admin_list_beta_members()"))
        .rejects.toThrow(/not authorized/i);
      await expect(pg.query("select * from public.forum_beta_members"))
        .rejects.toThrow(/permission denied/i);

      await setIdentity(pg, null, "anon");
      await expect(pg.query("select public.forum_is_beta_member()"))
        .rejects.toThrow(/permission denied/i);

      await setIdentity(pg, IDS.admin);
      await pg.query("select public.forum_admin_set_beta_member('BETA_STUDENT', true)");
      await pg.query("select public.forum_admin_set_beta_member('beta_student', true)");
      const listed = await pg.query("select username, added_by_username from public.forum_admin_list_beta_members()");
      expect(listed.rows).toEqual([{ username: "beta_student", added_by_username: "forum_admin" }]);
      await pg.exec("reset role");
      const addedLogs = await pg.query(
        "select action from public.forum_moderation_log where action = 'beta_add'",
      );
      expect(addedLogs.rows).toHaveLength(1);

      await setIdentity(pg, IDS.admin);
      expect((await pg.query(
        "select public.forum_admin_set_beta_member('beta_student', false) as enabled",
      )).rows[0]).toEqual({ enabled: false });
      await pg.exec("reset role");
      const actions = await pg.query(`
        select action from public.forum_moderation_log
        where action in ('beta_add', 'beta_remove') order by id
      `);
      expect(actions.rows).toEqual([{ action: "beta_add" }, { action: "beta_remove" }]);
      await setIdentity(pg, IDS.admin);
      await expect(pg.query(
        "select public.forum_admin_set_beta_member('missing_student', true)",
      )).rejects.toThrow(/username not found/i);
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 60_000);

  it("rolls back only in test or staging while mode is off and refuses production", async () => {
    const pg = await database();
    try {
      await pg.exec(migration);
      await setIdentity(pg, IDS.admin);
      await pg.query("select public.forum_admin_set_beta_member('beta_student', true)");
      await pg.query("select public.forum_admin_set_mode('beta')");
      await pg.exec("reset role");
      await expect(pg.exec(rollback)).rejects.toThrow(/forum mode must be off/i);
      await pg.exec("rollback");

      await setMode(pg, "off");
      await pg.exec("reset role");
      await pg.exec(rollback);
      const state = await pg.query(`
        select
          to_regclass('public.forum_beta_members') as beta_table,
          to_regprocedure('public.forum_is_beta_member()') as beta_check,
          public.forum_mode() as mode,
          (select count(*)::integer from public.forum_moderation_log
            where action in ('beta_add', 'beta_remove')) as beta_logs
      `);
      expect(state.rows[0]).toEqual({ beta_table: null, beta_check: null, mode: "off", beta_logs: 0 });
      await setIdentity(pg, IDS.admin);
      await expect(pg.query("select public.forum_admin_set_mode('beta')"))
        .rejects.toThrow(/invalid forum mode/i);
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }

    const production = await database("production");
    try {
      await production.exec(migration);
      await expect(production.exec(rollback)).rejects.toThrow(/refused for environment production/i);
      await production.exec("rollback");
      const installed = await production.query(
        "select to_regclass('public.forum_beta_members') is not null as installed",
      );
      expect(installed.rows[0]).toEqual({ installed: true });
    } finally {
      await production.close();
    }
  }, 60_000);
});
