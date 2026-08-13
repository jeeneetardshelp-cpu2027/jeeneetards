import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const forumV1 = readFileSync("src/migrations/forum_v1.sql", "utf8");
const usernameClaim = readFileSync("src/migrations/forum_username_claim_v1.sql", "utf8");
const closedBeta = readFileSync("src/migrations/forum_closed_beta_v1.sql", "utf8");
const preflight = readFileSync("src/migrations/forum_suspension_admin_v1_preflight.sql", "utf8");
const audit = readFileSync("src/migrations/forum_suspension_admin_v1_audit.sql", "utf8");
const migration = readFileSync("src/migrations/forum_suspension_admin_v1.sql", "utf8");
const postflight = readFileSync("src/migrations/forum_suspension_admin_v1_postflight.sql", "utf8");
const rollback = readFileSync("src/migrations/forum_suspension_admin_v1_rollback.sql", "utf8");

const IDS = {
  admin: "22000000-0000-4000-8000-000000000001",
  author: "22000000-0000-4000-8000-000000000002",
  other: "22000000-0000-4000-8000-000000000003",
};

async function setIdentity(pg, id, role = "authenticated") {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  await pg.query("select set_config('request.jwt.claim.role', $1, false)", [role]);
  await pg.exec(`set role ${role}`);
}

async function database() {
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
    insert into public.app_environment (id, name) values (true, 'test');
    insert into auth.users (id, created_at) values
      ('${IDS.admin}', now() - interval '1 day'),
      ('${IDS.author}', now() - interval '1 day'),
      ('${IDS.other}', now() - interval '1 day');
    insert into public.profiles (id, username, is_admin) values
      ('${IDS.admin}', 'forum_admin', true),
      ('${IDS.author}', 'rohit_', false),
      ('${IDS.other}', 'student_two', false);
  `);
  await pg.exec(forumV1);
  await pg.exec(usernameClaim);
  await pg.exec("reset role");
  return pg;
}

async function openForum(pg) {
  await setIdentity(pg, IDS.admin);
  await pg.query("select public.forum_admin_set_mode('open')");
  await pg.exec("reset role");
}

// forum_v1 rejects a duplicate recent post, so each call needs distinct text.
const post = (pg, label = "one") => pg.query(
  "select public.forum_create_post('physics', $1, $2) as id",
  [`A real preparation question ${label}`, `Body ${label} with enough detail to pass validation.`],
);

describe("forum suspension-admin SQL delta", () => {
  it("is atomic, deliberately non-idempotent, counts-only auditable, and rollback-guarded", () => {
    expect(preflight).toContain("begin transaction read only");
    expect(preflight).toContain("already applied; review drift before retrying");
    expect(audit).toContain("begin transaction read only");
    // Counts only. Comments are stripped first so the explanatory header does
    // not satisfy the very assertion it describes.
    const auditSql = audit.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
    expect(auditSql).not.toMatch(/\b(username|reason)\b/i);
    expect(auditSql).not.toMatch(/public\.profiles/);
    expect(migration).toContain("begin;");
    expect(migration).not.toMatch(/if not exists/i);
    // The wrapper must delegate rather than re-implement the suspension write,
    // so the moderation-log entry keeps coming from one reviewed place.
    expect(migration).toContain("perform public.forum_admin_set_suspension(");
    expect(migration).not.toMatch(/insert into public\.forum_suspensions/i);
    expect(migration).not.toMatch(/delete from public\.forum_suspensions/i);
    expect(rollback).toContain("not in ('staging', 'test')");
    expect(rollback).not.toMatch(/delete from public\.forum_suspensions/i);
  });

  it("suspends by username, blocks that student from posting, and lifts cleanly", async () => {
    const pg = await database();
    try {
      await pg.exec(preflight);
      await pg.exec(audit);
      await pg.exec(migration);
      await pg.exec(postflight);
      await openForum(pg);

      // The author can contribute before any suspension.
      await setIdentity(pg, IDS.author);
      await post(pg);

      // Case-insensitive, and a trailing underscore is a legal claimed handle.
      await setIdentity(pg, IDS.admin);
      const applied = await pg.query(
        "select * from public.forum_admin_set_suspension_by_username($1, $2, $3)",
        ["ROHIT_", 7, "Repeated abuse after warnings"],
      );
      expect(applied.rows[0].username).toBe("rohit_");
      expect(applied.rows[0].reason).toBe("Repeated abuse after warnings");
      expect(new Date(applied.rows[0].suspended_until).getTime())
        .toBeGreaterThan(Date.now());

      await setIdentity(pg, IDS.author);
      await expect(post(pg, "two")).rejects.toThrow(/temporarily suspended/i);

      await setIdentity(pg, IDS.admin);
      const listed = await pg.query("select * from public.forum_admin_list_suspensions()");
      expect(listed.rows).toHaveLength(1);
      expect(listed.rows[0]).toMatchObject({
        username: "rohit_", is_active: true, created_by_username: "forum_admin",
      });

      const lifted = await pg.query(
        "select * from public.forum_admin_set_suspension_by_username($1, $2, $3)",
        ["rohit_", null, "Appeal accepted"],
      );
      expect(lifted.rows[0]).toMatchObject({ username: "rohit_", suspended_until: null });

      await setIdentity(pg, IDS.author);
      await post(pg, "three");

      // The moderation log is deliberately unreadable by any browser role, so
      // this audit read runs as the table owner rather than as the admin JWT.
      await pg.exec("reset role");
      const log = await pg.query(`
        select action, count(*)::integer as entries from public.forum_moderation_log
        where action in ('suspend', 'unsuspend') group by action order by action
      `);
      await setIdentity(pg, IDS.admin);
      expect(log.rows).toEqual([
        { action: "suspend", entries: 1 },
        { action: "unsuspend", entries: 1 },
      ]);
      expect((await pg.query("select * from public.forum_admin_list_suspensions()")).rows)
        .toHaveLength(0);
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 60_000);

  it("refuses non-admins, unknown usernames, moderators, and unusable durations", async () => {
    const pg = await database();
    try {
      await pg.exec(migration);
      await openForum(pg);

      await setIdentity(pg, IDS.other);
      await expect(pg.query(
        "select * from public.forum_admin_set_suspension_by_username($1, $2, $3)",
        ["rohit_", 7, "not allowed"],
      )).rejects.toThrow(/not authorized/i);
      await expect(pg.query("select * from public.forum_admin_list_suspensions()"))
        .rejects.toThrow(/not authorized/i);

      await setIdentity(pg, null, "anon");
      await expect(pg.query("select * from public.forum_admin_list_suspensions()"))
        .rejects.toThrow(/permission denied/i);

      await setIdentity(pg, IDS.admin);
      await expect(pg.query(
        "select * from public.forum_admin_set_suspension_by_username($1, $2, $3)",
        ["nobody_here", 7, "unknown student"],
      )).rejects.toThrow(/username not found/i);
      await expect(pg.query(
        "select * from public.forum_admin_set_suspension_by_username($1, $2, $3)",
        ["forum_admin", 7, "locking out the moderator"],
      )).rejects.toThrow(/moderator accounts cannot be suspended/i);
      await expect(pg.query(
        "select * from public.forum_admin_set_suspension_by_username($1, $2, $3)",
        ["rohit_", 7, "no"],
      )).rejects.toThrow(/3 to 500 character suspension reason/i);
      await expect(pg.query(
        "select * from public.forum_admin_set_suspension_by_username($1, $2, $3)",
        ["rohit_", 400, "far too long"],
      )).rejects.toThrow(/limited to 365 days/i);

      // None of the refusals may leave a partial suspension behind.
      expect((await pg.query("select * from public.forum_admin_list_suspensions()")).rows)
        .toHaveLength(0);
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 60_000);

  it("allows an existing suspension to be lifted after the student becomes a moderator", async () => {
    const pg = await database();
    try {
      await pg.exec(migration);
      await openForum(pg);
      await setIdentity(pg, IDS.admin);
      await pg.query(
        "select * from public.forum_admin_set_suspension_by_username($1, $2, $3)",
        ["rohit_", 7, "Suspended before promotion"],
      );

      // Promotion can happen after the suspension was recorded. The browser
      // has only the username, so refusing this lift would strand the row from
      // the eventual admin UI even though the UUID RPC can remove it.
      await pg.exec("reset role");
      await pg.exec(`update public.profiles set is_admin = true where id = '${IDS.author}'`);
      await setIdentity(pg, IDS.admin);
      const lifted = await pg.query(
        "select * from public.forum_admin_set_suspension_by_username($1, $2, $3)",
        ["rohit_", null, "Lifted after moderator promotion"],
      );
      expect(lifted.rows[0]).toMatchObject({
        username: "rohit_", suspended_until: null, reason: null,
      });
      expect((await pg.query("select * from public.forum_admin_list_suspensions()")).rows)
        .toHaveLength(0);
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 60_000);

  // Both scenarios below were found by an independent review of this delta.
  // Each one passed preflight before the guard existed.
  it("refuses to install where a username is not single-valued", async () => {
    const pg = await database();
    try {
      // The case-insensitive unique index is what makes lower(btrim(username))
      // resolve to one student. Without it, SELECT INTO picks one arbitrarily
      // and the wrong person is suspended.
      await pg.exec("drop index public.forum_profiles_username_ci_idx");
      await expect(pg.exec(preflight)).rejects.toThrow(/forum_profiles_username_ci_idx is missing/i);
      await pg.exec("rollback");

      await pg.exec(`
        create unique index forum_profiles_username_ci_idx
          on public.profiles (lower(btrim(username))) where username is not null;
      `);
      await pg.exec(preflight);

      // An index present but data already colliding must also be refused.
      await pg.exec("drop index public.forum_profiles_username_ci_idx");
      await pg.exec(`
        insert into auth.users (id, created_at)
        values ('22000000-0000-4000-8000-000000000009', now() - interval '1 day');
        insert into public.profiles (id, username) values
          ('22000000-0000-4000-8000-000000000009', 'ROHIT_');
        create index forum_profiles_username_ci_idx
          on public.profiles (lower(btrim(username))) where username is not null;
      `);
      await expect(pg.exec(preflight)).rejects.toThrow(/not unique, or not valid/i);
      await pg.exec("rollback");

      // Defence in depth: even installed against such a database, the wrapper
      // refuses rather than suspending an arbitrary one of the two students.
      await pg.exec(migration);
      await setIdentity(pg, IDS.admin);
      await expect(pg.query(
        "select * from public.forum_admin_set_suspension_by_username($1, $2, $3)",
        ["rohit_", 7, "ambiguous target"],
      )).rejects.toThrow(/matches more than one profile/i);
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 60_000);

  it("refuses a moderation log that cannot record both suspend and unsuspend", async () => {
    const pg = await database();
    try {
      // A missing constraint yields NULL, and `NULL not like ...` is NULL, so
      // an inline test would silently pass here.
      await pg.exec("alter table public.forum_moderation_log drop constraint forum_moderation_log_action_check");
      await expect(pg.exec(preflight)).rejects.toThrow(/action constraint is missing/i);
      await pg.exec("rollback");

      // 'unsuspend' contains the substring suspend, so an unquoted match would
      // pass on a constraint that cannot record a suspension at all.
      await pg.exec(`
        alter table public.forum_moderation_log
          add constraint forum_moderation_log_action_check check (action in ('unsuspend'));
      `);
      await expect(pg.exec(preflight)).rejects.toThrow(/does not permit the suspend action/i);
      await pg.exec("rollback");

      // Merely mentioning both literals is not proof that both are allowed.
      // This constraint rejects suspend while containing both quoted words.
      await pg.exec(`
        alter table public.forum_moderation_log
          drop constraint forum_moderation_log_action_check;
        alter table public.forum_moderation_log
          add constraint forum_moderation_log_action_check
          check (action <> 'suspend' or action = 'unsuspend');
      `);
      await expect(pg.exec(preflight)).rejects.toThrow(/not the reviewed positive allow-list shape/i);
      await pg.exec("rollback");
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 60_000);

  it("accepts both reviewed forum-v1 and closed-beta action allow-lists", async () => {
    const pg = await database();
    try {
      await pg.exec(preflight);
      await pg.exec(closedBeta);
      await pg.exec(preflight);
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 60_000);

  it("removes only its own wrappers on guarded rollback and keeps suspension history", async () => {
    const pg = await database();
    try {
      await pg.exec(migration);
      await openForum(pg);
      await setIdentity(pg, IDS.admin);
      await pg.query(
        "select * from public.forum_admin_set_suspension_by_username($1, $2, $3)",
        ["rohit_", 3, "Retained across rollback"],
      );
      await pg.exec("reset role");

      // A present-but-empty marker table is unmarked. SQL NULL semantics must
      // not let the staging/test-only rollback run there.
      await pg.exec("delete from public.app_environment");
      await expect(pg.exec(rollback)).rejects.toThrow(/environment unmarked/i);
      await pg.exec("rollback");
      expect((await pg.query(`
        select to_regprocedure(
          'public.forum_admin_set_suspension_by_username(text,integer,text)'
        ) is not null as wrapper_retained
      `)).rows[0].wrapper_retained).toBe(true);

      await pg.exec("insert into public.app_environment (id, name) values (true, 'test')");
      await pg.exec(rollback);

      const state = await pg.query(`
        select
          to_regprocedure('public.forum_admin_set_suspension_by_username(text,integer,text)') as wrapper,
          to_regprocedure('public.forum_admin_list_suspensions()') as lister,
          to_regprocedure('public.forum_admin_set_suspension(uuid,timestamptz,text)') is not null as reviewed_rpc,
          (select count(*)::integer from public.forum_suspensions) as rows_kept
      `);
      expect(state.rows[0]).toEqual({
        wrapper: null, lister: null, reviewed_rpc: true, rows_kept: 1,
      });
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 60_000);
});
