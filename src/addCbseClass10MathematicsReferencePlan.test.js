import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "docs/sql/add_cbse_class10_mathematics_reference_2026-07-29.sql",
  "utf8",
);

const created = [
  "Real Numbers",
  "Polynomials",
  "Pair of Linear Equations in Two Variables",
  "Arithmetic Progressions",
  "Triangles",
  "Coordinate Geometry",
  "Introduction to Trigonometry",
  "Some Applications of Trigonometry",
  "Areas Related to Circles",
  "Surface Areas and Volumes",
];

describe("CBSE Class 10 Mathematics Gate 1 artifact", () => {
  it("reuses the four exact reviewed chapters and creates ten", () => {
    for (const row of [
      "(62, 'Statistics', 'statistics')",
      "(64, 'Circles', 'circles')",
      "(66, 'Probability', 'probability')",
      "(76, 'Quadratic Equations', 'quadratic-equations')",
    ]) {
      expect(source).toContain(row);
    }
    for (const name of created) {
      expect(source).toContain(`(3, '${name}'`);
    }
    expect(source).toContain("v_chapter_rows <> 10");
    expect(source).toContain("count(*) from public.chapters) <> 169");
  });

  it("fails closed on the fresh production baseline", () => {
    expect(source).toContain(
      "(select count(*) from public.playlists) <> 148",
    );
    expect(source).toContain(
      "(select count(*) from public.videos) <> 1882",
    );
    expect(source).toContain(
      "(select count(*) from public.playlist_videos) <> 1886",
    );
    expect(source).toContain(
      "(select count(*) from public.chapters) <> 159",
    );
  });

  it("is additive and protects the shared JEE catalogue", () => {
    expect(source).toContain(
      "where id = 3 and name = 'Mathematics' and slug = 'mathematics'",
    );
    expect(source).toContain(
      "v_jee_fingerprint <> 'd7aae3ce7635401ebeffe97e627048bc'",
    );
    expect(source).not.toMatch(
      /^\s*(update|delete|alter|drop|truncate)\s/mi,
    );
  });
});
