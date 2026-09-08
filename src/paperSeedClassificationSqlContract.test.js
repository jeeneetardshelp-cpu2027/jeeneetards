// A migration that SEEDS previous-year papers must classify them in the same
// file.
//
// WHY THIS EXISTS. On 2 Sep 2026 two migrations were each correct on their own
// and wrong together:
//
//   09:30  20260902093000_study_material_paper_metadata.sql classified every
//          previous_year_paper row then present — 183 of them — and its own
//          self-verification asserted zero unclassified. True when it ran.
//   12:25  20260902122500_neet_ug_2025_papers.sql inserted four NEET UG 2025
//          rows, setting exam_year but neither paper_year nor paper_kind.
//
// Three hours apart, so the backfill could not have seen them. The result sat
// on production for six days: 184 of 188 rows classified, while supabase's
// README said zero unclassified, because "every paper is classified" had been
// established once as a fact about a MOMENT and nothing carried it forward.
//
// Nothing failed. The page still grouped the 2025 papers correctly, because
// the client falls back to reading the year out of the title — so the only
// symptom was a column quietly holding null, which is the kind of defect that
// survives precisely because it looks like nothing.
//
// 20260908110000_classify_neet_2025_papers.sql fixed the four rows and asserts
// the general property inside its own transaction. But a POSTFLIGHT only binds
// the migration that carries it: the next seed to land after it can repeat the
// whole thing. This file is the part that carries forward — it reads the
// migrations as text and asks of every paper-inserting file whether it also
// sets the columns those rows need.
//
// It is a text contract, deliberately, and it cannot prove the data is right;
// the migration's postflight does that by querying. What it proves is cheaper
// and catches the failure the postflight cannot see: a NEW file that inserts
// papers without classifying them.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort(); // timestamp-prefixed, so lexical order IS apply order

/** Comments quote column names while explaining them; only code counts. */
const stripComments = (sql) =>
  sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

/**
 * Files that INSERT previous-year papers, as opposed to the ones that merely
 * mention the type in prose or update existing rows.
 */
const paperSeeds = files
  .map((file) => ({ file, sql: stripComments(readFileSync(join(DIR, file), "utf8")) }))
  .filter(({ sql }) =>
    /insert\s+into\s+public\.study_materials/i.test(sql)
    && /'previous_year_paper'/.test(sql));

/**
 * The one file that predates this rule, grandfathered BY NAME rather than by a
 * pattern that would quietly excuse the next one too.
 *
 * It is applied to production and cannot be edited — rewriting an applied
 * migration is how the chain and the database stop agreeing. Its rows were
 * repaired by 20260908110000_classify_neet_2025_papers.sql instead, and the
 * last test in this file asserts that repair is still in the chain, so a
 * database rebuilt from these migrations ends up classified either way.
 */
const GRANDFATHERED = "20260902122500_neet_ug_2025_papers.sql";
const seedsUnderRule = paperSeeds.filter(({ file }) => file !== GRANDFATHERED);

describe("a migration that seeds previous-year papers classifies them too", () => {
  // A scan that finds nothing passes everything. Pin that it reads something,
  // so a renamed directory or a changed insert style fails loudly here instead
  // of turning the assertion below into a no-op.
  it("actually finds the paper seeds", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(
      paperSeeds.length,
      `no migration in ${DIR} appears to insert previous_year_paper rows — has the `
        + "insert style or the table changed? This test is vacuous until it finds one.",
    ).toBeGreaterThan(0);
  });

  it.each(seedsUnderRule.map(({ file }) => file))(
    "%s sets paper_year and paper_kind on the rows it inserts",
    (file) => {
      const sql = stripComments(readFileSync(join(DIR, file), "utf8"));

      // The 2 Sep seed set exam_year and stopped there. exam_year is the older
      // column and the client no longer reads it for grouping, so setting it
      // alone leaves a row that looks seeded and is not classified.
      for (const column of ["paper_year", "paper_kind"]) {
        expect(
          sql.includes(column),
          `${file} inserts previous_year_paper rows but never mentions ${column}. `
            + "A seed that lands after the classification backfill will not be picked up by "
            + "it — that is exactly how ids 414-417 sat unclassified from 2 to 8 Sep 2026, "
            + "with no error and no visible symptom. Set both columns in the insert, and "
            + "assert zero unclassified rows in the file's own postflight.",
        ).toBe(true);
      }
    },
  );

  // The historical one. It is applied and cannot be edited, so it is named here
  // rather than allowed to fail: the record of what went wrong belongs with the
  // rule that came from it.
  it("records the seed that predates this rule", () => {
    const offender = GRANDFATHERED;
    if (!files.includes(offender)) return; // removed from the chain; nothing to record

    const sql = stripComments(readFileSync(join(DIR, offender), "utf8"));
    const classifiesItself = ["paper_year", "paper_kind"].every((c) => sql.includes(c));
    expect(
      classifiesItself,
      `${offender} now classifies its own rows, so it no longer needs to be the exception `
        + "this test carves out — delete this case.",
    ).toBe(false);

    // And the fix for it must still be in the chain.
    expect(
      files.some((f) => /classify_neet_2025_papers/.test(f)),
      "the migration that classified ids 414-417 is gone from the chain, so those rows "
        + "are unclassified again on any database rebuilt from it",
    ).toBe(true);
  });
});
