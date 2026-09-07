// browseRpcServableFloorSqlRehearsal.test.js
//
// WHAT IS REAL HERE. These tests EXECUTE
// supabase/migrations/20260907091500_browse_rpc_servable_floor.sql on a real
// PostgreSQL engine (PGlite, Postgres compiled to WASM) with the real pg_trgm
// extension. The migration's own self-verification DO block runs, so if the
// floor were wrong in either direction this file would fail at setup rather
// than in an assertion.
//
// AND IT RUNS ON THE COMPOSED CHAIN, in the order `db push` uses:
//
//   20260831140005 production_baseline
//   20260901160000 universal_search_materials
//   20260902170000 search_aliases              (search_video_ids' newest body)
//   20260902180000 universal_search_material_words
//   20260902240000 browse_course_relevance     (search_playlist_ids' newest body)
//   20260907091500 browse_rpc_servable_floor    (this migration)
//
// That matters more than usual here, because this migration RE-EMITS both
// browse matchers. Setting it up on a clean baseline would prove nothing about
// whether it carried the alias pass and the relevance ordering forward — the
// exact failure src/searchFeatureCarryOverSqlContract.test.js exists to catch at
// author time, and this file catches by execution.
//
// WHAT IS NOT REAL. The catalogue is a stand-in of a few dozen rows, not
// production's 484 playlists / 5,471 lectures. public.is_admin() is a stub. And
// crucially: PGlite will not reproduce production's PLAN. These tests prove the
// floor REFUSES and ADMITS the right queries. They cannot prove the timing that
// motivated it — that came from measuring production, and is recorded in the
// migration header.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { beforeAll, describe, expect, it } from "vitest";

const BASELINE = "supabase/migrations/20260831140005_production_baseline.sql";
const MATERIALS = "supabase/migrations/20260901160000_universal_search_materials.sql";
const ALIASES = "supabase/migrations/20260902170000_search_aliases.sql";
const WORDS = "supabase/migrations/20260902180000_universal_search_material_words.sql";
const RELEVANCE = "supabase/migrations/20260902240000_browse_course_relevance.sql";
const MIGRATION = "supabase/migrations/20260907091500_browse_rpc_servable_floor.sql";

const baseline = readFileSync(BASELINE, "utf8");
const aliases = readFileSync(ALIASES, "utf8");
const migration = readFileSync(MIGRATION, "utf8");

/**
 * The alias seed, read out of the alias migration itself. That migration's own
 * self-test refuses any seeded alias whose expansion matches nothing, so the
 * fixture has to be derived from the seed rather than guessed at — the same
 * approach src/browseCourseRelevanceSqlRehearsal.test.js takes.
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
  while ((m = tuple.exec(body)) !== null) {
    rows.push({ alias: m[1].replace(/''/g, "'"), expansion: m[2].replace(/''/g, "'") });
  }
  expect(rows.length, "no alias tuples parsed out of the seed").toBeGreaterThan(20);
  return rows;
}

const SEED = seededAliases();

const sql = (s) => s.raw.join("");

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

function baselineTable(name) {
  const head = `CREATE TABLE IF NOT EXISTS "public"."${name}" (`;
  const start = baseline.indexOf(head);
  expect(start, `baseline has no table ${name}`).toBeGreaterThan(-1);
  const end = baseline.indexOf("\n);", start);
  return `${baseline.slice(start, end)}\n);`;
}

let pg;

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
  await pg.exec(sql`
    create or replace function public.is_admin() returns boolean
      language sql stable as $$ select false $$;
    grant execute on function public.is_admin() to anon, authenticated, service_role;
  `);

  await pg.exec(readFileSync(MATERIALS, "utf8"));

  // A catalogue with titles that a servable query can actually find, so the
  // "still answers" half of every assertion below is not vacuous.
  await pg.exec(sql`
    insert into public.subjects (id, name, slug, display_order)
      values (1, 'Physics', 'physics', 1);
    insert into public.institutes_channels (id, name) values (3, 'Competishun');
    insert into public.learning_goals (id, slug, name, display_order)
      values (1, 'jee', 'JEE', 1);
    -- 9xxx deliberately: the chapter loop below generates video ids from its
    -- own counter (chapter id + 5000) and would collide in the 51xx range.
    insert into public.videos (id, title, chapter_id, subject_id, youtube_video_id) values
      (9001, 'Acid Base Titration Basics', null, 1, 'yt9001'),
      (9002, 'Physics Class 11 Full Course', null, 1, 'yt9002'),
      -- The rest of the alias migration's regression corpus, which searches
      -- these phrases and aborts if any of them stops returning rows.
      (9003, 'Pulley Problem - Newton''s Laws of Motion', null, 1, 'yt9003'),
      (9004, 'Maxima and Minima - Applications of Derivatives', null, 1, 'yt9004'),
      (9005, 'Gravitation Class 11 One Shot', null, 1, 'yt9005'),
      (9006, 'Projectile Motion Numericals', null, 1, 'yt9006'),
      (9007, 'Friction Problems Solved', null, 1, 'yt9007'),
      (9008, 'Class 11 Physics NCERT Full Course', null, 1, 'yt9008');
    insert into public.playlists (id, title, teacher, channel_id, subject_id) values
      (7, 'Complete Kinematics', 'ABJ Sir', 3, 1),
      (8, 'Physics One Shot - Aagaz Series', 'ABJ Sir', 3, 1),
      (9, 'Acid Base Chemistry', 'ABJ Sir', 3, 1);
  `);

  // One chapter per seeded alias expansion, plus a lecture named after it. The
  // alias migration aborts if any seeded alias expands to something the
  // catalogue does not contain, so this fixture is derived from the seed.
  const chapterNames = [...new Set([
    ...SEED.map((r) => r.expansion),
    // The alias migration's "nothing that worked broke" corpus searches for
    // these through universal_search, so they have to exist before it runs.
    "Kinematics", "Thermodynamics", "Gravitation", "Friction", "Projectile Motion",
    "Alternating Current", "Permutations and Combinations",
  ])];
  let cid = 100;
  for (const name of chapterNames) {
    cid += 1;
    await pg.query(
      `insert into public.chapters (id, name, slug, subject_id, display_order)
       values ($1, $2, $3, 1, 1)`,
      [cid, name, `c-${cid}`],
    );
    await pg.query(
      `insert into public.videos (id, title, chapter_id, subject_id, youtube_video_id)
       values ($1, $2, $3, 1, $4)`,
      [cid + 5000, `${name} - One Shot`, cid, `yt${cid}`],
    );
  }

  await pg.exec(readFileSync(ALIASES, "utf8"));
  await pg.exec(readFileSync(WORDS, "utf8"));
  await pg.exec(readFileSync(RELEVANCE, "utf8"));
  // The migration under test. Its own DO $verify$ block runs here; a wrong
  // floor aborts the transaction and fails this setup.
  await pg.exec(migration);
}, 120000);

const ids = async (fn, q) =>
  (await pg.query(`select id from public.${fn}($1)`, [q])).rows.map((r) => r.id);

describe("browse matchers: the servable floor", () => {
  // Every one of these was measured at HTTP 500 57014 on production. The old
  // guard tested `qlen`, the length of the whole string, so only the first was
  // refused -- and even that one only because qlen happened to be 2.
  it.each([
    ["ac", "one token, 2 characters"],
    ["3d", "one token, 2 characters"],
    ["p c", "two 1-character tokens, 3 characters overall"],
    ["a b c", "three 1-character tokens, 5 characters overall"],
    ["p and c", "7 characters overall, longest surviving token far too short"],
  ])("refuses %j (%s), from both matchers", async (q) => {
    expect(await ids("search_video_ids", q)).toEqual([]);
    expect(await ids("search_playlist_ids", q)).toEqual([]);
  });

  // The other half. A floor that refuses everything would pass the block above,
  // so these queries -- all measured at HTTP 200 -- must still be answered.
  it.each([
    ["kinematics", "one long token"],
    ["acid", "one token, exactly 4 characters"],
    ["physics", "one long token"],
  ])("still answers %j (%s)", async (q) => {
    const videos = await ids("search_video_ids", q);
    const playlists = await ids("search_playlist_ids", q);
    expect(videos.length + playlists.length).toBeGreaterThan(0);
  });

  it("keeps the multi-token queries that carry a long token", async () => {
    // "p block" and "class 11" are the controls from useUniversalSearch.js:
    // several tokens, but one of them long enough to drive the index. The floor
    // must not treat "several tokens" as disqualifying on its own.
    const { rows } = await pg.query(
      `select public.search_is_servable(t.q_tokens, t.q_long) as ok
         from public.search_query_tokens($1) t`,
      ["p block"],
    );
    expect(rows[0].ok).toBe(true);
  });

  it("exposes the rule as a callable helper, so both matchers share one copy", async () => {
    const { rows } = await pg.query(
      `select p.proname, p.provolatile
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'search_is_servable'`,
    );
    expect(rows).toHaveLength(1);
    // IMMUTABLE ('i'), or the callers could not stay `stable`.
    expect(rows[0].provolatile).toBe("i");
  });

  it("did not narrow what a servable query matches", async () => {
    // The migration re-emits both bodies. If it had dropped a disjunct or the
    // ranker, a literal title would stop being found. The expected id is looked
    // up rather than hardcoded, because the chapter fixture is generated from
    // the alias seed and its ids move when that seed changes.
    const { rows } = await pg.query(
      `select id from public.videos where title = 'Kinematics - One Shot'`,
    );
    expect(rows, "the kinematics fixture is missing").toHaveLength(1);
    expect(await ids("search_video_ids", "kinematics")).toContain(rows[0].id);
    expect(await ids("search_playlist_ids", "kinematics")).toContain(7);
  });
});
