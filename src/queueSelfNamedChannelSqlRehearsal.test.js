// queueSelfNamedChannelSqlRehearsal.test.js — the queue's new signal, on a real
// engine, against a fixture built to make the rule's edges visible.
//
// WHAT THIS PROVES that production data cannot. On the live catalogue every
// organisation that trips this signal happens to be an organisation, so a rule
// that simply said "flagged = reject" would look correct there. The fixture
// includes a REAL PERSON whose channel carries their own name, because that is
// the case the signal cannot decide and the reason it is a column rather than a
// classification. Mohit Tyagi (32 courses), Digraj Singh Rajput (5) and Vinay
// Uppal (1) are all in that position on production today.
//
// The migration DROPs and recreates two functions, so getting past the exec is
// itself an assertion: the preflight refuses if either is missing.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  "supabase/migrations/20260908120000_queue_self_named_channel_signal.sql", "utf8");

// The smallest world the migration needs: the two tables it joins, the
// proposals it reads, and stubs for what it calls but does not change.
const WORLD = `
-- Supabase roles the migration grants to; PGlite starts without them.
do $roles$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres superuser; end if;
end $roles$;

create schema if not exists auth;
create or replace function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
create or replace function public.is_admin() returns boolean language sql stable as $$ select true $$;

create table public.institutes_channels (id bigint primary key, name text);
create table public.playlists (id bigint primary key, teacher text, institute_channel_id bigint);
create table public.teacher_name_proposals (
  id bigint primary key, raw_teacher text unique, normalized text,
  occurrences int, kind text, status text default 'pending');

create or replace function public.search_teachers_internal(p_q text, p_limit int, p_flag boolean)
returns table(teacher_id bigint, display_name text, match_type text, institutes jsonb, course_count int)
language sql stable as $$ select null::bigint, null::text, null::text, null::jsonb, null::int where false $$;

-- The pre-migration shapes, so the preflight finds them and the DROP has
-- something to drop.
create or replace function public.get_proposal_groups(p_status text default 'pending')
returns table (normalized text, kind text, variants jsonb, variant_count int,
               total_occurrences bigint, candidates jsonb)
language sql stable as $$ select null::text, null::text, null::jsonb, null::int, null::bigint, null::jsonb where false $$;
create or replace function public.get_faculty_review_groups(p_status text default 'pending')
returns table (normalized text, kind text, variants jsonb, variant_count int,
               total_occurrences bigint, candidates jsonb)
language sql stable as $$ select * from public.get_proposal_groups(p_status) $$;
`;

// Each row is a case the rule has to get right.
const FIXTURE = `
insert into public.institutes_channels (id, name) values
  (1, 'Magnet Brains'), (2, 'Mohit Tyagi'), (3, 'Unacademy NEET'), (4, 'Competishun+'),
  (5, 'Vipin Sharma');

insert into public.playlists (id, teacher, institute_channel_id) values
  -- an ORGANISATION: every course on a channel of its own name
  (10, 'Magnet Brains', 1), (11, 'Magnet Brains', 1),
  -- a REAL PERSON in exactly the same position -- this is why it cannot reject
  (20, 'Mohit Tyagi', 2), (21, 'Mohit Tyagi', 2),
  -- a teacher on somebody else's channel
  (30, 'Anoop Vashishtha', 3), (31, 'Anoop Vashishtha', 3),
  -- spans two channels, so not self-named even though one of them matches
  (40, 'ABJ Sir', 2), (41, 'ABJ Sir', 4),
  -- one course has no channel recorded at all
  (50, 'Dr. Roopali', 3), (51, 'Dr. Roopali', null),
  -- THE CASE THAT SEPARATES "every" FROM "any": one course on his own channel,
  -- one on somebody else's. A teacher with a single self-named course among
  -- others is a person, and must not be flagged.
  (60, 'Vipin Sharma', 5), (61, 'Vipin Sharma', 3);

insert into public.teacher_name_proposals (id, raw_teacher, normalized, occurrences, kind) values
  (1, 'Magnet Brains', 'magnet brains', 2, 'single'),
  (2, 'Mohit Tyagi', 'mohit tyagi', 2, 'single'),
  (3, 'Anoop Vashishtha', 'anoop vashishtha', 2, 'single'),
  (4, 'ABJ Sir', 'abj', 2, 'single'),
  (5, 'Dr. Roopali', 'roopali', 2, 'single'),
  (6, 'Vipin Sharma', 'vipin sharma', 2, 'single'),
  -- A proposal whose playlists no longer exist. The scan cannot create one,
  -- but a deleted course can leave one behind, and "no courses" must not read
  -- as "all of its courses match".
  (7, 'Ghost Teacher', 'ghost teacher', 1, 'single');
`;

let pg;
let rows;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(WORLD);
  await pg.exec(FIXTURE);
  // The migration's preflight and three self-test assertions run inside this.
  await pg.exec(MIGRATION);
  rows = (await pg.query("select * from public.get_faculty_review_groups('pending')")).rows;
}, 120000);

const signal = (name) => rows.find((r) => r.normalized === name)?.self_named_channel;

describe("the queue now carries the fact that decides most of these", () => {
  it("flags an organisation whose courses all sit on a channel of its own name", async () => {
    expect(signal("magnet brains")).toBe(true);
  });

  it("flags a REAL PERSON in the same position, which is why it is not a verdict", async () => {
    // Mohit Tyagi owns his channel and teaches 32 courses on it. A rule that
    // rejected on this signal would delete him. The column reports; the
    // reviewer decides.
    expect(signal("mohit tyagi")).toBe(true);
  });

  it("does not flag a teacher on somebody else's channel", async () => {
    expect(signal("anoop vashishtha")).toBe(false);
  });

  it("does not flag a name whose courses span more than one channel", async () => {
    // ABJ Sir has a course on the Mohit Tyagi channel and one on Competishun+.
    // EVERY course must match, not merely one.
    expect(signal("abj")).toBe(false);
  });

  it("does not flag a teacher with only SOME courses on their own channel", async () => {
    // The rule is EVERY course, not merely one. Vipin Sharma has a course on
    // "Vipin Sharma" and another on "Unacademy NEET" -- he is a person who
    // also teaches elsewhere, which is the commonest shape for a real teacher
    // who owns a channel.
    //
    // Added after a mutation exposed the gap: changing the rule from "all
    // courses match" to "any course matches" left every earlier test green,
    // because no fixture row had a partial match. This is that row.
    expect(signal("vipin sharma")).toBe(false);
  });

  it("does not flag a proposal whose courses no longer exist", async () => {
    // Vacuously "every course matches" when there are no courses. The count > 0
    // guard exists for exactly this, and until this test nothing justified it:
    // a mutation making the guard vacuous left every other assertion green.
    expect(signal("ghost teacher")).toBe(false);
  });

  it("does not flag a name with a course that has no channel at all", async () => {
    expect(signal("roopali")).toBe(false);
  });

  it("never returns null, because callers would read that as a no", async () => {
    for (const r of rows) expect(r.self_named_channel).not.toBeNull();
  });
});

describe("it adds a fact and changes no classification", () => {
  it("leaves every kind exactly as the proposals table records it", async () => {
    const drift = (await pg.query(`
      select count(*)::int as n
        from public.get_proposal_groups('pending') g
        join public.teacher_name_proposals p on p.normalized = g.normalized
       where p.kind is distinct from g.kind`)).rows[0].n;
    expect(drift).toBe(0);
  });

  it("still returns every pending group, none dropped by the new join", async () => {
    expect(rows).toHaveLength(7);
  });
});
