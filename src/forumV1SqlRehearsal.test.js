import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync("src/migrations/forum_v1.sql", "utf8");
const postflight = readFileSync("src/migrations/forum_v1_postflight.sql", "utf8");
const rollback = readFileSync("src/migrations/forum_v1_rollback.sql", "utf8");

const IDS = {
  admin: "00000000-0000-4000-8000-000000000001",
  author: "00000000-0000-4000-8000-000000000002",
  voter: "00000000-0000-4000-8000-000000000003",
  reporter2: "00000000-0000-4000-8000-000000000004",
  reporter3: "00000000-0000-4000-8000-000000000005",
};

async function setIdentity(pg, id, role = "authenticated") {
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  await pg.query("select set_config('request.jwt.claim.role', $1, false)", [role]);
}

async function forumDatabase() {
  const pg = new PGlite();
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
    insert into public.app_environment (id, name) values (true, 'test');

    insert into auth.users (id, created_at) values
      ('${IDS.admin}', now() - interval '1 day'),
      ('${IDS.author}', now() - interval '1 day'),
      ('${IDS.voter}', now() - interval '1 day'),
      ('${IDS.reporter2}', now() - interval '1 day'),
      ('${IDS.reporter3}', now() - interval '1 day');
    insert into public.profiles (id, username, is_admin) values
      ('${IDS.admin}', 'forum_admin', true),
      ('${IDS.author}', 'student_author', false),
      ('${IDS.voter}', 'student_voter', false),
      ('${IDS.reporter2}', 'student_reporter2', false),
      ('${IDS.reporter3}', 'student_reporter3', false);
  `);
  await pg.exec(migration);
  return pg;
}

async function openForum(pg) {
  await setIdentity(pg, IDS.admin);
  const result = await pg.query("select public.forum_admin_set_mode('open') as mode");
  expect(result.rows[0].mode).toBe("open");
}

async function createPost(pg) {
  await setIdentity(pg, IDS.author);
  const result = await pg.query(`
    select public.forum_create_post(
      'physics',
      'Why does normal force become zero?',
      'I understand the equation, but I do not understand the physical reason.'
    ) as id
  `);
  return result.rows[0].id;
}

describe("forum v1 ephemeral PostgreSQL rehearsal", () => {
  it("executes cleanly, starts off, and passes the read-only postflight", async () => {
    const pg = await forumDatabase();
    try {
      const state = await pg.query(`
        select
          (select mode from public.forum_settings where id) as mode,
          (select count(*)::integer from public.forum_topics where is_active) as topics,
          (select count(*)::integer from public.forum_topics where slug in ('motivation','general')) as deferred
      `);
      expect(state.rows[0]).toEqual({ mode: "off", topics: 6, deferred: 0 });
      await pg.exec(postflight);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("enforces mode, public reads, identity, votes, karma, and recount integrity", async () => {
    const pg = await forumDatabase();
    try {
      await setIdentity(pg, IDS.author);
      await expect(pg.query(`select public.forum_create_post('physics','A valid forum title','A valid body')`))
        .rejects.toThrow(/not open/i);

      await openForum(pg);
      const postId = await createPost(pg);

      await setIdentity(pg, IDS.voter);
      const upvote = await pg.query(
        "select * from public.forum_cast_vote('post', $1, 1::smallint)", [postId],
      );
      expect(upvote.rows[0]).toMatchObject({ viewer_vote: 1, score: 1, upvote_count: 1, downvote_count: 0 });
      const flip = await pg.query(
        "select * from public.forum_cast_vote('post', $1, (-1)::smallint)", [postId],
      );
      expect(flip.rows[0]).toMatchObject({ viewer_vote: -1, score: -1, upvote_count: 0, downvote_count: 1 });

      const stats = await pg.query("select karma from public.forum_user_stats where user_id = $1", [IDS.author]);
      expect(stats.rows[0].karma).toBe(-1);

      await setIdentity(pg, IDS.author);
      await pg.query("select * from public.forum_cast_vote('post', $1, 1::smallint)", [postId]);
      const selfStats = await pg.query("select karma from public.forum_user_stats where user_id = $1", [IDS.author]);
      expect(selfStats.rows[0].karma).toBe(-1);

      await setIdentity(pg, IDS.admin);
      const drift = await pg.query("select * from public.forum_recount_metrics(false)");
      expect(drift.rows).toHaveLength(0);
      const karmaDrift = await pg.query("select * from public.forum_recount_karma(false)");
      expect(karmaDrift.rows).toHaveLength(0);

      await setIdentity(pg, IDS.voter);
      const feed = await pg.query("select * from public.get_forum_feed() where id = $1", [postId]);
      expect(feed.rows).toHaveLength(1);
      expect(feed.rows[0].author_username).toBe("student_author");
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("searches LIKE metacharacters literally and rejects incomplete cursors", async () => {
    const pg = await forumDatabase();
    try {
      await openForum(pg);
      const firstId = await createPost(pg);
      await setIdentity(pg, IDS.voter);
      await pg.query(`
        select public.forum_create_post(
          'mathematics', 'Understanding a 100% score safely',
          'What does 100%_complete mean when a path contains C:\\notes?'
        )
      `);
      const percent = await pg.query("select id from public.get_forum_feed(p_query => '%')");
      expect(percent.rows).toHaveLength(1);
      const underscore = await pg.query("select id from public.get_forum_feed(p_query => '_complete')");
      expect(underscore.rows).toHaveLength(1);
      const slash = await pg.query("select id from public.get_forum_feed(p_query => 'C:\\notes')");
      expect(slash.rows).toHaveLength(1);
      await expect(pg.query(`
        select * from public.get_forum_feed(
          p_sort => 'hot', p_cursor_id => $1, p_cursor_created_at => now()
        )
      `, [firstId])).rejects.toThrow(/incomplete forum cursor for hot/i);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("enforces same-post parents, maximum depth, and author tombstones", async () => {
    const pg = await forumDatabase();
    try {
      await openForum(pg);
      const postId = await createPost(pg);
      await setIdentity(pg, IDS.author);
      const second = await pg.query(`
        select public.forum_create_post(
          'chemistry', 'A second valid forum question', 'This is another complete question body.'
        ) as id
      `);
      const otherPostId = second.rows[0].id;
      let parentId = null;
      for (let depth = 0; depth <= 10; depth += 1) {
        const row = await pg.query(
          "select public.forum_create_comment($1, $2, $3) as id",
          [postId, parentId, `A useful answer at depth ${depth}`],
        );
        parentId = row.rows[0].id;
      }
      await expect(pg.query(
        "select public.forum_create_comment($1, $2, 'Too deep')", [postId, parentId],
      )).rejects.toThrow(/maximum comment depth/i);
      await expect(pg.query(
        "select public.forum_create_comment($1, $2, 'Wrong thread')", [otherPostId, parentId],
      )).rejects.toThrow(/not in this post|foreign key/i);

      const first = await pg.query(
        "select id from public.forum_comments where post_id = $1 order by depth limit 1", [postId],
      );
      await pg.query("select public.forum_delete_comment($1)", [first.rows[0].id]);
      const comments = await pg.query("select * from public.get_forum_comments($1)", [postId]);
      expect(comments.rows).toHaveLength(11);
      expect(comments.rows.find((row) => row.id === first.rows[0].id)).toMatchObject({
        body: "[deleted]", is_tombstone: true,
      });
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("keeps self-harm reports visible but auto-hides after three other distinct reports", async () => {
    const pg = await forumDatabase();
    try {
      await openForum(pg);
      const postId = await createPost(pg);

      await setIdentity(pg, IDS.voter);
      await pg.query("select public.forum_submit_report('post', $1, 'self_harm', null)", [postId]);
      let post = await pg.query("select hidden_at from public.forum_posts where id = $1", [postId]);
      expect(post.rows[0].hidden_at).toBeNull();

      for (const reporter of [IDS.voter, IDS.reporter2, IDS.reporter3]) {
        await setIdentity(pg, reporter);
        await pg.query("select public.forum_submit_report('post', $1, 'spam', null)", [postId]);
      }
      post = await pg.query("select hidden_at from public.forum_posts where id = $1", [postId]);
      expect(post.rows[0].hidden_at).not.toBeNull();
      const log = await pg.query("select action from public.forum_moderation_log where target_id = $1", [postId]);
      expect(log.rows.some((row) => row.action === "auto_hide")).toBe(true);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("allows safety reports but blocks publishing in read-only mode", async () => {
    const pg = await forumDatabase();
    try {
      await openForum(pg);
      const postId = await createPost(pg);
      await setIdentity(pg, IDS.admin);
      await pg.query("select public.forum_admin_set_mode('read_only')");

      await setIdentity(pg, IDS.voter);
      await expect(pg.query(`
        select public.forum_create_post('physics', 'Another valid question title', 'Another valid question body')
      `)).rejects.toThrow(/not open/i);
      const report = await pg.query(
        "select public.forum_submit_report('post', $1, 'spam', null) as id", [postId],
      );
      expect(report.rows[0].id).toBeTruthy();
      const visible = await pg.query("select id from public.get_forum_post($1)", [postId]);
      expect(visible.rows).toHaveLength(1);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("anonymizes account content and clears its karma attribution without breaking threads", async () => {
    const pg = await forumDatabase();
    try {
      await openForum(pg);
      const postId = await createPost(pg);
      await setIdentity(pg, IDS.voter);
      await pg.query("select * from public.forum_cast_vote('post', $1, 1::smallint)", [postId]);

      await setIdentity(pg, IDS.admin);
      await pg.query("delete from public.profiles where id = $1", [IDS.author]);
      const post = await pg.query(`
        select title, body, author_id, deleted_at is not null as deleted
        from public.forum_posts where id = $1
      `, [postId]);
      expect(post.rows[0]).toMatchObject({
        title: "[deleted]", body: "", author_id: null, deleted: true,
      });
      const vote = await pg.query("select target_author_id from public.forum_votes where post_id = $1", [postId]);
      expect(vote.rows[0].target_author_id).toBeNull();
      const stats = await pg.query("select * from public.forum_user_stats where user_id = $1", [IDS.author]);
      expect(stats.rows).toHaveLength(0);
      const drift = await pg.query("select * from public.forum_recount_karma(false)");
      expect(drift.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("removes vote karma transactionally when an admin permanently removes a target", async () => {
    const pg = await forumDatabase();
    try {
      await openForum(pg);
      const postId = await createPost(pg);
      await setIdentity(pg, IDS.voter);
      await pg.query("select * from public.forum_cast_vote('post', $1, 1::smallint)", [postId]);
      await setIdentity(pg, IDS.admin);
      await pg.query(`
        select public.forum_admin_moderate('post', $1, 'remove', 'personal information', null)
      `, [postId]);
      const stats = await pg.query("select karma from public.forum_user_stats where user_id = $1", [IDS.author]);
      expect(stats.rows[0].karma).toBe(0);
      const drift = await pg.query("select * from public.forum_recount_karma(false)");
      expect(drift.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("denies direct browser table access and the guarded rollback removes only forum objects", async () => {
    const pg = await forumDatabase();
    try {
      await pg.exec("set role anon");
      await expect(pg.query("select * from public.forum_posts"))
        .rejects.toThrow(/permission denied/i);
      const mode = await pg.query("select public.forum_mode() as mode");
      expect(mode.rows[0].mode).toBe("off");
      await expect(pg.query("select public.forum_create_post('physics','A valid title here','A valid body')"))
        .rejects.toThrow(/permission denied/i);
      await pg.exec("reset role");

      await pg.exec(rollback);
      const objects = await pg.query("select to_regclass('public.forum_posts') as posts, to_regclass('public.profiles') as profiles");
      expect(objects.rows[0]).toEqual({ posts: null, profiles: "profiles" });
    } finally {
      await pg.close();
    }
  }, 30_000);
});
