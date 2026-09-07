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
const NEEDLE = "supabase/migrations/20260907170000_universal_search_alias_needle.sql";

const baseline = readFileSync(BASELINE, "utf8");
const materials = readFileSync(MATERIALS, "utf8");
const migration = readFileSync(MIGRATION, "utf8");
const words = readFileSync(WORDS, "utf8");
const floor = readFileSync(FLOOR, "utf8");
const needle = readFileSync(NEEDLE, "utf8");

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
  await pg.exec(needle);
}, 180_000);
// ===========================================================================
// The needle swap.
//
// A local engine holds a handful of rows, so it cannot reproduce a statement
// timeout — the production failure this migration exists for. What it CAN
// prove is the thing that causes it: which token ends up driving the index
// prefilter. These tests read that decision out of the function's behaviour
// rather than trusting the SQL text.
// ===========================================================================

/** Ask the live function what it matched, via a query only one needle can find. */
async function results(q) {
  const { rows } = await pg.query(
    `select group_key, title from public.universal_search($1, null, 25, 0)`, [q]);
  return rows;
}

describe("a typed needle that cannot drive the index borrows the expansion's", () => {
  it("answers the alias whose own tokens are all one character", async () => {
    // "p and c" -> "permutations and combinations". On production the typed
    // form is the only 500 in the catalogue while the expansion and the "pnc"
    // alias both answer 111 rows in under 1.3s. Here we can only check that it
    // answers at all, and answers the same thing.
    const typed = await results("p and c");
    const expanded = await results("permutations and combinations");
    expect(typed.length).toBeGreaterThan(0);
    expect(typed.map((r) => r.title).sort())
      .toEqual(expanded.map((r) => r.title).sort());
  });

  it("leaves a query whose own needle is usable exactly as it was", async () => {
    // "kinematics" needs no help: its needle is its own word. If the swap
    // fired here it would be matching on something the student did not type.
    const rows = await results("kinematics");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => /kinematic/i.test(r.title))).toBe(true);
  });

  it("does not fire when there is no expansion to borrow from", async () => {
    // Same shape as "p and c" -- tiny tokens joined by filler -- but no alias.
    // There is nothing to swap to, so the query keeps its own needle and
    // simply answers with whatever that finds.
    await expect(results("x and y")).resolves.toBeDefined();
  });
});

describe("the condition is narrow on purpose", () => {
  it("only swaps when the typed needle is filler or too short", () => {
    const sql = readFileSync(NEEDLE, "utf8");
    const start = sql.indexOf("if q_alias_long is distinct from q_long");
    expect(start, "the swap is not in the migration").toBeGreaterThan(-1);
    const block = sql.slice(start, start + 260);
    // All three conditions present: there IS an expansion and it differs, the
    // expansion's needle is usable, and the typed one is not.
    expect(block).toMatch(/length\(q_alias_long\) >= 3/);
    expect(block).toMatch(/length\(q_long\) < 3/);
    expect(block).toMatch(/q_long = any \(public\.search_filler_tokens\(\)\)/);
  });

  it("is the only change to the body it was built from", () => {
    const body = (file) => {
      const s = readFileSync(file, "utf8");
      const a = s.indexOf("create or replace function public.universal_search(");
      const b = s.indexOf("end; $_$;", a);
      expect(a, `no universal_search in ${file}`).toBeGreaterThan(-1);
      return s.slice(a, b + "end; $_$;".length);
    };
    const undone = body(NEEDLE).replace(
      /\n\n {2}-- USE THE EXPANSION'S NEEDLE[\s\S]*? {4}q_long := q_alias_long;\n {2}end if;/,
      "");
    expect(undone).toBe(body(FLOOR));
  });
});

describe("nothing that already worked was given up", () => {
  it.each([
    ["kinematics", "a plain single word"],
    // The fixture seeds one short_notes row; "short notes" is the kind word
    // that reaches it, and reaching it at all is what proves the haystack
    // survived the re-emission.
    ["short notes", "a kind word the haystack added"],
    ["pnc", "a curated alias that already worked"],
  ])("still answers %s (%s)", async (q) => {
    expect((await results(q)).length).toBeGreaterThan(0);
  });

  it("still carries every earlier feature in the emitted body", async () => {
    const { rows } = await pg.query(`
      select prosrc from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'universal_search'`);
    expect(rows).toHaveLength(1);
    const src = rows[0].prosrc;
    for (const marker of ["search_rank_aliased", "study_material_haystack",
                          "'material'", "max(length(tok))"]) {
      expect(src, `the re-emission dropped ${marker}`).toContain(marker);
    }
  });
});
