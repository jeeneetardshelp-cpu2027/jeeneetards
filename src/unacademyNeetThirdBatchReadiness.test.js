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

  it("records the prepared manifest hashes and the zero-write approval boundary", () => {
    const hashes = manifestSources.map((source) => (
      createHash("sha256").update(source, "utf8").digest("hex")
    ));
    expect(hashes).toEqual([
      "2b63de83a2f2f9652cb5639ab7ed422bd1be8baa3384891829e3f30a26960bfb",
      "1e08268195e6b95c28d6bce41371a222851a9b074009e160b5348c59903d058b",
      "a9c25c040665d10b58235062ba9fd485c758569fd4eb5226db4590e3ba971b4a",
    ]);
    expect(readiness).toContain("Read-only preparation complete; owner approval is still required");
    expect(readiness).toContain("a6ed2229-85bd-4f4a-afea-fd7f3a166199");
    expect(readiness).toContain("c742fabf93ff8dd33d6ecd5eb4793db0");
    expect(readiness).toContain("No `release` push");
    expect(manifests.every((manifest) => manifest.teacher_evidence === undefined)).toBe(true);
  });

  it("defers the incomplete Animal Kingdom playlist instead of hiding the gap", () => {
    expect(readiness).toContain("Explicit deferral: Animal Kingdom");
    expect(readiness).toContain("PLsgHooHkqhhOcUymC3AOhf_uSoh_IIvcw");
    expect(readiness).toContain("source position 3");
    expect(readiness).toContain("Phoenix 2.0");
    expect(readiness).toContain("missing Sachin Sir Lecture 3");
  });
});
