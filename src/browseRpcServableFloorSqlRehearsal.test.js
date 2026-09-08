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
// The two migrations that landed between the floor and its correction. They are
// applied on production, so leaving them out of this chain would rehearse a
// database that does not exist -- and the Hinglish list in particular changes
// which tokens survive, which is the whole subject of this file.
const OTHER_FLOOR =
  "supabase/migrations/20260907093000_universal_search_q_long_floor.sql";
const HINGLISH =
  "supabase/migrations/20260907140000_search_filler_tokens_hinglish.sql";
// 20260907091500 shipped the floor with the CLIENT's rule -- >= 4 once there is
// more than one token -- against POST-filler tokens, and silently emptied
// "def int" and "x ray" on production. This is the correction, and the two
// queries appear below as must-answer cases so the pair cannot regress again.
// The rescue floor, moved into the shared tokeniser so the browse matchers get
// what universal_search has had since 20260907093000. Without it "ac ka matlab"
// reduced to ["ac"] and /browse answered 0 rows while /search answered 26.
// The anchor floor, and the migration that gives the browse matchers the same
// needle selection universal_search has had since it. Both are in the chain, so
// leaving them out would rehearse a database nobody runs.
const ANCHOR_FLOOR =
  "supabase/migrations/20260907170000_universal_search_anchor_floor.sql";
const BROWSE_ANCHOR =
  "supabase/migrations/20260908140000_browse_matchers_anchor_floor.sql";
const RESCUE =
  "supabase/migrations/20260907200000_shared_tokeniser_rescue_floor.sql";
const CORRECTION =
  "supabase/migrations/20260907160000_browse_servable_floor_correction.sql";

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
      (9008, 'Class 11 Physics NCERT Full Course', null, 1, 'yt9008'),
      -- The regression corpus for 20260907160000. Both queries are TWO tokens
      -- whose longest survivor is exactly 3 characters, which is the one shape
      -- the original floor got wrong -- and every "still answers" case that
      -- existed before it was a single token, so none of them could catch it.
      (9009, 'Definite Integration - One Shot', null, 1, 'yt9009'),
      (9010, 'X Ray Diffraction and Crystal Structure', null, 1, 'yt9010');
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
  // Then the rest of the chain, in order, so what this file exercises is what
  // production runs -- not the corrected rule in isolation.
  await pg.exec(readFileSync(OTHER_FLOOR, "utf8"));
  await pg.exec(readFileSync(HINGLISH, "utf8"));
  await pg.exec(readFileSync(CORRECTION, "utf8"));
  await pg.exec(readFileSync(ANCHOR_FLOOR, "utf8"));
  await pg.exec(readFileSync(RESCUE, "utf8"));
  await pg.exec(readFileSync(BROWSE_ANCHOR, "utf8"));
}, 120000);

const ids = async (fn, q) =>
  (await pg.query(`select id from public.${fn}($1)`, [q])).rows.map((r) => r.id);

describe("browse matchers: the servable floor", () => {
  // Every one of these was measured at HTTP 500 57014 on production. The old
  // guard tested `qlen`, the length of the whole string, so only the first was
  // refused -- and even that one only because qlen happened to be 2.
  it.each([
    // "ac" and "3d" USED to be here, refused on the length of their typed
    // token. 20260908140000 gives these matchers the anchor floor, so both now
    // reach their alias expansion and answer -- see the block at the end of
    // this file. What stays refused is a query with no anchor anywhere.
    ["p c", "two 1-character tokens, 3 characters overall"],
    ["a b c", "three 1-character tokens, 5 characters overall"],
    // "p and c" USED to be here. 20260907200000 moved the rescue floor into the
    // shared tokeniser, and the rescue keeps ["p","and","c"] because filtering
    // would leave ["p","c"] -- so its needle is now "and", which clears the
    // floor. That is deliberate and is covered by its own test below; it makes
    // /browse behave the way universal_search has since 20260907093000.
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
    // THE REGRESSION. Two tokens, longest survivor exactly 3 characters. Both
    // answered 200 on production -- "def int" 33 rows, "x ray" 8 -- and both
    // returned 0 under the original floor. Every case above this line is a
    // single token, which is why the first version of this file passed while
    // the defect shipped.
    ["def int", "two tokens, longest survivor exactly 3 characters"],
    ["x ray", "two tokens, longest survivor exactly 3 characters"],
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

  // Pinned at the helper, not through the catalogue, so this stays a statement
  // about the RULE and cannot be rescued by a fixture that happens to match.
  it("decides on the length of the longest survivor alone, not the token count", async () => {
    const { rows } = await pg.query(
      `select v.q,
              t.q_tokens,
              t.q_long,
              public.search_is_servable(t.q_tokens, t.q_long) as ok
         from (values ('def int'), ('x ray'), ('ac ka matlab'), ('p and c'), ('ac')) as v(q)
         cross join lateral public.search_query_tokens(v.q) t`,
    );
    const by = Object.fromEntries(rows.map((r) => [r.q, r]));

    // Two tokens, longest survivor 3 -- servable. The old rule demanded 4 here
    // purely because there were two of them, and that is what emptied both.
    expect(by["def int"].q_long).toBe("def");
    expect(by["def int"].q_tokens).toHaveLength(2);
    expect(by["def int"].ok).toBe(true);
    expect(by["x ray"].q_long).toBe("ray");
    expect(by["x ray"].q_tokens).toHaveLength(2);
    expect(by["x ray"].ok).toBe(true);

    // One token, 2 characters -- refused. The floor still does its job.
    expect(by["ac"].q_long).toBe("ac");
    expect(by["ac"].ok).toBe(false);
    // "p and c" changed with 20260907200000 and the change is intended. The
    // rescue keeps the raw tokens, because filtering leaves ["p","c"], so the
    // needle is "and" rather than "c" and the floor lets it through. This is
    // the one query the rescue costs us; see its own test below.
    expect(by["p and c"].q_long).toBe("and");
    expect(by["p and c"].ok).toBe(true);

    // This was the KNOWN GAP recorded here when the floor landed: the Hinglish
    // filler list made "ka"/"matlab" filler, the shared helper had no rescue
    // floor, and /search answered 26 rows where /browse answered 0.
    // 20260907200000 closed it by moving the rescue into the helper, so the
    // needle is a real word again and the query is servable on both surfaces.
    expect(by["ac ka matlab"].q_long).toBe("matlab");
    expect(by["ac ka matlab"].ok).toBe(true);
  });

  // The rescue floor, and specifically the thing that made it worth doing: not
  // that raw tokens match, but that keeping a real needle lets the query reach
  // the ALIAS pass, which is what actually finds the rows.
  describe("the rescue floor in the shared tokeniser", () => {
    it("keeps the raw tokens when filtering would leave nothing usable", async () => {
      const { rows } = await pg.query(
        `select t.q_tokens, t.q_long from public.search_query_tokens($1) t`,
        ["ac ka matlab"],
      );
      // "ka" and "matlab" are filler since 20260907140000, so filtering leaves
      // ["ac"] -- a two-character needle, which is what 57014 is made of.
      expect(rows[0].q_tokens).toHaveLength(3);
      expect(rows[0].q_long).toBe("matlab");
    });

    it("still filters when a usable token survives", async () => {
      const { rows } = await pg.query(
        `select t.q_tokens, t.q_long from public.search_query_tokens($1) t`,
        ["kinematics ka one shot"],
      );
      // The other direction. A rescue that fired unconditionally would pass the
      // test above and quietly stop filler removal from ever working.
      expect(rows[0].q_long).toBe("kinematics");
      expect(rows[0].q_tokens).not.toContain("ka");
    });

    it.each(["ac ka matlab", "ac kya hai", "ac the of"])(
      "answers %j from the browse matchers, through the alias",
      async (q) => {
        // These returned 0 on production while /search returned 26, 26 and 26.
        // The rows are not a raw-token match -- no title contains all three
        // typed words. search_rank_tokens has only conjunction tiers, so they
        // come from "ac" expanding to "Alternating Current".
        const videos = await ids("search_video_ids", q);
        expect(videos.length).toBeGreaterThan(0);
      },
    );

    it("costs us exactly one query, and it is p and c", async () => {
      // The rescue is not free. Filtering "p and c" leaves ["p","c"], so the
      // raw tokens are kept and the needle becomes the stopword "and", which
      // clears the floor -- where before it was refused outright.
      //
      // This is a deliberate trade, not an oversight. universal_search has
      // behaved this way since 20260907093000, so it makes the two surfaces
      // agree rather than creating a new class, and no student reaches it:
      // isServableQuery refuses "p and c" client-side because its only
      // three-letter word is a connective. On production universal_search
      // answers 500 57014 for it; an "and" needle alone is cheap on these
      // matchers ("the and for" is 200 / ~1.3s, 3/3), and it is the alias
      // expansion on top that tips it over.
      const { rows } = await pg.query(
        `select t.q_long, public.search_is_servable(t.q_tokens, t.q_long) as ok
           from public.search_query_tokens($1) t`,
        ["p and c"],
      );
      expect(rows[0].q_long).toBe("and");
      expect(rows[0].ok).toBe(true);
    });

    it("does not manufacture an anchor for a query that never had one", async () => {
      // A query whose every token is one character has nothing to search on
      // and no alias to borrow one from, so search_anchor returns null and both
      // matchers return before scanning.
      //
      // "ac" and "3d" are deliberately NOT in this list any more. They have two
      // characters and an alias, and since 20260908140000 they answer through
      // it. The distinction this test now draws is "no anchor anywhere" rather
      // than "the typed token is short", which is the whole change.
      for (const q of ["p c", "a b c", "p n c"]) {
        expect(await ids("search_video_ids", q)).toEqual([]);
        expect(await ids("search_playlist_ids", q)).toEqual([]);
      }
    });
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

  // 20260908140000: the browse matchers pick their needle the way
  // universal_search has since 20260907170000 -- typed content anchor if it
  // clears the floor, else the alias expansion's anchor, else refuse.
  describe("the anchor floor on the browse matchers", () => {
    it("answers \"ac\" through its alias, where a length rule refused it", async () => {
      // The split this closes. Measured on production 8 Sep: /search returned
      // 33 rows for "ac" with Alternating Current as row 1, while /browse
      // returned 0 -- fast, because it refused before the alias pass ran.
      const videos = await ids("search_video_ids", "ac");
      const playlists = await ids("search_playlist_ids", "ac");
      expect(videos.length + playlists.length).toBeGreaterThan(0);

      // And specifically the aliased chapter, not some incidental "ac" prefix
      // match -- otherwise this passes on a fixture that proves nothing.
      const { rows } = await pg.query(
        `select id from public.videos where title = 'Alternating Current - One Shot'`,
      );
      expect(rows, "the Alternating Current fixture is missing").toHaveLength(1);
      expect(videos).toContain(rows[0].id);
    });

    it("scans on the alias anchor, not on the stopword the raw tokens offer", async () => {
      // "p and c" is why this is an anchor rule and not a length rule. Its
      // typed content anchor is "c", so the length rule let it through on the
      // raw fallback "and" -- 1328 of 5533 production titles -- and it measured
      // 3.1s against a ~3.2s statement timeout, flipping to 500 under load.
      // search_anchor passes over "and" and takes the expansion's anchor.
      const { rows } = await pg.query(
        `select public.search_anchor(
                  public.search_token_anchor(public.search_content_tokens(t.q_tokens)),
                  ta.q_long,
                  t.q_long) as anchor
           from public.search_query_tokens('p and c') t
           cross join lateral public.search_query_tokens(
             public.search_expand_aliases(t.q)) ta`,
      );
      // "combinations", not "permutations": both are twelve characters, and
      // search_token_anchor breaks ties alphabetically so one query always
      // produces one plan. Either is selective; the point is that neither is
      // "and".
      expect(rows[0].anchor).toBe("combinations");
      expect(rows[0].anchor).not.toBe("and");
    });

    it("keeps the ranking and the cap both matchers' clients depend on", async () => {
      // Re-emitting a body is how features get silently dropped, which is what
      // src/searchFeatureCarryOverSqlContract.test.js exists for. These two are
      // asserted here as well because the failure is invisible at the UI:
      // usePlaylistBrowse reads array position AS relevance, and fetches the
      // whole set in one request on the strength of the cap.
      for (const fn of ["search_video_ids", "search_playlist_ids"]) {
        const { rows } = await pg.query(
          `select pg_get_functiondef(('public.' || $1 || '(text)')::regprocedure) as src`,
          [fn],
        );
        expect(rows[0].src, `${fn} lost its relevance ordering`)
          .toMatch(/order by public\.search_rank_aliased/i);
        expect(rows[0].src, `${fn} lost the 500-id cap`).toMatch(/limit\s+500/i);
        // And the rule it replaced is gone rather than left in front of it,
        // where it would veto every alias anchor.
        expect(rows[0].src, `${fn} still calls search_is_servable`)
          .not.toMatch(/search_is_servable/);
      }
    });
  });
});
