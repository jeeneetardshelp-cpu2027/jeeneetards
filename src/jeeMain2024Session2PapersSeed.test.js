import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2024_session2_papers_seed_2026-08-07.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/jee-main-2024-session2-official-papers-manifest.json",
  "utf8",
));

describe("JEE Main 2024 Session 2 official question-paper package", () => {
  it("records all ten complete, visually verified official bilingual Paper 1 PDFs", () => {
    expect(manifest.officialIndexUrl).toBe("https://www.nta.ac.in/Downloads");
    expect(manifest.officialApiUrl).toBe("https://www.nta.ac.in/downloads/getlist");
    expect(manifest.officialNoticeUrl).toBe(
      "https://www.nta.ac.in/Download/Notice/Notice_20240413164854.pdf",
    );
    expect(manifest.language).toBe("English and Hindi");
    expect(manifest.databaseLanguageFacet).toBe("English");
    expect(manifest.coverageNote).toContain("all ten bilingual Paper 1 PDFs");
    expect(manifest.coverageNote).toContain("No third-party substitute");
    expect(manifest.verification).toContain("progression through question 90");
    expect(manifest.verification).toContain("all 1,162 pages");
    expect(manifest.papers).toHaveLength(10);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([
      125, 106, 121, 122, 107, 123, 110, 117, 123, 108,
    ]);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(10);
    expect(new Set(manifest.papers.map((paper) => paper.sha256)).size).toBe(10);
    for (const paper of manifest.papers) {
      expect(paper.sourceUrl).toMatch(
        /^https:\/\/www\.nta\.ac\.in\/Download\/ExamPaper\/Paper_20250306\d+\.pdf$/,
      );
      expect(paper.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(seed).toContain(paper.title);
      expect(seed).toContain(paper.sourceUrl);
      expect(seed).toContain(`, ${paper.pageCount})`);
    }
    expect(seed).toContain("90-question");
    expect(seed).toContain("six-section");
    expect(seed).toContain("possible-answer fields for numerical-response questions");
    expect(seed).toContain("no worked solutions");
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
    expect(seed).toContain("expected 10 materials");
    expect(seed).toContain("expected exactly 10 total scopes");
    expect(seed).toContain("expected 10 JEE-only scopes");
    expect(seed).toContain("metadata mismatches");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
