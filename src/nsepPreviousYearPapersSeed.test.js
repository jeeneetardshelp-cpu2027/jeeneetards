import { createHash } from "node:crypto";
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
const pdfRoot = "public/study-materials/previous-year-papers/nsep";
const previewRoot = "public/study-materials/previews/previous-year-papers/nsep";

describe("NSEP previous-year paper release", () => {
  it("ships seven verified source PDFs unchanged with valid previews", () => {
    expect(manifest).toHaveLength(7);
    expect(new Set(manifest.map((item) => item.file)).size).toBe(7);
    expect(manifest.reduce((sum, item) => sum + item.pageCount, 0)).toBe(238);

    for (const item of manifest) {
      const pdfPath = `${pdfRoot}/${item.file}`;
      const previewPath = `${previewRoot}/${item.file.replace(/\.pdf$/, ".jpg")}`;
      expect(existsSync(pdfPath), pdfPath).toBe(true);
      expect(existsSync(previewPath), previewPath).toBe(true);

      const pdf = readFileSync(pdfPath);
      expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(createHash("sha256").update(pdf).digest("hex").toUpperCase()).toBe(item.sha256);

      const preview = readFileSync(previewPath);
      expect(preview[0]).toBe(0xff);
      expect(preview[1]).toBe(0xd8);
      expect(preview[2]).toBe(0xff);
      expect(statSync(previewPath).size).toBeGreaterThan(10_000);
    }
  });

  it("catalogs every paper only under Olympiad and Physics", () => {
    expect(manifest.map((item) => item.examYear)).toEqual([
      2019, 2020, 2021, 2022, 2023, 2024, 2025,
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
    expect(seed).toContain("expected 7 exact materials");
    expect(seed).toContain("expected 7 Olympiad Physics scopes");
    expect(seed).toContain("unexpected scopes found");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
