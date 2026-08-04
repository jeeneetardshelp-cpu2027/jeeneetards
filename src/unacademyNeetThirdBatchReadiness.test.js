import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readiness = readFileSync(
  "docs/unacademy-neet-third-batch-readiness-2026-08-04.md",
  "utf8",
);
const manifestPaths = [
  "docs/manifests/unacademy-neet-plant-morphology-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-plant-kingdom-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-ray-optics-class-12-reviewed.json",
];
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));

describe("Unacademy NEET third-batch read-only readiness", () => {
  it("pins the three official source playlists in the proposed order", () => {
    expect(manifests.map((manifest) => manifest.youtube_playlist_id)).toEqual([
      "PLsgHooHkqhhOkppPbQFJ1cbTT_IRK2zY9",
      "PLsgHooHkqhhNrWNVOeHEpvWwoNIE4yD7s",
      "PLsgHooHkqhhOk8KTfwoET_2kSfZ1TcYoV",
    ]);
    expect(new Set(manifests.map((manifest) => manifest.request_id)).size).toBe(3);
  });

  it("maps the reviewed lecture-only counts to the exact canonical chapters", () => {
    expect(manifests.map((manifest) => manifest.assignments.length)).toEqual([18, 11, 10]);
    expect(manifests.map((manifest) => manifest.exclusions.length)).toEqual([3, 6, 6]);
    expect(manifests.map((manifest) => (
      [...new Set(manifest.assignments.map((row) => row.chapter))]
    ))).toEqual([
      ["Morphology of Flowering Plants"],
      ["Plant Kingdom"],
      ["Ray Optics and Optical Instruments"],
    ]);
    manifests.forEach((manifest) => {
      expect(manifest.assignments.map((row) => row.lesson_number)).toEqual(
        Array.from({ length: manifest.assignments.length }, (_, index) => index + 1),
      );
    });
  });

  it("covers every source position exactly once and keeps non-lecture modes out", () => {
    expect(manifests.map((manifest) => (
      manifest.assignments.length + manifest.exclusions.length
    ))).toEqual([21, 17, 16]);
    manifests.forEach((manifest) => {
      const rows = [...manifest.assignments, ...manifest.exclusions];
      expect(new Set(rows.map((row) => row.position)).size).toBe(rows.length);
      expect(new Set(rows.map((row) => row.youtube_video_id)).size).toBe(rows.length);
      expect(manifest.exclusions.every((row) => row.reason.trim().length > 0)).toBe(true);
    });
    expect(manifests[2].exclusions.map((row) => row.position)).toEqual([
      9, 12, 13, 14, 15, 16,
    ]);
  });

  it("records the evidence-bound manifest hashes and rebaselined approval boundary", () => {
    const hashes = manifestSources.map((source) => (
      createHash("sha256").update(source, "utf8").digest("hex")
    ));
    expect(hashes).toEqual([
      "cc977352bb977d04a26f18bb3d27f9eaba996a190929ab3b75c9607c7f930841",
      "3ba7d3b374180d12be172f851c408677cd1a9c1b1ceaab8b0bb7c1f7238e5031",
      "63e4dc0a09a3fd1111c64c56a20b5f145b231c4d92e608093fe0a9c47a7599a6",
    ]);
    expect(readiness).toContain("Read-only preparation and owner evidence approval are complete");
    expect(readiness).toContain("a6ed2229-85bd-4f4a-afea-fd7f3a166199");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("No `release` push");
    expect(manifests.every((manifest) => (
      manifest.teacher_evidence?.decision_id === "a6ed2229-85bd-4f4a-afea-fd7f3a166199"
      && manifest.teacher_evidence.youtube_playlist_id === manifest.youtube_playlist_id
      && manifest.teacher_evidence.youtube_video_ids.length === manifest.assignments.length
    ))).toBe(true);
  });

  it("defers the incomplete Animal Kingdom playlist instead of hiding the gap", () => {
    expect(readiness).toContain("Explicit deferral: Animal Kingdom");
    expect(readiness).toContain("PLsgHooHkqhhOcUymC3AOhf_uSoh_IIvcw");
    expect(readiness).toContain("source position 3");
    expect(readiness).toContain("Phoenix 2.0");
    expect(readiness).toContain("missing Sachin Sir Lecture 3");
  });
});
