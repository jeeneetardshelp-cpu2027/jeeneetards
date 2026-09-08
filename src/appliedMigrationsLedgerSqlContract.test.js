// Once a migration has run on production, its file may never leave the chain.
//
// WHY THIS EXISTS, and why it is a separate thing from
// src/scripts/verifyMigrationStatus.js.
//
// That script already compares supabase/README.md's status column against the
// real database, and it is thorough -- it catches a row that lies about being
// applied, a row for a file that is not in the chain, a file with no row, and a
// version the database has run whose file is gone. It would have caught both of
// 7 Sep 2026's failures outright.
//
// Nothing ran it. On 7 Sep a session deleted
// 20260907170000_universal_search_anchor_floor.sql, its commit stating the file
// "is unapplied, so this removes it from the chain rather than reversing
// anything on production". It was applied -- the database still answers
// search_min_anchor_len() -> 3 -- so the delete removed the RECORD and left the
// change. The same commit removed the README row, so every offline check stayed
// green, CI passed, and it merged. It surfaced hours later only because
// `db push` refuses to run against a remote version it cannot find locally, and
// by then the chain had stopped reproducing production.
//
// The script cannot run in CI: it needs the Supabase link and the network. So
// the database's answer is written down when the script DOES run --
// supabase/applied_versions.json -- and this test enforces it offline, on every
// commit, with no credentials.
//
// THE LEDGER IS NOT A CLAIM, IT IS A RECORD. Every entry was observed in
// `supabase migration list` against production. That is the whole reason it may
// be trusted offline, and the whole reason it must never be hand-edited to make
// this test pass: doing that forges an observation. If an entry is genuinely
// wrong, re-run `npm run verify:migration-status`, which rewrites it from the
// database.
//
// Reverting an applied migration needs a NEW migration that undoes it. There is
// no unmerge for a database, and deleting the file is not one.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseStatusRows } from "./scripts/migrationStatusRows.js";

const ROOT = resolve(import.meta.dirname, "..");
const LEDGER = resolve(ROOT, "supabase/applied_versions.json");
const README = resolve(ROOT, "supabase/README.md");
const CHAIN = resolve(ROOT, "supabase/migrations");

const ledger = JSON.parse(readFileSync(LEDGER, "utf8"));
const rows = parseStatusRows(readFileSync(README, "utf8"));
const rowByVersion = new Map(rows.map((r) => [r.version, r]));

describe("every migration production has run is still in the chain", () => {
  it("has a ledger with entries, so an empty file cannot pass vacuously", () => {
    // A checker that reads "no signal" as "green" is a mistake this repo has
    // already made. An empty or malformed ledger fails here rather than
    // silently satisfying every assertion below.
    expect(Array.isArray(ledger.versions)).toBe(true);
    expect(ledger.versions.length).toBeGreaterThan(0);
    for (const entry of ledger.versions) {
      expect(entry.version, `${JSON.stringify(entry)} has no version`).toMatch(/^[0-9]{14}$/);
    }
  });

  it.each(ledger.versions.map((v) => [v.version, v.file]))(
    "%s still has its file in supabase/migrations/",
    (version, file) => {
      // The 7 Sep failure, caught offline. `file` is recorded alongside the
      // version so the message can name what went missing.
      expect(file, `ledger entry ${version} recorded no filename`).toBeTruthy();
      expect(
        existsSync(resolve(CHAIN, file)),
        `${file} ran on production but is no longer in supabase/migrations/. ` +
          "Deleting it does not reverse it -- the database still has the change, " +
          "and the chain no longer reproduces production. To take it out of " +
          "production, write a NEW migration that undoes it.",
      ).toBe(true);
    },
  );

  it.each(ledger.versions.map((v) => [v.version, v.file]))(
    "%s is still described by a README row that says applied",
    (version, file) => {
      const row = rowByVersion.get(version);
      expect(
        row,
        `${file} ran on production but supabase/README.md has no row for it`,
      ).toBeTruthy();
      // Not just "has a row": a row that went back to claiming pending is how
      // this table has been wrong four times.
      expect(
        row.claimed,
        `${file} ran on production but its README row (line ${row?.line}) says ` +
          `${row?.claimed ?? "nothing readable"}`,
      ).toBe("applied");
    },
  );

  it("does not record a version that has no migration file at all", () => {
    // Guards the ledger writer as well as the chain: an entry whose file was
    // never resolved would make the per-entry checks above untestable.
    const unresolved = ledger.versions.filter((v) => !v.file);
    expect(unresolved, `ledger entries with no filename: ${JSON.stringify(unresolved)}`).toEqual([]);
  });
});
