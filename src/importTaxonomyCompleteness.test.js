// Any migration that inserts lessons must also file them under a learning goal
// and a class level.
//
// Why this test exists: on 2026-08-03 a live check found 670 of 3,088 lessons
// (21.7%) had no row in video_learning_goals. src/useScopedSearch.js joins that
// junction with `!inner`, so those lessons could never appear in a goal-scoped
// search -- including one titled "The Living World Class 11 Biology NEET
// Concepts (L 1)", invisible to a student searching NEET Biology. The cause was
// three import migrations that populated the COURSE-level junctions and stopped
// there. Nothing failed; the lessons just quietly did not exist for search.
//
// docs/sql/backfill_video_taxonomy_junctions_2026-08-03.sql repairs the data.
// This test stops the next import from reintroducing it.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SQL_DIR = "docs/sql";

// The migrations that caused the gap, kept here deliberately rather than
// silently skipped. Do NOT add to this list to make a new import pass -- add the
// two junction inserts to the import instead.
// All of these have ALREADY been applied to production, so their lessons are
// repaired by the backfill rather than by editing history. The one pending file
// this test caught -- social_science_chapter_gaps_2026-08-02.sql, which had not
// been run yet -- was FIXED instead of grandfathered, so it lands correct.
const GRANDFATHERED = new Set([
  "catalogue_depth_2026-07-30.sql",
  "add_kinetic_theory_chapter_2026-07-30.sql",
  "thin_chapter_depth_2026-07-31.sql",
  ...Array.from({ length: 5 }, (_, i) => `biology_class11_aakash_neet_part${i + 1}_2026-07-31.sql`),
  ...Array.from({ length: 5 }, (_, i) => `biology_class11_allen_neet_part${i + 1}_2026-07-31.sql`),
]);

const insertsInto = (sql, table) =>
  new RegExp(`insert\\s+into\\s+public\\.${table}\\b`, "i").test(sql);

const sqlFiles = readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"));

describe("every lesson import files its lessons under a goal and a class level", () => {
  const importers = sqlFiles.filter((file) =>
    insertsInto(readFileSync(join(SQL_DIR, file), "utf8"), "videos"));

  it("finds the lesson-importing migrations to check", () => {
    // Guards the guard: if the detection regex ever stops matching, this test
    // would vacuously pass over an empty list.
    expect(importers.length).toBeGreaterThan(5);
  });

  it.each(importers.filter((f) => !GRANDFATHERED.has(f)))(
    "%s also populates video_learning_goals and video_class_levels",
    (file) => {
      const sql = readFileSync(join(SQL_DIR, file), "utf8");
      expect(insertsInto(sql, "video_learning_goals")).toBe(true);
      expect(insertsInto(sql, "video_class_levels")).toBe(true);
    },
  );

  it("keeps the grandfathered list honest — every entry really is a lesson import that really is missing them", () => {
    for (const file of GRANDFATHERED) {
      const sql = readFileSync(join(SQL_DIR, file), "utf8");
      expect(insertsInto(sql, "videos")).toBe(true);
      // If one of these ever gains the junction inserts, drop it from the list.
      expect(
        insertsInto(sql, "video_learning_goals") && insertsInto(sql, "video_class_levels"),
      ).toBe(false);
    }
  });

  it("ships the backfill that repairs the lessons those migrations left behind", () => {
    const backfill = readFileSync(
      join(SQL_DIR, "backfill_video_taxonomy_junctions_2026-08-03.sql"), "utf8");
    expect(insertsInto(backfill, "video_learning_goals")).toBe(true);
    expect(insertsInto(backfill, "video_class_levels")).toBe(true);
    // It must derive from course membership, never invent a value.
    expect(backfill).toMatch(/from public\.playlist_videos pv/);
    expect(backfill).toMatch(/join public\.playlist_learning_goals plg/);
    expect(backfill).toMatch(/join public\.playlist_class_levels pcl/);
    // ...and it must refuse to leave a lesson behind.
    expect(backfill).toMatch(/backfill incomplete/);
  });
});

describe("goal-scoped search is the reason this matters", () => {
  it("still uses an inner join on video_learning_goals", () => {
    const src = readFileSync("src/useScopedSearch.js", "utf8");
    // If this ever becomes a left join, a missing junction row stops hiding
    // lessons and the urgency of the test above drops -- but until then, an
    // unfiled lesson is an invisible lesson.
    expect(src).toContain("video_learning_goals!inner");
  });
});
