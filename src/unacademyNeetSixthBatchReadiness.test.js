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

describe("Unacademy NEET sixth-batch production evidence", () => {
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
      "38da2bc6041a2bed8ad0b3d5aaafeaf785c07a92d9f533529a441c4ba13df446",
      "9958cc9ba7b733a879ee1e3639c71e1ed65fc292ffd4285e9d83ed11d408780e",
    ]);
  });

  it("binds owner-reviewed teacher evidence and pins execution evidence", () => {
    expect(manifests.map((manifest) => manifest.teacher_evidence.teacher)).toEqual([
      "Anoop Vashishtha",
      "Anu Gupta",
    ]);
    manifests.forEach((manifest) => {
      expect(manifest.teacher_evidence.decision_id)
        .toBe("1d0ea7b9-8cac-4f3b-968d-82b4307f264a");
      expect(manifest.teacher_evidence.youtube_video_ids)
        .toEqual(manifest.assignments.map((row) => row.youtube_video_id));
    });
    expect(readiness).toContain("Production execution is complete");
    expect(readiness).toContain("Course 400");
    expect(readiness).toContain("Course 401");
    expect(readiness).toContain("382 playlists / 4,498 videos / 4,504 memberships");
    expect(readiness).toContain("Anoop V.");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("zero normalized");
    expect(readiness).toContain("No `release` push occurred");
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
