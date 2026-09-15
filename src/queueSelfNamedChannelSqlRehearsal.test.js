// queueSelfNamedChannelSqlRehearsal.test.js — the queue's new signal, on a real
// engine, against tables, functions and privileges taken from the production
// baseline.
//
// WHAT THIS PROVES that production data cannot. On the live catalogue every
// organisation that trips this signal happens to be an organisation, so a rule
// that simply said "flagged = reject" would look correct there. The fixture
// includes a REAL PERSON whose channel carries their own name, because that is
// the case the signal cannot decide and the reason it is a column rather than a
// classification. Mohit Tyagi (32 courses), Digraj Singh Rajput (5) and Vinay
// Uppal (1) are all in that position on production today.
//
// WHY NOTHING HERE IS HAND-TYPED ANY MORE. The first version of this file
// created its own playlists table with a column called institute_channel_id.
// Production's column is channel_id. The migration used the same wrong name, so
// it ran cleanly here against a table that exists nowhere and could not apply
// on production (42703). Its search_teachers_internal stub had five output
// columns where production returns thirteen, with no match_rank -- which is
// also why nothing here could notice that the migration had dropped
// production's `match_rank <= 2` candidate filter. So every table the migration
// reads, both functions it replaces, their grants, and the signature of the
// function it calls are read out of 20260831140005_production_baseline.sql.
//
// AND WHY THE GRANTS CHECK USED TO LIE. The second version then asserted that
// EXECUTE privileges were "identical before and after the drop" -- and passed,
// while the same migration on production handed the admin faculty review queue
// to the public anon key: get_proposal_groups went from 401 42501 to 200 with
// 7 rows. Production carries Supabase's default privileges:
//
//     ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
//       GRANT ALL ON FUNCTIONS TO "anon";          (and authenticated, ...)
//
// so a function that is DROPped and CREATEd is granted straight to anon and
// authenticated, and `revoke all ... from public` does not remove a direct role
// grant. PGlite starts with no default privileges, so here the recreated
// function got exactly what the SQL named and there was nothing to find. The
// test reproduced the SQL and not the platform, and certified the leak.
//
// So the rehearsal now applies the baseline's own ALTER DEFAULT PRIVILEGES
// before the migration runs -- after the pre-migration functions exist, because
// on production they predate those defaults' effect too -- and runs the chain
// as production ran it: 20260908120000, which must visibly leak, then
// 20260915100000, which must restore production's grants exactly. PGlite still
// does not reproduce PostgREST, auth.* or event triggers; default privileges
// are the one platform fact these two migrations depend on, and that one is now
// here.
//
// The migrations DROP and recreate two functions, so getting past each exec is
// itself an assertion: the preflights refuse if a function is missing, and both
// self-tests run inside the same statements.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  "supabase/migrations/20260908120000_queue_self_named_channel_signal.sql", "utf8");
const GRANTS_FIX = readFileSync(
  "supabase/migrations/20260915100000_restore_review_queue_grants.sql", "utf8");
const BASELINE = readFileSync(
  "supabase/migrations/20260831140005_production_baseline.sql", "utf8");

/** One CREATE TABLE statement, exactly as the baseline dump writes it. */
function baselineTable(name) {
  const head = `CREATE TABLE IF NOT EXISTS "public"."${name}" (`;
  const start = BASELINE.indexOf(head);
  expect(start, `baseline has no table ${name}`).toBeGreaterThan(-1);
  const end = BASELINE.indexOf("\n);", start);
  return `${BASELINE.slice(start, end)}\n);`;
}

/** One CREATE OR REPLACE FUNCTION statement, body included. */
function baselineFunction(name) {
  const head = `CREATE OR REPLACE FUNCTION "public"."${name}"(`;
  const start = BASELINE.indexOf(head);
  expect(start, `baseline has no function ${name}`).toBeGreaterThan(-1);
  const rest = BASELINE.slice(start);
  const opened = /\sAS (\$[A-Za-z_]*\$)/.exec(rest);
  expect(opened, `no dollar-quoted body for ${name}`).toBeTruthy();
  const closed = rest.indexOf(opened[1], opened.index + opened[0].length);
  return rest.slice(0, rest.indexOf(";", closed + opened[1].length) + 1);
}

/** The owner, REVOKE and GRANT statements the baseline records for one function. */
function baselinePrivileges(name) {
  return BASELINE.split("\n")
    .filter((line) => line.includes(`"public"."${name}"(`)
      && /^(GRANT|REVOKE|ALTER FUNCTION)/.test(line))
    .join("\n");
}

/** A baseline function's exact signature and result shape, without its body. */
function baselineSignature(name) {
  const fn = baselineFunction(name);
  const cut = fn.search(/\n\s*LANGUAGE /);
  expect(cut, `no LANGUAGE clause for ${name}`).toBeGreaterThan(-1);
  return fn.slice(0, cut);
}

/** Every ALTER DEFAULT PRIVILEGES statement the baseline records, verbatim. */
const DEFAULT_PRIVILEGES = BASELINE.split("\n")
  .filter((line) => line.startsWith("ALTER DEFAULT PRIVILEGES "))
  .join("\n");

/** "TABLE(a text, b bigint)" -> ["a text", "b bigint"] */
const resultColumns = (result) =>
  result.replace(/^TABLE\(/, "").replace(/\)$/, "").split(", ");

// search_teachers_internal is called, not changed, and its real body needs the
// whole faculty schema. So it is a stub -- but with production's exact
// signature, all thirteen output columns, read from the baseline so it cannot
// drift. It offers two candidates for Magnet Brains, one a strong match and one
// a weak one, so the candidate filter is observable.
const TEACHER_SEARCH_STUB = `${baselineSignature("search_teachers_internal")}
LANGUAGE sql STABLE AS $stub$
  select * from (values
    (101::bigint, 'Magnet Brains'::text, 'magnet-brains'::text, false, 'exact'::text,
     1, 'Magnet Brains'::text, null::text, 'Magnet Brains'::text, null::text, null::text,
     10::bigint, false),
    (102::bigint, 'Magnet Brainz'::text, 'magnet-brainz'::text, false, 'fuzzy'::text,
     3, 'Magnet Brainz'::text, null::text, 'Somewhere Else'::text, null::text, null::text,
     1::bigint, false)
  ) as c(teacher_id, display_name, slug, verified, match_type, match_rank, matched_on,
         alias_status, institutes, subjects, goals, course_count, is_ambiguous)
  where p_query = 'Magnet Brains'
$stub$;`;

const WORLD = `
-- Supabase roles the baseline grants to; PGlite starts without them.
do $roles$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres superuser; end if;
end $roles$;

create schema if not exists auth;
create or replace function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
create or replace function public.is_admin() returns boolean language sql stable as $$ select true $$;

${baselineTable("institutes_channels")}
${baselineTable("playlists")}
${baselineTable("teacher_name_proposals")}

${TEACHER_SEARCH_STUB}

-- The functions as production ran them BEFORE 20260908120000, with their real
-- grants, so the drop-and-recreate is measured against the truth rather than a
-- guess.
${baselineFunction("get_proposal_groups")}
${baselinePrivileges("get_proposal_groups")}
${baselineFunction("get_faculty_review_groups")}
${baselinePrivileges("get_faculty_review_groups")}
`;

// Each row is a case the rule has to get right. Every NOT NULL column the
// baseline declares is supplied, because the real tables enforce them.
const FIXTURE = `
insert into public.institutes_channels (id, name, youtube_channel_id) values
  (1, 'Magnet Brains', 'UC-magnet'), (2, 'Mohit Tyagi', 'UC-tyagi'),
  (3, 'Unacademy NEET', 'UC-unacademy'), (4, 'Competishun+', 'UC-competishun'),
  (5, 'Vipin Sharma', 'UC-vipin');

insert into public.playlists (id, title, teacher, channel_id) values
  -- an ORGANISATION: every course on a channel of its own name
  (10, 'Course 10', 'Magnet Brains', 1), (11, 'Course 11', 'Magnet Brains', 1),
  -- a REAL PERSON in exactly the same position -- this is why it cannot reject
  (20, 'Course 20', 'Mohit Tyagi', 2), (21, 'Course 21', 'Mohit Tyagi', 2),
  -- a teacher on somebody else's channel
  (30, 'Course 30', 'Anoop Vashishtha', 3), (31, 'Course 31', 'Anoop Vashishtha', 3),
  -- spans two channels, so not self-named even though one of them matches
  (40, 'Course 40', 'ABJ Sir', 2), (41, 'Course 41', 'ABJ Sir', 4),
  -- an ordinary teacher with a single course on somebody else's channel
  (50, 'Course 50', 'Dr. Roopali', 3),
  -- THE CASE THAT SEPARATES "every" FROM "any": one course on his own channel,
  -- one on somebody else's. A teacher with a single self-named course among
  -- others is a person, and must not be flagged.
  (60, 'Course 60', 'Vipin Sharma', 5), (61, 'Course 61', 'Vipin Sharma', 3);

insert into public.teacher_name_proposals (id, raw_teacher, normalized, occurrences, kind) values
  (1, 'Magnet Brains', 'magnet brains', 2, 'single'),
  (2, 'Mohit Tyagi', 'mohit tyagi', 2, 'single'),
  (3, 'Anoop Vashishtha', 'anoop vashishtha', 2, 'single'),
  (4, 'ABJ Sir', 'abj', 2, 'single'),
  (5, 'Dr. Roopali', 'roopali', 1, 'single'),
  (6, 'Vipin Sharma', 'vipin sharma', 2, 'single'),
  -- A proposal whose playlists no longer exist. The scan cannot create one,
  -- but a deleted course can leave one behind, and "no courses" must not read
  -- as "all of its courses match".
  (7, 'Ghost Teacher', 'ghost teacher', 1, 'single');
`;

const PROPOSALS = "public.get_proposal_groups(text)";
const REVIEW = "public.get_faculty_review_groups(text)";
const FUNCTIONS = [PROPOSALS, REVIEW];
const ROLES = ["anon", "authenticated", "service_role"];

let pg;
let rows;
let before; // the baseline, as production had it before 20260908120000
let leaked; // after 20260908120000 alone, as production had it on 15 Sep
let after; // after 20260915100000, as production has it now

/** Result shape and EXECUTE privileges of both functions, as the engine reports them. */
async function snapshot() {
  const out = {};
  for (const fn of FUNCTIONS) {
    const result = (await pg.query(
      "select pg_get_function_result($1::regprocedure) as r", [fn])).rows[0].r;
    const privileges = {};
    for (const role of ROLES) {
      privileges[role] = (await pg.query(
        "select has_function_privilege($1, $2, 'EXECUTE') as ok", [role, fn])).rows[0].ok;
    }
    out[fn] = { columns: resultColumns(result), privileges };
  }
  return out;
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(WORLD);
  await pg.exec(FIXTURE);
  before = await snapshot();
  // Supabase's default privileges, from the baseline. Applied AFTER the
  // pre-migration functions exist, exactly as on production, so they reach
  // only what is created from here on -- which is what 20260908120000 does.
  await pg.exec(DEFAULT_PRIVILEGES);
  // The migration's preflight and three self-test assertions run inside this.
  await pg.exec(MIGRATION);
  leaked = await snapshot();
  // The fix production applied the same day; its own has_function_privilege
  // self-test runs inside this and would abort the setup if it failed.
  await pg.exec(GRANTS_FIX);
  after = await snapshot();
  rows = (await pg.query("select * from public.get_faculty_review_groups('pending')")).rows;
}, 120000);

const group = (name) => rows.find((r) => r.normalized === name);
const signal = (name) => group(name)?.self_named_channel;

describe("the queue now carries the fact that decides most of these", () => {
  it("flags an organisation whose courses all sit on a channel of its own name", () => {
    expect(signal("magnet brains")).toBe(true);
  });

  it("flags a REAL PERSON in the same position, which is why it is not a verdict", () => {
    // Mohit Tyagi owns his channel and teaches 32 courses on it. A rule that
    // rejected on this signal would delete him. The column reports; the
    // reviewer decides.
    expect(signal("mohit tyagi")).toBe(true);
  });

  it("does not flag a teacher on somebody else's channel", () => {
    expect(signal("anoop vashishtha")).toBe(false);
    expect(signal("roopali")).toBe(false);
  });

  it("does not flag a name whose courses span more than one channel", () => {
    // ABJ Sir has a course on the Mohit Tyagi channel and one on Competishun+.
    // EVERY course must match, not merely one.
    expect(signal("abj")).toBe(false);
  });

  it("does not flag a teacher with only SOME courses on their own channel", () => {
    // The rule is EVERY course, not merely one. Vipin Sharma has a course on
    // "Vipin Sharma" and another on "Unacademy NEET" -- he is a person who also
    // teaches elsewhere, which is the commonest shape for a real teacher who
    // owns a channel.
    //
    // Added after a mutation exposed the gap: changing the rule from "all
    // courses match" to "any course matches" left every earlier test green,
    // because no fixture row had a partial match. This is that row.
    expect(signal("vipin sharma")).toBe(false);
  });

  it("does not flag a proposal whose courses no longer exist", () => {
    // Vacuously "every course matches" when there are no courses. The count > 0
    // guard exists for exactly this.
    expect(signal("ghost teacher")).toBe(false);
  });

  it("never returns null, because callers would read that as a no", () => {
    for (const r of rows) expect(r.self_named_channel).not.toBeNull();
  });
});

describe("it adds a fact and changes nothing else", () => {
  it("leaves every kind exactly as the proposals table records it", async () => {
    const drift = (await pg.query(`
      select count(*)::int as n
        from public.get_proposal_groups('pending') g
        join public.teacher_name_proposals p on p.normalized = g.normalized
       where p.kind is distinct from g.kind`)).rows[0].n;
    expect(drift).toBe(0);
  });

  it("still returns every pending group, none dropped by the new join", () => {
    expect(rows).toHaveLength(7);
  });

  it("keeps production's candidate filter: only match_rank <= 2 is offered", () => {
    // Production's get_proposal_groups filters candidates to match_rank <= 2.
    // The first version of this migration had lost that predicate, and nothing
    // could see it: the old stub had no match_rank column, so the filter could
    // not even have run here. The stub now offers a rank-1 and a rank-3 match.
    const offered = group("magnet brains").candidates.map((c) => c.teacher_id);
    expect(offered).toEqual([101]);
  });

  it.each(FUNCTIONS)("%s keeps every output column production returned before", (fn) => {
    for (const column of before[fn].columns) expect(after[fn].columns).toContain(column);
    // And the only addition is the signal itself.
    expect(after[fn].columns.filter((c) => !before[fn].columns.includes(c)))
      .toEqual(["self_named_channel boolean"]);
  });
});

describe("grants, on a world that has Supabase's default privileges", () => {
  it("takes the default privileges from the baseline, not from a hand-typed copy", () => {
    // Guards everything below. Without these statements a recreated function
    // gets exactly what the SQL names, the leak cannot happen, and the grants
    // assertions pass whatever the migrations do -- which is how this file
    // certified the leak the first time.
    expect(DEFAULT_PRIVILEGES).toContain('GRANT ALL ON FUNCTIONS TO "anon"');
    expect(DEFAULT_PRIVILEGES).toContain('GRANT ALL ON FUNCTIONS TO "authenticated"');
  });

  it("was measured against grants that actually exist, not a vacuous match", () => {
    // If the baseline grants had failed to load, "before" and "after" could
    // agree on everything being false.
    expect(before[REVIEW].privileges.authenticated).toBe(true);
    expect(before[PROPOSALS].privileges.service_role).toBe(true);
    expect(before[PROPOSALS].privileges.anon).toBe(false);
    expect(before[PROPOSALS].privileges.authenticated).toBe(false);
  });

  it("reproduces the 15 Sep leak: 20260908120000 alone hands the admin queue to anon", () => {
    // Measured on production after that push: anon -> get_proposal_groups
    // went from 401 42501 to 200 with 7 rows. get_proposal_groups is SECURITY
    // DEFINER with no check of its own, so this grant was the whole exposure.
    expect(leaked[PROPOSALS].privileges).toEqual({
      anon: true, authenticated: true, service_role: true,
    });
    // get_faculty_review_groups became executable by anon too; its own
    // is_admin() check is what still refused rows.
    expect(leaked[REVIEW].privileges.anon).toBe(true);
    // This is the assertion the second version of this file made after the
    // migration -- "identical to before" -- and it is FALSE on the platform.
    expect(leaked[PROPOSALS].privileges).not.toEqual(before[PROPOSALS].privileges);
  });

  it.each(FUNCTIONS)("%s ends the chain with exactly production's grants", (fn) => {
    // After 20260915100000: get_proposal_groups service_role only;
    // get_faculty_review_groups authenticated and service_role.
    expect(after[fn].privileges).toEqual(before[fn].privileges);
  });
});

describe("it only touches columns production has", () => {
  it("names no column that the baseline table does not declare", () => {
    // The check that would have caught 42703 before production did. Aliases
    // are the ones the migration uses; comments are stripped first so prose
    // cannot satisfy or fail it.
    const executable = MIGRATION.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
    const tables = { pl: "playlists", ic: "institutes_channels", p: "teacher_name_proposals" };
    for (const [alias, table] of Object.entries(tables)) {
      const declared = baselineTable(table);
      const used = [...executable.matchAll(new RegExp(`\\b${alias}\\.([a-z_]+)`, "g"))]
        .map((m) => m[1]);
      expect(used.length, `no ${alias}. references found; the alias map is stale`)
        .toBeGreaterThan(0);
      for (const column of new Set(used)) {
        expect(declared, `${alias}.${column} is not a column of ${table} in the baseline`)
          .toContain(`"${column}"`);
      }
    }
  });

  it("cannot meet a course without a channel, because production forbids one", async () => {
    // An earlier version of this fixture had a course with no channel at all.
    // playlists.channel_id is NOT NULL in production, so that case cannot occur
    // and testing it tested nothing. This asserts the reason instead.
    await expect(pg.query(
      "insert into public.playlists (id, title, teacher, channel_id) values (99, 'x', 'y', null)",
    )).rejects.toThrow(/null value|not-null/i);
  });
});
