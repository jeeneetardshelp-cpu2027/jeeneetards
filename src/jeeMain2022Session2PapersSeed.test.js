import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2022_session2_papers_seed_2026-08-07.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/jee-main-2022-session2-official-papers-manifest.json",
  "utf8",
));

describe("JEE Main 2022 Session 2 official question-paper package", () => {
  it("records only the nine unique, visually verified official English Paper 1 PDFs found", () => {
    expect(manifest.officialArchiveUrl).toBe("https://www.nta.ac.in/NoticeBoardArchive");
    expect(manifest.officialNoticeUrl).toBe(
      "https://www.nta.ac.in/Download/Notice/Notice_20220803205533.pdf",
    );
    expect(manifest.coverageNote).toContain("no third-party substitutes");
    expect(manifest.papers).toHaveLength(9);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([
      39, 30, 32, 43, 40, 33, 42, 30, 31,
    ]);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(9);
    expect(new Set(manifest.papers.map((paper) => paper.sha256)).size).toBe(9);
    for (const paper of manifest.papers) {
      expect(paper.sourceUrl).toMatch(
        /^https:\/\/www\.nta\.ac\.in\/Download\/ExamPaper\/Paper_202303\d+\.pdf$/,
      );
      expect(paper.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(seed).toContain(paper.title);
      expect(seed).toContain(paper.sourceUrl);
      expect(seed).toContain(`, ${paper.pageCount})`);
    }
    expect(seed).toContain("90-question/three-subject");
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
    expect(seed).toContain("expected 9 materials");
    expect(seed).toContain("expected exactly 9 total scopes");
    expect(seed).toContain("expected 9 JEE-only scopes");
    expect(seed).toContain("metadata mismatches");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
