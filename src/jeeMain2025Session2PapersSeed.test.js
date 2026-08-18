import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2025_session2_papers_seed_2026-08-07.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/jee-main-2025-session2-official-papers-manifest.json",
  "utf8",
));

describe("JEE Main 2025 Session 2 official question-paper package", () => {
  it("records only the eight complete, visually verified official bilingual Paper 1 PDFs", () => {
    expect(manifest.officialIndexUrl).toBe("https://www.nta.ac.in/Downloads");
    expect(manifest.officialApiUrl).toBe("https://www.nta.ac.in/downloads/getlist");
    expect(manifest.officialNoticeUrl).toBe(
      "https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/04/2025041144.pdf",
    );
    expect(manifest.language).toBe("English and Hindi");
    expect(manifest.databaseLanguageFacet).toBe("English");
    expect(manifest.coverageNote).toContain("4 April Shift 1 PDF was excluded");
    expect(manifest.coverageNote).toContain("No third-party substitute");
    expect(manifest.papers).toHaveLength(8);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([
      66, 67, 63, 59, 67, 65, 66, 62,
    ]);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(8);
    expect(new Set(manifest.papers.map((paper) => paper.sha256)).size).toBe(8);
    for (const paper of manifest.papers) {
      expect(paper.sourceUrl).toMatch(
        /^https:\/\/www\.nta\.ac\.in\/Download\/ExamPaper\/Paper_20250715\d+\.pdf$/,
      );
      expect(paper.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(seed).toContain(paper.title);
      expect(seed).toContain(paper.sourceUrl);
      expect(seed).toContain(`, ${paper.pageCount})`);
    }
    expect(seed).not.toContain("Paper_20250715182000.pdf");
    expect(seed).toContain("75-question/");
    expect(seed).toContain("three-subject completeness check");
    expect(seed).toContain("Questions only; no answer key or solutions are included");
    expect(seed).toContain("Linked only; not mirrored or redistributed by JEENEETARD");
  });

  it("uses one exam-level JEE scope without false class or subject attachment", () => {
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
    expect(seed).toContain("expected 8 materials");
    expect(seed).toContain("expected exactly 8 total scopes");
    expect(seed).toContain("expected 8 JEE-only scopes");
    expect(seed).toContain("metadata mismatches");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
