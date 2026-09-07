// searchQLongFloorSqlRehearsal.test.js
//
// WHAT IS REAL HERE. These tests EXECUTE the staged migration
// docs/sql/search_q_long_floor_2026-09-07.sql on a real
// PostgreSQL engine (PGlite, Postgres compiled to WASM) with the real pg_trgm
// extension, so `%>`, word_similarity, the trigram tiers, the migration's
// preflight and its whole self-verification DO block all actually run. Nothing
// in the migration is re-typed here.
//
// AND IT RUNS ON THE COMPOSED CHAIN, in the order `db push` applies it:
//
//   20260831140005 production_baseline               (helpers, tables, the
//                                                     English filler list)
//   20260901160000 universal_search_materials        (the seven-group box)
//   20260902170000 search_aliases                    (curated shorthand pass,
//                                                     search_video_ids)
//   20260902180000 universal_search_material_words   (the kind-word haystack)
//   20260902240000 browse_course_relevance           (search_playlist_ids)
//   20260907090000 search_q_long_floor               (this migration)
//
// A migration rehearsed on the bare baseline proves nothing about the state
// production is in, and this file re-emits FOUR functions three other
// migrations already replaced -- the exact shape of clobber that
// src/searchFeatureCarryOverSqlContract.test.js exists to catch at author time
// and that only the composed arrangement can catch at run time.
//
// AND THEN, at the end, it loads the Hinglish filler list ON TOP, because that
// list is the reason this migration exists.
//
// Both inputs were parked in docs/sql/ when this file was written, and it
// asserted they stayed there. On 7 Sep 2026 the Hinglish list was unparked into
// the chain and applied, which DELETED the docs/sql/ copy and left this file
// opening a path that no longer existed -- main went red on the ENOENT.
//
// Only that path moved. The migration under test is still the DRAFT in
// docs/sql/, and deliberately so: it is a different, larger file from the one
// that was applied. The draft floors the ANCHOR through
// public.search_min_anchor_len(), which is what makes "p and c" anchor on
// "combinations"; the applied 20260907093000 floors the token count instead,
// and on production "p and c" still answers 500 57014. Pointing this rehearsal
// at the applied file fails 20 of its 85 assertions, because they assert the
// draft's behaviour. That gap is the subject of the draft, not a bug here.
//
// WHAT IS NOT REAL. The catalogue is a stand-in: a chapter and a lesson per
// seeded alias expansion plus a few dozen rows, not production's 5,533 videos.
// public.is_admin() is a stub returning false. PGlite has no statement timeout
// and no statistics worth planning against, so it CANNOT reproduce the 57014
// this migration is about: on this engine the broken queries return rows
// slowly rather than failing. What is proved here is CORRECTNESS -- which
// needle each query ends up scanning on, that no needle is ever below the
// floor, that the healthy corpus is unchanged row for row, and that the
// features of three earlier migrations survived four whole-body re-emissions.
// The timings live in the migration header and were measured against
// production on 2026-09-07.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { beforeAll, describe, expect, it } from "vitest";

const BASELINE = "supabase/migrations/20260831140005_production_baseline.sql";
const MATERIALS = "supabase/migrations/20260901160000_universal_search_materials.sql";
const ALIASES = "supabase/migrations/20260902170000_search_aliases.sql";
const WORDS = "supabase/migrations/20260902180000_universal_search_material_words.sql";
const RELEVANCE = "supabase/migrations/20260902240000_browse_course_relevance.sql";
const MIGRATION = "docs/sql/search_q_long_floor_2026-09-07.sql";
const HINGLISH_SQL = "supabase/migrations/20260907140000_search_filler_tokens_hinglish.sql";

const baseline = readFileSync(BASELINE, "utf8");
const materials = readFileSync(MATERIALS, "utf8");
const aliases = readFileSync(ALIASES, "utf8");
const words = readFileSync(WORDS, "utf8");
const relevance = readFileSync(RELEVANCE, "utf8");
const migration = readFileSync(MIGRATION, "utf8");
const hinglishSql = readFileSync(HINGLISH_SQL, "utf8");

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

// ---------------------------------------------------------------------------
// FIXTURE -- named by the earlier migrations' own self-tests, so their
// verification blocks pass when the chain is composed.
// ---------------------------------------------------------------------------
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

// Rows the rescued shorthands must actually reach, and rows that exist only so
// a NARROWED prefilter can be shown not to have narrowed the wrong thing.
const FLOOR_VIDEOS = [
  "Alternating Current - Full Chapter Marathon",
  "AC Circuits Numericals",              // starts with "ac": the prefix tier
  "Three Dimensional Geometry One Shot",
  "Permutations and Combinations - PYQ Marathon",
  "Practical Backlog Clearing Session",  // contains "ac" mid-word, matches nothing
  "Definite Integration - Complete",
  "X Ray Spectrum and Moseley's Law",
  "Notes on Rotational Motion",
];

// Queries whose result must be BYTE-IDENTICAL across this migration. Each one
// has a content anchor of three characters or more, which is rule 1, which is
// the path this migration does not touch.
const CONTROL_QUERIES = [
  "kinematics",
  "rotational motion",
  "thermodynamics",
  "gravitation class 11",
  "kinamatics",                     // the typo tier
  "rotatinal motion",
  "how to solve pulley problems",   // pure-filler guard
  "jee main 2024 paper",
  "one shot",
  "class 11",                       // content tokens EMPTY -> raw fallback
  "and",                            // a bare filler word, same path
  "please help",
  "def int",                        // a two-token alias with a 3-char anchor
  "x ray",                          // ...and a two-token non-alias with one
  "notes",
  "physics 11",
  "zzqqxx no such topic zzqqxx",
];

// The shorthands that answer HTTP 500 on production today. After the floor they
// must resolve to the expansion's anchor and reach the expansion's rows.
const RESCUED = [
  ["ac", "alternating", "Alternating Current"],
  ["3d", "dimensional", "Three Dimensional Geometry"],
  // "permutations" and "combinations" are both twelve characters, and
  // search_token_anchor breaks the tie alphabetically so one query always
  // produces one plan. Measured on production the same day: "combinations"
  // 200 775ms 39 rows, "permutations" 200 733ms 29 rows -- either would do.
  ["p and c", "combinations", "Permutations and Combinations"],
];

// No token, typed or expanded, can anchor a scan. These must return nothing --
// fast and honest -- instead of scanning the catalogue into the timeout.
const UNANCHORED = ["p c", "a b c", "zq", "2d", "b c"];

// The five shapes the Hinglish list would break, with the anchor each
// must still resolve to once those words are filler.
const HINGLISH = [
  ["ac ka matlab", "alternating"],
  ["dc ka matlab", "matlab"],
  ["ph kaise padhe", "kaise"],
  ["ac kaise padhe", "alternating"],
  ["3d kaise samjhe", "dimensional"],
];

let pg;
const before = {};        // control query -> rows, captured pre-migration
const beforeAlias = {};   // alias -> rows, captured pre-migration
const beforeTokens = {};  // query -> q_tokens/q_long, captured pre-migration
const beforeBrowse = {};  // "fn|query" -> ids, captured pre-migration
const beforeHinglish = {}; // hinglish query -> rows, captured before the list

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
    "select qlen, q, q_tokens, q_long from public.search_query_tokens($1)", [query],
  );
  return rows[0];
}

async function ids(fn, query) {
  const { rows } = await pg.query(`select id from public.${fn}($1)`, [query]);
  return rows.map((r) => Number(r.id));
}

/**
 * The needle the six prefilters actually scan on, computed exactly as
 * universal_search, search_video_ids and search_playlist_ids compute it -- from
 * the deployed helpers, not from a copy of the rule written here. Null means
 * "no anchor", which is the case where those functions return without scanning.
 */
async function anchorOf(query) {
  const { rows } = await pg.query(
    `with t as (select * from public.search_query_tokens($1)),
          a as (select public.search_expand_aliases((select q from t)) as aq),
          ta as (select * from public.search_query_tokens(
                   coalesce((select aq from a), (select q from t))))
     select public.search_anchor(
              public.search_token_anchor(
                public.search_content_tokens((select q_tokens from t))),
              (select q_long from ta),
              (select q_long from t)) as anchor`,
    [query],
  );
  return rows[0].anchor;
}

/**
 * What q_long WOULD have been before this migration: the longest filler-filtered
 * token when any survive, else the longest raw token. This is not a re-typing of
 * the old body -- it is the same computation, expressed with the same helpers,
 * which is what makes it a fair counterfactual for the collapse.
 */
async function preFloorAnchor(query) {
  const { rows } = await pg.query(
    `with t as (select public.search_latin_key($1) as q),
          raw as (select array_remove(string_to_array((select q from t), ' '), '') as toks),
          c as (select public.search_content_tokens((select toks from raw)) as toks)
     select coalesce(
              case when cardinality((select toks from c)) > 0
                   then public.search_token_anchor((select toks from c))
                   else public.search_token_anchor((select toks from raw)) end,
              (select q from t)) as q_long`,
    [query],
  );
  return rows[0].q_long;
}

const key = (rows) => rows.map((r) => `${r.group_key}:${r.entity_id}:${r.match_rank}`);
const holds = (rows, needle) => rows.filter((r) => (r.title ?? "").includes(needle));

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
  for (const title of [...EXTRA_VIDEOS, ...FLOOR_VIDEOS]) {
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
      (9, 'Alternating Current - Class 12 Full Course', 'ABJ Sir', 3, 1),
      (10, 'Three Dimensional Geometry Crash Course', 'ABJ Sir', 3, 1);
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
      (5, 'Alternating Current - NCERT Physics', 'full_notes', 'NCERT',
       'https://example.test/e', 'official_source', 'approved', now(), null);
    insert into public.study_material_scopes (material_id, learning_goal_id, class_level_id, subject_id)
      values (1, 1, 1, 1), (3, 1, 1, 1), (4, 1, 1, 1), (5, 1, 1, 1);
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
  for (const q of [...CONTROL_QUERIES, ...SEED.map((s) => s.alias),
    ...RESCUED.map((r) => r[0]), ...UNANCHORED]) {
    beforeTokens[q] = await tokensOf(q);
  }
  for (const fn of ["search_video_ids", "search_playlist_ids"]) {
    for (const q of ["kinematics", "ac", "3d", "p and c", ...CONTROL_QUERIES]) {
      beforeBrowse[`${fn}|${q}`] = await ids(fn, q);
    }
  }

  // The preflight and the self-verification abort the transaction if anything
  // is wrong, so getting past this line is the first assertion in this file.
  await pg.exec(migration);
}, 600_000);

// ---------------------------------------------------------------------------

describe("the staged migration applies to the composed chain", () => {
  it("runs end to end, its own preflight and self-verification included", async () => {
    const { rows } = await pg.query(sql`
      select p.proname, p.provolatile, p.proparallel,
             pg_catalog.format_type(p.prorettype, null) as rettype,
             pg_catalog.pg_get_userbyid(p.proowner) as owner
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('search_min_anchor_len','search_floor_anchor',
                           'search_content_tokens','search_token_anchor','search_anchor')
       order by p.proname
    `);
    expect(rows.map((r) => r.proname)).toEqual([
      "search_anchor", "search_content_tokens", "search_floor_anchor",
      "search_min_anchor_len", "search_token_anchor",
    ]);
    for (const r of rows) {
      // IMMUTABLE and PARALLEL SAFE: they are pure string work, they run once
      // per search, and being IMMUTABLE is what would let one appear in an
      // expression index later without lying to the planner.
      expect(r.provolatile, `${r.proname} is not IMMUTABLE`).toBe("i");
      expect(r.proparallel, `${r.proname} is not PARALLEL SAFE`).toBe("s");
      expect(r.owner).toBe("postgres");
    }
  });

  it("grants the helpers to the roles a SECURITY INVOKER search needs", async () => {
    for (const fn of [
      "public.search_min_anchor_len()", "public.search_floor_anchor(text)",
      "public.search_content_tokens(text[])", "public.search_token_anchor(text[])",
      "public.search_anchor(text,text,text)",
    ]) {
      for (const role of ["anon", "authenticated", "service_role"]) {
        const { rows } = await pg.query(
          "select has_function_privilege($1, $2, 'execute') as ok", [role, fn],
        );
        expect(rows[0].ok, `${role} cannot execute ${fn}`).toBe(true);
      }
    }
  });

  it("is re-runnable, because a re-push must not fail", async () => {
    await expect(pg.exec(migration)).resolves.toBeTruthy();
  });

  it("keeps search_query_tokens' signature, so its three callers need no edit", async () => {
    const { rows } = await pg.query(sql`
      select pg_catalog.pg_get_function_result(p.oid) as result
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'search_query_tokens'
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].result.replace(/\s+/g, " ")).toBe(
      "TABLE(qlen integer, q text, q_tokens text[], q_long text)",
    );
  });
});

describe("the rule, on the engine rather than on paper", () => {
  it("puts the floor at three characters, in one place", async () => {
    const { rows } = await pg.query("select public.search_min_anchor_len() as n");
    expect(rows[0].n).toBe(3);
    // ...and the number appears nowhere else as a bare literal in the four
    // bodies, so there is nothing to keep in step by hand.
    for (const fn of ["universal_search", "search_query_tokens",
      "search_video_ids", "search_playlist_ids"]) {
      const { rows: src } = await pg.query(
        `select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = $1`, [fn],
      );
      expect(src[0].prosrc, `${fn} should call search_min_anchor_len via the helpers`)
        .toMatch(/search_(anchor|floor_anchor|token_anchor|content_tokens)/);
    }
  });

  it("never lets an alias displace a literal match (the LAW of 20260902170000)", async () => {
    // "shm" expands to "simple harmonic motion", whose anchor is four
    // characters longer -- and must still not be used, or the literal
    // '%shm%' disjunct would be gone.
    expect(await anchorOf("shm")).toBe("shm");
    for (const { alias } of SEED) {
      const t = beforeTokens[alias];
      if (!t || (t.q_long ?? "").length < 3) continue;
      expect(await anchorOf(alias), `${alias} stopped anchoring on its own tokens`)
        .toBe(t.q_long);
    }
  });

  it("returns no anchor at all when nothing typed or expanded can carry a scan", async () => {
    for (const q of UNANCHORED) {
      expect(await anchorOf(q), `"${q}" still has an anchor`).toBeNull();
    }
  });

  it("holds the invariant that is the whole point: every scan has a needle of 3+", async () => {
    const corpus = [
      ...CONTROL_QUERIES, ...SEED.map((s) => s.alias), ...UNANCHORED,
      ...RESCUED.map((r) => r[0]), ...HINGLISH.map((h) => h[0]),
      "ac notes", "ac class 12", "ac ke questions", "3d ka question",
      "p and c notes", "ac dc", "a the of", "the", "of", "a", "ab", "abc",
      "जेईई", "सूरदास", "netaji ka chashma", "ph ka full form", "x ray",
    ];
    for (const q of corpus) {
      const anchor = await anchorOf(q);
      if (anchor === null) {
        // No anchor means the function returns before it scans.
        expect(await search(q), `"${q}" has no anchor but still returned rows`).toEqual([]);
      } else {
        expect(anchor.length, `"${q}" would scan on the ${anchor.length}-character needle "${anchor}"`)
          .toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("the queries that answer HTTP 500 on production today", () => {
  it.each(RESCUED)("'%s' now anchors on '%s' and reaches %s", async (q, anchor, target) => {
    // Before: the anchor was the shorthand itself, one or two characters, which
    // on production is the 3.3s sequential scan and the 57014.
    expect((beforeTokens[q].q_long ?? "").length,
      `"${q}" did not have a short anchor before, so this test proves nothing`)
      .toBeLessThan(3);
    expect(await anchorOf(q)).toBe(anchor);
    const rows = await search(q);
    expect(rows.length, `"${q}" returned nothing`).toBeGreaterThan(0);
    expect(holds(rows, target).length, `"${q}" does not reach "${target}"`)
      .toBeGreaterThan(0);
  });

  it("keeps the prefix tier, which is the one thing a narrowed prefilter could lose", async () => {
    // "AC Circuits Numericals" starts with "ac" and matches on NOTHING else:
    // it is reachable only through `like q || '%'`, the disjunct that is not
    // built from the anchor. If replacing q_long had taken that with it, this
    // row would vanish.
    const rows = await search("ac");
    expect(holds(rows, "AC Circuits Numericals").length,
      "the typed-prefix disjunct was lost when the anchor moved").toBeGreaterThan(0);
  });

  it.each(UNANCHORED)("'%s' returns a fast empty instead of a catalogue scan", async (q) => {
    expect(await search(q)).toEqual([]);
    expect(await ids("search_video_ids", q)).toEqual([]);
    expect(await ids("search_playlist_ids", q)).toEqual([]);
  });

  it("fixes /browse in the same push, which no client gate does", async () => {
    // src/useBrowse.js gates on term.length alone, so "p and c" (7 characters)
    // is sent today and the lecture tab shows "Couldn't search lessons."
    for (const [q, , target] of RESCUED) {
      const lectures = await ids("search_video_ids", q);
      const courses = await ids("search_playlist_ids", q);
      expect(lectures.length + courses.length,
        `/browse still finds nothing for "${q}"`).toBeGreaterThan(0);
      expect(target.length).toBeGreaterThan(0);
    }
  });
});

describe("the healthy corpus is unchanged, row for row", () => {
  it.each(CONTROL_QUERIES)("leaves '%s' byte-identical", async (q) => {
    expect(key(await search(q))).toEqual(key(before[q]));
  });

  it.each(CONTROL_QUERIES)("leaves the tokens for '%s' identical", async (q) => {
    const now = await tokensOf(q);
    expect(now.q_tokens).toEqual(beforeTokens[q].q_tokens);
    expect(now.q_long).toEqual(beforeTokens[q].q_long);
  });

  it.each(CONTROL_QUERIES)("leaves both /browse lists for '%s' identical", async (q) => {
    expect(await ids("search_video_ids", q)).toEqual(beforeBrowse[`search_video_ids|${q}`]);
    expect(await ids("search_playlist_ids", q)).toEqual(beforeBrowse[`search_playlist_ids|${q}`]);
  });

  it("keeps every curated shorthand that already worked, row for row", async () => {
    const rescued = new Set(RESCUED.map((r) => r[0]));
    for (const { alias } of SEED) {
      if (rescued.has(alias)) continue;
      expect(key(await search(alias)), `${alias} changed`).toEqual(key(beforeAlias[alias]));
    }
  });

  it("keeps every seeded shorthand resolving to its own target", async () => {
    for (const { alias, expansion } of SEED) {
      const target = await search(expansion);
      expect(target.length, `${expansion} is not in the fixture catalogue`).toBeGreaterThan(0);
      const targetKeys = new Set(target.map((r) => `${r.group_key}:${r.entity_id}`));
      const hits = await search(alias);
      expect(hits.some((r) => targetKeys.has(`${r.group_key}:${r.entity_id}`)),
        `${alias} no longer reaches ${expansion}`).toBe(true);
    }
  });

  it("keeps the one-character floor and the pure-filler guard", async () => {
    expect(await search("a")).toEqual([]);
    const t = await tokensOf("how to");
    expect(t.q_tokens.length, "a pure-filler query lost its tokens, which makes tier 5 vacuous")
      .toBeGreaterThan(0);
  });
});

describe("the features of three earlier migrations survived four re-emissions", () => {
  it("keeps the material and paper pillars, the alias pass and the haystack", async () => {
    const { rows } = await pg.query(sql`
      select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'universal_search'
    `);
    const src = rows[0].prosrc;
    expect(src).toContain("'material'");
    expect(src).toContain("search_rank_aliased");
    expect(src).toContain("study_material_haystack");
  });

  it("keeps the /browse ranking and the 500-id cap", async () => {
    for (const fn of ["search_video_ids", "search_playlist_ids"]) {
      const { rows } = await pg.query(
        `select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = $1`, [fn],
      );
      expect(rows[0].prosrc, `${fn} lost the ranking`)
        .toMatch(/order\s+by\s+public\.search_rank_aliased/i);
      expect(rows[0].prosrc, `${fn} lost the cap`).toMatch(/limit\s+500/i);
    }
  });

  it("still answers a kind-word query, which is what the haystack is for", async () => {
    const rows = await search("notes");
    expect(rows.some((r) => r.group_key === "material"),
      "the kind-word haystack stopped reaching study materials").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// THE PAYOFF. Everything above runs with the deployed English filler list. This
// block loads the Hinglish list on top -- the file this migration exists
// to make safe -- and shows the five shapes it would otherwise break.
// ---------------------------------------------------------------------------
describe("with the Hinglish filler list applied on top", () => {
  beforeAll(async () => {
    for (const [q] of HINGLISH) beforeHinglish[q] = await search(q);
    await pg.exec(hinglishSql);
  }, 300_000);

  it("really does collapse the anchor -- the hold was not imaginary", async () => {
    // The counterfactual: what q_long would have been WITHOUT half one of this
    // migration, now that "ka", "kaise", "matlab" and "samjhe" are filler.
    for (const q of ["ac ka matlab", "ph kaise padhe", "3d kaise samjhe"]) {
      const collapsed = await preFloorAnchor(q);
      expect(collapsed.length,
        `"${q}" does not actually collapse, so this file proves nothing about the hold`)
        .toBeLessThan(3);
    }
    expect(await preFloorAnchor("ac ka matlab")).toBe("ac");
    expect(await preFloorAnchor("ph kaise padhe")).toBe("ph");
  });

  it.each(HINGLISH)("'%s' still resolves to the selective anchor '%s'", async (q, anchor) => {
    expect(await anchorOf(q)).toBe(anchor);
    expect(anchor.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the raw tokens when filler removal would eat the anchor", async () => {
    // Half one, observed at the shared tokeniser rather than inferred: the
    // Hindi words are dropped ONLY when something long enough survives them.
    expect((await tokensOf("ph kaise padhe")).q_tokens).toEqual(["ph", "kaise", "padhe"]);
    expect((await tokensOf("ph kaise padhe")).q_long).toBe("kaise");
    // ...while a query that keeps a real topic word still loses the Hindi.
    expect((await tokensOf("kinematics ke numericals")).q_tokens).toEqual(["kinematics"]);
  });

  it("loses no row any of the five already returned", async () => {
    for (const [q] of HINGLISH) {
      const now = new Map((await search(q)).map((r) => [`${r.group_key}:${r.entity_id}`, r.match_rank]));
      for (const r of beforeHinglish[q]) {
        const k = `${r.group_key}:${r.entity_id}`;
        expect(now.has(k), `"${q}" lost ${r.title}`).toBe(true);
      }
    }
  });

  it("keeps every scan anchored, with the Hindi words live", async () => {
    for (const q of [...HINGLISH.map((h) => h[0]), ...CONTROL_QUERIES,
      ...SEED.map((s) => s.alias), "emi kya hai", "ac aur dc", "nlm ke questions"]) {
      const anchor = await anchorOf(q);
      if (anchor === null) {
        expect(await search(q), `"${q}" has no anchor but returned rows`).toEqual([]);
      } else {
        expect(anchor.length, `"${q}" would scan on "${anchor}"`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("reads the Hinglish list from the chain it was unparked into", () => {
    // The Hinglish list was unparked on 7 Sep 2026 and applied, which deleted
    // the docs/sql/ copy this file used to read. Same words, new home.
    expect(HINGLISH_SQL.startsWith("supabase/migrations/"), "the Hinglish list is in the chain now").toBe(true);
    expect(hinglishSql, "an applied migration still carries the hold banner").not.toContain("DO NOT APPLY YET");
  });
});
