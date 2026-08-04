// The Class 10 English chapter list is the CBSE prescribed list, not whatever a
// publisher happens to have filmed.
//
// Why this test exists: on 2026-08-04 an import created five English chapters
// because a Magnet Brains playlist taught them and the catalogue did not have
// them. Three were not on the CBSE syllabus at all -- The Hundred Dresses I,
// The Hundred Dresses II and The Hack Driver -- and they went live, along with a
// lesson for the deleted poem "Animals". A publisher keeping older material
// online, for state boards or for students on the previous syllabus, is evidence
// about what was filmed and none at all about what is prescribed.
//
// The prescribed list below was read directly from the primary document:
//   https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/English_LL_SecP1_2026-27.pdf
// linked from https://cbseacademic.nic.in/curriculum_2027.html, whose header
// reads "Curriculum for the Academic Year 2026-27". Searching that PDF returns
// zero occurrences of "Hundred Dresses" and zero of "Hack Driver".
//
// docs/sql/english_remove_offsyllabus_chapters_2026-08-04.sql repairs the data.
// This test stops the next import from reintroducing it.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SQL_DIR = "docs/sql";
const SOURCE_URL =
  "https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/English_LL_SecP1_2026-27.pdf";

// CBSE 2026-27, "Prescribed Books" section, verbatim order.
export const FIRST_FLIGHT_PROSE = [
  "A Letter to God", "Nelson Mandela - Long Walk to Freedom", "Stories About Flying",
  "From the Diary of Anne Frank", "Glimpses of India", "Mijbil the Otter",
  "Madam Rides the Bus", "The Sermon at Benares", "The Proposal",
];
export const FIRST_FLIGHT_POEMS = [
  "Dust of Snow", "Fire and Ice", "A Tiger in the Zoo", "How to Tell Wild Animals",
  "The Ball Poem", "Amanda!", "The Trees", "Fog",
  "The Tale of Custard the Dragon", "For Anne Gregory",
];
export const FOOTPRINTS = [
  "A Triumph of Surgery", "The Thief's Story", "The Midnight Visitor",
  "A Question of Trust", "Footprints Without Feet", "The Making of a Scientist",
  "The Necklace", "Bholi", "The Book that Saved the Earth",
];

// Removed by the 2023-24 rationalisation. No migration may create a chapter for
// one of these, and no migration may import a lesson filed under one.
const REMOVED = [
  "The Hundred Dresses", // covers both "- I" and "- II"
  "The Hack Driver",
];

// The migration that caused this, kept here deliberately rather than silently
// skipped. It is already applied to production and is repaired by the revert
// rather than by editing history. Do NOT add to this list to make a new
// migration pass -- check the chapter against the prescribed list instead.
const GRANDFATHERED = new Set(["english_magnet_brains_2026-08-04.sql"]);

const sqlFiles = readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"));
const read = (f) => readFileSync(join(SQL_DIR, f), "utf8");
const createsChapter = (sql) => /insert\s+into\s+public\.chapters\b/i.test(sql);

describe("CBSE prescribed English syllabus", () => {
  it("is 9 prose + 10 poems + 9 Footprints chapters", () => {
    expect(FIRST_FLIGHT_PROSE).toHaveLength(9);
    expect(FIRST_FLIGHT_POEMS).toHaveLength(10);
    expect(FOOTPRINTS).toHaveLength(9);
    // 18 prose chapters is what the catalogue models; poems live inside them.
    expect(FIRST_FLIGHT_PROSE.length + FOOTPRINTS.length).toBe(18);
  });

  it("does not contain the rationalised-out chapters", () => {
    const all = [...FIRST_FLIGHT_PROSE, ...FIRST_FLIGHT_POEMS, ...FOOTPRINTS].join(" | ");
    expect(all).not.toMatch(/Hundred Dresses/i);
    expect(all).not.toMatch(/Hack Driver/i);
    // "Animals" must appear ONLY inside "How to Tell Wild Animals".
    const animalEntries = FIRST_FLIGHT_POEMS.filter((p) => /animals/i.test(p));
    expect(animalEntries).toEqual(["How to Tell Wild Animals"]);
  });
});

describe("no migration may add a chapter CBSE removed", () => {
  const chapterMigrations = sqlFiles.filter((f) => createsChapter(read(f)));

  it("finds the chapter-creating migrations to check", () => {
    // Guards the guard: an empty list would make the check below vacuous.
    expect(chapterMigrations.length).toBeGreaterThan(0);
  });

  it("keeps the grandfathered list honest — the entry really did create a removed chapter", () => {
    for (const file of GRANDFATHERED) {
      const sql = read(file);
      expect(createsChapter(sql)).toBe(true);
      const inserts = (sql.match(/insert\s+into\s+public\.chapters[\s\S]*?;/gi) ?? []).join("\n");
      // If this ever stops inserting a removed chapter, drop it from the list.
      expect(REMOVED.some((gone) => new RegExp(gone, "i").test(inserts))).toBe(true);
    }
  });

  it.each(chapterMigrations.filter((f) => !GRANDFATHERED.has(f)))(
    "%s creates no rationalised-out English chapter", (file) => {
    const sql = read(file);
    // Only the INSERT statements matter -- the revert migration names these
    // chapters throughout its prose and its DELETE, which is the point of it.
    const inserts = sql.match(/insert\s+into\s+public\.chapters[\s\S]*?;/gi) ?? [];
    for (const stmt of inserts) {
      for (const gone of REMOVED) {
        expect(stmt, `${file} inserts a chapter matching "${gone}"`).not.toMatch(
          new RegExp(gone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        );
      }
    }
  });
});

describe("the revert that repairs the live data", () => {
  const revert = read("english_remove_offsyllabus_chapters_2026-08-04.sql");

  it("cites the primary source rather than a summary of it", () => {
    expect(revert).toContain(SOURCE_URL);
    expect(revert).toMatch(/Curriculum for the Academic Year 2026-27/);
  });

  it("removes all three off-syllabus chapters and the deleted poem's lesson", () => {
    expect(revert).toMatch(/delete\s+from\s+public\.chapters/i);
    expect(revert).toMatch(/The Hundred Dresses I/);
    expect(revert).toMatch(/The Hundred Dresses II/);
    expect(revert).toMatch(/The Hack Driver/);
    expect(revert).toContain("0lgsPSZd1RE"); // the "Animals" lesson
  });

  it("refuses to delete lessons it was not written against", () => {
    expect(revert).toMatch(/refusing to delete someone else/i);
  });

  it("asserts the end state equals the prescribed list", () => {
    expect(revert).toMatch(/CBSE does not prescribe/);
    expect(revert).toMatch(/missing prescribed chapter/);
  });
});

describe("the poem assertion no longer requires a deleted poem", () => {
  it("english_poem_searchability checks ten poems, not eleven", () => {
    const sql = read("english_poem_searchability_2026-08-04.sql");
    const block = sql.match(/foreach v_poem in array array\[([\s\S]*?)\]/);
    expect(block).toBeTruthy();
    const names = block[1].match(/'[^']+'/g).map((s) => s.slice(1, -1));
    expect(names).toHaveLength(10);
    // The bare poem "Animals" was rationalised out; requiring a lesson to name
    // it would block the revert.
    expect(names).not.toContain("Animals");
    expect(names).toContain("How to Tell Wild Animals");
  });
});
