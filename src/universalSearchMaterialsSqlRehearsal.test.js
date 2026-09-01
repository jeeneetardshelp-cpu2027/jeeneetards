// universalSearchMaterialsSqlRehearsal.test.js
//
// WHAT IS REAL HERE. These tests EXECUTE the staged migration
// supabase/migrations/20260901160000_universal_search_materials.sql on a real
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

const baseline = readFileSync(BASELINE, "utf8");
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

const HELPERS = [
  "normalize_search_text", "translit_devanagari", "search_latin_key",
  "search_filler_tokens", "search_singular",
  "catalog_similarity", "catalog_word_similarity", "search_rank_tokens",
];

const IDENTITY_ARGS = "p_query text, p_types text[], p_limit integer, p_offset integer";

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
      (8, 'Kinematics Orphan Paper 2020',      'previous_year_paper', 'CBSE',        'https://example.test/h', 'official_source',    'approved', now(), 2020);
    insert into public.study_material_scopes (material_id, learning_goal_id, class_level_id, subject_id, chapter_id) values
      (1, 1, 1, 1, 10),
      (2, 1, null, 1, null),
      (3, 1, 1, 1, 10),
      (7, 2, 1, 1, 10);
  `);

  // The migration's own DO blocks abort the transaction if anything is wrong,
  // so simply getting past this line is the first assertion.
  await pg.exec(migration);
}, 120_000);

describe("the staged migration applies", () => {
  it("runs end to end, self-verification included", async () => {
    const { rows } = await pg.query(`
      select p.prosecdef as is_definer, p.proconfig
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'universal_search'
         and pg_get_function_identity_arguments(p.oid) = $1
    `, [IDENTITY_ARGS]);
    expect(rows).toHaveLength(1);
    // Elevating this function would bypass study_materials' RLS for every
    // caller. The migration's self-test asserts the same thing.
    expect(rows[0].is_definer).toBe(false);
    expect(rows[0].proconfig.join(",")).toContain("search_path=");
  });

  it("creates both title indexes the sargable predicates rely on", async () => {
    const { rows } = await pg.query(`
      select indexname, indexdef from pg_indexes
       where schemaname = 'public' and tablename = 'study_materials'
       order by indexname
    `);
    const byName = Object.fromEntries(rows.map((r) => [r.indexname, r.indexdef]));
    expect(byName.idx_study_materials_title_latin_pattern).toContain("text_pattern_ops");
    expect(byName.idx_study_materials_title_latin_trgm).toContain("gin_trgm_ops");
  });

  it("is re-runnable, because a re-push must not fail on the indexes", async () => {
    await expect(pg.exec(migration)).resolves.toBeTruthy();
  });
});

describe("the material group answers 'kinematics notes'", () => {
  it("returns approved notes and sheets, which today's search cannot", async () => {
    const rows = await search("kinematics notes", ["material"]);
    expect(rows.map((r) => r.entity_id.toString())).toEqual(["1", "2"]);
    expect(rows[0].group_key).toBe("material");
  });

  it("never leaks material that is not approved and published", async () => {
    const rows = await search("kinematics", ["material"]);
    const titles = rows.map((r) => r.title);
    expect(titles).not.toContain("Kinematics Notes Awaiting Review");
  });

  it("hides material no page on this site lists (the content guard)", async () => {
    // Material 4 is approved and published but has no study_material_scopes
    // row, so get_study_materials() — and therefore /materials — never shows
    // it. Suggesting it would be a link to nothing. "unscoped" appears in no
    // other title, so an empty result is the guard and nothing else.
    expect(await search("unscoped", ["material"])).toEqual([]);
    const rows = await search("kinematics", ["material"]);
    expect(rows.map((r) => r.title)).not.toContain("Kinematics Unscoped Lecture Notes");
  });

  it("carries one scope row's slugs, so the /materials filters it builds hold", async () => {
    const [notes] = await search("kinematics notes", ["material"]);
    expect(notes.extra).toMatchObject({
      material_type: "short_notes",
      goal_slug: "jee",
      class_slug: "class-11",
      subject_slug: "physics",
      chapter_slug: "kinematics",
    });
  });

  it("names the material type and its syllabus place in the subtitle", async () => {
    const rows = await search("kinematics notes", ["material"]);
    expect(rows[0].subtitle).toBe("Short notes · Physics · Kinematics");
    expect(rows[1].subtitle).toBe("Formula sheet · Physics");
  });

  it("leaves previous-year papers to the paper group", async () => {
    const rows = await search("kinematics", ["material"]);
    expect(rows.map((r) => r.title)).not.toContain("Kinematics Board Paper 2021");
  });
});

describe("the paper group answers 'jee main 2024 paper'", () => {
  it("finds the papers, newest year first", async () => {
    const rows = await search("jee main 2024 paper", ["paper"]);
    // Both JEE Main papers are the same match tier ("2023" clears the fuzzy
    // threshold against "2024"), so the year tie-break is what decides — and
    // the year is what a student is choosing by.
    expect(rows.map((r) => r.title)).toEqual([
      "JEE Main 2024 Session 1 Shift 1 Question Paper",
      "JEE Main 2023 Session 1 Shift 1 Question Paper",
    ]);
  });

  it("flags the papers the curated JEE Main landing actually lists", async () => {
    const [paper] = await search("jee main 2024 paper", ["paper"]);
    expect(paper.extra.jee_main_landing).toBe(true);
    const [other] = await search("kinematics board paper", ["paper"]);
    expect(other.extra.jee_main_landing).toBe(false);
  });

  it("puts the year first in the subtitle, because that is how papers are picked", async () => {
    const [paper] = await search("jee main 2024 paper", ["paper"]);
    expect(paper.subtitle).toBe("2024 · NTA");
  });

  it("hides a paper that neither the landing nor /materials lists", async () => {
    // Material 8: approved, but no scope row and not a JEE Main title, so no
    // page on this site shows it. Material 7 is the control — same shape, but
    // it has a scope, so it is offered.
    expect(await search("orphan", ["paper"])).toEqual([]);
    expect((await search("board", ["paper"])).map((r) => r.title))
      .toContain("Kinematics Board Paper 2021");
  });
});

describe("the gate is the database's, not the client's", () => {
  it("still hides unapproved material when the caller is anon", async () => {
    await pg.exec("set role anon;");
    try {
      const rows = await search("kinematics", ["material"]);
      expect(rows.map((r) => r.title)).not.toContain("Kinematics Notes Awaiting Review");
      expect(rows.map((r) => r.title)).toContain("Kinematics Short Notes");
    } finally {
      await pg.exec("reset role;");
    }
  });

  it("returns nothing for a query below the two-character floor", async () => {
    expect(await search("k", ["material"])).toEqual([]);
    expect(await search("k", ["paper"])).toEqual([]);
  });
});

describe("the five video groups are untouched", () => {
  it("still answers with chapters, playlists, lectures and institutes", async () => {
    const keys = new Set((await search("kinematics")).map((r) => r.group_key));
    expect(keys.has("chapter")).toBe(true);
    expect(keys.has("playlist")).toBe(true);
    expect(keys.has("lecture")).toBe(true);
    expect(keys.has("material")).toBe(true);
  });

  it("answers a channel query exactly as before", async () => {
    const rows = await search("competishun", ["institute"]);
    expect(rows.map((r) => r.title)).toEqual(["Competishun"]);
    expect(rows[0].subtitle).toBe("1 course");
  });

  it("searches every group when p_types is null, the new ones included", async () => {
    const keys = new Set((await search("jee main 2024 paper")).map((r) => r.group_key));
    expect(keys.has("paper")).toBe(true);
  });
});

describe("grouping, counting and paging behave like the other groups", () => {
  it("reports the whole group total on every page, not the page size", async () => {
    const page = await search("kinematics notes", ["material"], 1, 0);
    expect(page).toHaveLength(1);
    expect(Number(page[0].group_total)).toBe(2);
  });

  it("pages with limit and offset without repeating a row", async () => {
    const first = await search("kinematics notes", ["material"], 1, 0);
    const second = await search("kinematics notes", ["material"], 1, 1);
    expect(first[0].entity_id).not.toBe(second[0].entity_id);
  });

  it("labels the match tier with the same vocabulary as every other group", async () => {
    const rows = await search("kinematics notes", ["material"]);
    for (const row of rows) {
      expect(["exact", "prefix", "partial", "fuzzy"]).toContain(row.match_type);
      expect(row.match_rank).toBeGreaterThan(0);
    }
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

  it("writes no data and grants no new privilege", () => {
    // Comments discuss SECURITY DEFINER at length; the SQL must never use it.
    const code = migration
      .split("\n")
      .filter((line) => !/^\s*--/.test(line))
      .join("\n");
    expect(code).not.toMatch(/\binsert\s+into\b/i);
    expect(code).not.toMatch(/\bupdate\s+public\./i);
    expect(code).not.toMatch(/\bdelete\s+from\b/i);
    expect(code).not.toMatch(/security\s+definer/i);
    // The only grants are the three the baseline already has on this function.
    const grants = migration.match(/^grant .*$/gim) ?? [];
    expect(grants).toHaveLength(3);
    for (const grant of grants) expect(grant).toContain("public.universal_search");
  });

  it("keeps its JEE Main test in step with the landing page's own filter", async () => {
    const { JEE_MAIN_PAPERS_TITLE_PATTERN } = await import("./studyMaterialLandings.js");
    expect(migration).toContain(`ilike '${JEE_MAIN_PAPERS_TITLE_PATTERN}'`);
  });

  it("labels every material_type the CHECK constraint allows", async () => {
    const { STUDY_MATERIAL_TYPES } = await import("./useStudyMaterials.js");
    for (const { value } of STUDY_MATERIAL_TYPES) {
      expect(migration, `no subtitle label for ${value}`)
        .toContain(`when '${value}'`);
    }
  });
});
