import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(
    "docs/manifests/cbse-class10-mathematics-shobhit-nirwan.json",
    "utf8",
  ),
);
const linkScript = readFileSync(
  "src/scripts/linkCbseClass10MathematicsFaculty.js",
  "utf8",
);

describe("CBSE Class 10 Mathematics Gate 2 plan", () => {
  it("maps all 14 videos with the two reviewed chapter decisions", () => {
    expect(manifest.assignments).toHaveLength(14);
    expect(manifest.exclusions ?? []).toHaveLength(0);
    expect(manifest.assignments[1]).toMatchObject({
      youtube_video_id: "2wYLgSGVNqY",
      chapter: "Introduction to Trigonometry",
    });
    expect(manifest.assignments[10]).toMatchObject({
      youtube_video_id: "mDV43Sdoq2Y",
      chapter: "Pair of Linear Equations in Two Variables",
    });
  });

  it("binds the exact owner-reviewed teacher decision", () => {
    expect(manifest.teacher_evidence).toMatchObject({
      decision_id: "a8feac65-7e60-43a2-bc45-e88f5979c9c1",
      youtube_playlist_id: "PLzYa_EgDSEDJQG-HEQaFMHEIVBq_oMm35",
      teacher: "Shobhit Nirwan",
      source_url: "https://www.youtube.com/@MathsByShobhitNirwan",
    });
    expect(manifest.teacher_evidence.youtube_video_ids).toHaveLength(14);
  });

  it("keeps faculty linking additive behind the exact imported baseline", () => {
    expect(linkScript).toContain("baseline.playlists !== 149");
    expect(linkScript).toContain("baseline.videos !== 1896");
    expect(linkScript).toContain("baseline.memberships !== 1900");
    expect(linkScript).toContain("baseline.chapters !== 169");
    expect(linkScript).toContain("const TEACHER_ID = 28");
    expect(linkScript).toContain("ignoreDuplicates: true");
    expect(linkScript).not.toMatch(/\.(update|delete)\(/);
  });
});
