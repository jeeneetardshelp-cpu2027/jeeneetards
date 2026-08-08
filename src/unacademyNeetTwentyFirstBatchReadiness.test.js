import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateChapterManifest } from "./scripts/ingestionSafety.js";

const reviewPath =
  "docs/reviews/unacademy-neet-twenty-first-candidate-batch-2026-08-08.json";
const readinessPath =
  "docs/unacademy-neet-twenty-first-batch-readiness-2026-08-08.md";
const manifestPaths = [
  "docs/manifests/unacademy-neet-kinetic-theory-of-gases-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-electromagnetic-waves-class-12-reviewed.json",
];

const review = JSON.parse(readFileSync(reviewPath, "utf8"));
const readiness = readFileSync(readinessPath, "utf8");
const manifests = manifestPaths.map((path) => JSON.parse(readFileSync(path, "utf8")));

function snapshotHash(candidate) {
  const rows = [...candidate.videos, ...candidate.exclusions]
    .sort((left, right) => left.source_position - right.source_position)
    .map((row) => `${row.source_position}\t${row.youtube_video_id}`)
    .join("\n");
  return createHash("sha256").update(`${rows}\n`).digest("hex");
}

describe("Unacademy NEET twenty-first-batch readiness", () => {
  it("keeps the package behind an explicit owner gate", () => {
    expect(review.review_status).toBe("owner_approval_required");
    expect(review.proposed_decision_id).toBe("9443dd70-a2c6-4747-9a5e-a9022f7012cf");
    expect(readiness).toContain("OWNER APPROVAL REQUIRED - NO PRODUCTION WRITE");
    expect(readiness).toContain("no `release` push");
  });

  it("pins the current catalogue and protected JEE boundaries", () => {
    expect(review.preflight).toMatchObject({
      playlists: 419,
      videos: 4740,
      memberships: 4746,
      chapters: 263,
      chapter_class_levels: 92,
      source_collision_count: 0,
      retained_video_collision_count: 0,
      protected_jee_courses: 82,
      protected_jee_memberships: 1304,
      protected_jee_fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
      rolling_jee_courses: 212,
      rolling_jee_memberships: 2848,
      rolling_jee_fingerprint: "9eea2b44f0b19c08cc0907c57e091342",
    });
  });

  it("contains exactly two collision-free sources and six retained videos", () => {
    expect(review.candidates).toHaveLength(2);
    expect(new Set(review.candidates.map((candidate) => candidate.youtube_playlist_id)).size)
      .toBe(2);
    expect(review.candidates.flatMap((candidate) => candidate.videos)).toHaveLength(6);
    expect(review.candidates.every((candidate) =>
      candidate.source_collision_count === 0 && candidate.video_collision_count === 0))
      .toBe(true);
    expect(review.candidates.flatMap((candidate) => candidate.videos)
      .every((video) => video.duration_seconds > 0 && video.embedding_status === "embeddable"))
      .toBe(true);
    expect(review.candidates.every((candidate) =>
      snapshotHash(candidate) === candidate.source_snapshot_sha256)).toBe(true);
  });

  it("binds the exact playlist-specific teacher evidence to the proposed decision", () => {
    expect(manifests.map((manifest) => manifest.teacher_evidence.teacher))
      .toEqual(["Shubham Kumar", "Samip Velani"]);
    expect(manifests.every((manifest) =>
      manifest.teacher_evidence.decision_id === review.proposed_decision_id)).toBe(true);
    expect(review.teacher_normalization_gate).toMatchObject({
      status: "owner_review_required",
      matching_production_teacher_records: 0,
    });
  });

  it("maps the reviewed rows exhaustively and passes the mapped importer contract", () => {
    review.candidates.forEach((candidate, index) => {
      const manifest = manifests[index];
      expect(manifest.youtube_playlist_id).toBe(candidate.youtube_playlist_id);
      expect(manifest.assignments.map((row) => row.youtube_video_id))
        .toEqual(candidate.videos.map((row) => row.youtube_video_id));
      expect(manifest.assignments.map((row) => row.lesson_number))
        .toEqual(candidate.videos.map((_, position) => position + 1));
      expect(manifest.exclusions).toEqual([]);

      const mapped = validateChapterManifest({
        manifest,
        playlistId: candidate.youtube_playlist_id,
        teacher: candidate.teacher,
        videos: candidate.videos.map((row) => ({
          videoId: row.youtube_video_id,
          title: row.title,
          sourcePosition: row.source_position - 1,
          position: row.source_position - 1,
          durationSeconds: row.duration_seconds,
          embeddingStatus: row.embedding_status,
        })),
      });
      expect(mapped.videos).toHaveLength(candidate.source_item_count);
      expect(mapped.excludedVideos).toEqual([]);
    });
  });

  it("records two clean anonymous production dry-runs", () => {
    expect(review.anonymous_dry_runs).toHaveLength(2);
    expect(review.anonymous_dry_runs.every((run) =>
      run.status === "ok" && run.review === 0 && run.blocked === 0)).toBe(true);
    expect(review.anonymous_dry_runs.map((run) => run.assignments)).toEqual([2, 4]);
    expect(readiness).toContain("1 ok / 0 review / 0 blocked");
    expect(readiness).toContain("758e1ae5dbeded33afad84250c19faf1b20e12e51dc0ced5f6c6eba3f82b91cb");
    expect(readiness).toContain("ef112fbc83d88f2a94b8ff996a26969ed41205f618bb10704bd254867235554c");
  });

  it("keeps missing Biology chapters and later mutations outside this gate", () => {
    expect(review.deferred.some((entry) => entry.includes("Mineral Nutrition"))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("Transport in Plants"))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("course 413"))).toBe(true);
    expect(readiness).toContain("+2 playlists / +6 videos / +6 memberships / +0");
    expect(readiness).toContain("No normalized faculty mutation, quality-review transition");
  });
});
