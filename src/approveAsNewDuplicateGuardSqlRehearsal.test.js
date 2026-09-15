// approveAsNewDuplicateGuardSqlRehearsal.test.js — 20260915130000 on a real
// engine, against tables, constraints, triggers, functions and privileges taken
// from the production baseline.
//
// THE DEFECT. approve_proposal_as_new called create_teacher with
// p_duplicate_acknowledged hard-coded to true, so the duplicate check never ran
// on the only path the admin panel has for creating a teacher. On 2026-09-08 a
// batch approved 40 names that verified teachers already answered to and made
// 40 copies. The cases below are those names' shapes: an exact display name
// ("Alakh Pandey"), a verified alias ("ABJ Sir"), and a verified alias reached
// under a different typed name (raw "Saleem Sir", typed "Saleem").
//
// WHY THE MATCHING IS REAL, NOT A STUB. The guard's whole meaning is "what
// search_teachers_internal ranks 1": honorifics stripped by
// normalize_person_name, verified aliases counted, proposed ones not, an
// unverified teacher's exact name counted. A stub would encode my reading of
// that and share its mistakes, which is how an earlier rehearsal in this repo
// certified a candidate filter the migration had dropped. So the real function
// runs, with pg_trgm for its fuzzy tier -- and the guard is tested in BOTH
// directions: it must refuse a rank-1 match, and it must not refuse a mere
// prefix, part or near-spelling of an existing name.
//
// WHY THE GRANTS CAN FAIL HERE. The migration DROPs and creates both functions.
// Production's default privileges grant every created function to anon and
// authenticated, which PGlite does not do on its own -- the reason
// 20260908120000's rehearsal passed while the real push leaked the review queue.
// The baseline's ALTER DEFAULT PRIVILEGES are applied before the migration, and
// a control below proves they are live, so a missing revoke fails a test.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  "supabase/migrations/20260915130000_approve_as_new_checks_existing_faculty.sql", "utf8");
const BASELINE = readFileSync(
  "supabase/migrations/20260831140005_production_baseline.sql", "utf8");

/** One CREATE TABLE statement, exactly as the baseline dump writes it. */
function baselineTable(name) {
  const head = `CREATE TABLE IF NOT EXISTS "public"."${name}" (`;
  const start = BASELINE.indexOf(head);
  expect(start, `baseline has no table ${name}`).toBeGreaterThan(-1);
  return `${BASELINE.slice(start, BASELINE.indexOf("\n);", start))}\n);`;
}

/** The identity the baseline attaches to a table's id column. */
function baselineIdentity(name) {
  const head = `ALTER TABLE "public"."${name}" ALTER COLUMN "id" ADD GENERATED`;
  const start = BASELINE.indexOf(head);
  expect(start, `baseline has no identity for ${name}`).toBeGreaterThan(-1);
  return `${BASELINE.slice(start, BASELINE.indexOf("\n);", start))}\n);`;
}

/** One named constraint, as the baseline adds it. */
function baselineConstraint(table, constraint) {
  const head = `ALTER TABLE ONLY "public"."${table}"\n    ADD CONSTRAINT "${constraint}"`;
  const start = BASELINE.indexOf(head);
  expect(start, `baseline has no constraint ${constraint}`).toBeGreaterThan(-1);
  return BASELINE.slice(start, BASELINE.indexOf(";", start) + 1);
}

/** One trigger, as the baseline creates it. */
function baselineTrigger(name) {
  const line = BASELINE.split("\n").find((l) => l.startsWith(`CREATE OR REPLACE TRIGGER "${name}"`));
  expect(line, `baseline has no trigger ${name}`).toBeTruthy();
  return line;
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
    .filter((line) => line.includes(`"public"."${name}"(`) && /^(GRANT|REVOKE|ALTER FUNCTION)/.test(line))
    .join("\n");
}

const DEFAULT_PRIVILEGES = BASELINE.split("\n")
  .filter((line) => line.startsWith("ALTER DEFAULT PRIVILEGES "))
  .join("\n");

const TABLES = [
  "teachers", "teacher_aliases", "institutes_channels", "teacher_institutes", "subjects",
  "teacher_subjects", "learning_goals", "teacher_learning_goals", "playlists",
  "playlist_teachers", "teacher_name_proposals", "teacher_proposal_decisions",
];
const IDENTITIES = ["teachers", "teacher_aliases", "teacher_name_proposals", "teacher_proposal_decisions"];
const CONSTRAINTS = [
  ["teachers", "teachers_pkey"], ["teachers", "teachers_slug_key"],
  ["teacher_aliases", "teacher_aliases_pkey"],
  ["teacher_aliases", "teacher_aliases_teacher_id_normalized_alias_key"],
  ["teacher_name_proposals", "teacher_name_proposals_pkey"],
  ["teacher_name_proposals", "teacher_name_proposals_raw_teacher_key"],
  ["teacher_proposal_decisions", "teacher_proposal_decisions_pkey"],
  ["playlist_teachers", "playlist_teachers_pkey"],
  ["playlists", "playlists_pkey"],
];
const FUNCTIONS = [
  "normalize_person_name", "catalog_similarity", "looks_like_multiple_people",
  "looks_like_organization", "search_teachers_internal", "set_teacher_canonical",
  "set_alias_normalized", "create_teacher", "add_teacher_alias", "log_proposal_decision",
  "approve_proposal_as_existing", "approve_proposal_as_new", "approve_faculty_review_group_as_new",
];

const WORLD = `
do $roles$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres superuser; end if;
end $roles$;

create extension if not exists pg_trgm with schema public;
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
create or replace function public.is_admin() returns boolean language sql stable as $$ select true $$;

${TABLES.map(baselineTable).join("\n")}
${IDENTITIES.map(baselineIdentity).join("\n")}
${CONSTRAINTS.map(([table, name]) => baselineConstraint(table, name)).join("\n")}
${FUNCTIONS.map(baselineFunction).join("\n")}
${baselineTrigger("trg_teacher_canonical")}
${baselineTrigger("trg_alias_normalized")}
${baselinePrivileges("create_teacher")}
${baselinePrivileges("approve_proposal_as_new")}
${baselinePrivileges("approve_faculty_review_group_as_new")}
`;

const FIXTURE = `
insert into public.institutes_channels (id, name, youtube_channel_id) values
  (1, 'Physics Wallah', 'UC-pw'), (2, 'Competishun', 'UC-competishun');

-- Zubin Mehta is teacher #1 on purpose: a pending MULTI-PERSON proposal carries
-- his name below. A self-test that simply took the first teacher would run its
-- group case into that proposal and fail on "names more than one person".
insert into public.teachers (display_name, verified) values
  ('Zubin Mehta', true), ('Alakh Pandey', true), ('Amit Bijarnia', true),
  ('Saleem Ahmad', true), ('Neeraj Saini', true), ('Tarun Kumar', false);

insert into public.teacher_aliases (teacher_id, alias, alias_type, status)
select t.id, a.alias, a.alias_type, a.status
  from (values
    ('amit-bijarnia', 'ABJ Sir', 'initials', 'verified'),
    ('saleem-ahmad', 'Saleem Sir', 'short', 'verified'),
    -- A PROPOSED alias. create_teacher never counted these as a match, and
    -- this migration must not start.
    ('neeraj-saini', 'NS Bhaiya', 'nickname', 'proposed')
  ) as a(slug, alias, alias_type, status)
  join public.teachers t on t.slug = a.slug;

insert into public.playlists (id, title, teacher, channel_id) values
  (10, 'Class 10 Science', 'Alakh Pandey', 1),
  (11, 'Chemical Bonding', 'Alakh Pandey', 1),
  (20, 'Kinematics', 'ABJ Sir', 2),
  (30, 'Mission 30 Physics', 'Saleem Sir', 1),
  (40, 'Vardaan Biology', 'Tarun Kumar Sir', 1),
  (50, 'Sketching Graphs', 'Vikas Gupta', 2),
  (60, 'Organic Basics', 'NS', 2),
  (70, 'Human Physiology', 'Anand Mani', 1),
  (71, 'Genetics', 'Dr. Anand Mani', 1),
  (80, 'Rotational Mechanics', 'Mohit Goenka', 2),
  (90, 'Zoology Revision', 'Amit & Priya', 1);

-- The courses are already credited to the teachers they name, as they were
-- on production when the 8 Sep batch ran.
insert into public.playlist_teachers (playlist_id, teacher_id)
select c.playlist_id, t.id
  from (values (10, 'alakh-pandey'), (11, 'alakh-pandey'), (20, 'amit-bijarnia'), (30, 'saleem-ahmad'))
       as c(playlist_id, slug)
  join public.teachers t on t.slug = c.slug;

-- normalized is computed, not typed, so it is what the scan would store.
insert into public.teacher_name_proposals (raw_teacher, normalized, occurrences, kind)
select v.raw, public.normalize_person_name(v.raw), v.n, v.kind
  from (values
    ('Alakh Pandey', 2, 'single'), ('ABJ Sir', 1, 'single'), ('Saleem Sir', 1, 'single'),
    ('Tarun Kumar Sir', 1, 'single'), ('Vikas Gupta', 1, 'single'), ('NS', 1, 'single'),
    ('Anand Mani', 1, 'single'), ('Dr. Anand Mani', 1, 'single'),
    ('Mohit Goenka', 1, 'single'), ('Amit & Priya', 1, 'multi-person'),
    -- Neighbours of Alakh Pandey that are NOT rank-1 matches.
    ('Alakh', 1, 'single'), ('Pandey', 1, 'single'), ('Alakh Pandy', 1, 'single'),
    -- New people, for the flags that ride along.
    ('Nitin Vijay', 1, 'single'), ('Kavya Iyer', 1, 'single'), ('Meera Nair', 1, 'single'),
    -- A spelling nobody answers to, typed over later with an existing name.
    ('Zeta Qa Spelling', 1, 'single'),
    ('Zubin Mehta,', 1, 'multi-person')
  ) as v(raw, n, kind);
`;

const OLD_PROPOSAL = "public.approve_proposal_as_new(bigint,text,boolean)";
const OLD_GROUP = "public.approve_faculty_review_group_as_new(text,text,boolean)";
const NEW_PROPOSAL = "public.approve_proposal_as_new(bigint,text,boolean,boolean)";
const NEW_GROUP = "public.approve_faculty_review_group_as_new(text,text,boolean,boolean)";
const ROLES = ["anon", "authenticated", "service_role"];

let pg;
let before; // grants as the baseline recorded them
let after; // grants once the migration has run on a world with default privileges
let countsBeforeMigration;
let countsAfterMigration;

async function privileges(fn, db = pg) {
  const out = {};
  for (const role of ROLES) {
    out[role] = (await db.query("select has_function_privilege($1, $2, 'EXECUTE') as ok", [role, fn])).rows[0].ok;
  }
  return out;
}

async function counts(db = pg) {
  const one = async (table) => (await db.query(`select count(*)::int as n from public.${table}`)).rows[0].n;
  return {
    teachers: await one("teachers"),
    proposals: await one("teacher_name_proposals"),
    decisions: await one("teacher_proposal_decisions"),
    links: await one("playlist_teachers"),
    aliases: await one("teacher_aliases"),
  };
}

async function world() {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(WORLD);
  await db.exec(FIXTURE);
  return db;
}

const normalizedOf = async (raw) =>
  (await pg.query("select public.normalize_person_name($1) as n", [raw])).rows[0].n;
const proposal = async (raw) =>
  (await pg.query("select * from public.teacher_name_proposals where raw_teacher = $1", [raw])).rows[0];
const teacherBySlug = async (slug) =>
  (await pg.query("select id, display_name, verified from public.teachers where slug = $1", [slug])).rows[0];
const teacherIdOf = async (slug) => (await teacherBySlug(slug))?.id;

/** Resolves to { result } or { error } instead of throwing. */
async function attempt(sql, args) {
  try {
    return { result: (await pg.query(sql, args)).rows[0]?.r };
  } catch (error) {
    return { error };
  }
}

/** Calls the group function the way the admin panel does. */
async function approveGroup(raw, display, acknowledged) {
  const args = [await normalizedOf(raw), display, false];
  if (acknowledged === undefined) {
    return attempt("select public.approve_faculty_review_group_as_new($1, $2, $3) as r", args);
  }
  return attempt("select public.approve_faculty_review_group_as_new($1, $2, $3, $4) as r", [...args, acknowledged]);
}

beforeAll(async () => {
  pg = await world();
  before = { proposal: await privileges(OLD_PROPOSAL), group: await privileges(OLD_GROUP) };
  // Supabase's default privileges, applied after the old functions exist, as
  // on production, so they reach only what the migration creates.
  await pg.exec(DEFAULT_PRIVILEGES);
  countsBeforeMigration = await counts();
  // The preflight, the grants verify block and the behavioural self-test all
  // run inside this exec; any failure aborts the setup.
  await pg.exec(MIGRATION);
  countsAfterMigration = await counts();
  after = { proposal: await privileges(NEW_PROPOSAL), group: await privileges(NEW_GROUP) };
}, 120000);

describe("refuses to create a teacher that existing faculty already answer to", () => {
  it.each([
    ["an exact display name", "Alakh Pandey", "Alakh Pandey", "alakh-pandey"],
    ["a verified alias: the initials case", "ABJ Sir", "ABJ Sir", "amit-bijarnia"],
    ["a verified alias under a different typed name: the Saleem case", "Saleem Sir", "Saleem", "saleem-ahmad"],
    ["an unverified teacher's exact name, as create_teacher counts it", "Tarun Kumar Sir", "Tarun Kumar", "tarun-kumar"],
  ])("%s", async (_label, raw, typed, slug) => {
    const start = await counts();
    const matched = await teacherBySlug(slug);

    // The panel's call has three arguments; the default must be "not acknowledged".
    const { error, result } = await approveGroup(raw, typed);

    expect(result).toBeUndefined();
    expect(error.code).toBe("23514");
    expect(error.hint).toBe("duplicate_faculty");
    expect(JSON.parse(error.detail)).toContainEqual({ teacher_id: matched.id, display_name: matched.display_name, slug });
    // The curator is told WHO, so "a different person?" can be answered.
    expect(error.message).toContain(`${matched.display_name} (#${matched.id})`);
    // Nothing written: the proposal is still waiting for a decision.
    expect(await counts()).toEqual(start);
    expect((await proposal(raw)).status).toBe("pending");
  });

  it("checks the spelling the courses carry, not only the name typed", async () => {
    // raw "Saleem Sir" is a verified alias of Saleem Ahmad; the typed name
    // matches nobody. create_teacher alone only ever saw the typed name.
    const { error } = await approveGroup("Saleem Sir", "Mohammed Saleem Qureshi");
    expect(error?.hint).toBe("duplicate_faculty");
  });

  it("checks the name typed, not only the spelling the courses carry", async () => {
    const { error } = await approveGroup("Vikas Gupta", "Alakh Pandey");
    expect(error?.hint).toBe("duplicate_faculty");
    expect((await proposal("Vikas Gupta")).status).toBe("pending");
  });

  it("guards the per-proposal function too, not only the group wrapper", async () => {
    const id = (await proposal("ABJ Sir")).id;
    await expect(pg.query("select public.approve_proposal_as_new($1, $2, false)", [id, "Zeta Different"]))
      .rejects.toMatchObject({ code: "23514", hint: "duplicate_faculty" });
  });

  it.each([
    ["the group function", async () =>
      pg.query("select public.approve_faculty_review_group_as_new($1, 'Alakh Pandey', false, null)", [await normalizedOf("Alakh Pandey")])],
    ["the per-proposal function", async () =>
      pg.query("select public.approve_proposal_as_new($1, null, false, null)", [(await proposal("ABJ Sir")).id])],
  ])("treats a null acknowledgement as no acknowledgement (%s)", async (_label, call) => {
    // `not null` is null in SQL: without coalesce a JSON null skipped this
    // check AND create_teacher's own.
    const start = await counts();
    await expect(call()).rejects.toMatchObject({ code: "23514", hint: "duplicate_faculty" });
    expect(await counts()).toEqual(start);
  });

  it.each([
    ["several people", "Amit & Priya", /looks like more than one person/],
    ["a team", "Physics Department", /looks like a team or department/],
    ["a blank name", "   ", /display_name is required/],
  ])("rejects a typed name that could never be created (%s) before asking about duplicates", async (_label, typed, message) => {
    // "ABJ Sir" matches Amit Bijarnia, so a duplicate refusal was available --
    // but "create anyway" would then fail on the name itself.
    const { error } = await approveGroup("ABJ Sir", typed);
    expect(error?.code).not.toBe("23514");
    expect(error?.message).toMatch(message);
  });
});

describe("still creates a genuinely new person without being asked", () => {
  it("approves a name nobody answers to, exactly as before", async () => {
    const { result, error } = await approveGroup("Vikas Gupta", "Vikas Gupta");

    expect(error).toBeUndefined();
    expect(result).toMatchObject({ variants_resolved: 1, playlists_linked: 1, duplicate_acknowledged: false });
    expect(result.matched_existing).toEqual([]);
    const id = await teacherIdOf("vikas-gupta");
    expect(result.teacher_id).toBe(id);
    expect((await pg.query("select teacher_id from public.playlist_teachers where playlist_id = 50")).rows)
      .toEqual([{ teacher_id: id }]);
    const row = await proposal("Vikas Gupta");
    expect(row.status).toBe("approved-new");
    expect(row.resolved_teacher_ids).toEqual([id]);
    const decision = (await pg.query(
      "select decision, note from public.teacher_proposal_decisions where proposal_id = $1", [row.id])).rows;
    expect(decision).toEqual([{ decision: "approved-new", note: null }]);
  });

  it("does not count a PROPOSED alias as a match, as create_teacher never did", async () => {
    const { result, error } = await approveGroup("NS", "NS");
    expect(error).toBeUndefined();
    expect(result.duplicate_acknowledged).toBe(false);
  });

  it.each([
    ["a prefix of an existing name", "Alakh", 3],
    ["part of an existing name", "Pandey", 4],
    ["a near-spelling of an existing name", "Alakh Pandy", 5],
  ])("does not refuse %s, which is a neighbour, not a match", async (_label, name, rank) => {
    // Non-vacuous: the neighbour really is there, at exactly that rank.
    const best = (await pg.query(
      "select min(match_rank)::int as r from public.search_teachers_internal($1, 5, true)", [name])).rows[0].r;
    expect(best).toBe(rank);

    const { result, error } = await approveGroup(name, name);

    expect(error).toBeUndefined();
    expect(result.matched_existing).toEqual([]);
  });

  it("links every spelling in a group to the one new teacher, and verifies the shared alias", async () => {
    const { result, error } = await approveGroup("Anand Mani", "Anand Mani");

    expect(error).toBeUndefined();
    expect(result.variants_resolved).toBe(2);
    const id = await teacherIdOf("anand-mani");
    expect((await pg.query(
      "select playlist_id from public.playlist_teachers where teacher_id = $1 order by playlist_id", [id])).rows)
      .toEqual([{ playlist_id: 70 }, { playlist_id: 71 }]);
    expect([(await proposal("Anand Mani")).resolved_teacher_ids, (await proposal("Dr. Anand Mani")).resolved_teacher_ids])
      .toEqual([[id], [id]]);
    // Aliases are unique per teacher by NORMALISED spelling, and "Dr. Anand
    // Mani" normalises to "anand mani" -- the full-name alias create_teacher
    // made (proposed, as p_verified is false). The second variant's link
    // upgrades that row to verified rather than adding one.
    expect((await pg.query(
      "select alias_type, status from public.teacher_aliases where teacher_id = $1", [id])).rows)
      .toEqual([{ alias_type: "full-name", status: "verified" }]);
  });

  it("records the courses' spelling as a verified alias when the typed name differs", async () => {
    const id = (await proposal("Mohit Goenka")).id;
    await pg.query("select public.approve_proposal_as_new($1, $2, false)", [id, "Mohit Goenka Sir"]);
    const teacher = await teacherIdOf("mohit-goenka");
    // Same normalised spelling as the typed name, so add_teacher_alias updates
    // create_teacher's proposed full-name row: nickname, verified. Without that
    // call it would still read full-name, proposed.
    expect((await pg.query(
      "select alias_type, status from public.teacher_aliases where teacher_id = $1", [teacher])).rows)
      .toEqual([{ alias_type: "nickname", status: "verified" }]);
  });

  it.each([
    ["the per-proposal function", "Nitin Vijay", "nitin-vijay",
      (id) => pg.query("select public.approve_proposal_as_new($1, null, true)", [id])],
    ["the group function", "Kavya Iyer", "kavya-iyer",
      async () => pg.query("select public.approve_faculty_review_group_as_new($1, 'Kavya Iyer', true)", [await normalizedOf("Kavya Iyer")])],
  ])("creates a verified teacher when asked to, through %s", async (_label, raw, slug, call) => {
    await call((await proposal(raw)).id);
    const teacher = await teacherBySlug(slug);
    expect(teacher.verified).toBe(true);
    expect((await pg.query(
      "select alias_type, status from public.teacher_aliases where teacher_id = $1", [teacher.id])).rows)
      .toEqual([{ alias_type: "full-name", status: "verified" }]);
  });

  it("reports the acknowledgement it was given, even when nothing matched", async () => {
    const { result, error } = await attempt(
      "select public.approve_proposal_as_new($1, null, false, true) as r", [(await proposal("Meera Nair")).id]);
    expect(error).toBeUndefined();
    expect(result.duplicate_acknowledged).toBe(true);
    expect(result.matched_existing).toEqual([]);
  });
});

describe("creates a same-name person only when told it is a different person", () => {
  it("creates, links, and records what it was created beside", async () => {
    const original = await teacherIdOf("alakh-pandey");

    const { result, error } = await approveGroup("Alakh Pandey", "Alakh Pandey", true);

    expect(error).toBeUndefined();
    expect(result.duplicate_acknowledged).toBe(true);
    expect(result.matched_existing.map((m) => m.teacher_id)).toEqual([original]);
    expect(result.teacher_id).toBe(await teacherIdOf("alakh-pandey-2"));
    const row = await proposal("Alakh Pandey");
    const note = (await pg.query(
      "select note from public.teacher_proposal_decisions where proposal_id = $1", [row.id])).rows[0].note;
    expect(note).toContain(`Alakh Pandey (#${original})`);
  });

  it("lists every existing record with that name, so the next decision sees them all", async () => {
    // Two Alakh Pandeys exist now. A third attempt must name both.
    const { error } = await attempt(
      "select public.approve_proposal_as_new($1, 'Alakh Pandey', false) as r", [(await proposal("Zeta Qa Spelling")).id]);
    expect(error?.hint).toBe("duplicate_faculty");
    expect(JSON.parse(error.detail).map((m) => m.slug).sort()).toEqual(["alakh-pandey", "alakh-pandey-2"]);
  });
});

describe("keeps the rest of the baseline behaviour", () => {
  it("still refuses a multi-person proposal before any duplicate question", async () => {
    const id = (await proposal("Amit & Priya")).id;
    await expect(pg.query("select public.approve_proposal_as_new($1, $2, false, true)", [id, "Amit"]))
      .rejects.toThrow(/names more than one person/);
  });

  it("still refuses a proposal that is already decided", async () => {
    const id = (await proposal("Vikas Gupta")).id;
    await expect(pg.query("select public.approve_proposal_as_new($1, null, false, true)", [id]))
      .rejects.toThrow(/is already approved-new/);
  });

  it("still says so when a group has nothing pending", async () => {
    await expect(pg.query("select public.approve_faculty_review_group_as_new('nobody here', 'Nobody', false)"))
      .rejects.toThrow(/no pending proposals/);
  });

  it("still refuses a signed-in user who is not an admin, in each function's own check", async () => {
    // The group function is executable by `authenticated`; its is_admin() check
    // is all that stops a signed-in student from creating faculty. Each call is
    // shaped so that WITHOUT that function's own check it would fail
    // differently ('no pending proposals' / 'invalid proposal_id').
    const db = await world();
    await db.exec(DEFAULT_PRIVILEGES);
    await db.exec(MIGRATION);
    await db.exec(`
      create or replace function public.is_admin() returns boolean language sql stable as $$ select false $$;
      create or replace function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
    `);
    await db.exec("set session authorization authenticated");
    await expect(db.query("select public.approve_faculty_review_group_as_new('nobody here', 'Nobody', false)"))
      .rejects.toMatchObject({ code: "42501" });
    await db.exec("reset session authorization");
    await db.exec("set session authorization service_role");
    await expect(db.query("select public.approve_proposal_as_new(-1, 'Nobody', false)"))
      .rejects.toMatchObject({ code: "42501" });
    await db.exec("reset session authorization");
    await db.close();
  }, 120000);

  it.each(["approve_proposal_as_new", "approve_faculty_review_group_as_new"])(
    "%s keeps every statement of the baseline body except the ones this migration exists to change",
    (name) => {
      // A re-emitted body is compared line by line, not by signature: the
      // lesson of the candidate filter 20260908120000 silently dropped. Lines
      // must be present EXACTLY, not as a substring, and block comments are
      // removed first, so an extended or commented-out check does not count.
      const statements = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "").split("\n")
        .map((l) => l.replace(/--.*$/, "").trim().replace(/\s+/g, " "))
        .filter((l) => l && !/^(CREATE OR REPLACE FUNCTION|LANGUAGE|SET "search_path"|AS \$\$|end; \$\$;)/.test(l));
      const start = MIGRATION.indexOf(`create function public.${name}(`);
      const created = new Set(statements(MIGRATION.slice(start, MIGRATION.indexOf("$fn$;", start))));
      const changed = [
        // the bypass itself
        "v_new := public.create_teacher(coalesce(p_display_name, trim(p.raw_teacher)), '[]'::jsonb, p_verified, true);",
        // the decision log gains a note, the results gain two keys
        "array[v_tid], null);",
        "'similar_existing', v_new->'similar_existing');",
        "'playlists_linked', v_links,",
        "'teacher_id', v_teacher_id, 'playlists_linked', v_links);",
        // declarations and the passed-through flag
        "declare p record; v_new jsonb; v_tid bigint; v_links int := 0;",
        "declare r record; v_result jsonb; v_teacher_id bigint; v_done int := 0; v_links int := 0;",
        "v_result := public.approve_proposal_as_new(r.id, p_display_name, p_verified);",
      ];
      const missing = statements(baselineFunction(name))
        .filter((line) => !changed.includes(line))
        .filter((line) => !created.has(line));
      expect(missing).toEqual([]);
    },
  );
});

describe("grants, on a world with Supabase's default privileges", () => {
  it("takes the default privileges from the baseline", () => {
    expect(DEFAULT_PRIVILEGES).toContain('GRANT ALL ON FUNCTIONS TO "anon"');
    expect(DEFAULT_PRIVILEGES).toContain('GRANT ALL ON FUNCTIONS TO "authenticated"');
  });

  it("really does grant a freshly created function to anon here, so the checks below can fail", async () => {
    await pg.exec("create function public.zz_default_privileges_control() returns int language sql as $$ select 1 $$;");
    expect(await privileges("public.zz_default_privileges_control()")).toMatchObject({ anon: true, authenticated: true });
  });

  it("was measured against grants that exist", () => {
    expect(before.group).toEqual({ anon: false, authenticated: true, service_role: true });
    expect(before.proposal).toEqual({ anon: false, authenticated: false, service_role: true });
  });

  it("gives each new function exactly the grants its old signature had", () => {
    expect(after.group).toEqual(before.group);
    expect(after.proposal).toEqual(before.proposal);
  });

  it("removes the old signatures, so nothing can reach the unchecked bodies", async () => {
    for (const fn of [OLD_PROPOSAL, OLD_GROUP]) {
      expect((await pg.query("select to_regprocedure($1) as p", [fn])).rows[0].p).toBeNull();
    }
  });
});

describe("the migration's own self-test", () => {
  const selftestBlock = () =>
    MIGRATION.slice(MIGRATION.indexOf("do $selftest$"), MIGRATION.indexOf("$selftest$;") + "$selftest$;".length);

  it("left nothing behind on the database it ran against", () => {
    expect(countsAfterMigration).toEqual(countsBeforeMigration);
  });

  it("ran on this fixture, whose first teacher's name has a pending multi-person proposal", async () => {
    expect((await pg.query("select slug from public.teachers order by id limit 1")).rows[0].slug).toBe("zubin-mehta");
    expect(await proposal("Zubin Mehta,")).toMatchObject({ kind: "multi-person", status: "pending", normalized: "zubin mehta" });
  });

  it("would have failed on that queue if it had simply taken the first teacher", async () => {
    // So the teacher choice is what keeps the review queue from deciding
    // whether the migration applies.
    const quiet = [
      "   where not exists (select 1 from public.teacher_name_proposals q",
      "                      where q.normalized = t.canonical_name",
      "                        and q.status in ('pending','deferred'))",
      "     and not public.looks_like_multiple_people(t.display_name)",
    ].join("\n");
    const naive = MIGRATION.replace(quiet, "   where not public.looks_like_multiple_people(t.display_name)");
    expect(naive).not.toBe(MIGRATION);

    const db = await world();
    await db.exec(DEFAULT_PRIVILEGES);
    await expect(db.exec(naive)).rejects.toThrow(/names more than one person/);
    await db.close();
  }, 120000);

  it("fails, and writes nothing, when the functions still bypass the check", async () => {
    // A world where the four-argument functions exist but simply forward to the
    // baseline's unchecked bodies: the state this migration exists to end. The
    // self-test must refuse it, and its refusal must roll back.
    const db = await world();
    await db.exec(`
      create function public.approve_proposal_as_new(bigint, text, boolean, boolean) returns jsonb
        language sql as $f$ select public.approve_proposal_as_new($1, $2, $3) $f$;
      create function public.approve_faculty_review_group_as_new(text, text, boolean, boolean) returns jsonb
        language sql as $f$ select public.approve_faculty_review_group_as_new($1, $2, $3) $f$;
    `);
    const start = await counts(db);
    const block = selftestBlock();
    expect(block).toContain("APPROVE-AS-NEW SELF-TEST FAILED");

    await expect(db.exec(block)).rejects.toThrow(/APPROVE-AS-NEW SELF-TEST FAILED/);
    expect(await counts(db)).toEqual(start);
    await db.close();
  }, 120000);
});
