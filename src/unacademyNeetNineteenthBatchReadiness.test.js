import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reviewPath =
  "docs/reviews/unacademy-neet-nineteenth-candidate-batch-2026-08-07.json";
const readinessPath =
  "docs/unacademy-neet-nineteenth-batch-readiness-2026-08-07.md";
const manifests = [
  "docs/manifests/unacademy-neet-d-f-block-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-amines-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-thermochemistry-class-11-reviewed.json",
];

const review = JSON.parse(readFileSync(reviewPath, "utf8"));
const readiness = readFileSync(readinessPath, "utf8");
const parsedManifests = manifests.map((path) => JSON.parse(readFileSync(path, "utf8")));

function snapshotHash(candidate) {
  const rows = [...candidate.videos, ...candidate.exclusions]
    .sort((a, b) => a.source_position - b.source_position)
    .map((row) => `${row.source_position}\t${row.youtube_video_id}`)
    .join("\n");
  return createHash("sha256").update(`${rows}\n`).digest("hex");
}

describe("Unacademy NEET nineteenth-batch readiness", () => {
  it("stays behind a separate owner approval gate", () => {
    expect(review.review_status).toBe("owner_approval_required");
    expect(review.proposed_decision_id).toBe("e6539ac8-512b-4e76-8bd1-774c1a3c4bdc");
    expect(readiness).toContain("PREPARED, NOT APPROVED, NOT IMPORTED");
    expect(readiness).toContain("No production write");
    expect(readiness).toContain("1 ok / 0 review / 0 blocked");
  });

  it("pins the exact quiet-window baseline and protected JEE boundary", () => {
    expect(review.preflight).toMatchObject({
      playlists: 413,
      videos: 4723,
      memberships: 4729,
      chapters: 263,
      source_collision_count: 0,
      retained_video_collision_count: 0,
      protected_jee_courses: 82,
      protected_jee_memberships: 1304,
      protected_jee_fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
    });
  });

  it("contains exactly three clean official sources and eight retained videos", () => {
    expect(review.candidates).toHaveLength(3);
    expect(new Set(review.candidates.map((candidate) => candidate.youtube_playlist_id)).size).toBe(3);
    expect(review.candidates.flatMap((candidate) => candidate.videos)).toHaveLength(8);
    expect(review.candidates.flatMap((candidate) => candidate.videos)
      .every((video) => video.duration_seconds > 0 && video.embedding_status === "embeddable")).toBe(true);
    expect(review.candidates.every((candidate) => snapshotHash(candidate) === candidate.source_snapshot_sha256)).toBe(true);
  });

  it("maps every retained row exactly once and excludes only the Thermochemistry quiz", () => {
    expect(parsedManifests).toHaveLength(3);
    for (const [index, manifest] of parsedManifests.entries()) {
      expect(manifest.youtube_playlist_id).toBe(review.candidates[index].youtube_playlist_id);
      expect(manifest.teacher_evidence.decision_id).toBe(review.proposed_decision_id);
      expect(manifest.assignments.map((row) => row.youtube_video_id))
        .toEqual(review.candidates[index].videos.map((row) => row.youtube_video_id));
      expect(manifest.assignments.map((row) => row.lesson_number))
        .toEqual(manifest.assignments.map((_, rowIndex) => rowIndex + 1));
    }
    expect(parsedManifests[0].exclusions).toEqual([]);
    expect(parsedManifests[1].exclusions).toEqual([]);
    expect(parsedManifests[2].exclusions).toEqual([
      { position: 4, youtube_video_id: "cv6mAJ4wd3Q", reason: "quiz" },
    ]);
  });
});
