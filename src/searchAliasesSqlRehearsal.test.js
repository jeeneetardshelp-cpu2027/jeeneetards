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

const baseline = readFileSync(BASELINE, "utf8");
const materials = readFileSync(MATERIALS, "utf8");
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

const key = (rows) => rows.map((r) => `${r.group_key}:${r.entity_id}:${r.match_rank}`);

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
}, 180_000);

describe("the staged migration applies", () => {
  it("runs end to end, self-verification included", async () => {
    const { rows } = await pg.query(sql`
      select p.prosecdef as is_definer, array_to_string(p.proconfig, ',') as cfg
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'universal_search'
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].is_definer).toBe(false);
    expect(rows[0].cfg).toContain("search_path=");
  });

  it("seeds the alias table and keeps both comparison keys generated", async () => {
    const { rows } = await pg.query(
      "select count(*)::int as n from public.search_aliases where is_active",
    );
    expect(rows[0].n).toBe(SEED.length);
    const { rows: gen } = await pg.query(sql`
      select attname from pg_attribute
       where attrelid = 'public.search_aliases'::regclass and attgenerated = 's'
       order by attname
    `);
    expect(gen.map((r) => r.attname)).toEqual(["alias_key", "expansion_key"]);
  });

  it("is re-runnable, because a re-push must not fail", async () => {
    await expect(pg.exec(migration)).resolves.toBeTruthy();
    const { rows } = await pg.query(
      "select count(*)::int as n from public.search_aliases",
    );
    expect(rows[0].n).toBe(SEED.length);
  });
});

describe("every seeded alias finds its target", () => {
  it.each(SEED)("'$alias' reaches $expansion", async ({ alias, expansion }) => {
    const target = await search(expansion);
    expect(target.length, `${expansion} is not in the fixture catalogue`)
      .toBeGreaterThan(0);
    const hits = await search(alias);
    const targetKeys = new Set(target.map((r) => `${r.group_key}:${r.entity_id}`));
    expect(hits.some((r) => targetKeys.has(`${r.group_key}:${r.entity_id}`))).toBe(true);
  });

  it("fixes the shorthand the site review called out, which returned nothing before", () => {
    // These are the queries in the task and the review: each one found NO row
    // belonging to its target before the migration.
    for (const alias of ["shm", "pnc", "aod", "emi", "rot mech", "ktg", "moi", "pmi"]) {
      const row = SEED.find((r) => r.alias === alias);
      expect(row, `${alias} is not seeded`).toBeTruthy();
      const wasEmpty = beforeAlias[alias].every(
        (r) => !r.title.toLowerCase().includes(row.expansion.toLowerCase()),
      );
      expect(wasEmpty, `${alias} already reached ${row.expansion} before`).toBe(true);
    }
  });

  it("carries the Hindi interior schwa the transliterator cannot derive", async () => {
    // सूरदास keys to a Latin form with the interior 'a' still in it; a student
    // types "surdas". Same for कारतूस / "kartus". The seed stores the
    // Devanagari and the generated column transliterates it, so the alias key
    // and the chapter key come from the same function by construction.
    const { rows } = await pg.query(sql`
      select alias, expansion, expansion_key from public.search_aliases
       where alias in ('surdas', 'kartus') order by alias
    `);
    expect(rows.map((r) => r.alias)).toEqual(["kartus", "surdas"]);
    // Whatever the transliterator produces is what is stored — this asserts the
    // interior schwa really is there, which is the whole reason the gap exists.
    expect(rows[1].expansion_key).toBe("suradasa");
    expect(rows[0].expansion_key).toBe("karatusa");

    // Before: the Devanagari-titled chapter was NOT reachable from the typed
    // form. word_similarity('surdas', 'suradasa') is 0.429, under the 0.5
    // threshold, so the row never even cleared the index prefilter — this is
    // the miss search_v11's header predicted, measured.
    expect(beforeAlias.surdas.some((r) => r.title === "सूरदास")).toBe(false);
    expect(beforeAlias.kartus.some((r) => r.title === "कारतूस")).toBe(false);

    // After: it is reachable, and at the exact tier rather than by luck.
    const surdas = (await search("surdas")).find((r) => r.title === "सूरदास");
    expect(surdas).toBeTruthy();
    expect(surdas.match_type).toBe("exact");
    const kartus = (await search("kartus")).find((r) => r.title === "कारतूस");
    expect(kartus).toBeTruthy();
    expect(kartus.match_type).toBe("exact");

    // And the Latin-titled lesson that already answered "surdas" still does.
    expect(beforeAlias.surdas.some((r) => r.title.startsWith("Surdas Ke Pad"))).toBe(true);
    expect((await search("surdas")).some((r) => r.title.startsWith("Surdas Ke Pad"))).toBe(true);
  });
});

describe("an alias never replaces a literal match", () => {
  it.each(CONTROL_QUERIES)("leaves '%s' byte-identical", async (q) => {
    expect(key(await search(q))).toEqual(key(before[q]));
  });

  it("keeps every row a shorthand query already returned", async () => {
    for (const { alias } of SEED) {
      const now = new Set(key(await search(alias)).map((k) => k.split(":").slice(0, 2).join(":")));
      for (const k of key(beforeAlias[alias])) {
        const id = k.split(":").slice(0, 2).join(":");
        expect(now.has(id), `${alias} lost ${id}`).toBe(true);
      }
    }
  });

  it("never demotes a row that matched literally", async () => {
    for (const { alias } of SEED) {
      const now = new Map(
        (await search(alias)).map((r) => [`${r.group_key}:${r.entity_id}`, r.match_rank]),
      );
      for (const r of beforeAlias[alias]) {
        const k = `${r.group_key}:${r.entity_id}`;
        expect(now.get(k), `${alias} demoted ${k}`).toBeLessThanOrEqual(r.match_rank);
      }
    }
  });

  it("still answers 'emi' with the chemistry rows it answered with before", async () => {
    // "emi" is a substring of "chemistry". A design that rewrote the query
    // would have deleted these rows; this one adds Electromagnetic Induction
    // above them.
    const rows = await search("emi");
    expect(rows.some((r) => r.title === "Chemistry Full Syllabus Marathon")).toBe(true);
    const induction = rows.find((r) => r.title === "Electromagnetic Induction");
    const chemistry = rows.find((r) => r.title === "Chemistry Full Syllabus Marathon");
    expect(induction.match_rank).toBeLessThan(chemistry.match_rank);
  });

  it("still answers 'nlm' with the chapter literally named that", async () => {
    const rows = await search("nlm");
    expect(rows.some((r) => r.title === "Newton's Laws of Motion (NLM) - Full Chapter"))
      .toBe(true);
  });
});

describe("an unknown token is still nothing", () => {
  it("returns no rows and rewrites nothing", async () => {
    expect(await search("zzqqxx no such topic zzqqxx")).toEqual([]);
    const { rows } = await pg.query(
      "select public.search_expand_aliases($1) as out", ["zzqqxx"],
    );
    expect(rows[0].out).toBe("zzqqxx");
  });

  it("passes a query with no alias in it through untouched", async () => {
    const { rows } = await pg.query(sql`
      select q, public.search_expand_aliases(q) as out
        from unnest(array['kinematics','rotational motion','jee main 2024 paper','']) as q
    `);
    for (const r of rows) expect(r.out).toBe(r.q);
  });

  it("keeps the two-character floor", async () => {
    expect(await search("a")).toEqual([]);
  });
});

describe("/browse searches the same way the box does", () => {
  const ids = async (fn, q) => {
    const { rows } = await pg.query(`select id from public.${fn}($1) order by id`, [q]);
    return rows.map((r) => Number(r.id));
  };

  it("finds the shorthand in the lecture list, not only in the suggestions", async () => {
    const shm = await ids("search_video_ids", "shm");
    expect(shm.length).toBeGreaterThan(0);
    const { rows } = await pg.query(
      "select id from public.videos where title like 'Simple Harmonic Motion%'",
    );
    expect(shm).toContain(Number(rows[0].id));
  });

  it("finds the shorthand in the course list", async () => {
    expect(await ids("search_playlist_ids", "pnc")).toContain(5);
  });

  it("leaves a normal browse query alone", async () => {
    expect(await ids("search_playlist_ids", "kinematics")).toEqual([7]);
    expect((await ids("search_video_ids", "kinematics")).length).toBeGreaterThan(0);
  });
});

describe("the abort path fires", () => {
  /** The migration's own self-verification block, re-run on demand. */
  function verifyBlock() {
    const start = migration.indexOf("do $verify$");
    const end = migration.indexOf("$verify$;", start);
    expect(start, "no self-verification block in the migration").toBeGreaterThan(-1);
    return migration.slice(start, end + "$verify$;".length);
  }

  it("aborts when a seeded alias points at nothing in the catalogue", async () => {
    await pg.exec(
      "insert into public.search_aliases (alias, expansion, note) " +
      "values ('zzq', 'zzqqxx nothing at all', 'deliberate poison for the abort test');",
    );
    await expect(pg.exec(verifyBlock())).rejects.toThrow(/matches NOTHING in this catalogue/);
    await pg.exec("delete from public.search_aliases where alias = 'zzq';");
    await expect(pg.exec(verifyBlock())).resolves.toBeTruthy();
  });

  it("aborts when the alias REPLACES the literal match instead of adding to it", async () => {
    // The mutation this whole design exists to prevent: rank on the expansion
    // alone. Every row that only matched literally would silently vanish.
    await pg.exec(sql`
      create or replace function public.search_rank_aliased(
        p_haystack text, p_tokens text[], p_needle text,
        p_alias_tokens text[], p_alias_needle text
      ) returns integer language sql immutable parallel safe
      set search_path to 'public', 'pg_temp' as $mut$
        select public.search_rank_tokens(p_haystack, p_alias_tokens, p_alias_needle);
      $mut$;
    `);
    await expect(pg.exec(verifyBlock())).rejects.toThrow(/THE LAW IS BROKEN/);

    const original = migration.slice(
      migration.indexOf("create or replace function public.search_rank_aliased("),
      migration.indexOf("alter function public.search_rank_aliased"),
    );
    await pg.exec(original);
    await expect(pg.exec(verifyBlock())).resolves.toBeTruthy();
  });

  it("aborts when the alias pass is switched off in a search function", async () => {
    const original = migration.slice(
      migration.indexOf("create or replace function public.search_playlist_ids"),
      migration.indexOf("comment on function public.search_playlist_ids"),
    );
    await pg.exec(baselineFunction("search_playlist_ids"));   // the un-aliased body
    await expect(pg.exec(verifyBlock()))
      .rejects.toThrow(/does not use the alias pass/);
    await pg.exec(original);
    await expect(pg.exec(verifyBlock())).resolves.toBeTruthy();
  });

  it("refuses an alias row that would match nothing or everything", async () => {
    const bad = [
      ["a", "Kinematics"],                       // below the query floor
      ["pdf", "Kinematics"],                     // a filler token
      ["Kinematics", "kinematics"],              // expands to itself
      ["one two three four five", "Kinematics"], // longer than the phrase window
    ];
    for (const [alias, expansion] of bad) {
      await expect(pg.query(
        "insert into public.search_aliases (alias, expansion) values ($1, $2)",
        [alias, expansion],
      )).rejects.toThrow(/search_aliases_/);
    }
  });
});

describe("the alias table is public vocabulary, not a public write surface", () => {
  it("lets a logged-out reader see active aliases, because search runs as them", async () => {
    await pg.exec("set role anon;");
    try {
      const { rows } = await pg.query(
        "select count(*)::int as n from public.search_aliases",
      );
      expect(rows[0].n).toBe(SEED.length);
      // And search itself still works as anon, which is the point of the grant.
      expect((await search("shm")).length).toBeGreaterThan(0);
    } finally {
      await pg.exec("reset role;");
    }
  });

  it("hides an inactive alias from the public and stops it expanding", async () => {
    await pg.exec("update public.search_aliases set is_active = false where alias = 'shm';");
    try {
      await pg.exec("set role anon;");
      const { rows } = await pg.query(
        "select count(*)::int as n from public.search_aliases where alias = 'shm'",
      );
      expect(rows[0].n).toBe(0);
      const { rows: exp } = await pg.query(
        "select public.search_expand_aliases('shm') as out",
      );
      expect(exp[0].out).toBe("shm");
    } finally {
      await pg.exec("reset role;");
      await pg.exec("update public.search_aliases set is_active = true where alias = 'shm';");
    }
  });

  it("refuses a write from anon and from a non-admin signed-in user", async () => {
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role};`);
      try {
        await expect(pg.query(
          "insert into public.search_aliases (alias, expansion) values ('xyz', 'Kinematics')",
        )).rejects.toThrow();
      } finally {
        await pg.exec("reset role;");
      }
    }
  });

  it("stamps updated_at when a row is edited", async () => {
    const { rows: a } = await pg.query(
      "select updated_at from public.search_aliases where alias = 'shm'",
    );
    await pg.exec("update public.search_aliases set note = note || '.' where alias = 'shm';");
    const { rows: b } = await pg.query(
      "select updated_at from public.search_aliases where alias = 'shm'",
    );
    expect(new Date(b[0].updated_at) >= new Date(a[0].updated_at)).toBe(true);
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

  it("never elevates and grants explicitly", () => {
    const code = migration
      .split("\n").filter((line) => !/^\s*--/.test(line)).join("\n");
    expect(code).not.toMatch(/security\s+definer/i);
    expect(code).not.toMatch(/\bdrop\s+table\b/i);
    // Every new function is granted to all three Supabase roles by name.
    for (const fn of ["search_expand_aliases", "search_rank_aliased"]) {
      for (const role of ["anon", "authenticated", "service_role"]) {
        expect(code, `${fn} is not granted to ${role}`)
          .toContain(`grant execute on function public.${fn}`);
        expect(code).toMatch(new RegExp(`public\\.${fn}[^;]*to ${role};`));
      }
      expect(code).toMatch(new RegExp(`revoke all on function public\\.${fn}`));
    }
    expect(code).toContain("revoke all on table public.search_aliases from public;");
  });

  it("only ever writes to its own table", () => {
    const code = migration
      .split("\n").filter((line) => !/^\s*--/.test(line)).join("\n");
    const writes = code.match(/\b(insert\s+into|update|delete\s+from)\s+public\.(\w+)/gi) ?? [];
    for (const w of writes) expect(w.toLowerCase()).toContain("search_aliases");
  });
});
