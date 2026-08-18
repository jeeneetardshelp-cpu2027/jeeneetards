import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateChapterManifest } from "./scripts/ingestionSafety.js";

const readinessPath = "docs/unacademy-neet-sixteenth-batch-readiness-2026-08-07.md";
const reviewPath = "docs/reviews/unacademy-neet-sixteenth-candidate-batch-2026-08-07.json";
const manifestPaths = [
  "docs/manifests/unacademy-neet-applications-biotechnology-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-living-world-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-reproductive-health-class-12-reviewed.json",
];
const readiness = readFileSync(readinessPath, "utf8");
const reviewSource = readFileSync(reviewPath, "utf8");
const review = JSON.parse(reviewSource);
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const decisionId = "f7992243-3b5b-4c39-bac9-433dd766a70a";

describe("Unacademy NEET sixteenth-batch readiness", () => {
  it("pins the official channel and records the completed content import", () => {
    expect(review).toMatchObject({
      review_status: "owner_approval_required",
      proposed_decision_id: decisionId,
      channel: {
        handle: "@UnacademyNEET",
        youtube_channel_id: "UCdQwYksctqqiRwqp3PiJMWA",
        production_institute_id: 147,
        playlist_count: 736,
      },
    });
    expect(readiness).toContain("CONTENT IMPORT COMPLETED IN PRODUCTION");
    expect(readiness).toContain("courses 426-428");
    expect(readiness).toContain("+3 / +16 / +16 / +0");
    expect(readiness).toContain("409 playlists / 4,699 videos / 4,705");
    expect(readiness).toContain("82 courses / 1,304 memberships");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("no `release` push occurred");
  });

  it("pins the fresh public catalogue and JEE boundaries", () => {
    expect(review.preflight).toMatchObject({
      playlists: 406,
      videos: 4683,
      memberships: 4689,
      chapters: 263,
      chapter_class_levels: 92,
      teachers: 32,
      faculty_links: 161,
      quality_reviews_last_confirmed: 32,
      source_collision_count: 0,
      retained_video_collision_count: 0,
      cross_candidate_retained_video_collision_count: 0,
      protected_jee_courses: 82,
      protected_jee_memberships: 1304,
      protected_jee_fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
      rolling_jee_courses: 212,
      rolling_jee_memberships: 2848,
      rolling_jee_fingerprint: "9eea2b44f0b19c08cc0907c57e091342",
    });
  });

  it("records the exact taxonomy and missing normalization gate", () => {
    expect(review.candidates.map((candidate) => ({
      subject: candidate.subject_id,
      chapter: candidate.chapter_id,
      classLevel: candidate.class_level_id,
      teacher: candidate.teacher,
      teacherId: candidate.teacher_id,
      teacherStatus: candidate.teacher_record_status,
    }))).toEqual([
      { subject: 4, chapter: 102, classLevel: 3, teacher: "Seep Pahuja", teacherId: null, teacherStatus: "normalized_record_missing" },
      { subject: 4, chapter: 127, classLevel: 2, teacher: "Dr. Sachin Kapur", teacherId: null, teacherStatus: "normalized_record_missing" },
      { subject: 4, chapter: 123, classLevel: 3, teacher: "Dr. Sachin Kapur", teacherId: null, teacherStatus: "normalized_record_missing" },
    ]);
    expect(review.teacher_normalization_gate).toMatchObject({
      status: "owner_decision_required",
      matching_production_teacher_records: 0,
      required_new_teacher_records: ["Seep Pahuja", "Dr. Sachin Kapur"],
    });
  });

  it("keeps only reviewed lecture rows in source order", () => {
    expect(review.candidates.map((candidate) => candidate.videos.length)).toEqual([4, 5, 7]);
    expect(review.candidates.map((candidate) => candidate.exclusions.length)).toEqual([0, 2, 5]);
    for (const candidate of review.candidates) {
      expect(candidate.videos.map((video) => video.source_position))
        .toEqual(candidate.retained_source_positions);
      expect(candidate.exclusions.map((video) => video.source_position))
        .toEqual(candidate.excluded_source_positions);
    }
    expect(review.candidates[1].exclusions.map((row) => row.reason))
      .toEqual(["practice_dpp", "mixed_chapter_quiz"]);
    expect(review.candidates[2].exclusions.every((row) =>
      ["quiz", "practice_dpp", "mixed_chapter_quiz"].includes(row.reason))).toBe(true);
  });

  it("pins unique, embeddable, duration-complete, unreused lectures", () => {
    const retained = review.candidates.flatMap((candidate) => candidate.videos);
    expect(retained).toHaveLength(16);
    expect(new Set(retained.map((video) => video.youtube_video_id)).size).toBe(16);
    expect(retained.every((video) =>
      video.duration_seconds > 0 && video.embedding_status === "embeddable")).toBe(true);
    expect(review.candidates.every((candidate) =>
      candidate.source_collision_count === 0 && candidate.video_collision_count === 0)).toBe(true);
  });

  it("binds the proposed decision and exact teacher evidence independently", () => {
    for (const [index, manifest] of manifests.entries()) {
      const candidate = review.candidates[index];
      expect(manifest.youtube_playlist_id).toBe(candidate.youtube_playlist_id);
      expect(manifest.teacher_evidence).toMatchObject({
        decision_id: decisionId,
        youtube_playlist_id: candidate.youtube_playlist_id,
        teacher: candidate.teacher,
      });
      expect(manifest.teacher_evidence.youtube_video_ids)
        .toEqual(candidate.videos.map((video) => video.youtube_video_id));
      expect(manifest.assignments.map((row) => row.lesson_number))
        .toEqual(candidate.videos.map((_, index) => index + 1));
      expect(manifest.assignments.every((row) => row.chapter === candidate.chapter)).toBe(true);
    }
  });

  it("passes the production importer manifest contract against every reviewed source row", () => {
    for (const [index, manifest] of manifests.entries()) {
      const candidate = review.candidates[index];
      const sourceRows = [...candidate.videos, ...candidate.exclusions]
        .sort((left, right) => left.source_position - right.source_position)
        .map((row) => ({
          videoId: row.youtube_video_id,
          title: row.title,
          sourcePosition: row.source_position - 1,
          position: row.source_position - 1,
          durationSeconds: row.duration_seconds,
          embeddingStatus: row.embedding_status ?? "embeddable",
        }));
      const mapped = validateChapterManifest({
        manifest,
        playlistId: candidate.youtube_playlist_id,
        teacher: candidate.teacher,
        videos: sourceRows,
      });
      expect(mapped.videos).toHaveLength(candidate.videos.length);
      expect(mapped.excludedVideos).toHaveLength(candidate.exclusions.length);
    }
  });

  it("pins immutable source and file hashes", () => {
    for (const candidate of review.candidates) {
      const sourceHash = sha256(JSON.stringify({
        youtube_playlist_id: candidate.youtube_playlist_id,
        source_title: candidate.source_title,
        videos: candidate.videos,
        exclusions: candidate.exclusions,
      }));
      expect(candidate.source_snapshot_sha256).toBe(sourceHash);
      expect(readiness).toContain(sourceHash);
    }
    expect(readiness).toContain(sha256(reviewSource));
    for (const manifestSource of manifestSources) {
      expect(readiness).toContain(sha256(manifestSource));
    }
  });
});
