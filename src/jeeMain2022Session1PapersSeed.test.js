import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2022_session1_papers_seed_2026-08-06.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/jee-main-2022-session1-official-papers-manifest.json",
  "utf8",
));

describe("JEE Main 2022 Session 1 official question-paper package", () => {
  it("records the complete visually verified English Paper 1 set", () => {
    expect(manifest.officialArchiveUrl).toBe("https://www.nta.ac.in/NoticeBoardArchive");
    expect(manifest.officialNoticeUrl).toBe(
      "https://www.nta.ac.in/Download/Notice/Notice_20220702204623.pdf",
    );
    expect(manifest.papers).toHaveLength(12);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([
      26, 18, 26, 21, 28, 20, 27, 22, 21, 28, 26, 20,
    ]);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(12);
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
    expect(seed).toContain("expected 12 materials");
    expect(seed).toContain("expected exactly 12 total scopes");
    expect(seed).toContain("expected 12 JEE-only scopes");
    expect(seed).toContain("metadata mismatches");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
