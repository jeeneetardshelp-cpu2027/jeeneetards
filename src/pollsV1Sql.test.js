// pollsV1Sql.test.js -- runs src/migrations/polls_v1.sql inside a real
// Postgres (pglite) and exercises the rules that matter, as the forum SQL
// tests do. A migration that only ever gets read is a migration nobody has
// checked.
//
// The rules under test are the ones a component test cannot see:
//   * a student submission can never publish itself
//   * results stay hidden until the viewer has voted
//   * one vote per student, changeable
//   * picture links are restricted to an approved host list
//   * browser roles have no direct table access at all

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const migration = readFileSync("src/migrations/polls_v1.sql", "utf8");
const preflight = readFileSync("src/migrations/polls_v1_preflight.sql", "utf8");
const postflight = readFileSync("src/migrations/polls_v1_postflight.sql", "utf8");
const rollback = readFileSync("src/migrations/polls_v1_rollback.sql", "utf8");

const IDS = {
  admin: "41000000-0000-4000-8000-000000000001",
  student: "41000000-0000-4000-8000-000000000002",
  other: "41000000-0000-4000-8000-000000000003",
  fresh: "41000000-0000-4000-8000-000000000004",
};

async function setIdentity(pg, id, role = "authenticated") {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  await pg.exec(`set role ${role}`);
}

// The prerequisites polls_v1.sql declares: identity, the admin boundary, and
// the two forum tables it deliberately reads rather than duplicating.
async function scaffold(pg) {
  await pg.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $fn$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $fn$;
    create function auth.role() returns text language sql stable as $fn$
      select nullif(current_setting('request.jwt.claim.role', true), '')
    $fn$;
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      username text unique, full_name text, avatar_url text,
      is_admin boolean not null default false,
      created_at timestamptz not null default now()
    );
    create function public.is_admin() returns boolean
    language sql stable security definer set search_path = '' as $fn$
      select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    $fn$;
    create table public.forum_topics (
      id bigint generated always as identity primary key,
      slug text not null unique,
      name text not null,
      description text,
      kind text not null,
      display_order integer not null default 1000,
      is_active boolean not null default true
    );
    create table public.forum_suspensions (
      user_id uuid primary key references public.profiles(id) on delete cascade,
      suspended_until timestamptz not null,
      reason text not null,
      created_at timestamptz not null default now()
    );
    create table public.app_environment (
      id boolean primary key default true check (id),
      name text not null check (name in ('production','staging','test'))
    );
    insert into public.app_environment (id, name) values (true, 'test');
    insert into public.forum_topics (slug, name, kind, display_order) values
      ('physics', 'Physics', 'academic', 10),
      ('strategy', 'Strategy', 'non_academic', 50);
    insert into auth.users (id, created_at) values
      ('${IDS.admin}',   now() - interval '1 day'),
      ('${IDS.student}', now() - interval '1 day'),
      ('${IDS.other}',   now() - interval '1 day'),
      ('${IDS.fresh}',   now() - interval '1 minute');
    insert into public.profiles (id, username, is_admin) values
      ('${IDS.admin}',   'poll_admin',   true),
      ('${IDS.student}', 'ravi_student', false),
      ('${IDS.other}',   'meera_student', false),
      ('${IDS.fresh}',   'brand_new',    false);
  `);
}

async function setMode(pg, mode) {
  await setIdentity(pg, IDS.admin);
  await pg.query("select public.poll_admin_set_mode($1)", [mode]);
}

const OPTIONS = JSON.stringify([
  { label: "Two hours" },
  { label: "Four hours" },
  { label: "Six hours or more" },
]);

// Drop back to the owning role, for assertions that read the tables directly
// rather than through an RPC.
async function asOwner(pg) {
  await pg.exec("reset role");
}

// Submissions are throttled to two a day on purpose, which would otherwise
// make every later test depend on how many polls the earlier ones created.
// Tests that are not ABOUT throttling clear the ledger first.
async function clearRateEvents(pg) {
  await asOwner(pg);
  await pg.exec("delete from public.poll_rate_events");
}

async function submitPoll(
  pg,
  who = IDS.student,
  question = "How many hours do you study each day?",
  options = OPTIONS,
  { keepRateEvents = false } = {},
) {
  if (!keepRateEvents) await clearRateEvents(pg);
  await setIdentity(pg, who);
  const result = await pg.query(
    "select public.poll_submit('physics', $1, null, $2::jsonb) as id",
    [question, options],
  );
  return Number(result.rows[0].id);
}

async function approve(pg, pollId) {
  await setIdentity(pg, IDS.admin);
  await pg.query("select public.poll_admin_review($1, 'approve', null, null)", [pollId]);
}

let pg;

beforeAll(async () => {
  pg = new PGlite();
  await scaffold(pg);
  await pg.exec(migration);
}, 120_000);

afterAll(async () => {
  await pg?.close();
});

describe("polls_v1 install", () => {
  it("starts switched off, so installing it releases nothing", async () => {
    await setIdentity(pg, null, "anon");
    const mode = await pg.query("select public.poll_mode() as mode");
    expect(mode.rows[0].mode).toBe("off");
    const feed = await pg.query("select * from public.get_polls_feed()");
    expect(feed.rows).toHaveLength(0);
  });

  it("gives browser roles no direct table access", async () => {
    for (const role of ["anon", "authenticated"]) {
      await setIdentity(pg, IDS.student, role);
      await expect(pg.query("select * from public.polls")).rejects.toThrow(/permission denied/i);
      await expect(pg.query("select * from public.poll_votes")).rejects.toThrow(/permission denied/i);
      await expect(
        pg.query("insert into public.poll_comments (poll_id, body) values (1, 'hi')"),
      ).rejects.toThrow(/permission denied/i);
    }
  });

  it("refuses contributions while the mode is off", async () => {
    await setIdentity(pg, IDS.student);
    await expect(
      pg.query("select public.poll_submit('physics', $1, null, $2::jsonb)", [
        "How many hours do you study each day?", OPTIONS,
      ]),
    ).rejects.toThrow(/not open for contributions/i);
  });
});

describe("submitting a poll", () => {
  it("always lands as pending, never live, and derives a shareable slug", async () => {
    await setMode(pg, "open");
    const id = await submitPoll(pg);

    await asOwner(pg);
    const row = await pg.query(
      "select status, slug, published_at, reviewed_at from public.polls where id = $1",
      [id],
    );
    expect(row.rows[0].status).toBe("pending");
    expect(row.rows[0].published_at).toBeNull();
    expect(row.rows[0].reviewed_at).toBeNull();
    expect(row.rows[0].slug).toBe(`how-many-hours-do-you-study-each-day-${id}`);

    // And it is invisible to the public until an admin approves it.
    await setIdentity(pg, null, "anon");
    const feed = await pg.query("select * from public.get_polls_feed()");
    expect(feed.rows).toHaveLength(0);
  });

  it("rejects a poll with fewer than two or more than six options", async () => {
    await setIdentity(pg, IDS.other);
    await expect(
      pg.query("select public.poll_submit('physics', $1, null, $2::jsonb)", [
        "Is this a valid question about physics?", JSON.stringify([{ label: "Only one" }]),
      ]),
    ).rejects.toThrow(/between 2 and 6 options/i);
  });

  it("accepts a picture option from an approved host and refuses any other", async () => {
    await setIdentity(pg, IDS.other);
    const allowed = JSON.stringify([
      { label: "Diagram A", image_url: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg" },
      { label: "Diagram B", image_url: "https://upload.wikimedia.org/w/x.png" },
    ]);
    const ok = await pg.query(
      "select public.poll_submit('physics', $1, null, $2::jsonb) as id",
      ["Which free body diagram is correct here?", allowed],
    );
    expect(Number(ok.rows[0].id)).toBeGreaterThan(0);

    const spoofed = JSON.stringify([
      { label: "Diagram A", image_url: "https://not-an-approved-host.example/x.png" },
      { label: "Diagram B" },
    ]);
    await expect(
      pg.query("select public.poll_submit('physics', $1, null, $2::jsonb)", [
        "Which free body diagram is right in this case?", spoofed,
      ]),
    ).rejects.toThrow(/approved image host/i);
  });

  it("throttles a student to two submissions a day", async () => {
    await clearRateEvents(pg);
    await setIdentity(pg, IDS.other);
    await pg.query("select public.poll_submit('physics', $1, null, $2::jsonb)", [
      "The first poll submitted on this day?", OPTIONS,
    ]);
    await pg.query("select public.poll_submit('physics', $1, null, $2::jsonb)", [
      "The second poll submitted on this day?", OPTIONS,
    ]);
    await expect(
      pg.query("select public.poll_submit('physics', $1, null, $2::jsonb)", [
        "A third poll submitted on the very same day?", OPTIONS,
      ]),
    ).rejects.toThrow(/rate limit/i);
  });

  it("does not spend a student's daily budget on a submission it refused", async () => {
    // A rejected statement rolls its own rate event back. Being told "that
    // picture host is not allowed" must not also cost you the attempt.
    await clearRateEvents(pg);
    await setIdentity(pg, IDS.other);
    await expect(
      pg.query("select public.poll_submit('physics', $1, null, $2::jsonb)", [
        "Does a refused submission still cost me?",
        JSON.stringify([{ label: "A", image_url: "https://nope.example/x.png" }, { label: "B" }]),
      ]),
    ).rejects.toThrow(/approved image host/i);
    await asOwner(pg);
    const spent = await pg.query(
      "select count(*)::int as n from public.poll_rate_events where user_id = $1", [IDS.other],
    );
    expect(spent.rows[0].n).toBe(0);
  });

  it("refuses an account younger than ten minutes", async () => {
    await setIdentity(pg, IDS.fresh);
    await expect(
      pg.query("select public.poll_submit('physics', $1, null, $2::jsonb)", [
        "Can a brand new account publish immediately?", OPTIONS,
      ]),
    ).rejects.toThrow(/after 10 minutes/i);
  });
});

describe("review", () => {
  it("will not reject without a reason the student can read", async () => {
    const id = await submitPoll(pg, IDS.student, "Should the syllabus be cut this year?");
    await setIdentity(pg, IDS.admin);
    await expect(
      pg.query("select public.poll_admin_review($1, 'reject', null, null)", [id]),
    ).rejects.toThrow(/needs a short reason/i);

    await setIdentity(pg, IDS.admin);
    await pg.query("select public.poll_admin_review($1, 'reject', 'Not about exam preparation.', null)", [id]);
    await asOwner(pg);
    const mine = await pg.query("select status, review_note from public.polls where id = $1", [id]);
    expect(mine.rows[0].status).toBe("rejected");

    // The student can see why.
    await setIdentity(pg, IDS.student);
    const submissions = await pg.query("select * from public.get_my_poll_submissions()");
    const row = submissions.rows.find((r) => Number(r.id) === id);
    expect(row.review_note).toBe("Not about exam preparation.");
  });

  it("refuses to publish a rejected poll through the status control", async () => {
    const id = await submitPoll(pg, IDS.student, "A poll that will be turned down?");
    await setIdentity(pg, IDS.admin);
    await pg.query("select public.poll_admin_review($1, 'reject', 'Not exam related.', null)", [id]);
    // It has been reviewed, but never published. Reversing that is a
    // re-review, not a status flip -- and the admin gets told so in words
    // rather than seeing a CHECK constraint violation.
    await expect(
      pg.query("select public.poll_admin_set_status($1, 'live')", [id]),
    ).rejects.toThrow(/only a published poll/i);
  });

  it("refuses a non-admin", async () => {
    const id = await submitPoll(pg, IDS.student, "Which subject deserves more revision time?");
    await setIdentity(pg, IDS.other);
    await expect(
      pg.query("select public.poll_admin_review($1, 'approve', null, null)", [id]),
    ).rejects.toThrow(/admin only/i);
    await approve(pg, id);
  });
});

describe("voting and results", () => {
  let pollId;
  let optionIds;

  it("publishes an approved poll to anonymous visitors", async () => {
    pollId = await submitPoll(pg, IDS.student, "Which chapter feels hardest in mechanics?");
    await approve(pg, pollId);

    await setIdentity(pg, null, "anon");
    const feed = await pg.query("select * from public.get_polls_feed()");
    const row = feed.rows.find((r) => Number(r.id) === pollId);
    expect(row.question).toBe("Which chapter feels hardest in mechanics?");
    expect(row.topic_name).toBe("Physics");
    optionIds = row.options.map((o) => Number(o.id));
    expect(optionIds).toHaveLength(3);
  });

  it("hides every option's count from a visitor who has not voted", async () => {
    await setIdentity(pg, null, "anon");
    const feed = await pg.query("select * from public.get_polls_feed()");
    const row = feed.rows.find((r) => Number(r.id) === pollId);
    expect(row.results_visible).toBe(false);
    expect(row.options.every((o) => o.vote_count === null && o.share === null)).toBe(true);
  });

  it("reveals the results once the viewer votes, and counts the vote once", async () => {
    await setIdentity(pg, IDS.student);
    await pg.query("select public.poll_cast_vote($1, $2)", [pollId, optionIds[0]]);

    const seen = await pg.query("select * from public.get_poll($1)", [
      `which-chapter-feels-hardest-in-mechanics-${pollId}`,
    ]);
    const row = seen.rows[0];
    expect(row.results_visible).toBe(true);
    expect(Number(row.vote_count)).toBe(1);
    expect(Number(row.viewer_option_id)).toBe(optionIds[0]);
    expect(row.options.find((o) => Number(o.id) === optionIds[0]).vote_count).toBe(1);
    expect(row.options.find((o) => Number(o.id) === optionIds[0]).viewer_choice).toBe(true);

    // Voting again for the same option is not a second vote.
    await pg.query("select public.poll_cast_vote($1, $2)", [pollId, optionIds[0]]);
    const again = await pg.query("select * from public.get_poll($1)", [
      `which-chapter-feels-hardest-in-mechanics-${pollId}`,
    ]);
    expect(Number(again.rows[0].vote_count)).toBe(1);
  });

  it("moves the vote when a student changes their mind", async () => {
    await setIdentity(pg, IDS.student);
    await pg.query("select public.poll_cast_vote($1, $2)", [pollId, optionIds[1]]);
    const row = (await pg.query("select * from public.get_poll($1)", [
      `which-chapter-feels-hardest-in-mechanics-${pollId}`,
    ])).rows[0];
    expect(Number(row.vote_count)).toBe(1);
    expect(row.options.find((o) => Number(o.id) === optionIds[0]).vote_count).toBe(0);
    expect(row.options.find((o) => Number(o.id) === optionIds[1]).vote_count).toBe(1);
  });

  it("computes shares across two students", async () => {
    await setIdentity(pg, IDS.other);
    await pg.query("select public.poll_cast_vote($1, $2)", [pollId, optionIds[2]]);
    const row = (await pg.query("select * from public.get_poll($1)", [
      `which-chapter-feels-hardest-in-mechanics-${pollId}`,
    ])).rows[0];
    expect(Number(row.vote_count)).toBe(2);
    expect(Number(row.options.find((o) => Number(o.id) === optionIds[1]).share)).toBe(50);
    expect(Number(row.options.find((o) => Number(o.id) === optionIds[2]).share)).toBe(50);
  });

  it("refuses a vote for an option belonging to another poll", async () => {
    const otherPoll = await submitPoll(pg, IDS.student, "Which revision method actually works?");
    await approve(pg, otherPoll);
    await setIdentity(pg, IDS.other);
    await expect(
      pg.query("select public.poll_cast_vote($1, $2)", [otherPoll, optionIds[0]]),
    ).rejects.toThrow(/does not belong to this poll/i);
  });

  it("stops accepting votes once an admin closes the poll", async () => {
    await setIdentity(pg, IDS.admin);
    await pg.query("select public.poll_admin_set_status($1, 'closed')", [pollId]);
    await setIdentity(pg, IDS.fresh);
    await expect(
      pg.query("select public.poll_cast_vote($1, $2)", [pollId, optionIds[0]]),
    ).rejects.toThrow(/not accepting votes/i);

    // A closed poll shows its results to everyone, including people who
    // never voted -- that is the point of closing it.
    await setIdentity(pg, null, "anon");
    const row = (await pg.query("select * from public.get_poll($1)", [
      `which-chapter-feels-hardest-in-mechanics-${pollId}`,
    ])).rows[0];
    expect(row.results_visible).toBe(true);
    expect(row.options.every((o) => o.vote_count !== null)).toBe(true);
  });
});

describe("comments", () => {
  let pollId;

  beforeAll(async () => {
    pollId = await submitPoll(pg, IDS.student, "Do you revise better in the morning or at night?");
    await approve(pg, pollId);
  });

  it("publishes a comment and counts it", async () => {
    await setIdentity(pg, IDS.other);
    await pg.query("select public.poll_add_comment($1, $2)", [
      pollId, "Mornings, but only after eight hours of sleep.",
    ]);

    await setIdentity(pg, null, "anon");
    const comments = await pg.query("select * from public.get_poll_comments($1)", [pollId]);
    expect(comments.rows).toHaveLength(1);
    expect(comments.rows[0].author_username).toBe("meera_student");

    const feed = await pg.query("select * from public.get_polls_feed()");
    expect(Number(feed.rows.find((r) => Number(r.id) === pollId).comment_count)).toBe(1);
  });

  it("hides an admin-removed comment and un-counts it", async () => {
    await setIdentity(pg, null, "anon");
    const before = await pg.query("select * from public.get_poll_comments($1)", [pollId]);
    const commentId = Number(before.rows[0].id);

    await setIdentity(pg, IDS.admin);
    await pg.query("select public.poll_admin_set_comment_removed($1, true)", [commentId]);

    await setIdentity(pg, null, "anon");
    const after = await pg.query("select * from public.get_poll_comments($1)", [pollId]);
    expect(after.rows).toHaveLength(0);
    const feed = await pg.query("select * from public.get_polls_feed()");
    expect(Number(feed.rows.find((r) => Number(r.id) === pollId).comment_count)).toBe(0);
  });

  it("lets a student delete their own comment but not someone else's", async () => {
    await setIdentity(pg, IDS.other);
    const created = await pg.query("select public.poll_add_comment($1, $2) as id", [
      pollId, "Night owl here, and it is ruining my mornings.",
    ]);
    const commentId = Number(created.rows[0].id);

    await setIdentity(pg, IDS.student);
    await expect(
      pg.query("select public.poll_delete_comment($1)", [commentId]),
    ).rejects.toThrow(/only delete your own/i);

    await setIdentity(pg, IDS.other);
    await pg.query("select public.poll_delete_comment($1)", [commentId]);
    const after = await pg.query("select * from public.get_poll_comments($1)", [pollId]);
    expect(after.rows).toHaveLength(0);
  });
});

describe("reporting and moderation", () => {
  it("queues a report for an admin and resolves it once", async () => {
    const pollId = await submitPoll(pg, IDS.student, "Which teacher explains rotation best?");
    await approve(pg, pollId);

    await setIdentity(pg, IDS.other);
    await pg.query("select public.poll_submit_report('poll', $1, 'off_topic', 'Not exam related.')", [pollId]);
    // A second report from the same student is not a louder signal.
    await pg.query("select public.poll_submit_report('poll', $1, 'spam', null)", [pollId]);

    await setIdentity(pg, IDS.admin);
    const queue = await pg.query("select * from public.poll_admin_list_reports()");
    const mine = queue.rows.filter((r) => Number(r.poll_id) === pollId);
    expect(mine).toHaveLength(1);
    expect(mine[0].reason).toBe("off_topic");

    await pg.query("select public.poll_admin_resolve_report($1, 'actioned')", [Number(mine[0].id)]);
    const after = await pg.query("select * from public.poll_admin_list_reports()");
    expect(after.rows.filter((r) => Number(r.poll_id) === pollId)).toHaveLength(0);
  });

  it("silences a suspended student here too, but still lets them report", async () => {
    await pg.exec("reset role");
    await pg.query(
      `insert into public.forum_suspensions (user_id, suspended_until, reason)
       values ($1, now() + interval '1 day', 'Testing the shared suspension.')
       on conflict (user_id) do update set suspended_until = excluded.suspended_until`,
      [IDS.other],
    );

    const pollId = await submitPoll(pg, IDS.student, "Is a two hour daily target realistic?");
    await approve(pg, pollId);

    await setIdentity(pg, IDS.other);
    await expect(
      pg.query("select public.poll_add_comment($1, $2)", [pollId, "I should not be able to say this."]),
    ).rejects.toThrow(/suspended/i);
    await expect(
      pg.query("select public.poll_cast_vote($1, 1)", [pollId]),
    ).rejects.toThrow(/suspended/i);

    // Reporting is a safety valve, not a contribution.
    await pg.query("select public.poll_submit_report('poll', $1, 'abuse', null)", [pollId]);
  });
});

// Each of these scripts opens its own `begin;` and raises from inside it, so
// the failure leaves the session in an aborted transaction that swallows
// every later statement with "current transaction is aborted". Clearing it is
// what a SQL client's operator would do by hand, and the runbooks say so.
async function expectRefusal(pg, sql, pattern) {
  let message = "";
  try {
    await pg.exec(sql);
  } catch (error) {
    message = String(error?.message ?? error);
  }
  await pg.exec("rollback").catch(() => {});
  expect(message).toMatch(pattern);
}

// A separate database, so this exercises the real deployment order on a
// clean target rather than on the one the tests above have been writing to.
describe("install lifecycle", () => {
  it("passes preflight, installs, passes postflight, and rolls all the way back", async () => {
    const fresh = new PGlite();
    try {
      await scaffold(fresh);

      await fresh.exec(preflight);
      await fresh.exec(migration);
      await fresh.exec(postflight);

      // Preflight is not idempotent-friendly on purpose: run it again and it
      // must refuse rather than let a second install stack up.
      await expectRefusal(fresh, preflight, /already exist/i);

      await fresh.exec(rollback);
      const left = await fresh.query(`
        select count(*)::int as n from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'poll%'
      `);
      expect(left.rows[0].n).toBe(0);
      const functions = await fresh.query(`
        select count(*)::int as n from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and (p.proname like 'poll\\_%' or p.proname like 'get\\_poll%')
      `);
      expect(functions.rows[0].n).toBe(0);

      // And the forum tables it reads are untouched.
      const topics = await fresh.query("select count(*)::int as n from public.forum_topics");
      expect(topics.rows[0].n).toBe(2);
    } finally {
      await fresh.close();
    }
  }, 120_000);

  it("refuses to roll back a production database", async () => {
    const prod = new PGlite();
    try {
      await scaffold(prod);
      await prod.exec("update public.app_environment set name = 'production'");
      await prod.exec(migration);
      await expectRefusal(prod, rollback, /refused for environment production/i);
      // Nothing was dropped.
      const still = await prod.query("select public.poll_mode() as mode");
      expect(still.rows[0].mode).toBe("off");
    } finally {
      await prod.close();
    }
  }, 120_000);
});

// Regression coverage added after the 2026-08-27 hard audit. Each block below
// pins a defect the audit found and this change fixed.
describe("audit hardening", () => {
  // The image-host allowlist is the one wall between a student and putting a
  // hostile image in front of minors. Assert the END STATE (was anything
  // stored?) for a battery of bypass URLs, not just the regex.
  const HOSTILE_IMAGES = [
    "https://i.ytimg.com@evil.com/x.png",
    "https://i.ytimg.com:80@evil.com/x.png", // userinfo — the one the old regex let through the FUNCTION
    "https://i.ytimg.com.evil.com/x.png",
    "https://evil.com/i.ytimg.com/x.png",
    "javascript:alert(1)//i.ytimg.com/x",
    "data:text/html,<script>alert(1)</script>",
    "HTTPS://I.YTIMG.COM/x.png",
    "https://i.ytimg.com./x.png",
    "https://i.ytimg.com#@evil.com/x.png",
  ];

  it("never stores a hostile image URL through student submit", async () => {
    for (let i = 0; i < HOSTILE_IMAGES.length; i += 1) {
      const question = `Audit hostile image probe number ${i}?`;
      await clearRateEvents(pg);
      await setIdentity(pg, IDS.student);
      try {
        await pg.query("select public.poll_submit('physics', $1, null, $2::jsonb)", [
          question,
          JSON.stringify([{ label: "bad", image_url: HOSTILE_IMAGES[i] }, { label: "fine" }]),
        ]);
      } catch {
        // rejection is the expected path for most of these
      }
      await asOwner(pg);
      const stored = await pg.query(
        `select o.image_url from public.poll_options o
         join public.polls p on p.id = o.poll_id
         where p.question = $1 and o.image_url is not null`,
        [question],
      );
      expect(stored.rows).toEqual([]);
    }
  });

  it("accepts every host actually present in the poll_image_hosts seed", async () => {
    // Guards the seed itself: a host added with a typo, uppercase, or a stray
    // space would sit in the table looking correct and silently never match.
    await asOwner(pg);
    const seeded = await pg.query("select host from public.poll_image_hosts order by host");
    expect(seeded.rows.length).toBeGreaterThan(4);
    for (const { host } of seeded.rows) {
      const r = await pg.query("select public.poll_image_host_allowed($1) as ok", [
        `https://${host}/example.png`,
      ]);
      expect(r.rows[0].ok, host).toBe(true);
    }
  });

  it("poll_image_host_allowed itself denies the userinfo/port spoof (not only the column CHECK)", async () => {
    await asOwner(pg);
    // These resolve to evil.com in a browser; the function must say no on its own.
    for (const url of [
      "https://i.ytimg.com:80@evil.com/x.png",
      "https://i.ytimg.com@evil.com/x.png",
      "https://i.ytimg.com.evil.com/x.png",
    ]) {
      const r = await pg.query("select public.poll_image_host_allowed($1) as ok", [url]);
      expect(r.rows[0].ok).toBe(false);
    }
    // And it still allows the real hosts.
    const good = await pg.query(
      "select public.poll_image_host_allowed('https://i.ytimg.com/vi/abc/hqdefault.jpg') as ok",
    );
    expect(good.rows[0].ok).toBe(true);
  });

  it("SLUG: a question whose 60-char slug cut lands on a hyphen still submits with a valid slug", async () => {
    // 40 single characters => "a-a-a-..." with '-' at every even position, so
    // left(slug,60) ends on '-'. Before the rtrim fix this aborted on the slug
    // CHECK; now it must succeed and produce a CHECK-valid slug.
    const question = `${Array.from({ length: 40 }, () => "a").join(" ")}?`;
    await clearRateEvents(pg);
    await setIdentity(pg, IDS.student);
    const r = await pg.query(
      "select public.poll_submit('physics', $1, null, $2::jsonb) as id",
      [question, JSON.stringify([{ label: "one" }, { label: "two" }])],
    );
    const id = Number(r.rows[0].id);
    await asOwner(pg);
    const slug = (await pg.query("select slug from public.polls where id = $1", [id])).rows[0].slug;
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/); // the CHECK regex
    expect(slug).not.toMatch(/--/);
    expect(slug.endsWith(`-${id}`)).toBe(true);
  });

  it("TIME EXPIRY: a poll past closes_at reveals results to a non-voter and blocks voting", async () => {
    await clearRateEvents(pg);
    const id = await submitPoll(pg, IDS.student, "Does a timed poll reveal results after it closes?");
    await setIdentity(pg, IDS.admin);
    await pg.query("select public.poll_admin_review($1, 'approve', null, $2)", [
      id, new Date(Date.now() + 3600_000).toISOString(),
    ]);
    // Backdate both timestamps to simulate expiry while keeping closes_at > published_at.
    await asOwner(pg);
    await pg.query(
      "update public.polls set published_at = now() - interval '2 hours', closes_at = now() - interval '1 hour' where id = $1",
      [id],
    );
    const slug = (await pg.query("select slug from public.polls where id = $1", [id])).rows[0].slug;

    await setIdentity(pg, null, "anon");
    const row = (await pg.query("select * from public.get_poll($1)", [slug])).rows[0];
    expect(row.results_visible).toBe(true); // no longer a dead end
    expect(row.can_vote).toBe(false);
    expect(row.options.every((o) => o.vote_count !== null)).toBe(true);
  });

  it("EXPIRY: reads report an expired poll as closed even before the column catches up", async () => {
    await clearRateEvents(pg);
    const id = await submitPoll(pg, IDS.student, "Does an expired poll read as closed?");
    await setIdentity(pg, IDS.admin);
    await pg.query("select public.poll_admin_review($1, 'approve', null, $2)", [
      id, new Date(Date.now() + 3600_000).toISOString(),
    ]);
    await asOwner(pg);
    await pg.query(
      "update public.polls set published_at = now() - interval '2 hours', closes_at = now() - interval '1 hour' where id = $1",
      [id],
    );
    const slug = (await pg.query("select slug from public.polls where id = $1", [id])).rows[0].slug;

    // The stored column is deliberately still 'live' at this point.
    const stored = await pg.query("select status from public.polls where id = $1", [id]);
    expect(stored.rows[0].status).toBe("live");

    // ...but every read path reports the truth.
    await setIdentity(pg, null, "anon");
    const single = (await pg.query("select * from public.get_poll($1)", [slug])).rows[0];
    expect(single.status).toBe("closed");
    expect(single.can_vote).toBe(false);
    expect(single.results_visible).toBe(true);

    const feedRow = (await pg.query("select * from public.get_polls_feed()")).rows
      .find((r) => Number(r.id) === id);
    expect(feedRow.status).toBe("closed");
  });

  it("EXPIRY: poll_admin_close_expired persists the transition and is idempotent", async () => {
    await setIdentity(pg, IDS.admin);
    const first = await pg.query("select * from public.poll_admin_close_expired()");
    expect(first.rows.length).toBeGreaterThan(0);
    expect(first.rows.every((r) => r.question && r.closed_at)).toBe(true);

    // Second run has nothing left to do.
    const second = await pg.query("select * from public.poll_admin_close_expired()");
    expect(second.rows).toEqual([]);

    // Nothing still live is past its closing time.
    await asOwner(pg);
    const stragglers = await pg.query(
      "select count(*)::int as n from public.polls where status = 'live' and closes_at is not null and closes_at <= now()",
    );
    expect(stragglers.rows[0].n).toBe(0);
  });

  it("EXPIRY: a non-admin cannot close expired polls", async () => {
    await setIdentity(pg, IDS.other);
    await expect(
      pg.query("select * from public.poll_admin_close_expired()"),
    ).rejects.toThrow(/admin only/i);
  });

  it("EXPIRY: a live poll with no closing date is never touched", async () => {
    await clearRateEvents(pg);
    const id = await submitPoll(pg, IDS.student, "Does an open ended poll stay open?");
    await approve(pg, id); // no closes_at
    await setIdentity(pg, IDS.admin);
    await pg.query("select * from public.poll_admin_close_expired()");
    await asOwner(pg);
    const row = await pg.query("select status from public.polls where id = $1", [id]);
    expect(row.rows[0].status).toBe("live");
  });

  it("APPROVAL CHECK: a direct UPDATE cannot publish an unreviewed poll", async () => {
    await clearRateEvents(pg);
    const id = await submitPoll(pg, IDS.student, "Can a raw update publish me without review?");
    // As the owner (RLS bypassed) — the table CHECK is the last line of defence
    // if any future RPC forgets the review gate.
    await asOwner(pg);
    await expect(
      pg.query("update public.polls set status = 'live' where id = $1", [id]),
    ).rejects.toThrow(/polls_check|check constraint/i);
  });

  it("ADMIN GATE: every mutating admin RPC refuses a non-admin", async () => {
    await setIdentity(pg, IDS.other);
    const calls = [
      ["select public.poll_admin_set_mode('open')", []],
      ["select public.poll_admin_review($1, 'approve', null, null)", [1]],
      ["select public.poll_admin_set_status($1, 'closed')", [1]],
      ["select public.poll_admin_set_option_image($1, null)", [1]],
      ["select public.poll_admin_set_comment_removed($1, true)", [1]],
      ["select public.poll_admin_resolve_report($1, 'dismissed')", [1]],
      ["select public.poll_recount_metrics(true)", []],
    ];
    for (const [sql, args] of calls) {
      await expect(pg.query(sql, args)).rejects.toThrow(/admin only/i);
    }
  });

  it("ADMIN GATE: the admin list RPCs return nothing (not an error) for a non-admin", async () => {
    // These filter on is_admin() rather than raising, so a non-admin simply
    // sees an empty queue — still no data leak.
    await setMode(pg, "open");
    await setIdentity(pg, IDS.other);
    expect((await pg.query("select * from public.poll_admin_list_pending()")).rows).toEqual([]);
    expect((await pg.query("select * from public.poll_admin_list_reports()")).rows).toEqual([]);
  });

  it("DOUBLE REVIEW: the second reviewer of the same poll loses deterministically", async () => {
    await clearRateEvents(pg);
    const id = await submitPoll(pg, IDS.student, "What happens if two admins review me at once?");
    await setIdentity(pg, IDS.admin);
    await pg.query("select public.poll_admin_review($1, 'approve', null, null)", [id]);
    // A second review of the now-live poll must be refused, not silently applied.
    await expect(
      pg.query("select public.poll_admin_review($1, 'reject', 'too late', null)", [id]),
    ).rejects.toThrow(/already been reviewed/i);
    await asOwner(pg);
    const status = (await pg.query("select status from public.polls where id = $1", [id])).rows[0].status;
    expect(status).toBe("live");
  });
});

describe("counter integrity", () => {
  it("reports no drift after all of the above", async () => {
    await setIdentity(pg, IDS.admin);
    const drift = await pg.query("select * from public.poll_recount_metrics(false)");
    expect(drift.rows).toEqual([]);
  });
});
