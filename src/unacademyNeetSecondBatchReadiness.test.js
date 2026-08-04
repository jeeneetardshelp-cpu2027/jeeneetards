import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readiness = readFileSync(
  resolve(
    import.meta.dirname,
    "../docs/unacademy-neet-second-batch-readiness-2026-08-04.md",
  ),
  "utf8",
);

describe("Unacademy NEET second-batch readiness", () => {
  it("pins the three exact official source playlists and attributions", () => {
    for (const [playlistId, teacher] of [
      ["PLsgHooHkqhhM1W_NWZnLgqMDysIuHrMXu", "Mahendra Singh"],
      ["PLsgHooHkqhhNmUjrOF64b49WSKp93PsKZ", "Anu Gupta"],
      ["PLsgHooHkqhhPx8PUmYV2q6n6IbpGnCDlg", "Anoop Vashishtha"],
    ]) {
      expect(readiness).toContain(playlistId);
      expect(readiness).toContain(teacher);
    }
  });

  it("keeps lecture and practice modes separate with the reviewed counts", () => {
    expect(readiness).toContain("| class-11 | 14 | 9 |");
    expect(readiness).toContain("| class-12 | 11 | 8 |");
    expect(readiness).toContain("| class-12 | 9 | 7 |");
    expect(readiness).toContain("L 11 | PYQs");
    expect(readiness).toContain("six DPP quizzes");
    expect(readiness).toContain("six Menti quizzes");
    expect(readiness).toContain("videos: +34");
    expect(readiness).toContain("memberships: +34");
  });

  it("remains read-only and separately gates every production write", () => {
    expect(readiness).toContain("Prepared read-only and awaiting exact owner approval");
    expect(readiness).toContain("4555712a-b4ea-446c-8f57-04d2257562f9");
    expect(readiness).toContain("fresh anonymous v12 dry-run");
    expect(readiness).toContain("c742fabf93ff8dd33d6ecd5eb4793db0");
    expect(readiness).toContain("no release push");
    expect(readiness).not.toContain("Applied to production");
  });
});
