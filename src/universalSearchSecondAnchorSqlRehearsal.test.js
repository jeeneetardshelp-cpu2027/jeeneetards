// universalSearchSecondAnchorSqlRehearsal.test.js
//
// WHAT IS REAL HERE. These tests EXECUTE the staged migration
// supabase/migrations/20260908150000_universal_search_second_anchor.sql on a
// real PostgreSQL engine (PGlite, Postgres compiled to WASM) with the real
// pg_trgm extension, so `%>`, word_similarity and the migration's own
// self-verification DO block actually run. Nothing in the migration is retyped
// here. The chain it sits on is executed too — the applied
// 20260901160000 / 20260902170000 / 20260902180000 / 20260907093000 /
// 20260907170000 — so what runs underneath is what production has.
//
// WHAT THIS FILE IS FOR. The migration narrows a prefilter, and a narrowed
// prefilter can silently drop rows. Its header argues it cannot, from the tiers
// in search_rank_tokens. That argument is a proof, not evidence. This file is
// the evidence: every control query is run against the DEPLOYED body, then the
// migration is applied, then the same queries are run again and compared BY
// IDENTITY — so a swapped row is caught as well as a lost one.
//
// THE CASE THAT MATTERS MOST is tier 5. Tiers 1, 3 and 4 keep only rows that
// contain every token as a substring, so a substring conjunct cannot lose them.
// Tier 5 keeps rows that merely resemble the token, at word_similarity >= 0.5 —
// so if `%>` were even slightly stricter than 0.5, the new conjunct would drop
// real fuzzy matches. "kinamatics" below is that case, deliberately misspelt.
//
// WHAT IS NOT REAL. The catalogue is a stand-in: a handful of rows, not
// production's, and public.is_admin() is a stub returning false. These tests
// prove CORRECTNESS — that the rewrite returns what it returned before. They
// prove NOTHING about production query plans or timing, which depend on
// statistics this repo cannot see. The speed-up is unmeasured until it is
// applied.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { beforeAll, describe, expect, it } from "vitest";

const BASELINE = "supabase/migrations/20260831140005_production_baseline.sql";
const MATERIALS = "supabase/migrations/20260901160000_universal_search_materials.sql";
const ALIASES = "supabase/migrations/20260902170000_search_aliases.sql";
const WORDS = "supabase/migrations/20260902180000_universal_search_material_words.sql";
const FLOOR = "supabase/migrations/20260907093000_universal_search_q_long_floor.sql";
const ANCHOR = "supabase/migrations/20260907170000_universal_search_anchor_floor.sql";
const MIGRATION = "supabase/migrations/20260908150000_universal_search_second_anchor.sql";

const baseline = readFileSync(BASELINE, "utf8");
const materials = readFileSync(MATERIALS, "utf8");
const aliases = readFileSync(ALIASES, "utf8");
const words = readFileSync(WORDS, "utf8");
const floor = readFileSync(FLOOR, "utf8");
const anchorSql = readFileSync(ANCHOR, "utf8");
const migration = readFileSync(MIGRATION, "utf8");

/** Pull one CREATE OR REPLACE FUNCTION statement out of the baseline dump. */
function baselineFunction(name) {
  const head = `CREATE OR REPLACE FUNCTION "public"."${name}"(`;
  const start = baseline.indexOf(head);
  expect(start, `baseline has no function ${name}`).toBeGreaterThan(-1);
  const rest = baseline.slice(start);
  const opened = /\sAS (\$[A-Za-z_]*\$)/.exec(rest);
  expect(opened, `no dollar-quoted body for ${name}`).toBeTruthy();
  const bodyStart = opened.index + opened[0].length;
  const closed = rest.indexOf(opened[1], bodyStart);
  return rest.slice(0, rest.indexOf(";", closed + opened[1].length) + 1);
}

/** Pull one CREATE TABLE statement out of the baseline dump. */
function baselineTable(name) {
  const head = `CREATE TABLE IF NOT EXISTS "public"."${name}" (`;
  const start = baseline.indexOf(head);
  expect(start, `baseline has no table ${name}`).toBeGreaterThan(-1);
  const rest = baseline.slice(start);
  return rest.slice(0, rest.indexOf(");") + 2);
}

const sql = (strings, ...vals) => String.raw({ raw: strings }, ...vals);

let pg;

async function search(query, types = null, limit = 25, offset = 0) {
  const { rows } = await pg.query(
    `select group_key, entity_id, title, match_type, match_rank
       from public.universal_search($1, $2, $3, $4)`,
    [query, types, limit, offset],
  );
  return rows.map((r) => ({ ...r, entity_id: Number(r.entity_id) }));
}

const idsOf = (rows) => (rows ?? []).map((r) => `${r.group_key}:${r.entity_id}`).sort();

/**
 * The alias seed, read out of the alias migration itself. Its self-test refuses
 * any seeded alias that points at nothing, so the fixture must build a target
 * for every row. Parsed rather than listed so the two cannot drift.
 */
function seededAliases() {
  const head = "insert into public.search_aliases (alias, expansion, note) values";
  const start = aliases.indexOf(head);
  expect(start, "the alias migration has no seed block").toBeGreaterThan(-1);
  const body = aliases.slice(start + head.length,
    aliases.indexOf("on conflict do nothing;", start));
  const rows = [];
  const tuple = /\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'\s*,/g;
  let m;
  while ((m = tuple.exec(body)) !== null) rows.push(m[2].replace(/''/g, "'"));
  expect(rows.length, "no alias tuples parsed out of the seed").toBeGreaterThan(20);
  return rows;
}

// Chapters an EARLIER migration's own self-test names. They are not ours; the
// chain aborts without them.
const EXTRA_CHAPTERS = [
  "Thermodynamics", "Gravitation", "Friction", "Projectile Motion",
];

// Chapters, and the lesson each one needs to clear the content guard. Every
// alias expansion gets one, plus the ones these controls need.
const CHAPTERS = [...new Set([
  ...seededAliases(),
  "Definite Integration",
  "Indefinite Integration",
  "Kinematics",
  "Permutations and Combinations",
  "Simple Harmonic Motion",
  "Alternating Current",
  ...EXTRA_CHAPTERS,
])];

// Titles chosen so the control queries below exercise a specific tier:
//   "definite integration one shot"  tier 4 for "def int" (both substrings)
//   "Kinematics Problems"            tier 5 for "kinamatics" (misspelt)
//   "Integration Basics"             matches ONE token of "def int" only, so
//                                    the ranker must reject it both before and
//                                    after — the row that proves the comparison
//                                    is not vacuous.
const VIDEOS = [
  "Definite Integration One Shot",
  "Indefinite Integration Basics",
  "Kinematics Problems",
  "Integration Basics",
  "Alternating Current Full Chapter",
  // Below this line the titles are not ours. Each exists because a line in an
  // EARLIER migration's own self-test names it, and those self-tests run as
  // part of the chain this rehearsal executes. Without them the chain aborts
  // with "REGRESSION - these returned results before", which is that migration
  // doing its job on a fixture too thin to satisfy it.
  "Pulley Problem - Newton's Laws of Motion",
  "Maxima and Minima - Applications of Derivatives",
  "Class 11 Physics Full Course",
  "Gravitation Class 11 One Shot",
  "Projectile Motion Numericals",
  "Friction Problems Solved",
  "Newton's Laws of Motion (NLM) - Full Chapter",
  "Chemistry Full Syllabus Marathon",
  "Surdas Ke Pad (सूरदास के पद) — Full Chapter",
  "Kartoos (कारतूस) — Full Chapter",
];

// Each is run before and after. They are chosen by TIER, not by looking nice.
const CONTROL_QUERIES = [
  // Multi-token, no alias: the queries this migration is actually for.
  "def int",
  "int def",
  "definite integration",
  "integration basics",
  // Tier 5, misspelt on purpose. If `%>` were stricter than tier 5's 0.5 this
  // is the query that would silently lose its row.
  "kinamatics",
  "kinamatics problem",
  // Single token: no second anchor exists, so nothing may change.
  "kinematics",
  "integration",
  "shm",
  // Aliased: the migration must NOT fire, because a row can survive on alias
  // tokens alone and requiring a second typed token would drop it.
  "p and c",
  "pnc",
  // Nothing should match, before or after.
  "zzzz qqqq",
];

let before = {};

beforeAll(async () => {
  pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec("create extension if not exists pg_trgm;");
  await pg.exec(sql`
    create role anon;
    create role authenticated;
    create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
  `);

  await pg.exec(sql`
    create table public.subjects (id bigint primary key, name text not null, slug text, display_order int);
    create table public.chapters (id bigint primary key, name text not null, slug text, subject_id bigint, display_order int);
    create table public.videos (id bigint primary key, title text not null, chapter_id bigint, subject_id bigint, youtube_video_id text);
    create table public.institutes_channels (id bigint primary key, name text not null);
    create table public.playlists (id bigint primary key, title text not null, teacher text, channel_id bigint, subject_id bigint);
    create table public.playlist_videos (playlist_id bigint, video_id bigint, position int);
    create table public.learning_goals (id bigint primary key, slug text, name text, display_order int);
    create table public.boards (id bigint primary key, slug text, name text, display_order int);
    create table public.class_levels (id bigint primary key, slug text, name text, display_order int);
  `);
  await pg.exec(baselineTable("study_materials"));
  await pg.exec(baselineTable("study_material_scopes"));
  await pg.exec(sql`
    alter table public.study_material_scopes
      alter column id add generated always as identity;
    alter table public.study_materials enable row level security;
    create policy "public reads approved study materials" on public.study_materials
      for select using (review_status = 'approved' and published_at <= now());
    grant select on table public.study_materials to anon, authenticated;
    grant select on table public.study_material_scopes to anon, authenticated;
    grant select on table public.subjects, public.chapters, public.videos,
                        public.institutes_channels, public.playlists,
                        public.playlist_videos, public.learning_goals,
                        public.boards, public.class_levels
      to anon, authenticated;
  `);

  for (const name of [
    "normalize_search_text", "translit_devanagari", "search_latin_key",
    "search_filler_tokens", "search_singular",
    "catalog_similarity", "catalog_word_similarity", "search_rank_tokens",
    "search_query_tokens", "search_playlist_ids", "search_video_ids",
    "set_updated_at", "universal_search",
  ]) {
    await pg.exec(baselineFunction(name));
  }

  // NOT REAL: production's is_admin() reads auth.uid() against public.profiles.
  // The chain only needs it to exist and to gate a write policy.
  await pg.exec(sql`
    create or replace function public.is_admin() returns boolean
      language sql stable as $$ select false $$;
    grant execute on function public.is_admin() to anon, authenticated, service_role;
  `);

  await pg.exec(sql`
    insert into public.subjects (id, name, slug, display_order)
      values (1, 'Physics', 'physics', 1), (2, 'Mathematics', 'mathematics', 2);
    insert into public.institutes_channels (id, name) values (3, 'Competishun');
    insert into public.learning_goals (id, slug, name, display_order)
      values (1, 'jee', 'JEE', 1);
    insert into public.class_levels (id, slug, name, display_order)
      values (1, 'class-11', 'Class 11', 1);
  `);

  let id = 100;
  for (const name of CHAPTERS) {
    id += 1;
    await pg.query(
      `insert into public.chapters (id, name, slug, subject_id, display_order)
       values ($1, $2, $3, 1, 1)`,
      [id, name, `c-${id}`],
    );
    // Content guard: a chapter with no lesson is never suggested.
    await pg.query(
      `insert into public.videos (id, title, chapter_id, subject_id, youtube_video_id)
       values ($1, $2, $3, 1, $4)`,
      [id + 5000, `${name} - One Shot`, id, `yt${id}`],
    );
  }
  let vid = 900;
  for (const title of VIDEOS) {
    vid += 1;
    await pg.query(
      `insert into public.videos (id, title, chapter_id, subject_id, youtube_video_id)
       values ($1, $2, null, 1, $3)`,
      [vid, title, `ytx${vid}`],
    );
  }
  await pg.exec(sql`
    insert into public.playlists (id, title, teacher, channel_id, subject_id) values
      (5, 'Permutations and Combinations - Complete Course', 'ABJ Sir', 3, 2),
      (6, 'Definite Integration Marathon', 'ABJ Sir', 3, 2);
  `);

  // The applied chain, in order, so what this migration replaces is what
  // production actually has.
  await pg.exec(materials);
  await pg.exec(aliases);
  await pg.exec(words);
  await pg.exec(floor);
  await pg.exec(anchorSql);

  // SNAPSHOT, against the deployed body, before the staged migration runs.
  for (const q of CONTROL_QUERIES) before[q] = idsOf(await search(q));

  // ---- the migration under test -------------------------------------------
  await pg.exec(migration);
}, 180_000);

describe("the second anchor never costs a row that answered before it", () => {
  it.each(CONTROL_QUERIES)(
    "returns exactly the same rows for %j",
    async (query) => {
      const after = idsOf(await search(query));
      expect(after).toEqual(before[query]);
    },
  );

  // Without this, every assertion above could be comparing two empty arrays and
  // passing for the wrong reason. At least one control query must have matched
  // something, and the multi-token ones must be among them — those are the only
  // queries the migration changes the plan for.
  it("was not comparing empty result sets", () => {
    const matched = CONTROL_QUERIES.filter((q) => before[q].length > 0);
    expect(matched.length).toBeGreaterThan(4);
    expect(before["def int"].length).toBeGreaterThan(0);
    expect(before["kinamatics"].length).toBeGreaterThan(0);
  });

  // The tier-5 case, stated on its own because it is the one the losslessness
  // argument could get wrong. "kinamatics" reaches "Kinematics" only through
  // word_similarity, never as a substring.
  it("keeps a fuzzy match that no substring conjunct could have kept", async () => {
    const rows = await search("kinamatics");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => /kinematics/i.test(r.title))).toBe(true);
    // And it really is fuzzy: the typed token is not in the title.
    expect(/kinamatics/i.test(rows[0].title)).toBe(false);
  });
});

describe("the migration's own guards", () => {
  it("wrote the conjunct into all six pillars, not one", async () => {
    // Substring arithmetic rather than a regex: the escaping for a literal ")"
    // has to survive JS, the pg wire protocol and Postgres's own regex parser,
    // and it did not.
    const { rows } = await pg.query(sql`
      select (length(p.prosrc) - length(replace(p.prosrc, $1, '')))
             / length($1) as n
        from pg_proc p
       where p.pronamespace = 'public'::regnamespace
         and p.proname = 'universal_search'
         and pg_get_function_identity_arguments(p.oid)
             = 'p_query text, p_types text[], p_limit integer, p_offset integer'
    `, ["%> q_sing2 )"]);
    expect(Number(rows[0].n)).toBe(6);
  });

  it("gated the second anchor on no alias having fired", async () => {
    const { rows } = await pg.query(sql`
      select position('if q_alias_needle is not distinct from q then' in p.prosrc) as at
        from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.proname = 'universal_search'
         and pg_get_function_identity_arguments(p.oid)
             = 'p_query text, p_types text[], p_limit integer, p_offset integer'
    `);
    expect(Number(rows[0].at)).toBeGreaterThan(0);
  });

  it("carried forward the anchor floor and the alias pass it was built on", async () => {
    const { rows } = await pg.query(sql`
      select p.prosrc as src from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.proname = 'universal_search'
         and pg_get_function_identity_arguments(p.oid)
             = 'p_query text, p_types text[], p_limit integer, p_offset integer'
    `);
    const src = rows[0].src;
    for (const marker of ["search_anchor", "search_rank_aliased", "study_material_haystack", "max(length(tok))"]) {
      expect(src.includes(marker), `${marker} was dropped by the re-emission`).toBe(true);
    }
  });

  // The self-test has to be able to fail, or it is decoration. Feed the same
  // DO block a body that lost five of the six gates.
  it("its self-test rejects a body with the conjunct in only one gate", async () => {
    const tampered = migration.replace(
      /-- SECOND ANCHOR \(lossless[\s\S]*?%> q_sing2 \)\n/g,
      (m, offset, whole) => (whole.indexOf(m) === offset ? m : ""),
    );
    // Sanity: the tamper actually removed gates.
    expect((tampered.match(/%> q_sing2 \)/g) ?? []).length).toBeLessThan(6);
    await expect(pg.exec(tampered)).rejects.toThrow(/SECOND ANCHOR SELF-TEST FAILED/);
  });
});
