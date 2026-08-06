import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const report = readFileSync(
  "docs/unacademy-neet-fourteenth-batch-production-2026-08-06.md",
  "utf8",
);

describe("Unacademy NEET fourteenth-batch production report", () => {
  it("records the refreshed owner decision and exact course deltas", () => {
    expect(report).toContain("b98191cb-c0be-4d3c-9e15-95905da4fffc");
    expect(report).toContain("| 1 | Friction | 420 | +4 | +4 | 0 | 0 |");
    expect(report).toContain("| 2 | Cell: The Unit of Life | 421 | +4 | +4 | 0 | 0 |");
    expect(report).toContain("| 3 | Anatomy of Flowering Plants | 422 | +6 | +6 | 0 | 0 |");
    expect(report).toContain("+3 playlists / +14 videos / +14 memberships / 0 chapters");
  });

  it("pins final catalogue totals and both JEE integrity boundaries", () => {
    for (const total of ["403 playlists", "4,655 videos", "4,661 playlist-video memberships", "263 chapters"]) {
      expect(report).toContain(total);
    }
    expect(report).toContain("82 courses / 1,304");
    expect(report).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(report).toContain("212 courses / 2,848 memberships");
    expect(report).toContain("9eea2b44f0b19c08cc0907c57e091342");
  });

  it("records the source refresh and keeps later transitions gated", () => {
    expect(report).toContain("24c74a76-22fa-4bcc-8d31-5fbd688a9045");
    expect(report).toContain("excluded only the\ncurrent Quiz 2 row");
    expect(report).toContain("no `release` push");
    expect(report).toMatch(/remain\s+separate, later hash-gated production steps/);
  });
});
