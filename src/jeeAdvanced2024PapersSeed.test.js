import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2024_papers_seed_2026-08-06.sql",
  "utf8",
);

const expected = new Map([
  ["2024_1_English.pdf", 30],
  ["2024_1_Hindi.pdf", 34],
  ["2024_2_English.pdf", 26],
  ["2024_2_Hindi.pdf", 26],
]);

describe("JEE Advanced 2024 question-paper seed", () => {
  it("contains all four visually verified official PDFs and page counts", () => {
    for (const [file, pages] of expected) {
      expect(seed).toContain(`https://jeeadv.ac.in/past_qps/${file}`);
      expect(seed).toContain(`'${file.includes("English") ? "English" : "Hindi"}', ${pages}`);
    }
    expect(seed.match(/https:\/\/jeeadv\.ac\.in\/past_qps\/2024_[12]_(?:English|Hindi)\.pdf/g))
      .toHaveLength(4);
    expect(seed).toContain("'previous_year_paper'");
    expect(seed).toContain("'official_source'");
    expect(seed).toContain("2024");
  });

  it("uses one exam-level JEE scope without false class or subject attachment", () => {
    expect(seed).toContain("where slug = 'jee'");
    expect(seed).toContain("material_id, learning_goal_id");
    expect(seed).toContain("and board_id is null");
    expect(seed).toContain("and class_level_id is null");
    expect(seed).toContain("and subject_id is null");
    expect(seed).toContain("and chapter_id is null");
    expect(seed).not.toContain("where slug = 'neet'");
    expect(seed).not.toContain("where slug = 'school'");
  });

  it("is transactional, rerunnable and guarded by exact postflight counts", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("if not exists (");
    expect(seed).toContain("expected 4 materials");
    expect(seed).toContain("expected 4 JEE-only scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
