// searchFillerTokensHinglishSqlRehearsal.test.js
//
// WHAT IS REAL HERE. These tests EXECUTE the staged migration
// docs/sql/search_filler_tokens_hinglish_2026-09-07.sql on a
// real PostgreSQL engine (PGlite, Postgres compiled to WASM) with the real
// pg_trgm extension, so word_similarity, `%>`, the trigram fuzzy tier, the
// migration's preflight, its catalogue scan for the singular trap and its
// twenty-five tokenisation probes all actually run. Nothing in the migration is
// re-typed here — the word lists, the probes and the abort messages are read
// out of the file itself.
//
// AND IT RUNS ON THE COMPOSED CHAIN, not on a clean baseline. The order is the
// order `db push` uses:
//
//   20260831140005 production_baseline            (the helpers, incl. the
//                                                  English-only filler list)
//   20260901160000 universal_search_materials     (the seven-group search box)
//   20260902170000 search_aliases                 (curated shorthand pass, and
//                                                  the CHECK that forbids an
//                                                  alias whose key is filler)
//   20260902180000 universal_search_material_words
//   20260902240000 browse_course_relevance        (the live universal_search,
//                                                  search_video_ids and
//                                                  search_playlist_ids bodies)
//   20260907123000 search_filler_tokens_hinglish  (this migration)
//
// That arrangement is the whole point twice over. First, because a migration
// rehearsed on the bare baseline proves nothing about the state production is
// in. Second, and specific to THIS change: it is the only way to show that
// universal_search / search_video_ids / search_playlist_ids pick the new words
// up WITHOUT being re-emitted. They call search_filler_tokens() at runtime, so
// replacing that one function is enough — which is why this migration stays
// out of the carry-over contract in
// src/searchFeatureCarryOverSqlContract.test.js instead of joining it.
//
// WHAT IS NOT REAL. The catalogue is a stand-in — a few dozen rows, not 6,863.
// But the rows that matter are not invented: every Hindi title below is copied
// verbatim out of production, because those are the only rows a Hindi filler
// word could damage, and a fixture of made-up Hindi would prove nothing.
// public.is_admin() is a stub returning false. These tests prove CORRECTNESS,
// the before/after behaviour of real queries, and the abort paths. They prove
// nothing about production query PLANS or timing.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { beforeAll, describe, expect, it } from "vitest";

const BASELINE = "supabase/migrations/20260831140005_production_baseline.sql";
const MATERIALS = "supabase/migrations/20260901160000_universal_search_materials.sql";
const ALIASES = "supabase/migrations/20260902170000_search_aliases.sql";
const WORDS = "supabase/migrations/20260902180000_universal_search_material_words.sql";
const RELEVANCE = "supabase/migrations/20260902240000_browse_course_relevance.sql";
const MIGRATION = "docs/sql/search_filler_tokens_hinglish_2026-09-07.sql";

const baseline = readFileSync(BASELINE, "utf8");
const materials = readFileSync(MATERIALS, "utf8");
const aliases = readFileSync(ALIASES, "utf8");
const words = readFileSync(WORDS, "utf8");
const relevance = readFileSync(RELEVANCE, "utf8");
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
  const end = baseline.indexOf("\n);", start);
  return `${baseline.slice(start, end)}\n);`;
}

/** The alias seed, read out of the alias migration itself. */
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

/** Comment-stripped quoted strings out of a slice of the migration. */
const quoted = (s) => [...s.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n")
  .matchAll(/'([^']*)'/g)].map((m) => m[1]);

/** A declared array constant in the migration's verification block. */
function declaredList(name) {
  const start = migration.indexOf(`${name} constant text[] := array[`);
  expect(start, `no ${name} in the migration`).toBeGreaterThan(-1);
  return quoted(migration.slice(start, migration.indexOf("];", start)));
}

/** The emitted array in the function body itself. */
function emittedList() {
  const open = migration.indexOf("$fn$");
  const close = migration.indexOf("$fn$", open + 4);
  expect(close, "the function body is not dollar-quoted with $fn$").toBeGreaterThan(open);
  return quoted(migration.slice(open + 4, close));
}

/** The migration's own self-verification block, re-runnable on demand. */
function verifyBlock() {
  const start = migration.indexOf("do $verify$");
  const end = migration.indexOf("$verify$;", start);
  expect(start, "no self-verification block in the migration").toBeGreaterThan(-1);
  return migration.slice(start, end + "$verify$;".length);
}

const ENGLISH = declaredList("v_english");
const HINDI = declaredList("v_hindi");
const FORBIDDEN = declaredList("v_forbidden");
const EMITTED = emittedList();

// ---------------------------------------------------------------------------
// FIXTURE
// ---------------------------------------------------------------------------

// Named by the alias migration's own self-test.
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
  "Newton's Laws of Motion (NLM) - Full Chapter",
  "Chemistry Full Syllabus Marathon",
  "Surdas Ke Pad (सूरदास के पद) — Full Chapter",
  "Kartoos (कारतूस) — Full Chapter",
];
const FUZZY_COURSES = [
  [20, "Mathematics Foundation Series"],
  [21, "Rank Boosters - Mathematics"],
  [22, "Statistics I Class - XI Mathematics"],
  [23, "Hyperbola - JEE Mathematics"],
  [24, "Chemical Kinetics I Class - XII Chemistry"],
];
const LITERAL_COURSES = [
  [30, "Kinematics 1D"],
  [31, "Kinematics| Irodov solutions"],
  [32, "Rectilinear Motion (Kinematics)"],
  [33, "Rohit Mishra JEE Advanced Kinematics"],
];

// THE ROWS THAT MATTER. Every one of these is copied verbatim out of
// production on 2026-09-07. They are the only rows in the catalogue where a
// proposed Hindi word occurs as a WHOLE TOKEN on the search key, which is the
// only way a filler entry can do harm. A fixture of invented Hindi would prove
// nothing about this change.
const HINDI_CHAPTERS = [
  "नेताजी का चश्मा",
  "माता का आँचल",
  "कबीर की साखी",
  "मीरा के पद",
  "सपनों के से दिन",
  "डायरी का एक पन्ना",
  "एक कहानी यह भी",
  "अट नहीं रही है",
  "अब कहाँ दूसरे के दुख से दुखी होने वाले",
  "मैं क्यों लिखता हूँ",
  "तीसरी कसम के शिल्पकार शैलेंद्र",
];
const HINDI_VIDEOS = [
  "Netaji ka Chashma (नेताजी का चश्मा)",
  "Mata ka Aanchal (माता का आँचल)",
  // The romanised twin of each Devanagari chapter. These exist in production
  // and they matter: translit_devanagari gives every consonant its inherent
  // 'a', so "तीसरी कसम के शिल्पकार" keys to "tisari kasama ke shilpakara" and a
  // student typing "teesri kasam ke shilpkar" reaches the ROMANISED row, never
  // the Devanagari one. That schwa gap is a pre-existing aliasing problem, out
  // of scope here -- but the fixture has to reproduce it rather than hide it.
  "Diary Ka Ek Panna (डायरी का एक पन्ना) — Full Chapter",
  "Meera Ke Pad (मीरा के पद) — Full Chapter",
  "Teesri Kasam Ke Shilpkar Shailendra (तीसरी कसम के शिल्पकार शैलेंद्र)",
  "Dada Ji Ki Kahani",
  "Ek Kahani Yeh Bhi (एक कहानी यह भी)",
  "At Nahi Rahi Hai (अट नहीं रही है)",
  "Mai Kyu Likhta Hu (मैं क्यों लिखता हूँ)",
  "Main Kyon Likhta Hun (मैं क्यों लिखता हूँ) — Full Chapter",
  "Ab Kahan Dusre Ke Dukh Se Dukhi Hone Wale (अब कहाँ दूसरे के दुख से दुखी होने वाले)",
  "Naubatkhane Mein Ibadat (नौबतखाने में इबादत)",
  "Galti Se Mistake — Frullani Integral from Zero to Infinity",
  "Controversy ka Faisla! PW vs CW Who Won? | JEE Limits Question | BEWARE 11 | Anshul Sir",
  "L H Rule ke Papa! Stolz Cesaro Theorem!- Funda 6 | JEE Mains & Advanced | Anshul Sir",
  "Periodic Table वाली Pawri",
  "Faraday Law पर Questions का भंडारा",
  "Counter Current Mechanism - Difficult Nahi Hai",
  "असली Maths -LIMITS - Lec 1 | Limit क्या हैं और कैसे == से अलग होता हैं?  | Anshul Sir",
  "असली Maths -LIMITS - Lec 2  | Left और right hand वाली limits क्या होती हैं ? | Anshul Sir",
  "वज़ीर अली ने कंपनी के वकील का कत्ल क्यों किया?",
  "सवार ने कर्नल से कारतूस कैसे हासिल किए?",
];

// Content the "fix" queries are supposed to reach. Shaped after the real
// titles the same queries reach in production.
const FIX_VIDEOS = [
  "Kinematics Numericals - JEE Main PYQs",
  "Friction — One Shot (Concepts + PYQs)",
  "Thermodynamics in One Shot",
  "Rotational Motion One Shot",
  "Electrostatics — Full Chapter Marathon",
  "Gravitation Numericals for JEE",
];

// Rows that exist so a REJECTED word can be proved still alive.
const GUARD_VIDEOS = [
  "Halogens: Preparation, Properties and Uses of HCl, HBr and HI",
  "Bade Bhai Sahab (बड़े भाई साहब)",
  "Kar Chale Hum Fida (कर चले हम फ़िदा)",
  "Rotation (Part 1) - Rigid Body Dynamics",
  "Class 10 Hindi B - Kshitij Complete Revision",
];

// ---------------------------------------------------------------------------

// Queries whose result must be BYTE-IDENTICAL across the migration. None of
// them contains a word this file adds, so nothing about their tokenisation may
// move — that is the regression guard for the other 99% of the search box.
const CONTROL_QUERIES = [
  "kinematics",
  "rotational motion",
  "thermodynamics",
  "gravitation class 11",
  "kinamatics",                       // the typo tier
  "rotatinal motion",
  "how to solve pulley problems",     // the English filler list's own case
  "jee main 2024 paper",
  "one shot",                         // the phrase 'shot' was excluded to save
  "anshul sir limits",                // 'sir' was excluded
  "apna physics",                     // 'apna' was excluded
  "bade bhai sahab",                  // 'bade'/'bhai' were excluded
  "kar chale hum fida",               // 'kar'/'hum' were excluded
  "hcl hbr and hi",                   // 'hi' was excluded: HI is hydrogen iodide
  "rotation par questions",           // 'par' was excluded
  "class 10 hindi",                   // 'hindi' was excluded
  "zzqqxx no such topic zzqqxx",
];

// A Hindi word occurs in each of these AS PART OF A REAL TITLE. The named row
// must still come back, and must not be pushed further down the list.
const HARM_QUERIES = [
  ["netaji ka chashma", "चश्मा"],
  ["mata ka aanchal", "आँचल"],
  ["kabir ki sakhi", "साखी"],
  ["surdas ke pad", "सूरदास"],
  ["meera ke pad", "मीरा"],
  ["sapno ke se din", "सपनों"],
  ["diary ka ek panna", "डायरी"],
  ["ek kahani yeh bhi", "कहानी"],
  ["at nahi rahi hai", "रही"],
  ["dada ji ki kahani", "Dada Ji Ki Kahani"],
  ["main kyon likhta hun", "लिखता"],
  ["teesri kasam ke shilpkar", "शिल्पकार"],
  ["galti se mistake", "Galti Se Mistake"],
  ["controversy ka faisla", "Faisla"],
  ["naubatkhane mein ibadat", "Naubatkhane"],
  ["ab kahan dusre ke dukh se dukhi hone wale", "दुखी"],
  // and the same thing typed in Devanagari, which reaches the identical
  // Latin key through translit_devanagari
  ["नेताजी का चश्मा", "चश्मा"],
  ["कबीर की साखी", "साखी"],
  ["सपनों के से दिन", "सपनों"],
];

// The bug. Zero rows today; rows after.
const FIX_QUERIES = [
  ["kinematics ke numericals", "Kinematics Numericals"],
  ["friction ka concept", "Friction — One Shot"],
  ["thermodynamics ka one shot", "Thermodynamics in One Shot"],
  ["rotation ka one shot", "Rotational Motion One Shot"],
  ["electrostatics ke liye video", "Electrostatics"],
  ["gravitation ke sabhi numericals", "Gravitation Numericals"],
  ["thermodynamics ko kaise samjhein", "Thermodynamics"],
  ["integration kaise karein", "Integration"],
];

let pg;
const before = {};        // control query -> rows, captured pre-migration
const beforeAlias = {};   // alias -> rows, captured pre-migration
const beforeHarm = {};    // harm query -> rows, captured pre-migration
const beforeFix = {};     // fix query -> rows, captured pre-migration
const beforeTokens = {};  // query -> q_tokens, captured pre-migration
const beforeBrowse = {};  // /browse function + query -> ids, captured pre-migration

const sql = (strings, ...vals) => String.raw({ raw: strings }, ...vals);

async function search(query, types = null, limit = 50, offset = 0) {
  const { rows } = await pg.query(
    `select group_key, entity_id, title, match_type, match_rank
       from public.universal_search($1, $2, $3, $4)`,
    [query, types, limit, offset],
  );
  return rows.map((r) => ({ ...r, entity_id: Number(r.entity_id) }));
}

async function tokensOf(query) {
  const { rows } = await pg.query(
    "select q, q_tokens, q_long from public.search_query_tokens($1)", [query],
  );
  return rows[0];
}

const key = (rows) => rows.map((r) => `${r.group_key}:${r.entity_id}:${r.match_rank}`);
const holds = (rows, needle) =>
  rows.filter((r) => (r.title ?? "").includes(needle));

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
  await pg.exec(sql`
    create or replace function public.is_admin() returns boolean
      language sql stable as $$ select false $$;
    grant execute on function public.is_admin() to anon, authenticated, service_role;
  `);

  await pg.exec(materials);

  // ---- catalogue -----------------------------------------------------------
  await pg.exec(sql`
    insert into public.subjects (id, name, slug, display_order)
      values (1, 'Physics', 'physics', 1);
    insert into public.institutes_channels (id, name) values
      (3, 'Competishun'),
      (4, 'APNA PHYSICS IIT JEE By RKH Sir BTECH IIT D');
    insert into public.learning_goals (id, slug, name, display_order)
      values (1, 'jee', 'JEE', 1);
    insert into public.class_levels (id, slug, name, display_order)
      values (1, 'class-11', 'Class 11', 1);
  `);

  const chapterNames = [...new Set([
    ...SEED.map((r) => r.expansion), ...EXTRA_CHAPTERS, ...HINDI_CHAPTERS,
  ])];
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
  for (const title of [...EXTRA_VIDEOS, ...HINDI_VIDEOS, ...FIX_VIDEOS, ...GUARD_VIDEOS]) {
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
      (7, 'Complete Kinematics', 'ABJ Sir', 3, 1),
      (8, 'Physics One Shot - Aagaz Series', 'ABJ Sir', 3, 1),
      (9, 'MISSION 30 : COMPLETE PHYSICAL CHEMISTRY in One Shot', 'ABJ Sir', 3, 1),
      (10, 'Bio ki RanNEETi — Complete NCERT Coverage (Aakash NEET)', 'ABJ Sir', 3, 1);
    insert into public.playlist_videos (playlist_id, video_id, position)
      values (7, 901, 1);
    insert into public.study_materials
      (id, title, material_type, source_name, source_url, rights_status,
       review_status, published_at, exam_year)
    values
      (1, 'Simple Harmonic Motion Short Notes', 'short_notes', 'NCERT',
       'https://example.test/a', 'official_source', 'approved', now(), null),
      (2, 'JEE Main 2024 Session 1 Shift 1 Question Paper', 'previous_year_paper',
       'NTA', 'https://example.test/b', 'official_source', 'approved', now(), 2024),
      (3, 'Units and Measurement - NCERT Physics', 'full_notes', 'NCERT',
       'https://example.test/c', 'official_source', 'approved', now(), null),
      (4, 'CBSE Class 11 Physics 2021', 'previous_year_paper', 'CBSE',
       'https://example.test/d', 'official_source', 'approved', now(), 2021),
      (5, 'कबीर की साखी - NCERT स्पर्श', 'full_notes', 'NCERT',
       'https://example.test/e', 'official_source', 'approved', now(), null),
      (6, 'सूरदास के पद - NCERT क्षितिज', 'full_notes', 'NCERT',
       'https://example.test/f', 'official_source', 'approved', now(), null),
      (7, 'नेताजी का चश्मा - NCERT क्षितिज', 'full_notes', 'NCERT',
       'https://example.test/g', 'official_source', 'approved', now(), null);
    insert into public.study_material_scopes (material_id, learning_goal_id, class_level_id, subject_id)
      values (1, 1, 1, 1), (3, 1, 1, 1), (4, 1, 1, 1);
  `);
  for (const [pid, title] of [...FUZZY_COURSES, ...LITERAL_COURSES]) {
    await pg.query(
      `insert into public.playlists (id, title, teacher, channel_id, subject_id)
       values ($1, $2, 'ABJ Sir', 3, 1)`,
      [pid, title],
    );
  }

  // ---- the chain, in the order db push applies it ---------------------------
  await pg.exec(aliases);
  await pg.exec(words);
  await pg.exec(relevance);

  // ---- the world BEFORE this migration --------------------------------------
  for (const q of CONTROL_QUERIES) before[q] = await search(q);
  for (const { alias } of SEED) beforeAlias[alias] = await search(alias);
  for (const [q] of HARM_QUERIES) beforeHarm[q] = await search(q);
  for (const [q] of FIX_QUERIES) beforeFix[q] = await search(q);
  for (const q of [...CONTROL_QUERIES, ...HARM_QUERIES.map((h) => h[0]),
    ...FIX_QUERIES.map((f) => f[0])]) {
    beforeTokens[q] = (await tokensOf(q)).q_tokens;
  }
  for (const [fn, q] of [
    ["search_video_ids", "kinematics ke numericals"],
    ["search_playlist_ids", "physics ka one shot"],
  ]) {
    const { rows } = await pg.query(`select id from public.${fn}($1)`, [q]);
    beforeBrowse[`${fn}|${q}`] = rows.map((r) => Number(r.id));
  }

  // The preflight and the self-verification abort the transaction if anything
  // is wrong, so getting past this line is the first assertion in the file.
  await pg.exec(migration);
}, 300_000);

describe("the staged migration applies to the composed chain", () => {
  it("runs end to end, its own catalogue scan and 25 probes included", async () => {
    const { rows } = await pg.query(sql`
      select p.provolatile, p.proparallel, p.prokind,
             pg_catalog.format_type(p.prorettype, null) as rettype,
             pg_catalog.pg_get_userbyid(p.proowner) as owner,
             obj_description(p.oid, 'pg_proc') as comment
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'search_filler_tokens'
         and p.pronargs = 0
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].provolatile).toBe("i");     // IMMUTABLE
    expect(rows[0].proparallel).toBe("s");     // PARALLEL SAFE
    expect(rows[0].prokind).toBe("f");
    expect(rows[0].rettype).toBe("text[]");
    expect(rows[0].owner).toBe("postgres");
    expect(rows[0].comment).toContain("Hindi");
  });

  it("keeps the grants a SECURITY INVOKER search depends on", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const { rows } = await pg.query(
        "select has_function_privilege($1, 'public.search_filler_tokens()', 'execute') as ok",
        [role],
      );
      expect(rows[0].ok, `${role} cannot execute search_filler_tokens()`).toBe(true);
    }
    // ...and PUBLIC does not hold it by default, as the baseline had it.
    const { rows } = await pg.query(sql`
      select coalesce(bool_or(a.privilege_type = 'EXECUTE'), false) as public_has
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       where n.nspname = 'public' and p.proname = 'search_filler_tokens'
         and p.pronargs = 0 and a.grantee = 0
    `);
    expect(rows[0].public_has).toBe(false);
  });

  it("is re-runnable, because a re-push must not fail", async () => {
    await expect(pg.exec(migration)).resolves.toBeTruthy();
  });

  it("emits exactly the words it declares, and no others", async () => {
    const { rows } = await pg.query("select public.search_filler_tokens() as list");
    const live = rows[0].list;
    expect(live).toEqual(EMITTED);
    expect(live).toEqual([...ENGLISH, ...HINDI]);
    expect(new Set(live).size).toBe(live.length);
    for (const w of live) expect(w, w).toMatch(/^[a-z]+$/);
  });
});

describe("the English list the baseline shipped is still there, word for word", () => {
  it("carries all 96 of them", async () => {
    const { rows } = await pg.query("select public.search_filler_tokens() as list");
    const live = new Set(rows[0].list);
    // Read out of the BASELINE file, not out of the new migration, so a word
    // dropped from BOTH halves of the new file still fails here.
    const start = baseline.indexOf('CREATE OR REPLACE FUNCTION "public"."search_filler_tokens"()');
    const body = baseline.slice(start, baseline.indexOf("$$;", start));
    const original = quoted(body.slice(body.indexOf("select array[")));
    expect(original.length).toBe(96);
    for (const w of original) {
      expect(live.has(w), `"${w}" was dropped from the filler list`).toBe(true);
    }
    expect(ENGLISH).toEqual(original);
  });
});

describe("the words that were screened OUT stay out", () => {
  it("never contains a rejected word", async () => {
    const { rows } = await pg.query("select public.search_filler_tokens() as list");
    const live = new Set(rows[0].list);
    for (const w of FORBIDDEN) {
      expect(live.has(w), `"${w}" was rejected on a measured collision`).toBe(false);
    }
    // The three the whole design turns on, named so a careless edit that
    // shortened v_forbidden would still fail here.
    for (const w of ["shot", "one", "sir", "hindi", "english", "medium", "par", "hi", "ek"]) {
      expect(FORBIDDEN, `${w} must stay on the rejected list`).toContain(w);
      expect(live.has(w)).toBe(false);
    }
  });

  it("leaves the phrase 'one shot' fully discriminating", async () => {
    const t = await tokensOf("thermodynamics ka one shot");
    expect(t.q_tokens).toEqual(["thermodynamics", "one", "shot"]);
    expect(t.q_long).toBe("thermodynamics");
    // "one shot" typed alone is untouched.
    expect((await tokensOf("one shot")).q_tokens).toEqual(["one", "shot"]);
  });
});

describe("the reported bug", () => {
  it.each(FIX_QUERIES)("'%s' returned nothing and now finds %s", async (q, needle) => {
    expect(beforeFix[q], `"${q}" already returned rows before the fix`).toHaveLength(0);
    const rows = await search(q);
    expect(rows.length, `"${q}" is still empty`).toBeGreaterThan(0);
    expect(holds(rows, needle).length, `"${q}" does not reach "${needle}"`)
      .toBeGreaterThan(0);
  });

  it("drops only the Hindi word, never the topic", async () => {
    expect(beforeTokens["kinematics ke numericals"]).toEqual(["kinematics", "ke"]);
    expect((await tokensOf("kinematics ke numericals")).q_tokens).toEqual(["kinematics"]);
    expect(beforeTokens["friction ka concept"]).toEqual(["friction", "ka", "concept"]);
    expect((await tokensOf("friction ka concept")).q_tokens).toEqual(["friction", "concept"]);
  });

  it("reaches /browse too, with no re-emission of the browse functions", async () => {
    // search_video_ids and search_playlist_ids call search_filler_tokens() at
    // RUNTIME. This migration does not touch them -- and must not, because
    // re-emitting one from an older body is exactly what the carry-over
    // contract exists to stop. This proves the runtime call is enough.
    const ids = async (fn, q) => {
      const { rows } = await pg.query(`select id from public.${fn}($1)`, [q]);
      return rows.map((r) => Number(r.id));
    };
    expect(beforeBrowse["search_video_ids|kinematics ke numericals"]).toEqual([]);
    expect(beforeBrowse["search_playlist_ids|physics ka one shot"]).toEqual([]);
    expect((await ids("search_video_ids", "kinematics ke numericals")).length)
      .toBeGreaterThan(0);
    expect((await ids("search_playlist_ids", "physics ka one shot")).length)
      .toBeGreaterThan(0);
    // ...and the bodies really were left alone.
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function\s+public\.universal_search/i);
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function\s+public\.search_video_ids/i);
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function\s+public\.search_playlist_ids/i);
    expect(migration).not.toMatch(/create\s+or\s+replace\s+function\s+public\.search_query_tokens/i);
  });
});

describe("no Hindi title loses its own name", () => {
  it.each(HARM_QUERIES)("'%s' still finds %s", async (q, needle) => {
    const wasThere = holds(beforeHarm[q], needle);
    expect(wasThere.length, `the fixture never answered "${q}" with "${needle}"`)
      .toBeGreaterThan(0);
    const nowThere = holds(await search(q), needle);
    expect(nowThere.length, `"${q}" LOST "${needle}"`).toBeGreaterThan(0);
  });

  it("never demotes the row a Hindi query was already finding", async () => {
    // Tiers 1 and 3 match on the UNFILTERED latin key, which this change does
    // not touch, so an exact or prefix hit cannot move. Everything else can
    // only get a LOWER (better) rank as the token conjunction relaxes.
    for (const [q] of HARM_QUERIES) {
      const now = new Map(
        (await search(q)).map((r) => [`${r.group_key}:${r.entity_id}`, r.match_rank]),
      );
      for (const r of beforeHarm[q]) {
        const k = `${r.group_key}:${r.entity_id}`;
        expect(now.has(k), `"${q}" lost ${k} (${r.title})`).toBe(true);
        expect(now.get(k), `"${q}" demoted ${k} (${r.title})`)
          .toBeLessThanOrEqual(r.match_rank);
      }
    }
  });

  it("keeps the Devanagari and the romanised spelling in step", async () => {
    // का/के/की all transliterate onto the Latin filler word, so one entry
    // covers both scripts -- which means both scripts must survive together.
    const deva = await search("नेताजी का चश्मा");
    const latin = await search("netaji ka chashma");
    expect(holds(deva, "चश्मा").length).toBeGreaterThan(0);
    expect(holds(latin, "चश्मा").length).toBeGreaterThan(0);
  });
});

describe("everything that is not Hindi is untouched", () => {
  it.each(CONTROL_QUERIES)("leaves '%s' byte-identical", async (q) => {
    expect(key(await search(q))).toEqual(key(before[q]));
  });

  it.each(CONTROL_QUERIES)("leaves the tokens for '%s' identical", async (q) => {
    expect((await tokensOf(q)).q_tokens).toEqual(beforeTokens[q]);
  });

  it("keeps every seeded curated shorthand resolving to its target", async () => {
    for (const { alias, expansion } of SEED) {
      const target = await search(expansion);
      expect(target.length, `${expansion} is not in the fixture catalogue`)
        .toBeGreaterThan(0);
      const targetKeys = new Set(target.map((r) => `${r.group_key}:${r.entity_id}`));
      const hits = await search(alias);
      expect(
        hits.some((r) => targetKeys.has(`${r.group_key}:${r.entity_id}`)),
        `${alias} no longer reaches ${expansion}`,
      ).toBe(true);
    }
  });

  it("keeps every row a shorthand query already returned", async () => {
    for (const { alias } of SEED) {
      const now = new Set((await search(alias)).map((r) => `${r.group_key}:${r.entity_id}`));
      for (const r of beforeAlias[alias]) {
        expect(now.has(`${r.group_key}:${r.entity_id}`),
          `${alias} lost ${r.title}`).toBe(true);
      }
    }
  });

  it("keeps the two-character floor and the nonsense guard", async () => {
    expect(await search("a")).toEqual([]);
    expect(await search("zzqqxx no such topic zzqqxx")).toEqual([]);
  });
});

describe("the all-filler fallback, which is the one thing that narrows", () => {
  it("never empties the token list, in either language", async () => {
    for (const q of ["please help", "how to", "kya hai", "ka ke ki", "kaise karein",
      "mujhe chahiye", "sab kuch", "a"]) {
      const t = await tokensOf(q);
      expect(t.q_tokens.length, `"${q}" tokenised to nothing`).toBeGreaterThan(0);
    }
  });

  it("falls back to the RAW tokens for a query that is pure scaffolding", async () => {
    // Every word is filler now, so q_content is empty and the guard restores
    // the original split. That is STRICTER than today, where the surviving
    // Hindi word was the only token -- and it is why "ka lecture", "ki notes"
    // and "se questions" stop being 128-row substring dredges in production.
    expect((await tokensOf("ka lecture")).q_tokens).toEqual(["ka", "lecture"]);
    expect((await tokensOf("ki notes")).q_tokens).toEqual(["ki", "notes"]);
    expect((await tokensOf("kya hai")).q_tokens).toEqual(["kya", "hai"]);
    // The guard the English list was written for still behaves the same way.
    expect((await tokensOf("please help")).q_tokens).toEqual(["please", "help"]);
    expect((await tokensOf("how to")).q_tokens).toEqual(["how", "to"]);
  });

  it("cannot make a pure-filler query match the whole catalogue", async () => {
    const all = await pg.query("select count(*)::int as n from public.videos");
    for (const q of ["kya hai", "mujhe chahiye", "ka ke ki"]) {
      const rows = await search(q, null, 200);
      expect(rows.length, `"${q}" matched everything`).toBeLessThan(all.rows[0].n);
    }
  });
});

describe("the curated shorthand table stays usable", () => {
  it("refuses a new alias that is now a Hindi filler word", async () => {
    // 20260902170000_search_aliases.sql:223. This is the interaction the
    // migration's section 6 checks in the other direction: no EXISTING row is
    // shadowed. Here: a NEW row that would be is correctly rejected.
    await expect(pg.query(
      "insert into public.search_aliases (alias, expansion) values ('liye', 'Kinematics')",
    )).rejects.toThrow(/search_aliases_alias_not_filler/);
  });

  it("still accepts an ordinary new alias", async () => {
    await pg.exec(
      "insert into public.search_aliases (alias, expansion, note) " +
      "values ('kinemat', 'Kinematics', 'rehearsal only');",
    );
    await pg.exec("delete from public.search_aliases where alias = 'kinemat';");
  });
});

describe("the abort path fires", () => {
  const verify = verifyBlock();
  const original = migration.slice(
    migration.indexOf("create or replace function public.search_filler_tokens()"),
    migration.indexOf("alter function public.search_filler_tokens() owner to postgres"),
  );

  /** Re-emit the function with `mutate` applied to the word list. */
  async function poison(mutate, opts = {}) {
    const list = mutate([...ENGLISH, ...HINDI]);
    await pg.exec(
      `create or replace function public.search_filler_tokens() returns text[]
         language sql ${opts.volatile ? "volatile" : "immutable"} parallel safe
       as $poison$ select array[${list.map((w) => `'${w}'`).join(",")}]::text[]; $poison$;`,
    );
  }
  async function restore() {
    await pg.exec(original);
    await pg.exec(
      "comment on function public.search_filler_tokens() is " +
      "'Query words that express intent or exam scaffolding rather than subject matter, in English and in Hindi/Hinglish.';",
    );
    await expect(pg.exec(verify)).resolves.toBeTruthy();
  }

  it("aborts if anyone adds 'shot'", async () => {
    await poison((l) => [...l, "shot"]);
    await expect(pg.exec(verify)).rejects.toThrow(/SCREENED AND REJECTED/);
    await restore();
  });

  it("aborts if an English word the baseline shipped is dropped", async () => {
    await poison((l) => l.filter((w) => w !== "ncert"));
    await expect(pg.exec(verify)).rejects.toThrow(/DROPPED English filler words/);
    await restore();
  });

  it("aborts if a Hindi word is dropped", async () => {
    await poison((l) => l.filter((w) => w !== "ke"));
    await expect(pg.exec(verify)).rejects.toThrow(/Hindi filler words are missing/);
    await restore();
  });

  it("aborts on a word neither half of the file declares", async () => {
    await poison((l) => [...l, "zzundeclared"]);
    await expect(pg.exec(verify)).rejects.toThrow(/neither half of this file declares/);
    await restore();
  });

  it("aborts if the function stops being IMMUTABLE", async () => {
    await poison((l) => l, { volatile: true });
    await expect(pg.exec(verify)).rejects.toThrow(/not IMMUTABLE/);
    await restore();
  });

  it("aborts if the COMMENT is lost", async () => {
    await pg.exec("comment on function public.search_filler_tokens() is null;");
    await expect(pg.exec(verify)).rejects.toThrow(/COMMENT on search_filler_tokens\(\) was lost/);
    await restore();
  });

  it("aborts when a filler word would swallow a real title token by the singular rule", async () => {
    // 'sawal' is on the list; search_singular('sawals') = 'sawal', so a title
    // token "sawals" would be stripped from every query that typed it. The
    // migration scans the catalogue for exactly this and refuses.
    await pg.exec(
      "insert into public.videos (id, title, subject_id, youtube_video_id) " +
      "values (77001, 'Sawals of Rotational Dynamics', 1, 'ytpoison');",
    );
    await expect(pg.exec(verify))
      .rejects.toThrow(/singular rule would strip these REAL public.videos tokens/);
    await pg.exec("delete from public.videos where id = 77001;");
    await expect(pg.exec(verify)).resolves.toBeTruthy();
  });

  it("aborts when a curated shorthand would be shadowed by a new filler word", async () => {
    await pg.exec(
      "alter table public.search_aliases drop constraint search_aliases_alias_not_filler;",
    );
    try {
      await pg.exec(
        "insert into public.search_aliases (alias, expansion, note) " +
        "values ('liye', 'Kinematics', 'deliberate poison for the abort test');",
      );
      await expect(pg.exec(verify))
        .rejects.toThrow(/would become filler tokens and their rows would stop being editable/);
      await pg.exec("delete from public.search_aliases where alias = 'liye';");
    } finally {
      await pg.exec(
        "alter table public.search_aliases add constraint search_aliases_alias_not_filler " +
        "check (not (public.search_latin_key(alias) = any (public.search_filler_tokens())));",
      );
    }
    await expect(pg.exec(verify)).resolves.toBeTruthy();
  });

  it("aborts when a tokenisation probe stops holding", async () => {
    // The data proof, not the word list: remove 'ka' only, and
    // "friction ka concept" no longer tokenises to [friction concept].
    await poison((l) => l.filter((w) => w !== "ka").concat("ka_x"));
    await expect(pg.exec(verify)).rejects.toThrow();
    await restore();
  });
});

describe("the migration file's own promises", () => {
  it("is staged, header-documented and rollback-documented", () => {
    expect(migration).toMatch(/^--[\s\S]*\nbegin;/);
    expect(migration).toContain("STAGED, NOT APPLIED");
    expect(migration).toContain("ROLLBACK.");
    expect(migration).toContain("npx supabase db push");
    expect(migration.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("changes exactly one object, and writes to no table", () => {
    const code = migration.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
    const created = [...code.matchAll(/create\s+or\s+replace\s+function\s+public\.(\w+)/gi)]
      .map((m) => m[1]);
    expect(created).toEqual(["search_filler_tokens"]);
    expect(code).not.toMatch(/\b(insert\s+into|update|delete\s+from)\s+public\./i);
    expect(code).not.toMatch(/\bdrop\s+(table|function|constraint)\b/i);
    expect(code).not.toMatch(/security\s+definer/i);
    expect(code).toMatch(/immutable\s+parallel\s+safe/i);
  });

  it("declares 96 English and 144 Hindi words, and emits exactly those", () => {
    expect(ENGLISH).toHaveLength(96);
    expect(HINDI).toHaveLength(144);
    expect(EMITTED).toEqual([...ENGLISH, ...HINDI]);
    expect(EMITTED).toHaveLength(240);
  });

  it("documents the one behaviour that narrows rather than widens", () => {
    // The all-filler fallback. If a later hand rewrites this header, they must
    // consciously delete this paragraph rather than lose it by accident.
    expect(migration).toMatch(/reverts to the RAW token list/);
    expect(migration).toMatch(/STRICTER, not looser/);
  });
});
