import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2024_session1_papers_seed_2026-08-07.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/jee-main-2024-session1-official-papers-manifest.json",
  "utf8",
));

describe("JEE Main 2024 Session 1 official question-paper package", () => {
  it("records only the eight complete, visually verified official bilingual Paper 1 PDFs", () => {
    expect(manifest.officialIndexUrl).toBe("https://www.nta.ac.in/NoticeBoardArchive");
    expect(manifest.officialNoticeUrl).toBe(
      "https://www.nta.ac.in/Download/Notice/Notice_20240212120843.pdf",
    );
    expect(manifest.language).toBe("English and Hindi");
    expect(manifest.databaseLanguageFacet).toBe("English");
    expect(manifest.coverageNote).toContain("27 January Shift 2");
    expect(manifest.coverageNote).toContain("29 January Shift 2");
    expect(manifest.coverageNote).toContain("No third-party substitute");
    expect(manifest.verification).toContain("90 unique questions numbered 1-90");
    expect(manifest.verification).toContain("all 894 pages");
    expect(manifest.verification).toContain("blank trailing page after question 90");
    expect(manifest.papers).toHaveLength(8);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([
      117, 104, 121, 105, 106, 108, 117, 116,
    ]);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(8);
    expect(new Set(manifest.papers.map((paper) => paper.sha256)).size).toBe(8);
    for (const paper of manifest.papers) {
      expect(paper.sourceUrl).toMatch(
        /^https:\/\/www\.nta\.ac\.in\/Download\/ExamPaper\/Paper_20250910\d+\.pdf$/,
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
    expect(seed).toContain("expected 8 materials");
    expect(seed).toContain("expected exactly 8 total scopes");
    expect(seed).toContain("expected 8 JEE-only scopes");
    expect(seed).toContain("metadata mismatches");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
