// Every migration that re-emits universal_search must carry FORWARD every
// feature the chain added before it.
//
// WHY THIS EXISTS. `universal_search` is replaced wholesale with CREATE OR
// REPLACE, so a migration written against an older copy of the body silently
// deletes whatever landed in between. It is not a merge — the last file to run
// simply wins. This has nearly shipped three times:
//
//   1. Two agents independently re-emitted the function on the same day. The
//      later file (kind words) was written from the pre-alias base and would
//      have dropped the curated shorthand pass, leaving the alias table and its
//      helpers in the database, orphaned and doing nothing.
//   2. Both files' own self-verification DO blocks would have PASSED, because
//      each one only checks its own feature, inside its own transaction.
//   3. The rehearsal suites would have passed too, because each set up only its
//      own migration on a clean baseline. Nothing looked at the composed end
//      state, which is the only state production ever has.
//
// So the per-migration self-tests and the per-migration rehearsals are both
// structurally blind to this class of bug. This file is the check that is not:
// it reads the migrations as text and asks, of every re-emission, whether it
// still contains the markers of everything that came before it.
//
// ADDING A FEATURE. If you re-emit universal_search, add a row to FEATURES with
// a marker that appears in YOUR body and the file that introduced it. From then
// on, anyone who re-emits the function without carrying your feature fails here
// by name, at author time, instead of silently in production.
//
// This is a text contract, deliberately. It cannot prove the SQL behaves — the
// PGlite rehearsals do that by executing it. What it proves is cheaper and
// catches the failure the rehearsals cannot see: that a feature went MISSING
// from the one object every one of them shares.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";

/** A migration re-emits the function when it declares it. */
const REEMIT = /create\s+or\s+replace\s+function\s+public\.universal_search/i;

// Each feature: a marker that must survive into every LATER re-emission, and
// the migration that introduced it. Markers are chosen to be load-bearing
// identifiers — not comments — so deleting the feature deletes the marker.
const FEATURES = [
  {
    name: "material and paper pillars",
    since: "20260901160000_universal_search_materials.sql",
    // The group_key the materials pillar returns.
    marker: /'material'/,
  },
  {
    name: "curated shorthand alias pass",
    since: "20260902170000_search_aliases.sql",
    // The ranking helper the second pass calls.
    marker: /search_rank_aliased/,
  },
  {
    name: "material kind-word haystack",
    since: "20260902180000_universal_search_material_words.sql",
    // The helper that widens the haystack in rank AND prefilter.
    marker: /study_material_haystack/,
  },
];

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort(); // timestamp-prefixed, so lexical order IS apply order

const reemissions = files
  .map((file) => ({ file, body: readFileSync(join(DIR, file), "utf8") }))
  .filter(({ body }) => REEMIT.test(body));

describe("universal_search feature carry-over", () => {
  // A scan that reads nothing passes everything. Pin what it must find, so a
  // renamed directory or a changed declaration style fails loudly here rather
  // than turning every assertion below into a no-op.
  it("actually finds the migrations that re-emit universal_search", () => {
    expect(reemissions.length).toBeGreaterThanOrEqual(3);
    for (const { since } of FEATURES) {
      expect(files, `${since} is named in FEATURES but not in ${DIR}`).toContain(since);
    }
  });

  // Each marker must be present in the file that introduced it. If it is not,
  // the marker is a typo and every carry-over assertion using it is vacuous.
  it.each(FEATURES)("$name is really identifiable in $since", ({ since, marker }) => {
    const body = readFileSync(join(DIR, since), "utf8");
    expect(marker.test(body)).toBe(true);
  });

  // The contract itself.
  it("every re-emission carries every feature introduced before it", () => {
    const missing = [];
    for (const { file, body } of reemissions) {
      for (const feature of FEATURES) {
        // Only features that already existed when this file was written.
        if (file < feature.since) continue;
        if (!feature.marker.test(body)) {
          missing.push(
            `${file} re-emits universal_search without "${feature.name}" ` +
            `(introduced by ${feature.since}). Re-emitting from an older copy ` +
            `of the body DELETES that feature — rebuild your body from the ` +
            `most recent re-emission, not from the baseline.`,
          );
        }
      }
    }
    expect(missing).toEqual([]);
  });

  // The end state is what production runs, so say it plainly: the final
  // re-emission has to hold everything.
  it("the last re-emission holds every feature", () => {
    const last = reemissions[reemissions.length - 1];
    for (const feature of FEATURES) {
      expect(
        feature.marker.test(last.body),
        `${last.file} is the last file to re-emit universal_search, so it is ` +
        `what production ends up with — and it is missing "${feature.name}"`,
      ).toBe(true);
    }
  });
});
