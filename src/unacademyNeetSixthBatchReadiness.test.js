import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readiness = readFileSync(
  "docs/unacademy-neet-sixth-batch-readiness-2026-08-04.md",
  "utf8",
);
const reviewSource = readFileSync(
  "docs/reviews/unacademy-neet-sixth-candidate-batch-2026-08-04.json",
  "utf8",
);
const review = JSON.parse(reviewSource);
const manifestPaths = [
  "docs/manifests/unacademy-neet-hydrogen-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-modern-physics-class-12-reviewed.json",
];
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));

describe("Unacademy NEET sixth-batch read-only readiness", () => {
  it("pins the two official playlists in the proposed order", () => {
    expect(manifests.map((manifest) => manifest.youtube_playlist_id)).toEqual([
      "PLsgHooHkqhhP65sAqtkbWpVVSrK7FlTWA",
      "PLsgHooHkqhhMQWo55rneDci-gmYynS9Za",
    ]);
    expect(new Set(manifests.map((manifest) => manifest.request_id)).size).toBe(2);
  });

  it("retains only the numbered lecture sequences", () => {
    expect(manifests.map((manifest) => manifest.assignments.length)).toEqual([6, 11]);
    expect(manifests.map((manifest) => manifest.exclusions.length)).toEqual([3, 1]);
    expect(manifests.map((manifest) => (
      [...new Set(manifest.assignments.map((row) => row.chapter))]
    ))).toEqual([["Hydrogen"], ["Modern Physics"]]);
    manifests.forEach((manifest) => {
      expect(manifest.assignments.map((row) => row.position))
        .toEqual(manifest.assignments.map((_, index) => index + 1));
      expect(manifest.assignments.map((row) => row.lesson_number))
        .toEqual(manifest.assignments.map((_, index) => index + 1));
    });
  });

  it("pins source evidence, taxonomy, scope behavior, and zero collisions", () => {
    expect(review.channel).toMatchObject({
      youtube_channel_id: "UCdQwYksctqqiRwqp3PiJMWA",
      handle: "@UnacademyNEET",
      public_playlist_count: 736,
    });
    expect(review.candidates.map((candidate) => [
      candidate.chapter_id,
      candidate.class_level,
      candidate.teacher_id,
    ])).toEqual([
      [44, "class-11", 36],
      [83, "class-12", 35],
    ]);
    expect(review.candidates[0].chapter_class_scope).toContain("playlist fallback");
    expect(review.candidates[1].chapter_class_scope).toBe("canonical class-12 row");
    expect(review.candidates.every((candidate) => (
      candidate.source_collision_count === 0 && candidate.video_collision_count === 0
    ))).toBe(true);
  });

  it("pins all retained and excluded source rows without overlap", () => {
    const retained = review.candidates.flatMap((candidate) => candidate.videos);
    const excluded = review.candidates.flatMap((candidate) => candidate.excluded_videos);
    const allIds = [...retained, ...excluded].map((video) => video.youtube_video_id);
    expect(retained).toHaveLength(17);
    expect(excluded).toHaveLength(4);
    expect(new Set(allIds).size).toBe(21);
    expect(retained.every((video) => (
      video.duration_seconds > 0 && video.embedding_status === "embeddable"
    ))).toBe(true);
    expect(excluded.every((video) => (
      video.duration_seconds > 0 && video.embedding_status === "embeddable"
    ))).toBe(true);
  });

  it("pins the immutable review and manifest hashes", () => {
    expect(createHash("sha256").update(reviewSource, "utf8").digest("hex"))
      .toBe("13a1fa8516cba60d4d9d9bbdb1ca1dd467c6d91fcdafb8e8e669e05830e97f26");
    expect(manifestSources.map((source) => (
      createHash("sha256").update(source, "utf8").digest("hex")
    ))).toEqual([
      "2f18a04cb837fa73b8683c9a8bb88a34d66ea3c4fe0da7e301855fd936c1c405",
      "9efc26ea9a25dbd933a7ddf2f9860b8737ab19a983488a6e8ac023323aa17deb",
    ]);
  });

  it("keeps teacher binding and every production write behind approval", () => {
    expect(manifests.every((manifest) => manifest.teacher_evidence == null)).toBe(true);
    expect(readiness).toContain("Read-only preparation is complete");
    expect(readiness).toContain("1d0ea7b9-8cac-4f3b-968d-82b4307f264a");
    expect(readiness).toContain("Anoop V.");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("No `release` push");
  });

  it("documents the still-incomplete numbered sequences", () => {
    for (const label of [
      "Human Reproduction",
      "Neural Control and Coordination",
      "Animal Kingdom",
    ]) {
      expect(readiness).toContain(label);
    }
  });
});
