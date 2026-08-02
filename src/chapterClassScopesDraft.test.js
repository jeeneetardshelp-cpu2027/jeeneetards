import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(import.meta.dirname, "migrations/chapter_class_scopes_v13_draft.sql"),
  "utf8",
);

describe("chapter class scopes v13 review draft", () => {
  it("fails closed before any DDL or data statement can run", () => {
    expect(sql.indexOf("NOT APPROVED: chapter class scopes v13"))
      .toBeLessThan(sql.indexOf("create table if not exists public.chapter_class_levels"));
    expect(sql).toContain("PREPARED FOR REVIEW. NOT APPROVED OR APPLIED ANYWHERE.");
  });

  it("creates a canonical chapter/class junction without changing existing catalogue rows", () => {
    expect(sql).toContain("primary key (chapter_id, class_level_id)");
    expect(sql).not.toMatch(/\b(?:update|delete\s+from|truncate)\b/i);
    expect(sql).not.toMatch(/alter\s+table\s+public\.(?:playlists|videos|chapters|class_levels)/i);
  });

  it("seeds only the five reviewed Physics corrections", () => {
    for (const row of [
      ["kinematics", "class-11"],
      ["newtons-laws-of-motion-nlm", "class-11"],
      ["work-energy-and-power", "class-11"],
      ["ray-optics-and-optical-instruments", "class-12"],
      ["modern-physics", "class-12"],
    ]) {
      expect(sql).toContain(`'${row[0]}', '${row[1]}'`);
    }
    expect(sql).toContain("expected five reviewed chapter/class rows");
  });

  it("records official provenance and rejects Dropper as an academic chapter class", () => {
    expect(sql).toContain("cbseacademic.nic.in/web_material/CurriculumMain26/SrSec/Physics_SrSec_2025-26.pdf");
    expect(sql).toContain("ncert.nic.in/textbook/pdf/leph2ps.pdf");
    expect(sql).toContain("Dropper is a target cohort, not a canonical chapter class");
  });

  it("does not replace the live browse functions in this preparation gate", () => {
    expect(sql).not.toContain("create or replace function public.get_browse_curriculum");
    expect(sql).not.toContain("create or replace function public.browse_facet_counts");
  });
});
