import { describe, expect, it } from "vitest";
import { fetchJeeMainPapers } from "./useJeeMainPapers.js";
import { findPaperLanding } from "./studyMaterialLandings.js";

describe("JEE Main paper collection", () => {
  it("queries only previous-year papers whose reviewed title starts with JEE Main", async () => {
    const calls = [];
    const query = {
      select(columns, options) { calls.push(["select", columns, options]); return this; },
      eq(column, value) { calls.push(["eq", column, value]); return this; },
      ilike(column, value) { calls.push(["ilike", column, value]); return this; },
      order(column, options) { calls.push(["order", column, options]); return this; },
      range(from, to) { calls.push(["range", from, to]); return this; },
      then(resolve) {
        resolve({
          data: [{
            id: 7,
            title: "JEE Main 2024 Session 1 - 27 January Shift 1",
            description: "Official NTA question paper.",
            material_type: "previous_year_paper",
            source_name: "National Testing Agency (JEE Main)",
            source_url: "https://nta.example/paper.pdf",
            file_format: "pdf",
            exam_year: 2024,
            // The metadata columns the 2026-09-02 migration backfilled.
            paper_kind: "question_paper",
            paper_year: 2024,
            exam_session: "Session 1",
            exam_shift: "Shift 1",
          }],
          count: 84,
          error: null,
        });
      },
    };
    const client = {
      from(table) { calls.push(["from", table]); return query; },
    };

    const result = await fetchJeeMainPapers(client, { limit: 60, offset: 60 });

    expect(calls).toContainEqual(["from", "study_materials"]);
    expect(calls).toContainEqual(["eq", "material_type", "previous_year_paper"]);
    expect(calls).toContainEqual(["ilike", "title", "JEE Main%"]);
    expect(calls).toContainEqual(["range", 60, 119]);
    // The 2026-09-02 flip: the SELECT reads the real metadata columns.
    const [, selectedColumns] = calls.find(([name]) => name === "select");
    for (const column of ["paper_kind", "paper_year", "exam_session", "exam_shift"]) {
      expect(selectedColumns.split(",")).toContain(column);
    }
    expect(result.error).toBeNull();
    expect(result.data.total).toBe(84);
    expect(result.data.items[0]).toMatchObject({
      title: "JEE Main 2024 Session 1 - 27 January Shift 1",
      sourceName: "National Testing Agency (JEE Main)",
      scopes: [{ goal: "jee-main" }],
      // ...and exposes them on the mapped row for the classifiers.
      paperKind: "question_paper",
      paperYear: 2024,
      examSession: "Session 1",
      examShift: "Shift 1",
    });
  });

  // The registry's titlePattern and scopeGoal ride through the same fetcher,
  // so a sibling exam (NEET, JEE Advanced) is a registry entry, not a copy of
  // this query.
  it("queries a sibling landing with its own pattern and scope goal", async () => {
    const calls = [];
    const query = {
      select() { return this; },
      eq(column, value) { calls.push(["eq", column, value]); return this; },
      ilike(column, value) { calls.push(["ilike", column, value]); return this; },
      order() { return this; },
      range() { return this; },
      then(resolve) {
        resolve({
          data: [{
            id: 21,
            title: "NEET UG 2024 - Set T1 (English)",
            material_type: "previous_year_paper",
            source_name: "National Testing Agency (NEET)",
            source_url: "https://nta.example/neet-2024-t1.pdf",
            file_format: "pdf",
            exam_year: 2024,
          }],
          count: 6,
          error: null,
        });
      },
    };
    const client = { from() { return query; } };
    const neet = findPaperLanding("/materials/neet/previous-year-papers");

    const result = await fetchJeeMainPapers(client, {
      titlePattern: neet.titlePattern,
      scopeGoal: neet.scopeGoal,
    });

    expect(calls).toContainEqual(["eq", "material_type", "previous_year_paper"]);
    expect(calls).toContainEqual(["ilike", "title", "NEET%"]);
    // This fixture row carries no metadata columns (the shape of a response
    // cached before the 2026-09-02 flip): they map to explicit nulls, which
    // is what sends the classifiers down the title-grammar fallback.
    expect(result.data.items[0]).toMatchObject({
      title: "NEET UG 2024 - Set T1 (English)",
      scopes: [{ goal: "neet" }],
      paperKind: null,
      paperYear: null,
      examSession: null,
      examShift: null,
    });
  });
});
