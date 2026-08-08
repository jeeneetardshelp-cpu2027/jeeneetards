import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2023_session2_papers_seed_2026-08-08.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/jee-main-2023-session2-official-papers-manifest.json",
  "utf8",
));
const session1Exclusion = readFileSync(
  "docs/study-materials/jee-main-2023-session1-official-papers-exclusion-2026-08-08.md",
  "utf8",
);

describe("JEE Main 2023 Session 2 official question-paper package", () => {
  it("records all twelve complete, visually verified official bilingual Paper 1 PDFs", () => {
    expect(manifest.officialIndexUrl).toBe("https://www.nta.ac.in/Downloads");
    expect(manifest.officialApiUrl).toBe("https://www.nta.ac.in/downloads/getlist");
    expect(manifest.officialNoticeUrl).toBe(
      "https://www.nta.ac.in/Download/Notice/Notice_20230419201035.pdf",
    );
    expect(manifest.language).toBe("English and Hindi");
    expect(manifest.databaseLanguageFacet).toBe("English");
    expect(manifest.coverageNote).toContain("all twelve bilingual Paper 1 PDFs");
    expect(manifest.coverageNote).toContain("no Session 1 B.E./B.Tech. Paper 1 PDFs");
    expect(manifest.coverageNote).toContain("no third-party substitute");
    expect(manifest.verification).toContain("all 90 unique questions");
    expect(manifest.verification).toContain("all 1,313 pages");
    expect(manifest.papers).toHaveLength(12);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([
      107, 114, 115, 105, 113, 107, 110, 106, 108, 110, 103, 115,
    ]);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(12);
    expect(new Set(manifest.papers.map((paper) => paper.sha256)).size).toBe(12);
    for (const paper of manifest.papers) {
      expect(paper.sourceUrl).toMatch(
        /^https:\/\/www\.nta\.ac\.in\/Download\/ExamPaper\/Paper_202309261\d+\.pdf$/,
      );
      expect(paper.byteLength).toBeGreaterThan(5_000_000);
      expect(paper.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(seed).toContain(paper.title);
      expect(seed).toContain(paper.sourceUrl);
      expect(seed).toContain(`, ${paper.pageCount})`);
    }
    expect(seed).toContain("90-question/three-subject completeness check");
    expect(seed).toContain("possible-answer fields for numerical-response questions");
    expect(seed).toContain("no worked solutions");
    expect(seed).toContain("Linked only; not mirrored or redistributed by JEENEETARD");
  });

  it("documents why 2023 Session 1 Paper 1 is deliberately absent", () => {
    expect(session1Exclusion).toContain("No JEE Main 2023 Session 1 B.E./B.Tech. Paper 1 PDF");
    expect(session1Exclusion).toContain("official NTA download API");
    expect(session1Exclusion).toContain("no Session 1 B.E./B.Tech. Paper 1 PDF");
    expect(session1Exclusion).toContain("No coaching-site reconstruction");
    expect(session1Exclusion).toContain("redistribution-approved originals");
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
