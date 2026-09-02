// browseCourseRelevanceSqlRehearsal.test.js
//
// WHAT IS REAL HERE. These tests EXECUTE the staged migration
// supabase/migrations/20260902240000_browse_course_relevance.sql on a real
// PostgreSQL engine (PGlite, Postgres compiled to WASM) with the real pg_trgm
// extension, so `%>`, word_similarity, the trigram fuzzy tier, the migration's
// preflight and its self-verification DO block all actually run. Nothing in the
// migration is re-typed here.
//
// AND IT RUNS ON THE COMPOSED CHAIN, not on a clean baseline. The order is the
// order `db push` uses:
//
//   20260831140005 production_baseline           (helpers + the un-ordered body)
//   20260901160000 universal_search_materials    (the seven-group search box)
//   20260902170000 search_aliases                (the curated shorthand pass —
//                                                 THE body this file carries
//                                                 forward)
//   20260902180000 universal_search_material_words
//   20260902240000 browse_course_relevance       (this migration)
//
// That arrangement is the whole point. Each migration's own rehearsal loads
// only its own ancestor, so none of them can see a later file re-emitting a
// shared function from an older copy of the body — the failure mode
// src/searchFeatureCarryOverSqlContract.test.js exists to catch at author time
// and this file catches by execution. Setting this migration up on the bare
// baseline would prove nothing about the state production is actually in.
//
// WHAT IS NOT REAL. The catalogue is a stand-in, shaped after what production
// measurably holds but a few dozen rows rather than 484 playlists / 5,471
// lectures. The alias migration's self-test refuses any seeded alias pointing
// at nothing, so the chapter fixture is PARSED OUT OF ITS OWN SEED, as in
// src/searchAliasesSqlRehearsal.test.js. public.is_admin() is a stub returning
// false. These tests prove CORRECTNESS and the abort paths. They prove nothing
// about production query PLANS or timing.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { beforeAll, describe, expect, it } from "vitest";

const BASELINE = "supabase/migrations/20260831140005_production_baseline.sql";
const MATERIALS = "supabase/migrations/20260901160000_universal_search_materials.sql";
const ALIASES = "supabase/migrations/20260902170000_search_aliases.sql";
const WORDS = "supabase/migrations/20260902180000_universal_search_material_words.sql";
const MIGRATION = "supabase/migrations/20260902240000_browse_course_relevance.sql";

const baseline = readFileSync(BASELINE, "utf8");
const materials = readFileSync(MATERIALS, "utf8");
const aliases = readFileSync(ALIASES, "utf8");
const words = readFileSync(WORDS, "utf8");
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

/** One statement out of a staged migration file, by its opening line. */
function blockFrom(file, from, to) {
  const start = file.indexOf(from);
  const end = file.indexOf(to, start);
  expect(start, `no "${from}" in that migration`).toBeGreaterThan(-1);
  expect(end, `no "${to}" after it`).toBeGreaterThan(start);
  return file.slice(start, end);
}

// The alias migration's self-test names each of these.
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

// COURSES, shaped after what production measurably holds for "kinematics":
// 48 matches, of which only four are literal (tier 3/4) and 44 are trigram
// fuzzy — overwhelmingly *Mathematics* courses, because "mathematics" is within
// word_similarity 0.5 of "kinematics".
//
// The fuzzy rows are inserted FIRST on purpose. With no ORDER BY, Postgres is
// free to return a small table in storage order, so this fixture reproduces the
// production symptom — the Mathematics courses lead — rather than relying on
// luck to expose it.
const FUZZY_COURSES = [
  [20, "Mathematics Foundation Series"],
  [21, "Rank Boosters - Mathematics"],
  [22, "Statistics I Class - XI Mathematics"],
  [23, "Hyperbola - JEE Mathematics"],
  [24, "Chemical Kinetics I Class - XII Chemistry"],
];
const LITERAL_COURSES = [
  [30, "Kinematics 1D"],                       // prefix, and the shortest
  [31, "Kinematics| Irodov solutions"],        // prefix, longer
  [32, "Rectilinear Motion (Kinematics)"],     // all-tokens, not a prefix
  [33, "Rohit Mishra JEE Advanced Kinematics"],// all-tokens, longer
];

let pg;
let beforeIds = [];   // search_playlist_ids('kinematics'), captured pre-migration

const sql = (strings, ...vals) => String.raw({ raw: strings }, ...vals);

const courseIds = async (q) => {
  const { rows } = await pg.query("select id from public.search_playlist_ids($1)", [q]);
  return rows.map((r) => Number(r.id));
};
const titleOf = async (id) => {
  const { rows } = await pg.query("select title from public.playlists where id = $1", [id]);
  return rows[0]?.title ?? null;
};

async function search(query, types = null, limit = 25, offset = 0) {
  const { rows } = await pg.query(
    `select group_key, entity_id, title from public.universal_search($1, $2, $3, $4)`,
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
      (7, 'Complete Kinematics', 'ABJ Sir', 3, 1),
      (8, 'Physics One Shot - Aagaz Series', 'ABJ Sir', 3, 1),
      (9, 'MISSION 30 : COMPLETE PHYSICAL CHEMISTRY in One Shot', 'ABJ Sir', 3, 1);
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
       'https://example.test/d', 'official_source', 'approved', now(), 2021);
    insert into public.study_material_scopes (material_id, learning_goal_id, class_level_id, subject_id)
      values (1, 1, 1, 1), (3, 1, 1, 1), (4, 1, 1, 1);
  `);
  // Fuzzy first, then literal — see the note on FUZZY_COURSES.
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

  // The world as production has it TODAY: aliased, and unordered.
  beforeIds = await courseIds("kinematics");

  // The migration's preflight and self-verification abort the transaction if
  // anything is wrong, so getting past this line is the first assertion.
  await pg.exec(migration);
}, 240_000);

// ===========================================================================
// THE BUG, on the composed chain, before and after.
// ===========================================================================
describe("the Courses tab had no best match, and now has one", () => {
  it("returned an unranked list before this migration", async () => {
    // Not a guarantee about Postgres — an unordered query may return rows in
    // ANY order at all, which is exactly the complaint. On this fixture it
    // returns storage order, and storage order puts every fuzzy Mathematics
    // course ahead of the course actually called "Kinematics 1D".
    expect(beforeIds.length).toBeGreaterThan(LITERAL_COURSES.length);
    for (const [pid, title] of FUZZY_COURSES) {
      expect(
        beforeIds.indexOf(pid),
        `"${title}" was NOT above the best match, so this fixture no longer reproduces the bug`,
      ).toBeLessThan(beforeIds.indexOf(30));
    }
  });

  it("leads with the best match afterwards, and the tie-break is the shorter title", async () => {
    const after = await courseIds("kinematics");
    expect(await titleOf(after[0])).toBe("Kinematics 1D");
    // Prefix tier first (both courses whose title STARTS with the query),
    // then all-tokens, then fuzzy. Inside a tier the shorter title wins:
    // 'Complete Kinematics' (19) rides along from the shared fixture and is
    // shorter than 'Rectilinear Motion (Kinematics)' (31), which is shorter
    // than 'Rohit Mishra JEE Advanced Kinematics' (36).
    expect(after.slice(0, 2)).toEqual([30, 31]);
    expect(after.slice(2, 5)).toEqual([7, 32, 33]);
    for (const [pid] of FUZZY_COURSES) {
      expect(after.indexOf(pid)).toBeGreaterThan(after.indexOf(33));
    }
  });

  it("changes only the ORDER, never the match set", async () => {
    // An ordering migration that quietly dropped a row would be a far worse
    // bug than the one it fixes, and it would look like a success.
    const after = await courseIds("kinematics");
    expect([...after].sort((a, b) => a - b)).toEqual([...beforeIds].sort((a, b) => a - b));
  });

  it("is deterministic, because paging over this order depends on it", async () => {
    // pl.id is the last key, and it is unique, so the order is TOTAL. Without
    // that, one course can appear on two pages and another on none.
    expect(await courseIds("kinematics")).toEqual(await courseIds("kinematics"));
    expect(await courseIds("physics")).toEqual(await courseIds("physics"));
  });

  it("agrees with the lecture list about what a search means", async () => {
    // Both halves of one results page now rank. This is the disagreement the
    // migration exists to end.
    const { rows } = await pg.query(`
      select proname, prosrc from pg_proc
       where pronamespace = 'public'::regnamespace
         and proname in ('search_playlist_ids', 'search_video_ids')`);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.prosrc, `${r.proname} does not order by the rank`)
        .toMatch(/order\s+by\s+public\.search_rank_aliased/i);
      expect(r.prosrc, `${r.proname} has no cap`).toMatch(/limit\s+500/i);
    }
  });
});

// ===========================================================================
// THE CARRY-OVER. This migration re-emits search_playlist_ids WHOLE. Everything
// the chain put into that body before it has to still be there.
// ===========================================================================
describe("the curated shorthand pass survives the re-emit", () => {
  it("still calls the alias helpers at all", async () => {
    const { rows } = await pg.query(`
      select prosrc from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'search_playlist_ids'`);
    expect(rows).toHaveLength(1);
    // Re-emitted from the baseline instead of from 20260902170000, these vanish
    // and nothing else in the database notices.
    expect(rows[0].prosrc).toContain("search_rank_aliased");
    expect(rows[0].prosrc).toContain("search_expand_aliases");
  });

  it("still finds a course by its shorthand", async () => {
    // "pnc" is not a substring of "Permutations and Combinations".
    expect(await courseIds("pnc")).toContain(5);
  });

  it("still matches everything it matched, on every seeded alias", async () => {
    for (const { alias } of SEED) {
      const viaAlias = await courseIds(alias);
      // Not every alias has a course target in this fixture; what must never
      // happen is the alias returning FEWER courses than its expansion's own
      // literal query, which is what losing the pass looks like.
      const key = await pg.query("select public.search_expand_aliases($1) as k", [alias]);
      const viaExpansion = await courseIds(String(key.rows[0].k));
      for (const pid of viaExpansion) {
        expect(viaAlias, `"${alias}" lost the course its expansion finds`).toContain(pid);
      }
    }
  });

  it("leaves the search box and the lecture list untouched", async () => {
    // This migration re-emits exactly one function. universal_search must still
    // carry BOTH later features the chain gave it.
    const { rows } = await pg.query(`
      select prosrc from pg_proc
       where pronamespace = 'public'::regnamespace and proname = 'universal_search'`);
    expect(rows[0].prosrc).toContain("search_rank_aliased");
    expect(rows[0].prosrc).toContain("study_material_haystack");
    expect((await search("shm")).length).toBeGreaterThan(0);
    expect((await search("pyq")).length).toBeGreaterThan(0);
  });

  it("keeps the two-character query floor", async () => {
    expect(await courseIds("a")).toEqual([]);
    expect(await courseIds("k")).toEqual([]);
  });

  it("is re-runnable, because a re-push must not fail", async () => {
    await expect(pg.exec(migration)).resolves.toBeTruthy();
    expect(await titleOf((await courseIds("kinematics"))[0])).toBe("Kinematics 1D");
  });
});

// ===========================================================================
// THE CAP. 500 is what search_video_ids uses and what src/usePlaylistBrowse.js
// relies on to bound its whole-set fetch. Production holds 484 playlists in
// total, so this cannot bind there today — which is precisely why it needs a
// test that makes it bind.
// ===========================================================================
describe("the 500-id cap", () => {
  it("bounds a query that would otherwise match everything", async () => {
    await pg.exec(sql`
      insert into public.playlists (id, title, teacher, channel_id, subject_id)
      select 100000 + g, 'Kinematics Marathon Part ' || g, 'ABJ Sir', 3, 1
        from generate_series(1, 620) as g;
    `);
    try {
      const ids = await courseIds("kinematics");
      expect(ids).toHaveLength(500);
      // And it keeps the BEST 500, not an arbitrary 500: the prefix-tier
      // courses are still the ones at the top.
      expect(await titleOf(ids[0])).toBe("Kinematics 1D");
    } finally {
      await pg.exec("delete from public.playlists where id >= 100000;");
    }
  });
});

// ===========================================================================
// THE ABORT PATHS. Both DO blocks are re-run on demand against a deliberately
// broken database, so "it would have stopped the deploy" is executed rather
// than asserted in a comment.
// ===========================================================================
describe("the migration refuses to ship a broken ordering", () => {
  const preflightBlock = () => blockFrom(migration, "do $preflight$", "$preflight$;") + "$preflight$;";
  const verifyBlock = () => blockFrom(migration, "do $verify$", "$verify$;") + "$verify$;";
  const goodBody = () => blockFrom(
    migration,
    "create or replace function public.search_playlist_ids",
    "alter function public.search_playlist_ids",
  );
  /** 20260902170000's body: aliased, but with no ORDER BY and no LIMIT. */
  const unorderedBody = () => blockFrom(
    aliases,
    "create or replace function public.search_playlist_ids",
    "alter function public.search_playlist_ids",
  );

  it("the blocks were really extracted, so these tests are not vacuous", () => {
    expect(preflightBlock()).toContain("search_expand_aliases(text)");
    expect(verifyBlock()).toContain("THE CARRY-OVER");
    expect(goodBody()).toMatch(/order\s+by\s+public\.search_rank_aliased/i);
    expect(unorderedBody()).not.toMatch(/order\s+by\s+public\.search_rank_aliased/i);
  });

  it("aborts when the ORDER BY is missing — the exact regression it prevents", async () => {
    // Exactly 20260902170000's body: the alias pass intact, the ordering gone.
    // This is what a future migration re-emitting from the older copy produces,
    // and the count check is what catches it — the ranker is called once (the
    // WHERE) where it must be called twice.
    await pg.exec(unorderedBody());
    await expect(pg.exec(verifyBlock())).rejects.toThrow(
      /calls search_rank_aliased 1 time\(s\) -- it needs one in the WHERE and one in the ORDER BY/,
    );
    await pg.exec(goodBody());
    await expect(pg.exec(verifyBlock())).resolves.toBeTruthy();
  });

  it("aborts when the ordering is there but ranks by something else", async () => {
    // The plausible mistake: order by title, which looks tidy, is stable, and
    // has nothing to do with what the student typed. The ranker is still
    // called twice, so ONLY the ORDER BY check can catch this one.
    const body = unorderedBody();
    const call = /and (public\.search_rank_aliased\([\s\S]*?\)) is not null;/.exec(body);
    expect(call, "could not find the ranker call to mutate").toBeTruthy();
    await pg.exec(body.replace(
      call[0],
      `and ${call[1]} is not null and ${call[1]} < 99\n     order by pl.title, pl.id\n     limit 500;`,
    ));
    await expect(pg.exec(verifyBlock())).rejects.toThrow(/does not ORDER BY the rank/);
    await pg.exec(goodBody());
    await expect(pg.exec(verifyBlock())).resolves.toBeTruthy();
  });

  it("aborts when the alias pass is dropped from the body it carried forward", async () => {
    await pg.exec(baselineFunction("search_playlist_ids"));   // the pre-alias body
    await expect(pg.exec(verifyBlock())).rejects.toThrow(
      /calls search_rank_aliased 0 time\(s\)|no longer expands aliases|lost a match disjunct/,
    );
    await pg.exec(goodBody());
    await expect(pg.exec(verifyBlock())).resolves.toBeTruthy();
  });

  it("aborts when the ranker stops ranking, even with the ORDER BY intact", async () => {
    // A body can order by the right expression while the expression itself has
    // been flattened to a constant. The ordering would then be a no-op and
    // nothing structural would notice.
    const original = blockFrom(
      aliases,
      "create or replace function public.search_rank_aliased(",
      "alter function public.search_rank_aliased",
    );
    await pg.exec(sql`
      create or replace function public.search_rank_aliased(
        p_haystack text, p_tokens text[], p_needle text,
        p_alias_tokens text[], p_alias_needle text
      ) returns integer language sql immutable parallel safe
      set search_path to 'public', 'pg_temp' as $mut$
        select case when public.search_rank_tokens(p_haystack, p_tokens, p_needle) is null
                      and public.search_rank_tokens(p_haystack, p_alias_tokens, p_alias_needle) is null
                    then null else 1 end;
      $mut$;
    `);
    await expect(pg.exec(verifyBlock())).rejects.toThrow(
      /a literal match does not outrank a fuzzy one/,
    );
    await pg.exec(original);
    await expect(pg.exec(verifyBlock())).resolves.toBeTruthy();
  });

  it("the preflight refuses to run before the migration it depends on", async () => {
    await pg.exec("drop function public.search_expand_aliases(text);");
    await expect(pg.exec(preflightBlock())).rejects.toThrow(
      /search_expand_aliases\(text\) does not exist/,
    );
    await pg.exec(blockFrom(
      aliases,
      "create or replace function public.search_expand_aliases(",
      "alter function public.search_expand_aliases",
    ));
    await expect(pg.exec(preflightBlock())).resolves.toBeTruthy();
  });

  it("the preflight refuses a database whose body already lost the alias pass", async () => {
    // Applying an ordering on top of an already-regressed body would cement the
    // loss: the carry-over check would then see the ordering and be satisfied.
    await pg.exec(baselineFunction("search_playlist_ids"));
    await expect(pg.exec(preflightBlock())).rejects.toThrow(
      /has no alias pass -- fix that regression/,
    );
    await pg.exec(goodBody());
    await expect(pg.exec(preflightBlock())).resolves.toBeTruthy();
  });
});
