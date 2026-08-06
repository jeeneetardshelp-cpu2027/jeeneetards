import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2022_session1_papers_seed_2026-08-06.sql",
  "utf8",
);
const expected = new Map([
  ["Paper_20230320113108.pdf", { date: "24 June", pages: 18 }],
  ["Paper_20230320131539.pdf", { date: "26 June", pages: 20 }],
  ["Paper_20230322131758.pdf", { date: "29 June", pages: 20 }],
]);

describe("JEE Main 2022 Session 1 official question-paper seed", () => {
  it("contains the three visually verified live NTA English PDFs", () => {
    for (const [file, metadata] of expected) {
      expect(seed).toContain(`https://www.nta.ac.in/Download/ExamPaper/${file}`);
      expect(seed).toContain(`${metadata.date} Shift 2 (English)`);
      expect(seed).toContain(`'English', ${metadata.pages}`);
    }
    expect(seed.match(/https:\/\/www\.nta\.ac\.in\/Download\/ExamPaper\/Paper_202303\d+\.pdf/g)).toHaveLength(9);
    expect(seed).toContain("date, shift, language, 90-question completeness and page count were checked");
    expect(seed).toContain("Questions only; no answer key is included");
    expect(seed).toContain("'previous_year_paper'");
    expect(seed).toContain("'official_source'");
    expect(seed).toContain("National Testing Agency (JEE Main)");
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

  it("is transactional, rerunnable and guarded by exact postflight counts", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 3 materials");
    expect(seed).toContain("expected 3 JEE-only scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
