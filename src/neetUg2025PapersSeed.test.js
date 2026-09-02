import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_neet_ug_2025_papers_seed_2026-08-16.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/neet-ug-2025-official-papers-manifest.json",
  "utf8",
));

describe("NEET UG 2025 official question-paper package", () => {
  it("records the four visually verified official NTA English PDFs", () => {
    expect(manifest.officialApiUrl).toBe("https://www.nta.ac.in/downloads/getlist");
    expect(manifest.officialNoticeUrl).toBe(
      "https://neet.nta.nic.in/document-category/neetug-2025-public-notices/",
    );
    expect(manifest.sourceQuery).toEqual({
      Year: "2025",
      ExamType: "3",
      PaperType: "0",
    });
    expect(manifest.papers).toHaveLength(4);
    expect(manifest.papers.map((paper) => paper.setCode)).toEqual(["45", "46", "47", "48"]);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([32, 32, 32, 32]);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(4);
    for (const paper of manifest.papers) {
      expect(paper.examDate).toBe("2025-05-04");
      expect(paper.sourceUrl).toMatch(
        /^https:\/\/www\.nta\.ac\.in\/Download\/ExamPaper\/Paper_20251004204701_[a-f0-9]{8}\.pdf$/,
      );
      expect(paper.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(seed).toContain(paper.title);
      expect(seed).toContain(paper.sourceUrl);
      expect(seed).toContain(", 32)");
    }
    expect(manifest.coverageNote).toContain("52 unique");
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

  it("keeps non-English editions outside this English-only batch", () => {
    expect(manifest.coverageNote).toContain("only the four English booklet codes");
    expect(manifest.coverageNote).toContain("Other language editions remain outside");
    expect(seed).not.toMatch(/Assamese|Bengali|Gujarati|Hindi|Kannada|Malayalam|Marathi|Odia|Punjabi|Tamil|Telugu|Urdu/);
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
