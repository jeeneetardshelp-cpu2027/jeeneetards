import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readiness = readFileSync(
  "docs/unacademy-neet-seventh-batch-readiness-2026-08-04.md",
  "utf8",
);
const reviewSource = readFileSync(
  "docs/reviews/unacademy-neet-seventh-candidate-batch-2026-08-04.json",
  "utf8",
);
const review = JSON.parse(reviewSource);
const manifestPaths = [
  "docs/manifests/unacademy-neet-biodiversity-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-cell-cycle-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-microbes-class-12-reviewed.json",
];
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));

describe("Unacademy NEET seventh-batch read-only readiness", () => {
  it("pins the three official playlists in the proposed order", () => {
    expect(manifests.map((manifest) => manifest.youtube_playlist_id)).toEqual([
      "PLsgHooHkqhhOLWySbDetaU3Z-KiEBLE63",
      "PLsgHooHkqhhMbUvz0HhRZwLrpa4--2M1F",
      "PLsgHooHkqhhMeV7vEcqRc91GnmR15_eHw",
    ]);
    expect(new Set(manifests.map((manifest) => manifest.request_id)).size).toBe(3);
  });

  it("retains complete numbered lecture sequences", () => {
    expect(manifests.map((manifest) => manifest.assignments.length)).toEqual([5, 7, 4]);
    expect(manifests.map((manifest) => manifest.exclusions.length)).toEqual([0, 0, 0]);
    expect(manifests.map((manifest) => (
      [...new Set(manifest.assignments.map((row) => row.chapter))]
    ))).toEqual([
      ["Biodiversity and Conservation"],
      ["Cell Cycle and Cell Division"],
      ["Microbes in Human Welfare"],
    ]);
    expect(manifests[0].assignments.map((row) => row.lesson_number))
      .toEqual([1, 2, 3, 5, 4]);
    expect(manifests.slice(1).every((manifest) => (
      manifest.assignments.every((row, index) => row.lesson_number === index + 1)
    ))).toBe(true);
  });

  it("pins source evidence, taxonomy, class scopes, and zero collisions", () => {
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
      [99, "class-12", 33],
      [106, "class-11", 33],
      [115, "class-12", 33],
    ]);
    expect(review.candidates.every((candidate) => (
      candidate.chapter_class_scope.startsWith("canonical")
      && candidate.source_collision_count === 0
      && candidate.video_collision_count === 0
    ))).toBe(true);
  });

  it("pins all 16 embeddable retained rows without overlap", () => {
    const videos = review.candidates.flatMap((candidate) => candidate.videos);
    expect(videos).toHaveLength(16);
    expect(new Set(videos.map((video) => video.youtube_video_id)).size).toBe(16);
    expect(videos.every((video) => (
      video.duration_seconds > 0 && video.embedding_status === "embeddable"
    ))).toBe(true);
    expect(review.candidates.every((candidate) => candidate.excluded_videos.length === 0))
      .toBe(true);
  });

  it("pins the immutable review and manifest hashes", () => {
    expect(createHash("sha256").update(reviewSource, "utf8").digest("hex"))
      .toBe("bba2fed3d160261d9a34b7177665b1e3d2ba8f26e2e7410972cf74ae10cd3e20");
    expect(manifestSources.map((source) => (
      createHash("sha256").update(source, "utf8").digest("hex")
    ))).toEqual([
      "a980124726b9242075ce4f91d642943efb0814ce663ec3a8c4cad93ef139813b",
      "cf62f0ee5e90152038d13e09b8e9923b78fd4cde4a64909d559dbf17961702ee",
      "8504035c22590941032b6993a54b58499a5f03b6bf7b9a40d3cf87ed4c4688b4",
    ]);
  });

  it("keeps teacher binding and production writes behind owner approval", () => {
    expect(manifests.every((manifest) => manifest.teacher_evidence == null)).toBe(true);
    expect(readiness).toContain("Read-only preparation is complete");
    expect(readiness).toContain("cf45d7d5-43ef-4311-abd7-5297ec2ea3b6");
    expect(readiness).toContain("Pradeep Sir");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("No `release` push");
  });

  it("documents incomplete and contaminated-source deferrals", () => {
    for (const label of [
      "Photosynthesis",
      "Human Reproduction",
      "Neural Control and Coordination",
      "Animal Kingdom",
    ]) {
      expect(readiness).toContain(label);
    }
  });
});
