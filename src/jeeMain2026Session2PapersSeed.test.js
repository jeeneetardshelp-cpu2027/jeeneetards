import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2026_session2_papers_seed_2026-08-06.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/jee-main-2026-session2-official-papers-manifest.json",
  "utf8",
));

describe("JEE Main 2026 Session 2 official question-paper package", () => {
  it("records the nine visually verified official NTA/NIC PDFs", () => {
    expect(manifest.officialIndexUrl).toBe("https://jeemain.nta.nic.in/sitemap/");
    expect(manifest.papers).toHaveLength(9);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([30, 31, 28, 30, 30, 30, 28, 31, 31]);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(9);
    for (const paper of manifest.papers) {
      expect(paper.sourceUrl).toMatch(/^https:\/\/cdnbbsr\.s3waas\.gov\.in\/.*\.pdf$/);
      expect(paper.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(seed).toContain(paper.title);
      expect(seed).toContain(paper.sourceUrl);
      expect(seed).toContain(`, ${paper.pageCount})`);
    }
    expect(seed).toContain("three-subject/75-question completeness");
    expect(seed).toContain("Questions only; no answer key or solutions are included");
    expect(seed).toContain("Linked only; not mirrored or redistributed by JEENEETARD");
  });

  it("uses one JEE exam-level scope without false class or subject attachment", () => {
    expect(seed).toContain("where slug = 'jee'");
    expect(seed).toContain("material_id, learning_goal_id");
    expect(seed).toContain("board_id is null");
    expect(seed).toContain("class_level_id is null");
    expect(seed).toContain("subject_id is null");
    expect(seed).toContain("chapter_id is null");
    expect(seed).not.toContain("where slug = 'neet'");
    expect(seed).not.toContain("where slug = 'school'");
  });

  it("is transactional, rerunnable and guarded by exact postflight checks", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 9 materials");
    expect(seed).toContain("expected exactly 9 total scopes");
    expect(seed).toContain("expected 9 JEE-only scopes");
    expect(seed).toContain("metadata mismatches");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
