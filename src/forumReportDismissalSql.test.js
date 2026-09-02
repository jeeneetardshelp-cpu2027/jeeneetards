import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const forumV1 = readFileSync("src/migrations/forum_v1.sql", "utf8");
const preflight = readFileSync("src/migrations/forum_report_dismissal_v1_preflight.sql", "utf8");
const audit = readFileSync("src/migrations/forum_report_dismissal_v1_audit.sql", "utf8");
const migration = readFileSync("src/migrations/forum_report_dismissal_v1.sql", "utf8");
const postflight = readFileSync("src/migrations/forum_report_dismissal_v1_postflight.sql", "utf8");
const rollback = readFileSync("src/migrations/forum_report_dismissal_v1_rollback.sql", "utf8");

const IDS = {
  admin: "21000000-0000-4000-8000-000000000001",
  author: "21000000-0000-4000-8000-000000000002",
  reporter: "21000000-0000-4000-8000-000000000003",
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
      ('${IDS.author}', now() - interval '1 day'),
      ('${IDS.reporter}', now() - interval '1 day');
    insert into public.profiles (id, username, is_admin) values
      ('${IDS.admin}', 'forum_admin', true),
      ('${IDS.author}', 'student_author', false),
      ('${IDS.reporter}', 'student_reporter', false);
  `);
  await pg.exec(forumV1);
  return pg;
}

async function seedReport(pg, reason = "spam") {
  await setIdentity(pg, IDS.admin);
  await pg.query("select public.forum_admin_set_mode('open')");
  await setIdentity(pg, IDS.author);
  const post = await pg.query(`
    select public.forum_create_post(
      'physics', 'Does friction act up or down?',
      E'I drew the free-body diagram and need help with the direction.'
    ) as id
  `);
  const comment = await pg.query(
    "select public.forum_create_comment($1, null, 'Please check the limiting-friction condition.') as id",
    [post.rows[0].id],
  );
  await setIdentity(pg, IDS.reporter);
  const report = await pg.query(
    "select public.forum_submit_report('comment', $1, $2, 'Please review this reply') as id",
    [comment.rows[0].id, reason],
  );
  return {
    postId: post.rows[0].id,
    commentId: comment.rows[0].id,
    reportId: report.rows[0].id,
  };
}

async function contentSnapshot(pg, fixture) {
  const result = await pg.query(`
    select
      (select row_to_json(p) from (
        select title, body, hidden_at, hidden_by, hidden_reason, locked_at,
          locked_by, deleted_at
        from public.forum_posts where id = $1
      ) p) as post,
      (select row_to_json(c) from (
        select body, hidden_at, hidden_by, hidden_reason, deleted_at
        from public.forum_comments where id = $2
      ) c) as comment,
      (select count(*)::integer from public.forum_moderation_log) as moderation_log_count
  `, [fixture.postId, fixture.commentId]);
  return result.rows[0];
}

describe("forum report-dismissal SQL delta", () => {
  it("is atomic, deliberately non-idempotent, counts-only auditable, and rollback-guarded", () => {
    expect(preflight).toContain("begin transaction read only");
    expect(preflight).toContain("already exists; review drift before retrying");
    expect(audit).toContain("begin transaction read only");
    expect(audit).toContain("inconsistent_resolution_rows");
    expect(audit).not.toMatch(/\b(note|reporter_id|body|title)\b/);
    expect(migration).toContain("begin;");
    expect(migration).toContain("create function public.forum_admin_dismiss_report");
    expect(migration).not.toMatch(/if not exists/i);
    expect(migration.match(/update public\.forum_reports/g)).toHaveLength(1);
    expect(migration).not.toMatch(/(?:update|delete from|insert into) public\.forum_(?:posts|comments|moderation_log)/i);
    expect(rollback).toContain("app_environment is missing");
    expect(rollback).toContain("not in ('staging', 'test')");
  });

  it("dismisses only the pending report and records the acting admin", async () => {
    const pg = await database();
    try {
      await pg.exec(preflight);
      await pg.exec(audit);
      const fixture = await seedReport(pg);
      await pg.exec("reset role");
      await pg.exec(migration);
      await pg.exec(postflight);
      const before = await contentSnapshot(pg, fixture);

      await setIdentity(pg, IDS.admin);
      await pg.query("select public.forum_admin_dismiss_report($1)", [fixture.reportId]);
      await pg.exec("reset role");

      const state = await pg.query(`
        select status, resolved_at is not null as has_resolved_at, resolved_by
        from public.forum_reports where id = $1
      `, [fixture.reportId]);
      expect(state.rows[0]).toEqual({
        status: "dismissed",
        has_resolved_at: true,
        resolved_by: IDS.admin,
      });
      expect(await contentSnapshot(pg, fixture)).toEqual(before);

      await setIdentity(pg, IDS.admin);
      const queue = await pg.query("select id from public.forum_admin_list_reports(100)");
      expect(queue.rows).not.toContainEqual({ id: fixture.reportId });
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  });

  it("denies non-admin and anonymous roles and rejects repeat dismissal", async () => {
    const pg = await database();
    try {
      const fixture = await seedReport(pg);
      await pg.exec("reset role");
      await pg.exec(migration);

      await setIdentity(pg, IDS.reporter);
      await expect(pg.query("select public.forum_admin_dismiss_report($1)", [fixture.reportId]))
        .rejects.toThrow(/not authorized/i);
      await setIdentity(pg, null, "anon");
      await expect(pg.query("select public.forum_admin_dismiss_report($1)", [fixture.reportId]))
        .rejects.toThrow(/permission denied/i);

      await setIdentity(pg, IDS.admin);
      await pg.query("select public.forum_admin_dismiss_report($1)", [fixture.reportId]);
      await pg.exec("reset role");
      const first = await pg.query(
        "select resolved_at, resolved_by from public.forum_reports where id = $1",
        [fixture.reportId],
      );
      await setIdentity(pg, IDS.admin);
      await expect(pg.query("select public.forum_admin_dismiss_report($1)", [fixture.reportId]))
        .rejects.toThrow(/pending report not found/i);
      await pg.exec("reset role");
      const second = await pg.query(
        "select resolved_at, resolved_by from public.forum_reports where id = $1",
        [fixture.reportId],
      );
      expect(second.rows).toEqual(first.rows);
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  });

  it("can close a pending report whose polymorphic target has been removed", async () => {
    const pg = await database();
    try {
      const fixture = await seedReport(pg, "self_harm");
      await pg.exec("reset role");
      await pg.query("delete from public.forum_comments where id = $1", [fixture.commentId]);
      await pg.exec(migration);

      await setIdentity(pg, IDS.admin);
      await pg.query("select public.forum_admin_dismiss_report($1)", [fixture.reportId]);
      await pg.exec("reset role");
      const state = await pg.query(
        "select status, resolved_by from public.forum_reports where id = $1",
        [fixture.reportId],
      );
      expect(state.rows[0]).toEqual({ status: "dismissed", resolved_by: IDS.admin });
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  });

  it("removes only the RPC during guarded rollback and refuses production", async () => {
    const pg = await database();
    try {
      const fixture = await seedReport(pg);
      await pg.exec("reset role");
      await pg.exec(migration);
      await setIdentity(pg, IDS.admin);
      await pg.query("select public.forum_admin_dismiss_report($1)", [fixture.reportId]);
      await pg.exec("reset role");
      await pg.exec(rollback);
      const state = await pg.query(`
        select
          to_regprocedure('public.forum_admin_dismiss_report(bigint)') as rpc,
          (select status from public.forum_reports where id = $1) as report_status
      `, [fixture.reportId]);
      expect(state.rows[0]).toEqual({ rpc: null, report_status: "dismissed" });
    } finally {
      await pg.close();
    }

    const production = await database("production");
    try {
      await production.exec(migration);
      await expect(production.exec(rollback)).rejects.toThrow(/refused for environment production/i);
      await production.exec("rollback");
      const state = await production.query(
        "select to_regprocedure('public.forum_admin_dismiss_report(bigint)') is not null as installed",
      );
      expect(state.rows[0]).toEqual({ installed: true });
    } finally {
      await production.close();
    }
  }, 60_000);
});
