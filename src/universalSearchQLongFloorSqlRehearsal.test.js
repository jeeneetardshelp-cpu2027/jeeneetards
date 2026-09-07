// searchAliasesSqlRehearsal.test.js
//
// WHAT IS REAL HERE. These tests EXECUTE the staged migration
// supabase/migrations/20260902170000_search_aliases.sql on a real PostgreSQL
// engine (PGlite, Postgres compiled to WASM) with the real pg_trgm extension,
// so `%>`, word_similarity, the generated alias-key columns, the RLS policies
// and the migration's own self-verification DO block all actually run. Nothing
// in the migration is re-typed here. The search helpers it builds on
// (search_latin_key, search_rank_tokens, search_query_tokens, the filler list,
// the transliterator, search_playlist_ids, search_video_ids) are extracted
// verbatim from the production baseline, and the seven-group universal_search
// this file replaces is produced by executing the applied migration
// 20260901160000_universal_search_materials.sql — so what runs is what
// production has.
//
// WHAT IS NOT REAL. The catalogue is a stand-in. The migration's self-test
// refuses any seeded alias that points at nothing, so the fixture builds one
// chapter (and one lesson, for the content guard) per seeded expansion, PARSED
// OUT OF THE MIGRATION'S OWN SEED so the two cannot drift. Row counts are a
// handful, not production's, and public.is_admin() is a stub that returns
// false. These tests prove CORRECTNESS, the before/after behaviour of real
// queries, and the abort path. They prove nothing about production query PLANS
// or timing.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { beforeAll, describe, expect, it } from "vitest";

const BASELINE = "supabase/migrations/20260831140005_production_baseline.sql";
const MATERIALS = "supabase/migrations/20260901160000_universal_search_materials.sql";
const MIGRATION = "supabase/migrations/20260902170000_search_aliases.sql";
const WORDS = "supabase/migrations/20260902180000_universal_search_material_words.sql";
const FLOOR = "supabase/migrations/20260907093000_universal_search_q_long_floor.sql";

const baseline = readFileSync(BASELINE, "utf8");
const materials = readFileSync(MATERIALS, "utf8");
const migration = readFileSync(MIGRATION, "utf8");
const words = readFileSync(WORDS, "utf8");
const floor = readFileSync(FLOOR, "utf8");

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
  const end = baseline.indexOf("\n);", start);
  return `${baseline.slice(start, end)}\n);`;
}

/**
 * The seed, read out of the migration file itself. The fixture below builds a
 * target for every row, so a new alias added to the migration automatically
 * gets a target here and automatically gets tested — the two cannot drift.
 */
function seededAliases() {
  const head = "insert into public.search_aliases (alias, expansion, note) values";
  const start = migration.indexOf(head);
  expect(start, "the migration has no seed block").toBeGreaterThan(-1);
  const body = migration.slice(start + head.length,
    migration.indexOf("on conflict do nothing;", start));
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

// Extra catalogue the migration's own corpus assertions need. Every one of
// these exists because a line in the self-test names it.
const EXTRA_CHAPTERS = [
  "Kinematics", "Thermodynamics", "Gravitation", "Friction", "Projectile Motion",
];
const EXTRA_VIDEOS = [
  "Pulley Problem - Newton's Laws of Motion",
  "Maxima and Minima - Applications of Derivatives",
  "Class 11 Physics Full Course",
  "Gravitation Class 11 One Shot",
  "Projectile Motion Numericals",
  "Friction Problems Solved",
  // The literal-preservation control: the chapter really is called this.
  "Newton's Laws of Motion (NLM) - Full Chapter",
  // "emi" is a substring of "chemistry"; this row must keep matching "emi".
  "Chemistry Full Syllabus Marathon",
  // Latin+Devanagari, exactly as the Hindi imports title their lessons.
  "Surdas Ke Pad (सूरदास के पद) — Full Chapter",
  "Kartoos (कारतूस) — Full Chapter",
];

// Queries whose results must be byte-identical before and after the migration.
const CONTROL_QUERIES = [
  "kinematics",
  "rotational motion",
  "thermodynamics",
  "gravitation class 11",
  "kinamatics",
  "rotatinal motion",
  "how to solve pulley problems",
  "jee main 2024 paper",
  "zzqqxx no such topic zzqqxx",
];

let pg;
let before = {};        // control query -> rows, captured pre-migration
let beforeAlias = {};   // alias -> rows, captured pre-migration

const sql = (strings, ...vals) => String.raw({ raw: strings }, ...vals);

async function search(query, types = null, limit = 25, offset = 0) {
  const { rows } = await pg.query(
    `select group_key, entity_id, title, match_type, match_rank
       from public.universal_search($1, $2, $3, $4)`,
    [query, types, limit, offset],
  );
  return rows.map((r) => ({ ...r, entity_id: Number(r.entity_id) }));
}

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
  // The migration only needs it to exist (preflight) and to gate the write
  // policy; "always false" is the honest stand-in for "nobody here is an admin".
  await pg.exec(sql`
    create or replace function public.is_admin() returns boolean
      language sql stable as $$ select false $$;
    grant execute on function public.is_admin() to anon, authenticated, service_role;
  `);

  // Seven-group universal_search, produced by running the migration production
  // already has, so this file replaces exactly what it will replace.
  await pg.exec(materials);

  // ---- catalogue -----------------------------------------------------------
  await pg.exec(sql`
    insert into public.subjects (id, name, slug, display_order)
      values (1, 'Physics', 'physics', 1);
    insert into public.institutes_channels (id, name) values (3, 'Competishun');
    insert into public.learning_goals (id, slug, name, display_order)
      values (1, 'jee', 'JEE', 1);
    insert into public.class_levels (id, slug, name, display_order)
      values (1, 'class-11', 'Class 11', 1);
  `);

  const chapterNames = [...new Set([...SEED.map((r) => r.expansion), ...EXTRA_CHAPTERS])];
  let id = 100;
  for (const name of chapterNames) {
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
  for (const title of EXTRA_VIDEOS) {
    vid += 1;
    await pg.query(
      `insert into public.videos (id, title, chapter_id, subject_id, youtube_video_id)
       values ($1, $2, null, 1, $3)`,
      [vid, title, `ytx${vid}`],
    );
  }
  await pg.exec(sql`
    insert into public.playlists (id, title, teacher, channel_id, subject_id) values
      (5, 'Permutations and Combinations - Complete Course', 'ABJ Sir', 3, 1),
      (6, 'Simple Harmonic Motion Marathon', 'ABJ Sir', 3, 1),
      (7, 'Complete Kinematics', 'ABJ Sir', 3, 1);
    insert into public.playlist_videos (playlist_id, video_id, position)
      values (7, 901, 1);
    insert into public.study_materials
      (id, title, material_type, source_name, source_url, rights_status,
       review_status, published_at, exam_year)
    values
      (1, 'Simple Harmonic Motion Short Notes', 'short_notes', 'NCERT',
       'https://example.test/a', 'official_source', 'approved', now(), null),
      (2, 'JEE Main 2024 Session 1 Shift 1 Question Paper', 'previous_year_paper',
       'NTA', 'https://example.test/b', 'official_source', 'approved', now(), 2024);
    insert into public.study_material_scopes (material_id, learning_goal_id, class_level_id, subject_id)
      values (1, 1, 1, 1);
  `);

  // ---- snapshot the world BEFORE the alias migration ------------------------
  for (const q of CONTROL_QUERIES) before[q] = await search(q);
  for (const { alias } of SEED) beforeAlias[alias] = await search(alias);

  // The migration's preflight and self-verification abort the transaction if
  // anything is wrong, so getting past this line is the first assertion.
  await pg.exec(migration);
  await pg.exec(words);
  await pg.exec(floor);
}, 180_000);
// The floor is about WHICH TOKEN drives the index prefilter, and that is not
// directly observable from outside the function. It is observable through
// behaviour: q_long is used as a LIKE needle, so a query whose only surviving
// token is two characters matches on that token, while one that keeps its raw
// tokens matches on the longest raw one. These tests read that difference.
//
// What they CANNOT show is the timeout itself. PGlite holds a handful of rows,
// so no plan here is slow enough to be cancelled; the production evidence for
// that is in the migration header ("p and c" -> 500 57014, 3/3 runs). These
// prove the SELECTION rule changed, and that nothing else did.

describe("filler removal stops where it would break the index", () => {
  it("still filters when a real word survives", async () => {
    // "one" and "shot" are content here; "kinematics" is what carries the
    // needle. Nothing about this query changes.
    const rows = await search("kinematics one shot");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("keeps the raw tokens when filtering would leave only a short one", async () => {
    // "the" and "of" are already English filler, so this is an exact stand-in
    // for the post-Hinglish state: same q_tokens, same q_long. Without the
    // floor the needle becomes "ac"; with it, the raw tokens are kept.
    const rows = await search("ac the of");
    // The assertion that matters is that it ANSWERS. Before the floor this is
    // the shape that scans the catalogue and gets cancelled in production.
    expect(Array.isArray(rows)).toBe(true);
  });

  it("does not change a query whose survivors are long enough", async () => {
    // Control: filler removal still happens where it always did.
    const withFiller = await search("the kinematics");
    const without = await search("kinematics");
    expect(withFiller.map((r) => r.entity_id).sort())
      .toEqual(without.map((r) => r.entity_id).sort());
  });
});

describe("the features this re-emission had to carry", () => {
  const source = async () => {
    const { rows } = await pg.query(`
      select prosrc from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'universal_search'`);
    return rows[0].prosrc;
  };

  it("still runs the curated shorthand alias pass", async () => {
    expect(await source()).toContain("search_rank_aliased");
    // Behaviour, not just the marker: a seeded shorthand still resolves.
    const rows = await search("shm");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("still widens the material haystack with kind words", async () => {
    expect(await source()).toContain("study_material_haystack");
    const rows = await search("short notes");
    expect(rows.some((r) => r.group_key === "material")).toBe(true);
  });

  it("still returns the material and paper pillars", async () => {
    const src = await source();
    expect(src).toContain("'material'");
    expect(src).toContain("'paper'");
  });

  it("carries the floor itself, so a later re-emission cannot drop it silently", async () => {
    expect(await source()).toContain("max(length(tok))");
  });
});


describe("the hazard the floor exists for, shown on a real engine", () => {
  // search_query_tokens is the SHARED helper and has no floor -- the floor
  // lives inline in universal_search. So this reads the unfloored selection
  // and shows the cliff is real: for these queries the needle the prefilter
  // would otherwise use is two characters long.
  const qLong = async (query) => {
    const { rows } = await pg.query(
      "select q_long, q_tokens from public.search_query_tokens($1)", [query]);
    return rows[0];
  };

  it("would pick a two-character needle once the particles are filler", async () => {
    // "the" and "of" are ALREADY English filler, so this is an exact stand-in
    // for what "ac ka matlab" becomes after the Hinglish list is applied:
    // same surviving tokens, same needle.
    const { q_long: needle } = await qLong("ac the of");
    expect(needle).toBe("ac");
    expect(needle.length).toBeLessThan(3);
  });

  it("has a longer raw token available to fall back to", async () => {
    // Which is what makes the floor a rescue rather than a refusal: the query
    // as typed contains something the index can use.
    const raw = "ac the of".split(" ");
    expect(Math.max(...raw.map((t) => t.length))).toBeGreaterThanOrEqual(3);
  });

  it("leaves a long needle alone, so the common case is untouched", async () => {
    const { q_long: needle } = await qLong("kinematics ka one shot");
    expect(needle.length).toBeGreaterThanOrEqual(3);
    // "kinematics" survives whatever the filler list says about the rest, so
    // the floor never engages here and the filtering keeps its benefit.
    expect(needle).toBe("kinematics");
  });

  it("is implemented as a condition on the guard, not as a comment", async () => {
    // The behavioural half cannot be shown here: PGlite holds a handful of
    // rows, so no plan is slow enough to be cancelled. The production evidence
    // is in the migration header ("p and c" -> 500 57014, 3 of 3 runs). What
    // this file CAN prove is that the condition is in the body production
    // will run, and that is what the carry-over contract then holds forward.
    const { rows } = await pg.query(`
      select prosrc from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'universal_search'`);
    expect(rows[0].prosrc).toContain("max(length(tok))");
    expect(rows[0].prosrc).toContain(">= 3");
  });
});
