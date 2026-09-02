// paperMetadataSqlRehearsal.test.js
//
// WHAT IS REAL HERE. These tests EXECUTE the migration
// supabase/migrations/20260902093000_study_material_paper_metadata.sql on a
// real PostgreSQL engine (PGlite, Postgres compiled to WASM), against
// study_materials created from the production baseline's own CREATE TABLE
// text — CHECK constraints included. The migration's preflight, backfill,
// constraints and self-verification DO block all actually run.
//
// THE CONTRACT UNDER TEST: the SQL backfill and the client's
// parsePaperTitle (src/studyMaterialLandings.js) implement ONE title
// grammar. Every sample title below — the live-verified production shapes —
// must classify identically in both. The migration was APPLIED to production
// and the client flipped to the real columns on 2026-09-02
// (src/useJeeMainPapers.js selects them; paperMetadata prefers them), so
// this contract now keeps the grammar honest for FUTURE seeds — a new
// title must land in the same columns the pages trust — and for the title
// fallback that still classifies rows lacking the columns.
//
// WHAT IS NOT REAL. Production's 171 rows are not here; a handful of
// representative titles are. The migration itself guards the full set: its
// self-test aborts the push if any real row comes out unclassified.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { parsePaperTitle } from "./studyMaterialLandings.js";

const BASELINE = "supabase/migrations/20260831140005_production_baseline.sql";
const MIGRATION = "supabase/migrations/20260902093000_study_material_paper_metadata.sql";

const baseline = readFileSync(BASELINE, "utf8");
const migration = readFileSync(MIGRATION, "utf8");

/** Pull one CREATE TABLE statement out of the baseline dump. */
function baselineTable(name) {
  const head = `CREATE TABLE IF NOT EXISTS "public"."${name}" (`;
  const start = baseline.indexOf(head);
  expect(start, `baseline has no table ${name}`).toBeGreaterThan(-1);
  const end = baseline.indexOf("\n);", start);
  return `${baseline.slice(start, end)}\n);`;
}

// The live-verified production title shapes, one per grammar variant:
// modern JEE Main papers (session + shift), result-stage and provisional
// answer keys, pre-session JEE Main, JEE Advanced Paper 1/2, both NEET UG
// releases, and NSEP's season-titled solved papers.
const PAPER_TITLES = [
  "JEE Main 2024 Session 2 - 4 April Shift 1 (English & Hindi)",
  "JEE Main 2024 Session 1 - 27 January Shift 2 (English & Hindi)",
  "JEE Main 2021 Session 4 Final Answer Key (Paper 1 B.E./B.Tech)",
  "JEE Main 2022 Session 1 Provisional Final Answer Key (Paper 1 B.E./B.Tech)",
  "JEE Main 2015 - 4 April Offline Set A (English and Hindi)",
  "JEE Advanced 2013 Paper 1 (English + Hindi)",
  "JEE Advanced 2007 Paper 2 (English + Hindi)",
  "NEET UG 2024 - Set T1 (English)",
  "NEET UG 2026 Re-Examination - Set 50 (English)",
  "NSEP 2024-25 Physics Paper with Solutions",
  "NSEP 2017-18 Physics Paper with Solutions",
];

let pg;

async function bootDatabase() {
  const db = new PGlite();
  await db.exec(baselineTable("study_materials"));
  return db;
}

async function seedPapers(db, titles, { startId = 1 } = {}) {
  for (const [index, title] of titles.entries()) {
    await db.query(
      `insert into public.study_materials
         (id, title, material_type, source_name, source_url, rights_status,
          review_status, published_at, exam_year)
       values ($1, $2, 'previous_year_paper', 'Recorded source',
               $3, 'official_source', 'approved', now(), null)`,
      [startId + index, title, `https://example.test/${startId + index}`],
    );
  }
}

beforeAll(async () => {
  pg = await bootDatabase();
  await seedPapers(pg, PAPER_TITLES);
  // A non-paper row: the backfill must leave it alone.
  await pg.query(
    `insert into public.study_materials
       (id, title, material_type, source_name, source_url, rights_status,
        review_status, published_at)
     values (900, 'Kinematics Formula Sheet 2024', 'formula_sheet',
             'Competishun', 'https://example.test/sheet', 'creator_permission',
             'approved', now())`,
  );
  // The migration's own DO blocks abort the transaction if anything is
  // wrong, so simply getting past this line is the first assertion.
  await pg.exec(migration);
}, 120_000);

describe("the staged paper-metadata migration", () => {
  // The migration is applied history now (2026-09-02): its file text — the
  // staging note included — must stay byte-stable, or the local migrations
  // directory would diff against what production already ran.
  it("keeps its recorded staging, rollback and push documentation intact", () => {
    expect(migration).toContain("STAGED, NOT APPLIED");
    expect(migration).toContain("npx supabase db push");
    expect(migration).toContain("ROLLBACK");
    expect(migration).toContain("drop column if exists paper_kind");
  });

  it("classifies every sample title exactly as the client's parsePaperTitle does", async () => {
    for (const title of PAPER_TITLES) {
      const { rows } = await pg.query(
        `select paper_kind, paper_year, exam_session, exam_shift
           from public.study_materials where title = $1`,
        [title],
      );
      expect(rows, title).toHaveLength(1);
      const expected = parsePaperTitle(title);
      expect(
        {
          kind: rows[0].paper_kind,
          year: rows[0].paper_year,
          session: rows[0].exam_session,
          shift: rows[0].exam_shift,
        },
        title,
      ).toEqual({
        kind: expected.kind,
        year: expected.year,
        session: expected.session,
        shift: expected.shift,
      });
    }
  });

  it("leaves non-paper rows with NULL paper metadata", async () => {
    const { rows } = await pg.query(
      `select paper_kind, paper_year, exam_session, exam_shift
         from public.study_materials where id = 900`,
    );
    expect(rows[0]).toEqual({
      paper_kind: null, paper_year: null, exam_session: null, exam_shift: null,
    });
  });

  it("adds the CHECK constraints that keep the columns trustworthy", async () => {
    const { rows } = await pg.query(`
      select conname from pg_constraint
       where conrelid = 'public.study_materials'::regclass
       order by conname
    `);
    const names = rows.map((row) => row.conname);
    for (const name of [
      "study_materials_paper_kind_check",
      "study_materials_paper_year_check",
      "study_materials_exam_session_check",
      "study_materials_exam_shift_check",
      "study_materials_paper_metadata_scope",
    ]) {
      expect(names).toContain(name);
    }
    // The scope constraint actually bites: a notes row must refuse a kind.
    await expect(pg.query(
      `update public.study_materials set paper_kind = 'question_paper' where id = 900`,
    )).rejects.toThrow(/paper_metadata_scope/);
  });

  it("is re-runnable, because a re-push must not fail", async () => {
    await expect(pg.exec(migration)).resolves.toBeTruthy();
  });

  // The whole reason the self-test exists: a paper title outside the known
  // grammar must ABORT the push (rolling everything back), never silently
  // drop that paper off every year page.
  it("aborts, rolling back, when a paper title has no recognisable year", async () => {
    const fresh = await bootDatabase();
    await seedPapers(fresh, [
      "JEE Main 2024 Session 1 - 27 January Shift 1 (English & Hindi)",
      "Some Old Board Paper With No Year Named",
    ]);
    await expect(fresh.exec(migration)).rejects.toThrow(/no paper_kind or paper_year/);
    // The failed script leaves the session inside its aborted transaction;
    // end it so the state can be inspected. Nothing in it was committed.
    await fresh.exec("rollback;");
    // The failed transaction rolled back: the columns are gone again.
    const { rows } = await fresh.query(`
      select count(*)::int as n from information_schema.columns
       where table_schema = 'public' and table_name = 'study_materials'
         and column_name in ('paper_kind', 'paper_year', 'exam_session', 'exam_shift')
    `);
    expect(rows[0].n).toBe(0);
    await fresh.close();
  });
});
