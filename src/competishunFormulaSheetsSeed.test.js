// The PDFs themselves moved to Supabase Storage, so the sha256 and %PDF-
// checks that used to live here now run against the bucket in
// src/scripts/verifyStudyMaterialStorage.js (npm run verify:study-materials).
// Everything that does not need the PDF bytes - the manifest's shape, the
// preview images, and the seed SQL agreeing with the manifest - stays here.
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(
  "docs/study-materials/competishun-formula-sheets-manifest.json",
  "utf8",
));
const seed = readFileSync(
  "docs/sql/study_materials_competishun_formula_sheets_seed_2026-08-06.sql",
  "utf8",
);
const previewRoot = "public/study-materials/previews/formula-sheets";

describe("Competishun formula-sheet release", () => {
  it("ships the twenty permission-backed sheets with valid previews", () => {
    expect(manifest).toHaveLength(20);
    expect(new Set(manifest.map((item) => item.file)).size).toBe(20);
    expect(manifest.reduce((sum, item) => sum + item.pageCount, 0)).toBe(170);

    for (const item of manifest) {
      const previewPath = `${previewRoot}/${item.file.replace(/\.pdf$/, ".jpg")}`;
      expect(existsSync(previewPath), previewPath).toBe(true);

      // Every entry must still carry the digest the storage check verifies
      // against; a manifest row with no sha256 would make that check vacuous.
      expect(item.sha256, item.file).toMatch(/^[0-9A-Fa-f]{64}$/);


      const preview = readFileSync(previewPath);
      expect(preview[0]).toBe(0xff);
      expect(preview[1]).toBe(0xd8);
      expect(preview[2]).toBe(0xff);
      expect(statSync(previewPath).size).toBeGreaterThan(10_000);
    }
  });

  it("keeps Mathematics JEE-only and shares Physics and Chemistry with NEET", () => {
    const mathematics = manifest.filter((item) => item.subject === "mathematics");
    const science = manifest.filter((item) => item.subject !== "mathematics");
    expect(mathematics).toHaveLength(6);
    expect(science).toHaveLength(14);
    expect(mathematics.every((item) => item.goals.join(",") === "jee")).toBe(true);
    expect(science.every((item) => item.goals.join(",") === "jee,neet")).toBe(true);

    const expectedScopes = manifest.reduce(
      (sum, item) => sum + (item.chapters.length * item.goals.length),
      0,
    );
    expect(expectedScopes).toBe(36);
  });

  it("uses reviewed creator-permission records and exact chapter-owned scopes", () => {
    for (const item of manifest) {
      expect(seed).toContain(`'${item.file}'`);
      expect(seed).toContain(`'${item.subject}'`);
      expect(seed).toContain(`'${item.title.replaceAll("'", "''")}'`);
      for (const chapter of item.chapters) expect(seed).toContain(`'${chapter}'`);
    }

    expect(seed).toContain("'formula_sheet'");
    expect(seed).toContain("'creator_permission'");
    expect(seed).toContain("redistribution permission confirmed");
    expect(seed).toContain("'Competishun'");
    expect(seed).toContain("delete from public.study_material_scopes");
    expect(seed).toContain("expected 20 exact materials");
    expect(seed).toContain("expected 36 chapter scopes");
    expect(seed).toContain("expected 21 JEE chapter scopes");
    expect(seed).toContain("expected 15 NEET chapter scopes");
    expect(seed).toContain("NEET mathematics leakage");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
