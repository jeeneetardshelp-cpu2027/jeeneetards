import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2017_papers_seed_2026-08-08.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/jee-main-2017-official-papers-manifest.json",
  "utf8",
));

describe("JEE Main 2017 official question-paper package", () => {
  it("records the complete visually verified Paper 1 set from the archived official host", () => {
    expect(manifest.officialArchiveUrl).toBe("https://www.cbse.gov.in/cbsenew/press_archive.html");
    expect(manifest.officialQuestionPapersPageUrl).toBe(
      "https://web.archive.org/web/20170505050223id_/http://jeemain.nic.in/webinfo/QuestionPapers2017.htm",
    );
    expect(manifest.language).toBe("English and Hindi");
    expect(manifest.papers).toHaveLength(10);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([
      44, 44, 44, 44, 18, 13, 14, 20, 13, 13,
    ]);
    expect(manifest.papers.reduce((sum, paper) => sum + paper.pageCount, 0)).toBe(267);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(10);
    for (const paper of manifest.papers) {
      expect(paper.sourceUrl).toMatch(
        /^https:\/\/web\.archive\.org\/web\/\d+id_\/http:\/\/jeemain\.nic\.in:80\/webinfo\/PDF\/.+\.pdf$/,
      );
      expect(paper.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(paper.byteLength).toBeGreaterThan(100_000);
      expect(seed).toContain(paper.title);
      expect(seed).toContain(paper.sourceUrl);
      expect(seed).toContain(`, ${paper.pageCount})`);
    }
    expect(seed).toContain("All 267 pages were hashed and visually checked");
    expect(seed).toContain("no answer key or worked solutions are included");
    expect(seed).toContain("Linked only; not mirrored or redistributed by JEENEETARD");
  });

  it("uses the supported Hinglish filter while clearly labelling the bilingual files", () => {
    expect(seed).toContain("'pdf', 'Hinglish', 2017");
    expect(seed).toContain("English and Hindi");
    expect(seed).toContain("language taxonomy has no bilingual value");
  });

  it("uses one exam-level JEE scope without false class, subject or lecture attachment", () => {
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
