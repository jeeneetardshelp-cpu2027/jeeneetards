import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const production = readFileSync("./production/faculty_quality_production.sql", "utf8");
const wrapper = readFileSync("./faculty_quality_production_wrapper_dry_run.sql", "utf8");

describe("faculty + quality production package", () => {
  it("contains preflight, verified feature sources and postflight in order", () => {
    const names = [
      "faculty_quality_production_preflight.sql", "teachers_v7.sql",
      "teachers_v7_import.sql", "teachers_v7_admin_ui.sql", "universal_search.sql",
      "content_quality_v10.sql", "faculty_quality_production_postflight.sql",
    ];
    let cursor = -1;
    for (const name of names) {
      const found = production.indexOf(name);
      expect(found).toBeGreaterThan(cursor);
      cursor = found;
    }
  });

  it("contains no staging seed or fixture helper", () => {
    expect(production).not.toMatch(/insert\s+into\s+public\.app_environment/i);
    expect(production).not.toMatch(/DRIFTFX|TESTPL|__fixture_playlist/i);
  });

  it("does not scan or auto-resolve legacy faculty during deployment", () => {
    expect(production).not.toMatch(/select\s+public\.scan_free_text_teachers\s*\(/i);
    expect(production).not.toMatch(/perform\s+public\.scan_free_text_teachers\s*\(/i);
  });

  it("wraps the exact package in a staging transaction that rolls back", () => {
    expect(wrapper.trimStart().toLowerCase()).toContain("begin;");
    expect(wrapper).toContain(production);
    expect(wrapper.trimEnd().toLowerCase().endsWith("rollback;")).toBe(true);
    expect(wrapper).toContain("create temporary table fq_baseline");
  });
});

