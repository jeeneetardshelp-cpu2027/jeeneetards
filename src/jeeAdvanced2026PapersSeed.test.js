import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2026_papers_seed_2026-08-06.sql",
  "utf8",
);

const expected = new Map([
  ["p1_english.pdf", 34],
  ["p1_hindi.pdf", 38],
  ["p2_english.pdf", 29],
  ["p2_hindi.pdf", 32],
]);

describe("JEE Advanced 2026 question-paper seed", () => {
  it("contains all four visually verified official PDFs and page counts", () => {
    for (const [file, pages] of expected) {
      expect(seed).toContain(`https://jeeadv.ac.in/documents/${file}`);
      expect(seed).toContain(`'${file.split(".")[0].split("_")[1] === "english" ? "English" : "Hindi"}', ${pages}`);
    }
    expect(seed.match(/https:\/\/jeeadv\.ac\.in\/documents\/p[12]_(?:english|hindi)\.pdf/g))
      .toHaveLength(4);
    expect(seed).toContain("'previous_year_paper'");
    expect(seed).toContain("'official_source'");
    expect(seed).toContain("2026");
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
