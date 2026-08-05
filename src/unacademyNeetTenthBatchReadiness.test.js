import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256 = (path) => createHash("sha256")
  .update(readFileSync(path))
  .digest("hex");

const reviewPath = "docs/reviews/unacademy-neet-tenth-candidate-batch-2026-08-05.json";
const manifestPaths = [
  "docs/manifests/unacademy-neet-thermal-properties-of-matter-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-electromagnetic-induction-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-plant-growth-and-development-class-11-reviewed.json",
];

describe("Unacademy NEET tenth-batch readiness", () => {
  it("pins the exact read-only baseline and protected JEE boundary", () => {
    const review = readJson(reviewPath);
    expect(review.review_status).toBe("production_import_complete");
    expect(review.proposed_decision_id).toBe("0fab6ecf-934f-46ae-bb8a-05cbd6b9cea1");
    expect(review.preflight).toMatchObject({
      playlists: 391,
      videos: 4566,
      memberships: 4572,
      chapters: 263,
      source_collision_count: 0,
      retained_video_collision_count: 0,
      cross_candidate_retained_video_collision_count: 0,
      protected_jee_courses: 82,
      protected_jee_memberships: 1304,
      protected_jee_fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
    });
  });

  it("keeps three complete, disjoint, embeddable lecture sequences", () => {
    const review = readJson(reviewPath);
    expect(review.candidates.map((candidate) => candidate.youtube_playlist_id)).toEqual([
      "PLsgHooHkqhhNB7vXo5H5J-QsBotPAPYUR",
      "PLsgHooHkqhhNvpnnFH79_2cZGiXgI3zlt",
      "PLsgHooHkqhhOn3bqr2nMVYEGq3Zh5bMDF",
    ]);
    expect(review.candidates.map((candidate) => candidate.videos.length)).toEqual([4, 3, 5]);
    expect(review.candidates.map((candidate) => candidate.excluded.length)).toEqual([0, 0, 0]);
    const ids = review.candidates.flatMap((candidate) => candidate.videos.map((video) => video.youtube_video_id));
    expect(new Set(ids).size).toBe(12);
    for (const candidate of review.candidates) {
      expect(candidate.video_collision_count).toBe(0);
      expect(candidate.source_collision_count).toBe(0);
      expect(candidate.videos.every((video) => video.duration_seconds > 0)).toBe(true);
      expect(candidate.videos.every((video) => video.embedding_status === "embeddable")).toBe(true);
    }
  });

  it("binds exact teacher evidence and one scoped chapter per manifest", () => {
    const review = readJson(reviewPath);
    const manifests = manifestPaths.map(readJson);
    expect(manifests.map((manifest) => manifest.teacher_evidence.teacher)).toEqual([
      "Mahendra Singh", "Anu Gupta", "Pradeep Singh",
    ]);
    expect(manifests.map((manifest) => manifest.assignments.length)).toEqual([4, 3, 5]);
    expect(manifests.map((manifest) => manifest.exclusions.length)).toEqual([0, 0, 0]);
    for (const [index, manifest] of manifests.entries()) {
      const candidate = review.candidates[index];
      expect(manifest.teacher_evidence.decision_id).toBe(review.proposed_decision_id);
      expect(manifest.youtube_playlist_id).toBe(candidate.youtube_playlist_id);
      expect(manifest.teacher_evidence.youtube_video_ids).toEqual(
        candidate.videos.map((video) => video.youtube_video_id),
      );
      expect(manifest.assignments.map((assignment) => assignment.position)).toEqual(
        candidate.retained_source_positions,
      );
      expect(new Set(manifest.assignments.map((assignment) => assignment.chapter))).toEqual(
        new Set([candidate.chapter]),
      );
    }
  });

  it("keeps immutable manifest hashes visible to reviewers", () => {
    expect(manifestPaths.map(sha256)).toEqual([
      "a556ad839168188023d6f70c587b6f54b3a8ad8a9c46d8e3637cd9e388fac5e5",
      "83fc258aa8a7637078149ac456377a865ba0647585d77f22f9db238581653351",
      "bf3bfdb3602eb79ea76ccb3400eb65864ff9175c0eeb94a8d52628129c2b9d03",
    ]);
  });

  it("records the exact create-only production result and both JEE boundaries", () => {
    const review = readJson(reviewPath);
    expect(review.production_execution).toMatchObject({
      approved_decision_id: "0fab6ecf-934f-46ae-bb8a-05cbd6b9cea1",
      final_catalogue: {
        playlists: 394,
        videos: 4578,
        memberships: 4584,
        chapters: 263,
      },
      delta: {
        playlists: 3,
        videos: 12,
        memberships: 12,
        chapters: 0,
        videos_reused: 0,
      },
      protected_jee_after: {
        courses: 82,
        memberships: 1304,
        fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
      },
      rolling_jee_after: {
        courses: 212,
        memberships: 2848,
        fingerprint: "9eea2b44f0b19c08cc0907c57e091342",
      },
    });
    expect(review.candidates.map((candidate) => candidate.production_import.course_id))
      .toEqual([411, 412, 413]);
    expect(review.candidates.every((candidate) => (
      candidate.production_import.videos_reused === 0
      && candidate.production_import.chapters_created === 0
      && candidate.production_import.protected_jee_fingerprint_after
        === "30eee4a4a6842e5beeb7c97083d7f812"
    ))).toBe(true);
    expect(review.production_execution.audit_note).toMatch(/no rows/i);
  });
});
