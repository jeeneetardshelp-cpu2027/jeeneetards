import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2015_papers_seed_2026-08-10.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/jee-main-2015-official-papers-manifest.json",
  "utf8",
));

describe("JEE Main 2015 official question-paper package", () => {
  it("records the complete visually verified Paper 1 set from the archived official host", () => {
    expect(manifest.officialQuestionPapersPageUrl).toBe(
      "https://web.archive.org/web/20150420143051id_/http://jeemain.nic.in:80/webinfo/QuestionPapers2015.htm",
    );
    expect(manifest.officialDisclosureUrl).toBe(
      "https://www.cbse.gov.in/cbsenew/rti/disclosures/08-07-2015.pdf",
    );
    expect(manifest.language).toBe("English and Hindi");
    expect(manifest.papers).toHaveLength(6);
    expect(manifest.papers.map((paper) => paper.pageCount)).toEqual([
      40, 40, 40, 40, 35, 35,
    ]);
    expect(manifest.papers.reduce((sum, paper) => sum + paper.pageCount, 0)).toBe(230);
    expect(new Set(manifest.papers.map((paper) => paper.sourceUrl)).size).toBe(6);
    expect(manifest.papers.every((paper) => (
      paper.languages.join(",") === "English,Hindi"
    ))).toBe(true);
    for (const paper of manifest.papers) {
      expect(paper.sourceUrl).toMatch(
        /^https:\/\/web\.archive\.org\/web\/\d+id_\/http:\/\/jeemain\.nic\.in:80\/webinfo\/PDF\/.+\.pdf$/,
      );
      expect(paper.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(paper.byteLength).toBeGreaterThan(800_000);
      expect(seed).toContain(paper.title);
      expect(seed).toContain(paper.sourceUrl);
      expect(seed).toContain(`, ${paper.pageCount})`);
    }
    expect(seed).toContain("All 230 pages were hashed and visually checked");
    expect(seed).toContain("no answer key or worked solutions are included");
    expect(seed).toContain("Linked only; not mirrored or redistributed by JEENEETARD");
  });

  it("uses the supported Hinglish filter while accurately labelling both file languages", () => {
    expect(seed).toContain("'pdf', 'Hinglish', 2015");
    expect(seed).toContain("English and Hindi");
    expect(seed).toContain("no bilingual value");
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
    expect(seed).toContain("expected 6 materials");
    expect(seed).toContain("expected exactly 6 total scopes");
    expect(seed).toContain("expected 6 JEE-only scopes");
    expect(seed).toContain("metadata mismatches");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
