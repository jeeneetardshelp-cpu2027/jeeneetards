import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve("docs/sql/add_molecular_basis_chapter_production_2026-07-28.sql"),
  "utf8",
);

describe("Molecular Basis chapter production plan", () => {
  it("is a single-row additive plan with fail-closed production guards", () => {
    expect(source.match(/\binsert\s+into\s+public\.chapters\b/gi)).toHaveLength(1);
    expect(source).toMatch(/Molecular Basis of Inheritance/);
    expect(source).toMatch(/molecular-basis-of-inheritance/);
    expect(source).toMatch(/app_environment is not production-empty/);
    expect(source).toMatch(/count\(\*\) from public\.playlists\) <> 112/);
    expect(source).toMatch(/count\(\*\) from public\.videos\) <> 1621/);
    expect(source).toMatch(/count\(\*\) from public\.playlist_videos\) <> 1625/);
    expect(source).toMatch(/count\(\*\) from public\.chapters\) <> 123/);
    expect(source).toMatch(/JEE fingerprint mismatch/);
    expect(source).toContain("d7aae3ce7635401ebeffe97e627048bc");
    expect(source).toMatch(/expected one insert/);
  });

  it("contains no destructive or in-place mutation", () => {
    expect(source).not.toMatch(/\b(update|delete|alter|drop|truncate)\b\s+(?:table|from|public\.)/i);
    expect(source).not.toMatch(/\bon\s+conflict\b/i);
  });
});
