import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateChapterManifest } from "./scripts/ingestionSafety.js";

const readinessPath = "docs/unacademy-neet-seventeenth-batch-readiness-2026-08-07.md";
const reviewPath = "docs/reviews/unacademy-neet-seventeenth-candidate-batch-2026-08-07.json";
const manifestPath = "docs/manifests/unacademy-neet-breathing-exchange-gases-class-11-reviewed.json";
const readiness = readFileSync(readinessPath, "utf8");
const reviewSource = readFileSync(reviewPath, "utf8");
const review = JSON.parse(reviewSource);
const manifestSource = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestSource);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const decisionId = "ae4a8549-84d5-4784-91ed-2f56e4208d88";

describe("Unacademy NEET seventeenth-batch readiness", () => {
  it("pins the official channel and records the completed production import", () => {
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
    expect(readiness).toContain("course `429`");
    expect(readiness).toContain("`release` push occurred");
  });

  it("records the exact additive delta and unchanged JEE boundaries", () => {
    expect(readiness).toContain("410 playlists / 4,705 videos / 4,711 memberships / 263 chapters");
    expect(readiness).toContain("+1 / +6 / +6 / +0");
    expect(readiness).toContain("1 ok / 0 review / 0 blocked");
    expect(readiness).toContain("82 / 1,304");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("212 / 2,848");
    expect(readiness).toContain("9eea2b44f0b19c08cc0907c57e091342");
    expect(readiness).toContain("https://www.jeeneetard.com/course/429/chapter/105");
    expect(readiness).toContain("official YouTube iframe for `bmF2tmenuMI`");
    expect(readiness).toContain("playlist_teachers` link for course 429 remains absent");
  });

  it("pins the fresh public catalogue and protected JEE boundaries", () => {
    expect(review.preflight).toMatchObject({
      playlists: 409,
      videos: 4699,
      memberships: 4705,
      chapters: 263,
      chapter_class_levels: 92,
      teachers: 34,
      faculty_links: 164,
      quality_reviews_last_confirmed: 35,
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

  it("uses the existing chapter and verified normalized teacher", () => {
    expect(review.candidates).toHaveLength(1);
    expect(review.candidates[0]).toMatchObject({
      subject_id: 4,
      chapter_id: 105,
      chapter: "Breathing and Exchange of Gases",
      class_level_id: 2,
      class_level: "class-11",
      teacher_id: 38,
      teacher: "Dr. Sachin Kapur",
      teacher_verified: true,
      teacher_record_status: "normalized_record_present",
      source_collision_count: 0,
      video_collision_count: 0,
    });
    expect(review.teacher_normalization_gate).toMatchObject({
      status: "satisfied",
      matching_production_teacher_records: 1,
      teacher_id: 38,
      teacher_slug: "sachin-kapur",
      teacher_verified: true,
    });
  });

  it("keeps only L1-L6 and excludes every quiz row", () => {
    const candidate = review.candidates[0];
    expect(candidate.retained_source_positions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(candidate.excluded_source_positions).toEqual([7, 8, 9, 10]);
    expect(candidate.videos.map((video) => video.source_position))
      .toEqual(candidate.retained_source_positions);
    expect(candidate.exclusions.map((video) => video.source_position))
      .toEqual(candidate.excluded_source_positions);
    expect(candidate.exclusions.map((row) => row.reason))
      .toEqual(["quiz", "quiz", "mixed_chapter_quiz", "quiz"]);
    expect(candidate.videos.every((video) =>
      video.duration_seconds > 0 && video.embedding_status === "embeddable")).toBe(true);
  });

  it("binds the proposed playlist-specific teacher evidence", () => {
    const candidate = review.candidates[0];
    expect(manifest.youtube_playlist_id).toBe(candidate.youtube_playlist_id);
    expect(manifest.teacher_evidence).toMatchObject({
      decision_id: decisionId,
      youtube_playlist_id: candidate.youtube_playlist_id,
      teacher: candidate.teacher,
    });
    expect(manifest.teacher_evidence.youtube_video_ids)
      .toEqual(candidate.videos.map((video) => video.youtube_video_id));
    expect(manifest.assignments.map((row) => row.lesson_number))
      .toEqual([1, 2, 3, 4, 5, 6]);
    expect(manifest.assignments.every((row) => row.chapter === candidate.chapter)).toBe(true);
  });

  it("passes the production importer manifest contract", () => {
    const candidate = review.candidates[0];
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
    expect(mapped.videos).toHaveLength(6);
    expect(mapped.excludedVideos).toHaveLength(4);
  });

  it("pins immutable source and file hashes", () => {
    const candidate = review.candidates[0];
    const sourceHash = sha256(JSON.stringify({
      youtube_playlist_id: candidate.youtube_playlist_id,
      source_title: candidate.source_title,
      videos: candidate.videos,
      exclusions: candidate.exclusions,
    }));
    expect(candidate.source_snapshot_sha256).toBe(sourceHash);
    expect(readiness).toContain(sourceHash);
    expect(readiness).toContain(sha256(reviewSource));
    expect(readiness).toContain(sha256(manifestSource));
  });
});
