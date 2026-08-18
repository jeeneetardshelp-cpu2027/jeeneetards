// Any migration that creates a School Boards course must also give it a board.
//
// Why this test exists: on 2026-08-04 an import of 29 Class 10 English lessons
// landed two courses with no row in playlist_boards. src/usePlaylistBrowse.js
// scopes Browse by board with an INNER join, and the School Boards journey
// always carries a board, so both courses were unreachable through Browse from
// the moment they shipped. Five newly created chapters dead-ended at zero
// courses while the board-blind chapter picker advertised "1 course" for each.
//
// The sanctioned importer already forbids this -- import_playlist_v4.sql refuses
// a school-goal payload with no board_id. Hand-written docs/sql migrations do
// not run through validate_import_payload, so they bypass the rule. This test is
// that rule, applied to the hand-written path.
//
// docs/sql/backfill_playlist_boards_2026-08-04.sql repairs the data.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SQL_DIR = "docs/sql";

// Already applied to production and repaired by the backfill rather than by
// editing history. Do NOT add to this list to make a new migration pass -- add
// the playlist_boards insert to the migration instead.
const GRANDFATHERED = new Set([
  "social_science_chapter_gaps_2026-08-02.sql",
  "english_magnet_brains_2026-08-04.sql",
]);

const insertsInto = (sql, table) =>
  new RegExp(`insert\\s+into\\s+public\\.${table}\\b`, "i").test(sql);

// A migration "creates a School Boards course" when it inserts a playlist and
// tags it with the school learning goal. Matching on the goal rather than on the
// word "school" keeps JEE/NEET imports out: those must NOT have a board row, and
// import_playlist_v4.sql rejects them if they do.
const createsSchoolCourse = (sql) =>
  insertsInto(sql, "playlists") && /slug\s*=\s*'school'/i.test(sql);

const sqlFiles = readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"));
const read = (file) => readFileSync(join(SQL_DIR, file), "utf8");

describe("every School Boards course import gives its course a board", () => {
  const schoolImporters = sqlFiles.filter((file) => createsSchoolCourse(read(file)));

  it("finds the School Boards migrations to check", () => {
    // Guards the guard: if the detection ever stops matching, the test below
    // would vacuously pass over an empty list.
    expect(schoolImporters.length).toBeGreaterThan(0);
  });

  it.each(schoolImporters.filter((f) => !GRANDFATHERED.has(f)))(
    "%s also populates playlist_boards",
    (file) => {
      expect(insertsInto(read(file), "playlist_boards")).toBe(true);
    },
  );

  it("keeps the grandfathered list honest — every entry really is a school import that really is missing a board", () => {
    for (const file of GRANDFATHERED) {
      const sql = read(file);
      expect(createsSchoolCourse(sql)).toBe(true);
      // If one of these ever gains the insert, drop it from the list.
      expect(insertsInto(sql, "playlist_boards")).toBe(false);
    }
  });

  it("ships the backfill that repairs the courses those migrations left behind", () => {
    const backfill = read("backfill_playlist_boards_2026-08-04.sql");
    expect(insertsInto(backfill, "playlist_boards")).toBe(true);
    // It must only ever touch School Boards courses...
    expect(backfill).toMatch(/lg\.slug = 'school'/);
    // ...refuse to leave one behind...
    expect(backfill).toMatch(/still have no board row/);
    // ...refuse to tag anything that is not a School Boards course...
    expect(backfill).toMatch(/without the School Boards goal/);
    // ...and refuse to bulk-tag beyond the courses it was written for.
    expect(backfill).toMatch(/refusing to bulk-tag/);
  });
});

describe("why a missing board row hides a course", () => {
  it("Browse still scopes by board with an inner join", () => {
    const src = readFileSync("src/usePlaylistBrowse.js", "utf8");
    // If this ever becomes a left join, a course with no board row stops
    // disappearing and the urgency above drops. Until then, an untagged School
    // Boards course is an invisible one.
    expect(src).toContain("playlist_boards!inner");
    expect(src).toContain('q.eq("playlist_boards.board_id", boardId)');
  });

  it("the sanctioned importer still refuses school content with no board", () => {
    // This test exists because hand-written SQL bypasses that rule. If the rule
    // itself were ever dropped, the bypass would stop being the interesting part
    // and this whole file would need rethinking.
    const rpc = readFileSync("src/migrations/import_playlist_v4.sql", "utf8");
    expect(rpc).toMatch(/school-board content requires at least one board_id/);
  });
});
