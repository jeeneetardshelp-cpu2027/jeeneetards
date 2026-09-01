// The PDFs themselves moved to Supabase Storage, so the sha256 and %PDF-
// checks that used to live here now run against the bucket in
// src/scripts/verifyStudyMaterialStorage.js (npm run verify:study-materials).
// Everything that does not need the PDF bytes - the manifest's shape, the
// preview images, and the seed SQL agreeing with the manifest - stays here.
import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(readFileSync(
  "docs/study-materials/nsep-previous-year-papers-manifest.json",
  "utf8",
));
const seed = readFileSync(
  "docs/sql/study_materials_nsep_previous_year_papers_seed_2026-08-21.sql",
  "utf8",
);
const previewRoot = "public/study-materials/previews/previous-year-papers/nsep";

describe("NSEP previous-year paper release", () => {
  it("ships nine manifested papers with valid previews", () => {
    expect(manifest).toHaveLength(9);
    expect(new Set(manifest.map((item) => item.file)).size).toBe(9);
    expect(manifest.reduce((sum, item) => sum + item.pageCount, 0)).toBe(283);

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

  it("catalogs every paper only under Olympiad and Physics", () => {
    expect(manifest.map((item) => item.examYear)).toEqual([
      2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
    ]);
    expect(manifest.every((item) => item.goal === "olympiad")).toBe(true);
    expect(manifest.every((item) => item.subject === "physics")).toBe(true);

    for (const item of manifest) {
      expect(seed).toContain(`'${item.title}'`);
      expect(seed).toContain(`'${item.file}'`);
      expect(seed).toContain(`, ${item.examYear}, ${item.pageCount})`);
    }

    expect(seed).toContain("'previous_year_paper'");
    expect(seed).toContain("'creator_permission'");
    expect(seed).toContain("'Competishun'");
    expect(seed).toContain("where slug = 'olympiad'");
    expect(seed).toContain("where slug = 'physics'");
    expect(seed).toContain("delete from public.study_material_scopes");
    expect(seed).toContain("expected 9 exact materials");
    expect(seed).toContain("expected 9 Olympiad Physics scopes");
    expect(seed).toContain("unexpected scopes found");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
