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
  it("records only the complete, visually verified official bilingual Paper 1 PDF", () => {
    expect(manifest.officialIndexUrl).toBe("https://www.nta.ac.in/NoticeBoardArchive");
    expect(manifest.officialNoticeUrl).toBe(
      "https://www.nta.ac.in/Download/Notice/Notice_20240212120843.pdf",
    );
    expect(manifest.language).toBe("English and Hindi");
    expect(manifest.databaseLanguageFacet).toBe("English");
    expect(manifest.coverageNote).toContain("remaining nine shifts");
    expect(manifest.coverageNote).toContain("No third-party mirror");
    expect(manifest.verification).toContain("90 unique questions numbered 1-90");
    expect(manifest.verification).toContain("all 104 pages");
    expect(manifest.papers).toHaveLength(1);
    expect(manifest.papers[0]).toEqual({
      title: "JEE Main 2024 Session 1 - 29 January Shift 1 (English & Hindi)",
      sourceUrl: "https://www.nta.ac.in/Download/ExamPaper/Paper_20250910115932.pdf",
      pageCount: 104,
      byteLength: 4767560,
      sha256: "ECA0B6440D70656C5272DB9123E085F106D837D1688E17C75981E1E9F9DA1E9D",
    });
    expect(seed).toContain(manifest.papers[0].title);
    expect(seed).toContain(manifest.papers[0].sourceUrl);
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
    expect(seed).toContain("expected 1 material");
    expect(seed).toContain("expected exactly 1 total scope");
    expect(seed).toContain("expected 1 JEE-only scope");
    expect(seed).toContain("metadata mismatches");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
