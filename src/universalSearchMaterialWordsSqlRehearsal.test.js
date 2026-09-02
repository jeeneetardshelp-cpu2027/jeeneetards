// universalSearchMaterialWordsSqlRehearsal.test.js
//
// WHAT IS REAL HERE. These tests EXECUTE the staged migration
// supabase/migrations/20260902180000_universal_search_material_words.sql, on top
// of the 0901 migration it amends, on a real
// PostgreSQL engine (PGlite, Postgres compiled to WASM) with the real pg_trgm
// extension, so `%>`, word_similarity, gin_trgm_ops indexes and the migration's
// own self-verification DO block all actually run. The search helper functions
// (search_latin_key, search_rank_tokens, the filler list, the transliterator)
// are not re-typed here either — they are extracted verbatim from the
// production baseline, as is the five-group universal_search the migration
// replaces, so what runs is what production has.
//
// WHAT IS NOT REAL. The surrounding catalogue is a minimal stand-in: the two
// study-material tables come from the baseline's own CREATE TABLE text (CHECK
// constraints included), but subjects / chapters / videos / playlists /
// institutes are small hand-built tables with only the columns
// universal_search touches, and the row counts are a handful, not production's.
// So these tests prove CORRECTNESS and the RLS/visibility gate. They prove
// nothing about production query PLANS or timing — no local Postgres here has
// production's data distribution.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { beforeAll, describe, expect, it } from "vitest";

const BASELINE = "supabase/migrations/20260831140005_production_baseline.sql";
const MIGRATION = "supabase/migrations/20260901160000_universal_search_materials.sql";
const WORDS = "supabase/migrations/20260902180000_universal_search_material_words.sql";

const baseline = readFileSync(BASELINE, "utf8");
const migration = readFileSync(MIGRATION, "utf8");
const words = readFileSync(WORDS, "utf8");

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

const HELPERS = [
  "normalize_search_text", "translit_devanagari", "search_latin_key",
  "search_filler_tokens", "search_singular",
  "catalog_similarity", "catalog_word_similarity", "search_rank_tokens",
];

let pg;

async function search(query, types = null, limit = 10, offset = 0) {
  const { rows } = await pg.query(
    `select group_key, entity_id, title, subtitle, match_type, match_rank,
            group_total, extra
       from public.universal_search($1, $2, $3, $4)`,
    [query, types, limit, offset],
  );
  return rows;
}

beforeAll(async () => {
  pg = new PGlite({ extensions: { pg_trgm } });
  await pg.exec("create extension if not exists pg_trgm;");
  await pg.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    grant usage on schema public to anon, authenticated, service_role;
  `);

  // Catalogue stand-ins: only the columns universal_search reads.
  await pg.exec(`
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

  // The two tables this migration actually reads come from the baseline
  // verbatim, so the publish gate and the type CHECK are the real ones.
  await pg.exec(baselineTable("study_materials"));
  await pg.exec(baselineTable("study_material_scopes"));
  await pg.exec(`
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

  for (const name of HELPERS) await pg.exec(baselineFunction(name));
  // Production's five-group universal_search, so the migration replaces the
  // same thing it will replace on the real database.
  await pg.exec(baselineFunction("universal_search"));

  await pg.exec(`
    insert into public.subjects (id, name, slug, display_order) values (1, 'Physics', 'physics', 1);
    insert into public.chapters (id, name, slug, subject_id, display_order) values (10, 'Kinematics', 'kinematics', 1, 1);
    insert into public.videos (id, title, chapter_id, subject_id, youtube_video_id)
      values (100, 'Kinematics - relative motion', 10, 1, 'CBvaO-uDvs8');
    insert into public.institutes_channels (id, name) values (3, 'Competishun');
    insert into public.playlists (id, title, teacher, channel_id, subject_id)
      values (5, 'Complete Kinematics', 'ABJ Sir', 3, 1);
    insert into public.playlist_videos (playlist_id, video_id, position) values (5, 100, 1);
    insert into public.learning_goals (id, slug, name, display_order)
      values (1, 'jee', 'JEE', 1), (2, 'school', 'School', 2);
    insert into public.class_levels (id, slug, name, display_order) values (1, 'class-11', 'Class 11', 1);
  `);

  await pg.exec(`
    insert into public.study_materials
      (id, title, material_type, source_name, source_url, rights_status, review_status, published_at, exam_year)
    values
      (1, 'Kinematics Short Notes',            'short_notes',         'NCERT',       'https://example.test/a', 'official_source',    'approved', now(), null),
      (2, 'Kinematics Formula Sheet',          'formula_sheet',       'Competishun', 'https://example.test/b', 'creator_permission', 'approved', now(), null),
      (3, 'Kinematics Notes Awaiting Review',  'short_notes',         'NCERT',       'https://example.test/c', 'official_source',    'pending',  null,  null),
      (4, 'Kinematics Unscoped Lecture Notes', 'full_notes',          'NCERT',       'https://example.test/d', 'official_source',    'approved', now(), null),
      (5, 'JEE Main 2024 Session 1 Shift 1 Question Paper', 'previous_year_paper', 'NTA', 'https://example.test/e', 'official_source', 'approved', now(), 2024),
      (6, 'JEE Main 2023 Session 1 Shift 1 Question Paper', 'previous_year_paper', 'NTA', 'https://example.test/f', 'official_source', 'approved', now(), 2023),
      (7, 'Kinematics Board Paper 2021',       'previous_year_paper', 'CBSE',        'https://example.test/g', 'official_source',    'approved', now(), 2021),
      (8, 'Kinematics Orphan Paper 2020',      'previous_year_paper', 'CBSE',        'https://example.test/h', 'official_source',    'approved', now(), 2020),
      -- The case the whole migration exists for: a full-notes title that never
      -- says "notes", which is how all 205 of production's NCERT notes read.
      (9, 'Units and Measurement - NCERT Physics', 'full_notes',        'NCERT',       'https://example.test/i', 'official_source',    'approved', now(), null);
    insert into public.study_material_scopes (material_id, learning_goal_id, class_level_id, subject_id, chapter_id) values
      (1, 1, 1, 1, 10),
      (2, 1, null, 1, null),
      (3, 1, 1, 1, 10),
      (7, 2, 1, 1, 10),
      (9, 1, 1, 1, 10);
  `);

  // The migration's own DO blocks abort the transaction if anything is wrong,
  // so simply getting past this line is the first assertion.
  await pg.exec(migration);
  // Then the kind-words migration on top, exactly as production will take it.
  await pg.exec(words);
}, 120_000);

const kinds = (rows) => rows.map((r) => r.group_key);

// Each case below is a query I measured returning nothing against production
// on 2026-09-02, with 408 approved materials sitting there unreachable.
describe("a student can find a material by the word they call it", () => {
  it("finds papers by \"pyq\", which no title in the catalogue contains", async () => {
    const rows = await search("pyq", null, 20);
    expect(kinds(rows)).toContain("paper");
  });

  it("finds papers by \"previous year paper\"", async () => {
    const rows = await search("previous year paper", null, 20);
    expect(kinds(rows)).toContain("paper");
  });

  it("finds NCERT notes by \"ncert notes\" — the query that returned nothing at all", async () => {
    // "Units and Measurement - NCERT Physics" carries "ncert" already; the word
    // it could never carry is "notes". Both tokens must be present for tier 4,
    // which is why widening the haystack is what unblocks this exact query.
    const rows = await search("ncert notes", null, 20);
    const notes = rows.filter((r) => r.group_key === "material");
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.map((r) => r.title)).toContain("Units and Measurement - NCERT Physics");
  });

  it("finds notes by a bare \"notes\"", async () => {
    // The deliberate behaviour change: this returned zero materials of 408.
    const rows = await search("notes", null, 20);
    expect(kinds(rows)).toContain("material");
  });

  it("still separates the two pillars — a paper query does not return notes", async () => {
    const rows = await search("pyq", null, 20);
    expect(kinds(rows)).not.toContain("material");
  });
});

describe("widening the haystack costs nothing that already worked", () => {
  it("still finds a material by its title", async () => {
    const rows = await search("formula sheet", null, 20);
    expect(rows.filter((r) => r.group_key === "material").length).toBeGreaterThan(0);
  });

  it("still finds a paper by its exam and year", async () => {
    const rows = await search("jee main 2024", null, 20);
    expect(rows.filter((r) => r.group_key === "paper").length).toBeGreaterThan(0);
  });

  it("still finds courses and lectures, untouched by this migration", async () => {
    const rows = await search("kinematics", null, 30);
    expect(kinds(rows)).toContain("playlist");
    expect(kinds(rows)).toContain("lecture");
  });

  it("keeps the publish gate: a pending material stays invisible", async () => {
    // Row 3 is short_notes and pending. Its kind words must not smuggle it
    // past the approved-and-published filter in the pillar body. (That filter,
    // not the RLS policy, is what runs here — these queries execute as the
    // owner, so RLS would not bite even if the body left it to the policy.)
    const rows = await search("short notes", null, 20);
    expect(rows.map((r) => r.title)).not.toContain("Kinematics Notes Awaiting Review");
  });

  it("keeps the content guard: a material with no scope row is not offered", async () => {
    // Row 4 is full_notes with no scope, so /materials has no page for it.
    // Its title says "Notes" already, so it was reachable before this change
    // too; the point is that widening the haystack does not lower the bar the
    // join sets. Row 8 is the paper equivalent.
    const rows = await search("notes", null, 30);
    expect(rows.map((r) => r.title)).not.toContain("Kinematics Unscoped Lecture Notes");
  });
});

describe("the prefilter keeps the index support it claims to have", () => {
  // Postgres matches an expression index by matching the expression. Changing
  // the prefilter without moving the index would have quietly dropped both
  // pillars to a sequential scan while the SARGABLE comment still claimed
  // otherwise. These assertions are cheap; a seq scan on a growing table
  // is not.
  const indexes = async () => {
    const { rows } = await pg.query(
      "select indexname from pg_indexes where schemaname = 'public' and tablename = 'study_materials'");
    return rows.map((r) => r.indexname);
  };

  it("indexes the expression the prefilter actually uses", async () => {
    const names = await indexes();
    expect(names).toContain("idx_study_materials_haystack_pattern");
    expect(names).toContain("idx_study_materials_haystack_trgm");
  });

  it("drops the pair that indexed the expression nothing queries any more", async () => {
    const names = await indexes();
    expect(names).not.toContain("idx_study_materials_title_latin_pattern");
    expect(names).not.toContain("idx_study_materials_title_latin_trgm");
  });

  it("keeps the haystack usable in an index at all", async () => {
    // An expression index requires IMMUTABLE. If either helper were declared
    // STABLE the CREATE INDEX above would have failed, but pinning the
    // declaration says so out loud.
    const { rows } = await pg.query(`
      select proname, provolatile from pg_proc
       where pronamespace = 'public'::regnamespace
         and proname in ('study_material_kind_words', 'study_material_haystack')
       order by proname`);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.provolatile, row.proname).toBe("i");
  });
});

describe("the roles that run a search can execute what it calls", () => {
  // universal_search is SECURITY INVOKER, so anon executes both helpers
  // directly on every query. Relying on the default PUBLIC EXECUTE would make
  // search the one thing in this schema whose permissions were implicit.
  it.each([
    ["public.study_material_kind_words(text)"],
    ["public.study_material_haystack(text, text)"],
    ["public.universal_search(text, text[], integer, integer)"],
  ])("grants execute on %s to anon and authenticated", async (signature) => {
    const { rows } = await pg.query(
      `select has_function_privilege('anon', $1, 'execute') as anon,
              has_function_privilege('authenticated', $1, 'execute') as auth,
              has_function_privilege('public', $1, 'execute') as pub`,
      [signature],
    );
    expect(rows[0].anon, `anon on ${signature}`).toBe(true);
    expect(rows[0].auth, `authenticated on ${signature}`).toBe(true);
    // Revoked from PUBLIC, so the grants above are what carry the privilege.
    expect(rows[0].pub, `PUBLIC on ${signature}`).toBe(false);
  });
});

describe("this migration is a surgical amendment of 0901, not a rewrite", () => {
  // The function body is 428 lines re-emitted whole, because Postgres has no
  // way to patch one expression inside a function. Re-emitting by hand is
  // exactly how a pillar quietly loses a content guard, so this pins that the
  // ONLY difference is the substitution this migration exists to make.
  const body = (file) => {
    const s = readFileSync(file, "utf8");
    const start = s.indexOf("create or replace function public.universal_search(");
    const end = s.indexOf("end; $_$;", start);
    expect(start, `no universal_search in ${file}`).toBeGreaterThan(-1);
    expect(end, `no terminator in ${file}`).toBeGreaterThan(-1);
    return s.slice(start, end + "end; $_$;".length);
  };

  it("differs from 0901 only by the widened haystack, byte for byte", () => {
    const amended = body(WORDS);
    const substitutions = amended.match(
      /public\.study_material_haystack\(sm\.title, sm\.material_type\)/g) ?? [];
    // Two pillars, each with one rank call and three prefilter disjuncts.
    expect(substitutions).toHaveLength(8);

    const undone = amended
      .split("public.study_material_haystack(sm.title, sm.material_type)")
      .join("public.search_latin_key(sm.title)");
    expect(undone).toBe(body(MIGRATION));
  });
});
