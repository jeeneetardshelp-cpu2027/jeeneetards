import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readiness = readFileSync(
  "docs/unacademy-neet-fourth-batch-readiness-2026-08-04.md",
  "utf8",
);
const manifestPaths = [
  "docs/manifests/unacademy-neet-human-health-disease-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-body-fluids-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-mole-concept-class-11-reviewed.json",
];
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));

describe("Unacademy NEET fourth-batch read-only readiness", () => {
  it("pins the three official source playlists in the proposed order", () => {
    expect(manifests.map((manifest) => manifest.youtube_playlist_id)).toEqual([
      "PLsgHooHkqhhOBJpGejuKlJjjyqLGSUgax",
      "PLsgHooHkqhhPqQIxg5ou5zcgC6_72mepm",
      "PLsgHooHkqhhPW2M3F7WjhzIUSjTFDJrek",
    ]);
    expect(new Set(manifests.map((manifest) => manifest.request_id)).size).toBe(3);
  });

  it("keeps only the reviewed lecture sequences", () => {
    expect(manifests.map((manifest) => manifest.assignments.length)).toEqual([17, 7, 9]);
    expect(manifests.map((manifest) => manifest.exclusions.length)).toEqual([1, 7, 3]);
    expect(manifests.map((manifest) => (
      [...new Set(manifest.assignments.map((row) => row.chapter))]
    ))).toEqual([
      ["Human Health and Disease"],
      ["Body Fluids and Circulation"],
      ["Mole Concept"],
    ]);
  });

  it("pins natural lesson order independently from source position", () => {
    manifests.forEach((manifest) => {
      expect([...manifest.assignments.map((row) => row.lesson_number)].sort((a, b) => a - b))
        .toEqual(Array.from(
          { length: manifest.assignments.length },
          (_, index) => index + 1,
        ));
      expect(manifest.assignments.every((row, index, rows) => (
        index === 0 || rows[index - 1].position < row.position
      ))).toBe(true);
    });
    expect(manifests[0].assignments.find((row) => row.position === 18)?.lesson_number)
      .toBe(12);
  });

  it("covers each refreshed source row exactly once", () => {
    expect(manifests.map((manifest) => (
      manifest.assignments.length + manifest.exclusions.length
    ))).toEqual([18, 14, 12]);
    manifests.forEach((manifest) => {
      const rows = [...manifest.assignments, ...manifest.exclusions];
      expect(new Set(rows.map((row) => row.position)).size).toBe(rows.length);
      expect(new Set(rows.map((row) => row.youtube_video_id)).size).toBe(rows.length);
      expect(manifest.exclusions.every((row) => row.reason.trim().length > 0)).toBe(true);
    });
  });

  it("pins evidence-bound hashes and the completed production gate", () => {
    expect(manifestSources.map((source) => (
      createHash("sha256").update(source, "utf8").digest("hex")
    ))).toEqual([
      "8009aab3febb9864003631c8ec228e31ff8f91f81346c390a0948bcd2f0b67a5",
      "90a85e8b13e76a6581e8dda5f3c0bd8c5891095d7ae84d12b7cfeecdf0e9dab1",
      "bf7fd69806cc83083b15df2c7d589932ebd33af75d589e7cab9a36d3ff6ea9fd",
    ]);
    expect(readiness).toContain("Production execution is complete");
    expect(readiness).toContain("0bd393bd-1ad4-4ed7-8f23-74b59dee5a23");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("No `release` push");
    expect(manifests.every((manifest) => (
      manifest.teacher_evidence?.decision_id
        === "0bd393bd-1ad4-4ed7-8f23-74b59dee5a23"
      && manifest.teacher_evidence.youtube_playlist_id
        === manifest.youtube_playlist_id
      && manifest.teacher_evidence.youtube_video_ids.length
        === manifest.assignments.length
    ))).toBe(true);
    expect(readiness).toContain("377 playlists / 4,463 videos / 4,469 memberships");
  });

  it("documents the three incomplete source deferrals", () => {
    expect(readiness).toContain("Human Reproduction");
    expect(readiness).toContain("Neural Control and Coordination");
    expect(readiness).toContain("Animal Kingdom");
    expect(readiness).toContain("Phoenix 2.0");
  });
});
