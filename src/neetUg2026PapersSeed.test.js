import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_neet_ug_2026_papers_seed_2026-08-16.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/neet-ug-2026-official-papers-manifest.json",
  "utf8",
));

describe("NEET UG 2026 official question-paper package", () => {
  it("records the four visually verified official NTA PDFs", () => {
    expect(manifest.officialApiUrl).toBe("https://www.nta.ac.in/downloads/getlist");
    expect(manifest.officialNoticeUrl).toBe("https://neet.nta.nic.in/public-notices/");
    expect(manifest.papers).toHaveLength(4);
    expect(manifest.papers.map((paper) => paper.setCode)).toEqual(["50", "60", "70", "80"]);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([32, 32, 32, 32]);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(4);
    for (const paper of manifest.papers) {
      expect(paper.examDate).toBe("2026-06-21");
      expect(paper.sourceUrl).toMatch(
        /^https:\/\/www\.nta\.ac\.in\/Download\/ExamPaper\/Paper_20260623\d+\.pdf$/,
      );
      expect(paper.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(seed).toContain(paper.title);
      expect(seed).toContain(paper.sourceUrl);
      expect(seed).toContain(", 32)");
    }
    expect(manifest.coverageNote).toContain("questions 1-180");
    expect(manifest.coverageNote).toContain("rough-work pages");
    expect(seed).toContain("180-question completeness");
    expect(seed).toContain("Questions only; no answer key or solutions are included");
    expect(seed).toContain("Linked only; not mirrored or redistributed by JEENEETARD");
  });

  it("uses one NEET exam-level scope without false class or subject attachment", () => {
    expect(seed).toContain("where slug = 'neet'");
    expect(seed).toContain("material_id, learning_goal_id");
    expect(seed).toContain("board_id is null");
    expect(seed).toContain("class_level_id is null");
    expect(seed).toContain("subject_id is null");
    expect(seed).toContain("chapter_id is null");
    expect(seed).not.toContain("where slug = 'jee'");
    expect(seed).not.toContain("where slug = 'school'");
  });

  it("excludes the superseded May examination", () => {
    expect(manifest.coverageNote).toContain("superseded 3 May examination");
    expect(seed).not.toContain("3 May 2026");
  });

  it("is transactional, rerunnable and guarded by exact postflight checks", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 4 materials");
    expect(seed).toContain("expected exactly 4 total scopes");
    expect(seed).toContain("expected 4 NEET-only scopes");
    expect(seed).toContain("metadata mismatches");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
