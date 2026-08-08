import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateChapterManifest } from "./scripts/ingestionSafety.js";

const reviewPath =
  "docs/reviews/unacademy-neet-twentieth-candidate-batch-2026-08-08.json";
const readinessPath =
  "docs/unacademy-neet-twentieth-batch-readiness-2026-08-08.md";
const manifests = [
  "docs/manifests/unacademy-neet-metallurgy-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-s-block-elements-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-semiconductor-electronics-class-12-reviewed.json",
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

describe("Unacademy NEET twentieth-batch readiness", () => {
  it("stays at the reviewed owner-decision gate with no production authorization", () => {
    expect(review.review_status).toBe("owner_approval_required");
    expect(review.proposed_decision_id).toBe("8de024c6-7317-4901-a91e-5006a5efcd7e");
    expect(readiness).toContain("PREPARED ONLY - OWNER APPROVAL REQUIRED");
    expect(readiness).toContain("No production write");
    expect(readiness).toContain("no `release` push");
  });

  it("pins the current read-only baseline and protected JEE boundary", () => {
    expect(review.preflight).toMatchObject({
      playlists: 416,
      videos: 4731,
      memberships: 4737,
      chapters: 263,
      source_collision_count: 0,
      retained_video_collision_count: 0,
      excluded_video_collision_count: 0,
      protected_jee_courses: 82,
      protected_jee_memberships: 1304,
      protected_jee_fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
    });
  });

  it("contains exactly three coherent sources and nine retained videos", () => {
    expect(review.candidates).toHaveLength(3);
    expect(new Set(review.candidates.map((candidate) => candidate.youtube_playlist_id)).size).toBe(3);
    expect(review.candidates.flatMap((candidate) => candidate.videos)).toHaveLength(9);
    expect(review.candidates.flatMap((candidate) => candidate.videos)
      .every((video) => video.duration_seconds > 0 && video.embedding_status === "embeddable")).toBe(true);
    expect(review.candidates.every((candidate) => snapshotHash(candidate) === candidate.source_snapshot_sha256)).toBe(true);
  });

  it("maps each retained row once and excludes only S-Block question practice", () => {
    for (const [index, manifest] of parsedManifests.entries()) {
      expect(manifest.youtube_playlist_id).toBe(review.candidates[index].youtube_playlist_id);
      expect(manifest.teacher_evidence.decision_id).toBe(review.proposed_decision_id);
      expect(manifest.assignments.map((row) => row.youtube_video_id))
        .toEqual(review.candidates[index].videos.map((row) => row.youtube_video_id));
      expect(manifest.assignments.map((row) => row.lesson_number)).toEqual([1, 2, 3]);
    }
    expect(parsedManifests[0].exclusions).toEqual([]);
    expect(parsedManifests[1].exclusions).toEqual([
      { position: 4, youtube_video_id: "ihpwvwe6Y9I", reason: "ncert_question_practice" },
      { position: 5, youtube_video_id: "4IMGrDbroK4", reason: "ncert_question_practice" },
    ]);
    expect(parsedManifests[2].exclusions).toEqual([]);
  });

  it("records three clean anonymous production dry-runs", () => {
    expect(review.anonymous_dry_runs).toHaveLength(3);
    expect(review.anonymous_dry_runs.every((run) =>
      run.status === "ok" && run.review === 0 && run.blocked === 0)).toBe(true);
    expect(review.anonymous_dry_runs.map((run) => run.assignments)).toEqual([3, 3, 3]);
    expect(review.anonymous_dry_runs.map((run) => run.exclusions)).toEqual([0, 2, 0]);
    expect(readiness).toContain("1 ok / 0 review / 0 blocked");
  });

  it("passes the mapped importer contract for every exact source snapshot", () => {
    review.candidates.forEach((candidate, index) => {
      const sourceRows = [...candidate.videos, ...candidate.exclusions]
        .sort((left, right) => left.source_position - right.source_position)
        .map((row) => ({
          videoId: row.youtube_video_id,
          title: row.title,
          sourcePosition: row.source_position - 1,
          position: row.source_position - 1,
          durationSeconds: row.duration_seconds,
          embeddingStatus: row.embedding_status,
        }));
      const mapped = validateChapterManifest({
        manifest: parsedManifests[index],
        playlistId: candidate.youtube_playlist_id,
        teacher: candidate.teacher,
        videos: sourceRows,
      });
      expect(mapped.videos).toHaveLength(3);
      expect(mapped.excludedVideos).toHaveLength(candidate.exclusions.length);
    });
  });

  it("keeps teacher normalization and quality review as later gates", () => {
    expect(review.teacher_normalization_gate).toMatchObject({
      status: "owner_review_required",
      matching_production_teacher_records: 1,
    });
    expect(review.candidates[2]).toMatchObject({
      teacher: "Indrajeet Singh Sangtani",
      teacher_id: null,
      teacher_verified: false,
    });
    expect(readiness).toContain("Normalized faculty creation/linking and quality-review");
    expect(readiness).toContain("+3 playlists / +9 videos / +9 memberships");
  });
});
