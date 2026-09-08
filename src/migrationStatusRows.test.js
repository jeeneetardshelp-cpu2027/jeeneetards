// The status column of supabase/README.md, checked as data rather than read as
// prose. On 7 Sep 2026 that table carried five false status claims in one day —
// two of them inside commits written to correct earlier false claims — and CI
// stayed green through all of them, because a sentence is not executable.
//
// These tests cover the pure logic. The database half lives in
// src/scripts/verifyMigrationStatus.js (`npm run verify:migration-status`),
// which needs production and so cannot run here.
import { describe, expect, it } from "vitest";
import { claimedStatus, parseStatusRows, compareStatus } from "./scripts/migrationStatusRows.js";

const row = (file, cell) => `| \`${file}\` | ${cell} |`;

describe("reading what a README row claims", () => {
  it("reads a plain applied row", () => {
    expect(claimedStatus("**Applied** 7 Sep 2026 — confirmed by `migration list`.")).toBe("applied");
  });

  it("reads a staged row", () => {
    expect(claimedStatus("**Staged, NOT applied.** Puts a floor under q_long.")).toBe("pending");
  });

  // The trap that a looser rule falls into. A row correcting its own date reads
  // "**Applied 7 Sep 2026**, NOT 4 Sep" — a substring search for "NOT applied"
  // is fine here, but one for "NOT" is not, and the real profiles row is
  // exactly this shape. Keyed to the FIRST bold span for that reason.
  it("does not mistake an applied row that corrects its own date for a pending one", () => {
    expect(claimedStatus("**Applied 7 Sep 2026**, NOT 4 Sep — the version slot is backdated.")).toBe("applied");
  });

  it("returns null when no status is readable, rather than guessing", () => {
    expect(claimedStatus("Reduces `search_is_servable` to `length(q_long) >= 3`.")).toBeNull();
    expect(claimedStatus("")).toBeNull();
  });

  it("finds every migration row in a table and ignores surrounding prose", () => {
    const md = [
      "# Migrations", "", "| file | status |", "| --- | --- |",
      row("20260831140005_production_baseline.sql", "**Applied** 31 Aug 2026."),
      row("20260907160000_browse_servable_floor_correction.sql", "**Staged, NOT applied.** Reduces the floor."),
      "", "> A blockquote mentioning `20260902170000_search_aliases.sql` in passing.",
    ].join("\n");
    const rows = parseStatusRows(md);
    expect(rows.map((r) => r.version)).toEqual(["20260831140005", "20260907160000"]);
    expect(rows.map((r) => r.claimed)).toEqual(["applied", "pending"]);
  });
});

describe("comparing the table against the database", () => {
  const CHAIN = ["20260831140005", "20260907160000"];
  const applied = (...v) => v;

  it("passes when every row matches", () => {
    const rows = parseStatusRows([
      row("20260831140005_production_baseline.sql", "**Applied** 31 Aug 2026."),
      row("20260907160000_browse_servable_floor_correction.sql", "**Applied** 7 Sep 2026."),
    ].join("\n"));
    expect(compareStatus({ rows, appliedVersions: applied(...CHAIN), chainVersions: CHAIN })).toEqual([]);
  });

  // The actual 7 Sep defect, three times over.
  it("catches a row that says pending when the database has it", () => {
    const rows = parseStatusRows(row("20260907160000_browse_servable_floor_correction.sql", "**Staged, NOT applied.**"));
    // Scoped to the one version, so the only possible problem is the status
    // mismatch and not an unrelated undocumented row.
    const problems = compareStatus({
      rows, appliedVersions: ["20260907160000"], chainVersions: ["20260907160000"],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("says pending; it is applied");
  });

  it("catches a row that says applied when it is still pending", () => {
    const rows = parseStatusRows(row("20260907160000_browse_servable_floor_correction.sql", "**Applied** 7 Sep 2026."));
    const problems = compareStatus({ rows, appliedVersions: ["20260831140005"], chainVersions: CHAIN });
    expect(problems[0]).toContain("says applied; it is pending");
  });

  // An unreadable claim is not a passing one. A checker in this repo already
  // treated "no signal" as "green" and reported a defect-free run.
  it("treats an unreadable status as a problem, not a pass", () => {
    const rows = parseStatusRows(row("20260907160000_browse_servable_floor_correction.sql", "Reduces the floor to three."));
    const problems = compareStatus({ rows, appliedVersions: applied(...CHAIN), chainVersions: CHAIN });
    expect(problems[0]).toContain("states no readable status");
  });

  it("catches a migration in the chain that no row documents", () => {
    const rows = parseStatusRows(row("20260831140005_production_baseline.sql", "**Applied** 31 Aug 2026."));
    const problems = compareStatus({ rows, appliedVersions: applied(...CHAIN), chainVersions: CHAIN });
    expect(problems.some((p) => p.includes("20260907160000 is in the chain but has no README row"))).toBe(true);
  });

  // The live one, 7 Sep 2026: the anchor floor was pushed, then reverted out of
  // the repo, so production runs SQL the chain cannot reproduce. A checker that
  // only walks supabase/migrations/ cannot see this — there is nothing to walk.
  it("catches a migration the database has applied but the repo no longer contains", () => {
    const rows = parseStatusRows([
      row("20260831140005_production_baseline.sql", "**Applied** 31 Aug 2026."),
      row("20260907160000_browse_servable_floor_correction.sql", "**Applied** 7 Sep 2026."),
    ].join("\n"));
    const problems = compareStatus({
      rows, appliedVersions: [...CHAIN, "20260907170000"], chainVersions: CHAIN,
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("20260907170000 is applied to the database but has NO file");
    expect(problems[0]).toContain("no longer reproduces production");
  });
});
