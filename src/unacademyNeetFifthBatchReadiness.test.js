import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readiness = readFileSync(
  "docs/unacademy-neet-fifth-batch-readiness-2026-08-04.md",
  "utf8",
);
const reviewSource = readFileSync(
  "docs/reviews/unacademy-neet-fifth-candidate-batch-2026-08-04.json",
  "utf8",
);
const review = JSON.parse(reviewSource);
const manifestPaths = [
  "docs/manifests/unacademy-neet-ecosystem-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-gravitation-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-wave-optics-class-12-reviewed.json",
];
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));

describe("Unacademy NEET fifth-batch production evidence", () => {
  it("pins the three official playlists in the proposed order", () => {
    expect(manifests.map((manifest) => manifest.youtube_playlist_id)).toEqual([
      "PLsgHooHkqhhNu-Uw9RzbSyF1wsdL0Q25z",
      "PLsgHooHkqhhN0mEZWnzPfkn8UcmdYg-Mx",
      "PLsgHooHkqhhMil-qxm3tGjv6Q7uJ1s1WI",
    ]);
    expect(new Set(manifests.map((manifest) => manifest.request_id)).size).toBe(3);
  });

  it("keeps every row in the three clean lecture sequences", () => {
    expect(manifests.map((manifest) => manifest.assignments.length)).toEqual([6, 5, 7]);
    expect(manifests.map((manifest) => manifest.exclusions.length)).toEqual([0, 0, 0]);
    expect(manifests.map((manifest) => (
      [...new Set(manifest.assignments.map((row) => row.chapter))]
    ))).toEqual([["Ecosystem"], ["Gravitation"], ["Wave Optics"]]);
    manifests.forEach((manifest) => {
      expect(manifest.assignments.map((row) => row.position))
        .toEqual(manifest.assignments.map((_, index) => index + 1));
      expect(manifest.assignments.map((row) => row.lesson_number))
        .toEqual(manifest.assignments.map((_, index) => index + 1));
    });
  });

  it("pins exact source evidence, taxonomy, and zero collision", () => {
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
      [109, "class-12", 33],
      [81, "class-11", 34],
      [16, "class-12", 35],
    ]);
    const videos = review.candidates.flatMap((candidate) => candidate.videos);
    expect(videos).toHaveLength(18);
    expect(new Set(videos.map((video) => video.youtube_video_id)).size).toBe(18);
    expect(videos.every((video) => (
      video.duration_seconds > 0 && video.embedding_status === "embeddable"
    ))).toBe(true);
    expect(review.candidates.every((candidate) => (
      candidate.source_collision_count === 0 && candidate.video_collision_count === 0
    ))).toBe(true);
  });

  it("pins the immutable review and manifest hashes", () => {
    expect(createHash("sha256").update(reviewSource, "utf8").digest("hex"))
      .toBe("bbc753073dc1e65a574cdf5805b700645725bc6042fd777ef0b87979c89a2204");
    expect(manifestSources.map((source) => (
      createHash("sha256").update(source, "utf8").digest("hex")
    ))).toEqual([
      "84a1eb1ad9775b08ac05051dba64b6f9afadae068b949f975a0e7c6d12df3389",
      "10bf003796e3d15a806fbf71b1b5e24622785153be17e59f62b5337d36a81cec",
      "88e09b7d35f6cabcf98661ea8bd253b5aa00409ff20786fa793f558e1b72585c",
    ]);
  });

  it("pins the approved teacher evidence and completed production gate", () => {
    expect(manifests.every((manifest) => (
      manifest.teacher_evidence?.decision_id
        === "461233dd-54d1-413f-9625-2ffe5f164226"
      && manifest.teacher_evidence.youtube_playlist_id
        === manifest.youtube_playlist_id
      && manifest.teacher_evidence.youtube_video_ids.length
        === manifest.assignments.length
    ))).toBe(true);
    expect(manifests[1].teacher_evidence.teacher).toBe("Mahendra Singh");
    expect(manifests[1].teacher_evidence.source_label).toContain("Mahendra S.");
    expect(readiness).toContain("Production execution is complete");
    expect(readiness).toContain("461233dd-54d1-413f-9625-2ffe5f164226");
    expect(readiness).toContain("Mahendra S.");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("No `release` push");
    expect(readiness).toContain("380 playlists / 4,481 videos / 4,487 memberships");
  });

  it("documents incomplete and mixed-source deferrals", () => {
    for (const label of [
      "Human Reproduction",
      "Neural Control and Coordination",
      "Animal Kingdom",
      "Hydrogen",
      "Modern Physics",
    ]) {
      expect(readiness).toContain(label);
    }
  });
});
