import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_neet_ug_2024_papers_seed_2026-08-16.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/neet-ug-2024-official-papers-manifest.json",
  "utf8",
));

describe("NEET UG 2024 official question-paper package", () => {
  it("records the two visually verified official NTA English PDFs", () => {
    expect(manifest.officialApiUrl).toBe("https://www.nta.ac.in/downloads/getlist");
    expect(manifest.officialNoticeUrl).toBe("https://exams.nta.ac.in/NEET/");
    expect(manifest.sourceQuery).toEqual({
      Year: "2024",
      ExamType: "3",
      PaperType: "0",
    });
    expect(manifest.papers).toHaveLength(2);
    expect(manifest.papers.map((paper) => paper.setCode)).toEqual(["T1", "R1"]);
    expect(manifest.papers.map((paper) => paper.catalogName)).toEqual([
      "English_1",
      "English_3",
    ]);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([32, 32]);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(2);
    for (const paper of manifest.papers) {
      expect(paper.examDate).toBe("2024-05-05");
      expect(paper.sourceUrl).toMatch(
        /^https:\/\/www\.nta\.ac\.in\/Download\/ExamPaper\/Paper_2025012413\d+\.pdf$/,
      );
      expect(paper.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(seed).toContain(paper.title);
      expect(seed).toContain(paper.sourceUrl);
      expect(seed).toContain(", 32)");
    }
    expect(manifest.coverageNote).toContain("eight unique");
    expect(manifest.coverageNote).toContain("questions 1-200");
    expect(manifest.coverageNote).toContain("rough-work pages");
    expect(seed).toContain("200-question completeness");
    expect(seed).toContain("Questions only; no answer key or solutions are included");
    expect(seed).toContain("Linked only; not mirrored or redistributed by JEENEETARD");
  });

  it("documents and excludes the misleading English_2 catalogue entry", () => {
    expect(manifest.excludedFiles).toHaveLength(1);
    expect(manifest.excludedFiles[0]).toMatchObject({
      catalogName: "English_2",
      pageCount: 48,
      sha256: "B69D582FF457C62EC07E83298EC42C4041D7048293E39E58D05F93307E7B6DD1",
    });
    expect(manifest.excludedFiles[0].reason).toContain("T6_Hindi+English");
    expect(seed).not.toContain(manifest.excludedFiles[0].sourceUrl);
    expect(seed).not.toContain("T6_Hindi+English");
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

  it("is transactional, rerunnable and guarded by exact postflight checks", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 2 materials");
    expect(seed).toContain("expected exactly 2 total scopes");
    expect(seed).toContain("expected 2 NEET-only scopes");
    expect(seed).toContain("metadata mismatches");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
