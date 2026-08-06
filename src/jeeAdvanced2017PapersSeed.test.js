import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seed = readFileSync(
  "docs/sql/study_materials_jee_advanced_2017_papers_seed_2026-08-06.sql",
  "utf8",
);
const expected = new Map([
  ["2017_1.pdf", 32],
  ["2017_2.pdf", 32],
]);

describe("JEE Advanced 2017 question-paper seed", () => {
  it("contains both visually verified official English PDFs and page counts", () => {
    for (const [file, pages] of expected) {
      expect(seed).toContain(`https://jeeadv.ac.in/past_qps/${file}`);
      expect(seed).toContain(`'English', ${pages}`);
    }
    expect(seed.match(/https:\/\/jeeadv\.ac\.in\/past_qps\/2017_[12]\.pdf/g)).toHaveLength(2);
    expect(seed).toContain("no separate Hindi");
    expect(seed).toContain("with answer key");
    expect(seed).toContain("'previous_year_paper'");
    expect(seed).toContain("'official_source'");
    expect(seed).toContain("2017");
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
    expect(seed).toContain("expected 2 materials");
    expect(seed).toContain("expected 2 JEE-only scopes");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });
});
