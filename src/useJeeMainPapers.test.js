import { describe, expect, it } from "vitest";
import { fetchJeeMainPapers } from "./useJeeMainPapers.js";

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
    expect(result.error).toBeNull();
    expect(result.data.total).toBe(84);
    expect(result.data.items[0]).toMatchObject({
      title: "JEE Main 2024 Session 1 - 27 January Shift 1",
      sourceName: "National Testing Agency (JEE Main)",
      scopes: [{ goal: "jee-main" }],
    });
  });
});
