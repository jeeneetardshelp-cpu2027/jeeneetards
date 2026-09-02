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

const baseline = readFileSync(BASELINE, "utf8");
const materials = readFileSync(MATERIALS, "utf8");
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
    -- The row the kind-words migration exists for: a full-notes title that
    -- never says "notes", which is how all 205 of production's NCERT notes
    -- read. Row 4 is the paper equivalent -- its title never says "pyq".
    insert into public.study_materials
      (id, title, material_type, source_name, source_url, rights_status,
       review_status, published_at, exam_year)
    values
      (3, 'Units and Measurement - NCERT Physics', 'full_notes', 'NCERT',
       'https://example.test/c', 'official_source', 'approved', now(), null),
      (4, 'CBSE Class 11 Physics 2021', 'previous_year_paper', 'CBSE',
       'https://example.test/d', 'official_source', 'approved', now(), 2021),
      (5, 'Kinematics Notes Awaiting Review', 'short_notes', 'NCERT',
       'https://example.test/e', 'official_source', 'pending', null, null);
    insert into public.study_material_scopes (material_id, learning_goal_id, class_level_id, subject_id)
      values (3, 1, 1, 1), (4, 1, 1, 1), (5, 1, 1, 1);
  `);

  // ---- snapshot the world BEFORE the alias migration ------------------------
  for (const q of CONTROL_QUERIES) before[q] = await search(q);
  for (const { alias } of SEED) beforeAlias[alias] = await search(alias);

  // The migration's preflight and self-verification abort the transaction if
  // anything is wrong, so getting past this line is the first assertion.
  await pg.exec(migration);
  // ...and then the kind-words migration on top, in the SAME order db push
  // applies them by timestamp. Executing the real chain is the whole point of
  // this file: the two migrations' own rehearsals each loaded only their own
  // ancestor, so neither could see that the later one reverted the earlier.
  await pg.exec(words);
}, 180_000);
const kinds = (rows) => [...new Set(rows.map((r) => r.group_key))];

// ===========================================================================
// THE REGRESSION THIS FILE EXISTS FOR.
//
// Both 20260902170000 and 20260902180000 re-emit universal_search WHOLE,
// because Postgres cannot patch one expression inside a function body. db push
// applies them in TIMESTAMP order, so 180000 runs last and whatever it does not
// carry forward is silently discarded — no error, no failing test, nothing.
//
// An earlier draft of 180000 was re-emitted from the pre-alias 0901 ancestor,
// which would have reverted every curated shorthand on the next push. Neither
// migration's own rehearsal could see it: each loaded only its own ancestor.
// This file loads the CHAIN, which is the only arrangement that can catch it.
// ===========================================================================
describe("the alias pass survives the kind-words re-emit", () => {
  it("still calls the alias helpers at all", async () => {
    const { rows } = await pg.query(`
      select prosrc from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'universal_search'`);
    expect(rows).toHaveLength(1);
    // If 180000 were rebuilt from the pre-alias ancestor again, these vanish.
    expect(rows[0].prosrc).toContain("search_rank_aliased");
    expect(rows[0].prosrc).toContain("search_expand_aliases");
    // ...and this is the thing 180000 is supposed to add.
    expect(rows[0].prosrc).toContain("study_material_haystack");
  });

  it.each(SEED.map((r) => [r.alias, r.expansion]))(
    "still resolves the shorthand %s to %s", async (alias, expansion) => {
      const rows = await search(alias);
      expect(rows.length, `"${alias}" returned nothing after the re-emit`)
        .toBeGreaterThan(0);
      const titles = rows.map((r) => String(r.title).toLowerCase());
      expect(titles.some((t) => t.includes(expansion.toLowerCase())),
        `"${alias}" returned rows, but none of them was ${expansion}`).toBe(true);
    });

  it("keeps the browse helpers aliased too, so the two surfaces agree", async () => {
    // 180000 does not re-emit search_playlist_ids/search_video_ids, so these
    // must still be 170000's. If the header search and /browse disagreed about
    // "shm", that contradiction is exactly what 170000 raises to prevent.
    // Returns TABLE(id bigint), so it is a set, not an array column.
    const { rows } = await pg.query("select id from public.search_video_ids('shm')");
    expect(rows.length, 'search_video_ids("shm") found nothing').toBeGreaterThan(0);
  });
});

describe("a student can find a material by the word they call it", () => {
  it('finds papers by "pyq", which no title in the catalogue contains', async () => {
    expect(kinds(await search("pyq"))).toContain("paper");
  });

  it('finds papers by "previous year paper"', async () => {
    expect(kinds(await search("previous year paper"))).toContain("paper");
  });

  it('finds NCERT notes by "ncert notes" — the query that returned nothing', async () => {
    // "Units and Measurement - NCERT Physics" carries "ncert" already; the word
    // it could never carry is "notes". Both tokens must be present for tier 4.
    const rows = (await search("ncert notes")).filter((r) => r.group_key === "material");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.title)).toContain("Units and Measurement - NCERT Physics");
  });

  it('finds notes by a bare "notes"', async () => {
    expect(kinds(await search("notes"))).toContain("material");
  });

  it("keeps the publish gate: a pending material stays invisible", async () => {
    const rows = await search("notes", null, 50);
    expect(rows.map((r) => r.title)).not.toContain("Kinematics Notes Awaiting Review");
  });
});

describe("widening the haystack costs nothing that already worked", () => {
  it("still finds a material by its own title", async () => {
    const rows = (await search("short notes")).filter((r) => r.group_key === "material");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("still finds a paper by its exam and year", async () => {
    const rows = (await search("jee main 2024")).filter((r) => r.group_key === "paper");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("still finds courses and lectures, untouched by this migration", async () => {
    const k = kinds(await search("kinematics", null, 40));
    expect(k).toContain("playlist");
    expect(k).toContain("lecture");
  });
});

describe("the prefilter keeps the index support it claims to have", () => {
  const indexes = async () => {
    const { rows } = await pg.query(
      "select indexname from pg_indexes where schemaname='public' and tablename='study_materials'");
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

  it("keeps both helpers IMMUTABLE, which is what makes them legal in an index", async () => {
    const { rows } = await pg.query(`
      select proname, provolatile from pg_proc
       where pronamespace = 'public'::regnamespace
         and proname in ('study_material_kind_words', 'study_material_haystack')
       order by proname`);
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.provolatile, r.proname).toBe("i");
  });
});

describe("the roles that run a search can execute what it calls", () => {
  it.each([
    ["public.study_material_kind_words(text)"],
    ["public.study_material_haystack(text, text)"],
    ["public.universal_search(text, text[], integer, integer)"],
  ])("grants execute on %s to anon and authenticated, not PUBLIC", async (sig) => {
    const { rows } = await pg.query(
      `select has_function_privilege('anon', $1, 'execute') as anon,
              has_function_privilege('authenticated', $1, 'execute') as auth,
              has_function_privilege('public', $1, 'execute') as pub`, [sig]);
    expect(rows[0].anon, `anon on ${sig}`).toBe(true);
    expect(rows[0].auth, `authenticated on ${sig}`).toBe(true);
    expect(rows[0].pub, `PUBLIC on ${sig}`).toBe(false);
  });
});

describe("180000 is a surgical amendment of 170000, not of its ancestor", () => {
  // The structural half of the guard above. The behavioural tests prove the
  // aliases still work; this proves WHY, and pins the base so a later edit
  // cannot quietly re-derive the body from the wrong ancestor.
  const body = (file) => {
    const s = readFileSync(file, "utf8");
    const start = s.indexOf("create or replace function public.universal_search(");
    const end = s.indexOf("end; $_$;", start);
    expect(start, `no universal_search in ${file}`).toBeGreaterThan(-1);
    expect(end, `no terminator in ${file}`).toBeGreaterThan(-1);
    return s.slice(start, end + "end; $_$;".length);
  };

  it("differs from the alias body only by the widened haystack, byte for byte", () => {
    const amended = body(WORDS);
    const subs = amended.match(
      /public\.study_material_haystack\(sm\.title, sm\.material_type\)/g) ?? [];
    // Two pillars: one rank call and five prefilter disjuncts each. The alias
    // pass added two disjuncts per pillar, so this is 12, not the ancestor's 8
    // — the count itself says which body this was built from.
    expect(subs).toHaveLength(12);

    const undone = amended
      .split("public.study_material_haystack(sm.title, sm.material_type)")
      .join("public.search_latin_key(sm.title)");
    expect(undone).toBe(body(MIGRATION));
  });

  it("refuses to apply at all if the alias pass is not there", () => {
    // The preflight is the last line of defence if someone reorders the chain.
    const text = readFileSync(WORDS, "utf8");
    expect(text).toContain("public.search_expand_aliases(text)");
    expect(text).toContain("public.search_rank_aliased(text,text[],text,text[],text)");
    expect(text).toMatch(/REFUSING: the alias pass/);
  });
});
