import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readinessPath = "docs/unacademy-neet-twelfth-batch-readiness-2026-08-06.md";
const reviewPath = "docs/reviews/unacademy-neet-twelfth-candidate-batch-2026-08-06.json";
const manifestPath = "docs/manifests/unacademy-neet-atomic-structure-class-11-reviewed.json";
const readiness = readFileSync(readinessPath, "utf8");
const reviewSource = readFileSync(reviewPath, "utf8");
const review = JSON.parse(reviewSource);
const manifestSource = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestSource);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const decisionId = "227d1fa5-a7b9-4af2-b6b7-305e90edb412";

describe("Unacademy NEET twelfth-batch readiness", () => {
  it("records the completed production import and pins the official source", () => {
    expect(review.review_status).toBe("production_import_complete");
    expect(review.proposed_decision_id).toBe(decisionId);
    expect(review.channel).toMatchObject({
      handle: "@UnacademyNEET",
      youtube_channel_id: "UCdQwYksctqqiRwqp3PiJMWA",
      production_institute_id: 147,
      playlist_count: 736,
    });
    expect(readiness).toContain("Production import completed");
    expect(readiness).toContain("No schema migration");
  });

  it("pins the canonical taxonomy, class, and verified teacher", () => {
    const [candidate] = review.candidates;
    expect(candidate).toMatchObject({
      youtube_playlist_id: "PLsgHooHkqhhNW5IzFI54d-RGuxgvOpfn3",
      subject_id: 2,
      chapter_id: 37,
      chapter: "Atomic Structure",
      class_level_id: 2,
      class_level: "class-11",
      teacher_id: 36,
      teacher: "Anoop Vashishtha",
    });
  });

  it("keeps the complete L1-L14 lecture sequence and excludes all 14 practice rows", () => {
    const [candidate] = review.candidates;
    expect(candidate.videos.map((video) => (
      Number(video.title.match(/\bL\s?(\d+)\b/i)?.[1])
    ))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(candidate.exclusions).toHaveLength(14);
    expect(candidate.exclusions.slice(0, 10).every((row) => row.reason === "quiz")).toBe(true);
    expect(candidate.exclusions.slice(10).every(
      (row) => row.reason === "broad_physical_chemistry_mega_quiz",
    )).toBe(true);
  });

  it("pins unique, embeddable, duration-complete, unreused lectures", () => {
    const [candidate] = review.candidates;
    expect(candidate.videos).toHaveLength(14);
    expect(new Set(candidate.videos.map((video) => video.youtube_video_id)).size).toBe(14);
    expect(candidate.videos.every((video) => (
      video.duration_seconds > 0 && video.embedding_status === "embeddable"
    ))).toBe(true);
    expect(review.preflight).toMatchObject({
      source_collision_count: 0,
      retained_video_collision_count: 0,
      cross_candidate_retained_video_collision_count: 0,
    });
  });

  it("pins current catalogue and both JEE integrity boundaries", () => {
    expect(review.preflight).toMatchObject({
      playlists: 397,
      videos: 4603,
      memberships: 4609,
      chapters: 263,
      chapter_class_levels: 92,
      teachers: 32,
      protected_jee_courses: 82,
      protected_jee_memberships: 1304,
      protected_jee_fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
      rolling_jee_courses: 212,
      rolling_jee_memberships: 2848,
      rolling_jee_fingerprint: "9eea2b44f0b19c08cc0907c57e091342",
    });
  });

  it("binds playlist-specific teacher evidence and exact reviewed assignments", () => {
    const [candidate] = review.candidates;
    expect(manifest.youtube_playlist_id).toBe(candidate.youtube_playlist_id);
    expect(manifest.teacher_evidence).toMatchObject({
      decision_id: decisionId,
      youtube_playlist_id: candidate.youtube_playlist_id,
      teacher: "Anoop Vashishtha",
    });
    expect(manifest.teacher_evidence.youtube_video_ids).toEqual(
      candidate.videos.map((video) => video.youtube_video_id),
    );
    expect(manifest.assignments.map((row) => row.lesson_number)).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    );
    expect(manifest.assignments.every((row) => row.chapter === "Atomic Structure")).toBe(true);
    expect(manifest.exclusions).toHaveLength(14);
  });

  it("pins immutable review, source-snapshot, and manifest hashes", () => {
    const [candidate] = review.candidates;
    const sourceHash = sha256(JSON.stringify({
      youtube_playlist_id: candidate.youtube_playlist_id,
      source_title: candidate.source_title,
      videos: candidate.videos,
      exclusions: candidate.exclusions,
    }));
    expect(candidate.source_snapshot_sha256).toBe(sourceHash);
    for (const hash of [sha256(reviewSource), sourceHash, sha256(manifestSource)]) {
      expect(readiness).toContain(hash);
    }
  });

  it("keeps incomplete candidates deferred", () => {
    expect(review.deferred.some((entry) => (
      entry.includes("Coordination Compounds") && entry.includes("Lecture 11")
    ))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("Locomotion and Movement"))).toBe(true);
    expect(readiness).toContain("The completed additive delta");
  });

  it("records the exact create-only production result and both JEE boundaries", () => {
    expect(review.production_execution).toMatchObject({
      approved_decision_id: decisionId,
      final_catalogue: {
        playlists: 398,
        videos: 4617,
        memberships: 4623,
        chapters: 263,
      },
      delta: {
        playlists: 1,
        videos: 14,
        memberships: 14,
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
      import_contract: "reviewed_single_chapter_legacy_merge_with_new_source_guard",
      audit_snapshot_expected: false,
      request_replay_expected: false,
    });
    expect(review.candidates[0].production_import).toMatchObject({
      course_id: 417,
      videos_added: 14,
      memberships_added: 14,
      videos_reused: 0,
      chapters_created: 0,
      protected_jee_fingerprint_after: "30eee4a4a6842e5beeb7c97083d7f812",
    });
  });
});
