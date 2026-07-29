import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(
    resolve("docs/manifests/cbse-class10-science-shobhit-nirwan.json"),
    "utf8",
  ),
);
const facultySql = readFileSync(
  resolve("docs/sql/add_shobhit_nirwan_science_faculty_2026-07-28.sql"),
  "utf8",
);

describe("CBSE Class 10 Science Gate 2 plan", () => {
  it("maps nine reviewed lectures and excludes the two non-chapter entries", () => {
    expect(manifest.youtube_playlist_id).toBe(
      "PLo9JtLytZaK1wxHXpkXanN_XNxhXg-aoV",
    );
    expect(manifest.assignments).toHaveLength(9);
    expect(manifest.exclusions).toEqual([
      expect.objectContaining({ position: 1, youtube_video_id: "W6qKiMwqBYs" }),
      expect.objectContaining({ position: 2, youtube_video_id: "RpJZz91y5_A" }),
    ]);
    expect(
      new Set(
        [...manifest.assignments, ...manifest.exclusions].map(
          ({ youtube_video_id: id }) => id,
        ),
      ).size,
    ).toBe(11);
  });

  it("binds only the owner-reviewed Shobhit Nirwan evidence decision", () => {
    expect(manifest.teacher_evidence).toMatchObject({
      version: 1,
      kind: "reviewed_external_source",
      decision_id: "bcdcd82a-52dd-4f3a-b7da-75a1b637293e",
      teacher: "Shobhit Nirwan",
      youtube_playlist_id: "PLo9JtLytZaK1wxHXpkXanN_XNxhXg-aoV",
    });
    expect(manifest.teacher_evidence.youtube_video_ids).toHaveLength(9);
  });

  it("keeps the additive faculty write behind the exact post-import baseline", () => {
    expect(facultySql).toMatch(/count\(\*\) from public\.playlists\) <> 148/i);
    expect(facultySql).toMatch(/count\(\*\) from public\.videos\) <> 1882/i);
    expect(facultySql).toMatch(
      /count\(\*\) from public\.playlist_videos\) <> 1886/i,
    );
    expect(facultySql).toMatch(/count\(\*\) from public\.chapters\) <> 159/i);
    expect(facultySql).toMatch(/public\.create_teacher\(/i);
    expect(facultySql).toMatch(/on conflict .* do nothing/ims);
    expect(facultySql).not.toMatch(/\b(update|delete|truncate|drop)\b/i);
  });
});
