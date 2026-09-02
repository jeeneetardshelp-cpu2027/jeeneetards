// Every migration that re-emits a search function must carry FORWARD every
// feature the chain added to that function before it.
//
// WHY THIS EXISTS. These functions are replaced wholesale with CREATE OR
// REPLACE, so a migration written against an older copy of a body silently
// deletes whatever landed in between. It is not a merge — the last file to run
// simply wins. This has nearly shipped three times:
//
//   1. Two agents independently re-emitted universal_search on the same day.
//      The later file (kind words) was written from the pre-alias base and
//      would have dropped the curated shorthand pass, leaving the alias table
//      and its helpers in the database, orphaned and doing nothing.
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
// THREE FUNCTIONS, NOT ONE. universal_search was the first casualty, but it is
// not the only replaceable object the search depends on. `search_video_ids` and
// `search_playlist_ids` are re-emitted by the same alias migration and answer
// /browse rather than the search box, so a re-emission from the baseline would
// break lecture and course search while leaving the search box perfect — the
// failure would look like a /browse bug and be hunted in the wrong file.
//
// `search_video_ids` earned a second guarded feature on 2 Sep 2026: its
// `order by search_rank_aliased(...)` is now the ONLY copy of the lecture
// ranking that reaches the client. The RPC returns no rank column, so
// src/useBrowse.js reconstructs relevance purely from the position of each id
// in the returned array. Drop that ORDER BY and nothing errors anywhere — the
// function still returns the right 500 ids, the client still orders by
// position, and /browse silently goes back to serving database-id order under
// a control that says "Best match".
//
// `search_playlist_ids` earned the same pair later the same day, and they
// matter MORE there: Courses is the DEFAULT tab, so a lost ordering is the
// first thing a searching student meets. Its two markers are guarded
// separately on purpose — a body can keep `search_rank_aliased` in its WHERE
// (marker 1 satisfied, matching unchanged) while dropping it from the ORDER BY
// (marker 2 gone, ranking silently back to whatever ?sort= says), and the LIMIT
// is what lets src/usePlaylistBrowse.js fetch the whole match set in one
// bounded request instead of an unbounded one.
//
// ADDING A FEATURE. If you re-emit one of these functions, add a row to its
// `features` with a marker that appears in YOUR body and the file that
// introduced it. From then on, anyone who re-emits it without carrying your
// feature fails here by name, at author time, instead of silently in
// production.
//
// This is a text contract, deliberately. It cannot prove the SQL behaves — the
// PGlite rehearsals do that by executing it. What it proves is cheaper and
// catches the failure the rehearsals cannot see: that a feature went MISSING
// from an object every one of them shares.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "supabase/migrations";

/** A migration re-emits a function when it declares it. */
const reemitRe = (fn) =>
  new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\b`, "i");

// Markers are chosen to be load-bearing identifiers — not comments — so
// deleting the feature deletes the marker.
const GUARDED = [
  {
    fn: "universal_search",
    // The search box. Three re-emissions so far.
    minReemissions: 3,
    features: [
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
    ],
  },
  {
    fn: "search_video_ids",
    // /browse's Individual Lectures tab.
    minReemissions: 1,
    features: [
      {
        name: "curated shorthand alias pass",
        since: "20260902170000_search_aliases.sql",
        marker: /search_rank_aliased/,
      },
      {
        // The ordering itself, guarded separately from the helper: a body
        // could call search_rank_aliased in its WHERE and drop it from the
        // ORDER BY, keeping the marker above while losing the ranking. This
        // marker matches only an ORDER BY that ranks.
        name: "relevance ordering (src/useBrowse.js reads it as array position)",
        since: "20260902170000_search_aliases.sql",
        marker: /order\s+by\s+public\.search_rank_aliased/i,
      },
    ],
  },
  {
    fn: "search_playlist_ids",
    // /browse's Courses tab — the DEFAULT tab.
    minReemissions: 2,
    features: [
      {
        name: "curated shorthand alias pass",
        since: "20260902170000_search_aliases.sql",
        marker: /search_rank_aliased/,
      },
      {
        // Same shape as search_video_ids' second feature, and for the same
        // reason: this marker matches only an ORDER BY that ranks, so a body
        // that keeps the helper in its WHERE and loses the ordering fails here
        // instead of silently un-ranking the default tab.
        name: "relevance ordering (src/usePlaylistBrowse.js reads it as array position)",
        since: "20260902240000_browse_course_relevance.sql",
        marker: /order\s+by\s+public\.search_rank_aliased/i,
      },
      {
        // The bound the client relies on. usePlaylistBrowse fetches the WHOLE
        // filtered match set in one request so it can re-apply the ranking
        // across pages; without a cap that request is unbounded, and the
        // failure mode is a slow page rather than an error.
        name: "500-id cap the whole-set fetch depends on",
        since: "20260902240000_browse_course_relevance.sql",
        marker: /limit\s+500/i,
      },
    ],
  },
];

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort(); // timestamp-prefixed, so lexical order IS apply order

const bodies = files.map((file) => ({
  file,
  body: readFileSync(join(DIR, file), "utf8"),
}));

describe.each(GUARDED)("$fn feature carry-over", ({ fn, minReemissions, features }) => {
  const REEMIT = reemitRe(fn);
  const reemissions = bodies.filter(({ body }) => REEMIT.test(body));

  // A scan that reads nothing passes everything. Pin what it must find, so a
  // renamed directory or a changed declaration style fails loudly here rather
  // than turning every assertion below into a no-op.
  it("actually finds the migrations that re-emit it", () => {
    expect(reemissions.length).toBeGreaterThanOrEqual(minReemissions);
    for (const { since } of features) {
      expect(files, `${since} is named in FEATURES but not in ${DIR}`).toContain(since);
    }
  });

  // Each marker must be present in the file that introduced it. If it is not,
  // the marker is a typo and every carry-over assertion using it is vacuous.
  it.each(features)("$name is really identifiable in $since", ({ since, marker }) => {
    const body = readFileSync(join(DIR, since), "utf8");
    expect(marker.test(body)).toBe(true);
  });

  // The contract itself.
  it("every re-emission carries every feature introduced before it", () => {
    const missing = [];
    for (const { file, body } of reemissions) {
      for (const feature of features) {
        // Only features that already existed when this file was written.
        if (file < feature.since) continue;
        if (!feature.marker.test(body)) {
          missing.push(
            `${file} re-emits ${fn} without "${feature.name}" ` +
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
    for (const feature of features) {
      expect(
        feature.marker.test(last.body),
        `${last.file} is the last file to re-emit ${fn}, so it is ` +
        `what production ends up with — and it is missing "${feature.name}"`,
      ).toBe(true);
    }
  });
});
