import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const forumV1 = readFileSync("src/migrations/forum_v1.sql", "utf8");
const preflight = readFileSync("src/migrations/forum_moderation_context_v1_preflight.sql", "utf8");
const audit = readFileSync("src/migrations/forum_moderation_context_v1_audit.sql", "utf8");
const migration = readFileSync("src/migrations/forum_moderation_context_v1.sql", "utf8");
const postflight = readFileSync("src/migrations/forum_moderation_context_v1_postflight.sql", "utf8");
const rollback = readFileSync("src/migrations/forum_moderation_context_v1_rollback.sql", "utf8");

const IDS = {
  admin: "20000000-0000-4000-8000-000000000001",
  author: "20000000-0000-4000-8000-000000000002",
  reporter: "20000000-0000-4000-8000-000000000003",
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
      ('${IDS.reporter}', now() - interval '1 day');
    insert into public.profiles (id, username, is_admin) values
      ('${IDS.admin}', 'forum_admin', true),
      ('${IDS.author}', 'student_author', false),
      ('${IDS.reporter}', 'student_reporter', false);
  `);
  await pg.exec(forumV1);
  return pg;
}

async function seedCommentReport(pg) {
  await setIdentity(pg, IDS.admin);
  await pg.query("select public.forum_admin_set_mode('open')");
  await setIdentity(pg, IDS.author);
  const post = await pg.query(`
    select public.forum_create_post(
      'physics', 'Why is the normal force zero here?',
      E'I tried using F = ma.\n\nThe diagram still confuses me.'
    ) as id
  `);
  const postId = post.rows[0].id;
  const comment = await pg.query(
    "select public.forum_create_comment($1, null, E'This reply has\nseveral   spaces and the key explanation.') as id",
    [postId],
  );
  await setIdentity(pg, IDS.reporter);
  const report = await pg.query(
    "select public.forum_submit_report('comment', $1, 'self_harm', 'Please review urgently') as id",
    [comment.rows[0].id],
  );
  return { postId, commentId: comment.rows[0].id, reportId: report.rows[0].id };
}

describe("forum moderation-context SQL delta", () => {
  it("is atomic, deliberately non-idempotent, read-auditable, and rollback-guarded", () => {
    expect(preflight).toContain("begin transaction read only");
    expect(audit).toContain("begin transaction read only");
    expect(audit).toContain("pending_reports_with_missing_targets");
    expect(migration).toContain("begin;");
    expect(migration).toContain("drop function public.forum_admin_list_reports(integer)");
    expect(migration).not.toMatch(/if not exists/i);
    expect(rollback).toContain("app_environment is missing");
    expect(rollback).toContain("not in ('staging', 'test')");
  });

  it("returns actionable post and target context while preserving urgent ordering", async () => {
    const pg = await database();
    try {
      await pg.exec(preflight);
      await pg.exec(audit);
      const fixture = await seedCommentReport(pg);
      await pg.exec("reset role");
      await pg.exec(migration);
      await pg.exec(postflight);

      await setIdentity(pg, IDS.admin);
      const result = await pg.query("select * from public.forum_admin_list_reports(100)");
      expect(result.rows[0]).toMatchObject({
        id: fixture.reportId,
        target_type: "comment",
        target_id: fixture.commentId,
        reason: "self_harm",
        priority: "urgent",
        post_id: fixture.postId,
        topic_slug: "physics",
        post_title: "Why is the normal force zero here?",
        target_author_username: "student_author",
        content_preview: "This reply has several spaces and the key explanation.",
        target_exists: true,
        target_is_hidden: false,
        target_is_deleted: false,
        post_is_locked: false,
      });
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 30_000);

  it("denies real non-admin and anonymous roles and represents a removed target safely", async () => {
    const pg = await database();
    try {
      const fixture = await seedCommentReport(pg);
      await pg.exec("reset role");
      await pg.exec(migration);

      await setIdentity(pg, IDS.reporter);
      await expect(pg.query("select * from public.forum_admin_list_reports(100)"))
        .rejects.toThrow(/not authorized/i);
      await setIdentity(pg, null, "anon");
      await expect(pg.query("select * from public.forum_admin_list_reports(100)"))
        .rejects.toThrow(/permission denied/i);

      await pg.exec("reset role");
      await pg.query("delete from public.forum_comments where id = $1", [fixture.commentId]);
      await setIdentity(pg, IDS.admin);
      const result = await pg.query("select * from public.forum_admin_list_reports(100)");
      expect(result.rows[0]).toMatchObject({
        id: fixture.reportId,
        post_id: null,
        content_preview: null,
        target_exists: false,
      });
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 30_000);

  it("restores the reviewed forum v1 report-list contract", async () => {
    const pg = await database();
    try {
      await seedCommentReport(pg);
      await pg.exec("reset role");
      await pg.exec(migration);
      await pg.exec(rollback);
      await setIdentity(pg, IDS.admin);
      const result = await pg.query("select * from public.forum_admin_list_reports(100)");
      expect(Object.keys(result.rows[0])).toEqual([
        "id", "reporter_id", "target_type", "target_id", "reason",
        "note", "priority", "status", "created_at",
      ]);
    } finally {
      await pg.exec("reset role").catch(() => {});
      await pg.close();
    }
  }, 30_000);
});
