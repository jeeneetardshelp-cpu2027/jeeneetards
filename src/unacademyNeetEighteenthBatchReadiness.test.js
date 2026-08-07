import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateChapterManifest } from "./scripts/ingestionSafety.js";

const readinessPath = "docs/unacademy-neet-eighteenth-batch-readiness-2026-08-07.md";
const reviewPath = "docs/reviews/unacademy-neet-eighteenth-candidate-batch-2026-08-07.json";
const manifestPaths = [
  "docs/manifests/unacademy-neet-photosynthesis-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-ionic-equilibrium-ashwani-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-excretory-system-sachin-class-11-reviewed.json",
];
const readiness = readFileSync(readinessPath, "utf8");
const reviewSource = readFileSync(reviewPath, "utf8");
const review = JSON.parse(reviewSource);
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const decisionId = "8f19ac66-a1b4-4304-8a6f-468131f63732";

describe("Unacademy NEET eighteenth-batch readiness", () => {
  it("pins the official channel and remains owner-approval-only", () => {
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
    expect(readiness).toContain("Prepared and reviewed locally only");
    expect(readiness).toContain("No production write and no `release` push occurred");
  });

  it("pins the fresh catalogue and both JEE boundaries", () => {
    expect(review.preflight).toEqual({
      captured_at: "2026-08-07T09:35:45.408388Z",
      playlists: 410,
      videos: 4705,
      memberships: 4711,
      chapters: 263,
      chapter_class_levels: 92,
      teachers: 34,
      faculty_links: 165,
      quality_reviews: 36,
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

  it("uses the exact reviewed course, chapter, class, and teacher order", () => {
    expect(review.candidates).toHaveLength(3);
    expect(review.candidates.map((candidate) => ({
      order: candidate.order,
      playlist: candidate.youtube_playlist_id,
      chapterId: candidate.chapter_id,
      chapter: candidate.chapter,
      teacherId: candidate.teacher_id,
      teacher: candidate.teacher,
    }))).toEqual([
      {
        order: 1,
        playlist: "PLsgHooHkqhhOnifSHdglxvopt3ZmRFQ5-",
        chapterId: 119,
        chapter: "Photosynthesis in Higher Plants",
        teacherId: 33,
        teacher: "Pradeep Singh",
      },
      {
        order: 2,
        playlist: "PLsgHooHkqhhN29ebCtU31NQc4RSZQDJ0z",
        chapterId: 38,
        chapter: "Ionic Equilibrium",
        teacherId: 32,
        teacher: "Ashwani Tyagi",
      },
      {
        order: 3,
        playlist: "PLsgHooHkqhhPG_PVhW2TE7Ll_Rw2QUdu5",
        chapterId: 111,
        chapter: "Excretory Products and Their Elimination",
        teacherId: 38,
        teacher: "Dr. Sachin Kapur",
      },
    ]);
    expect(review.candidates.every((candidate) =>
      candidate.class_level === "class-11"
      && candidate.class_level_id === 2
      && candidate.teacher_verified
      && candidate.teacher_record_status === "normalized_record_present"
      && candidate.source_collision_count === 0
      && candidate.video_collision_count === 0)).toBe(true);
    expect(review.teacher_normalization_gate).toMatchObject({
      status: "satisfied",
      matching_production_teacher_records: 3,
      teachers: [
        { teacher_id: 32, teacher_slug: "ashwani-tyagi", teacher_verified: true },
        { teacher_id: 33, teacher_slug: "pradeep-singh", teacher_verified: true },
        { teacher_id: 38, teacher_slug: "sachin-kapur", teacher_verified: true },
      ],
    });
  });

  it("retains only the 18 reviewed lectures in official source order", () => {
    expect(review.candidates.map((candidate) => candidate.retained_source_positions)).toEqual([
      [1, 2, 3],
      [1, 2, 3, 4, 5, 6, 7, 8],
      [1, 2, 3, 4, 5, 6, 7],
    ]);
    expect(review.candidates.map((candidate) => candidate.excluded_source_positions)).toEqual([
      [4],
      [],
      [8, 9, 10, 11, 12],
    ]);
    expect(review.candidates.flatMap((candidate) => candidate.videos)).toHaveLength(18);
    expect(review.candidates.flatMap((candidate) => candidate.exclusions)).toHaveLength(6);
    expect(review.candidates.flatMap((candidate) => candidate.exclusions).map((row) => row.reason))
      .toEqual(["quiz", "quiz", "quiz", "quiz", "mixed_chapter_quiz", "mixed_chapter_quiz"]);
    expect(review.candidates.every((candidate) =>
      candidate.videos.map((row) => row.source_position).join(",")
      === candidate.retained_source_positions.join(","))).toBe(true);
    expect(review.candidates.flatMap((candidate) => candidate.videos).every((video) =>
      video.duration_seconds > 0 && video.embedding_status === "embeddable")).toBe(true);
  });

  it("binds each exact playlist to its reviewed teacher evidence", () => {
    review.candidates.forEach((candidate, index) => {
      const manifest = manifests[index];
      expect(manifest.youtube_playlist_id).toBe(candidate.youtube_playlist_id);
      expect(manifest.teacher_evidence).toMatchObject({
        decision_id: decisionId,
        youtube_playlist_id: candidate.youtube_playlist_id,
        teacher: candidate.teacher,
      });
      expect(manifest.teacher_evidence.youtube_video_ids)
        .toEqual(candidate.videos.map((video) => video.youtube_video_id));
      expect(manifest.assignments.map((row) => row.lesson_number))
        .toEqual(candidate.videos.map((_, videoIndex) => videoIndex + 1));
      expect(manifest.assignments.every((row) => row.chapter === candidate.chapter)).toBe(true);
    });
  });

  it("passes the production importer contract for all three manifests", () => {
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
        manifest: manifests[index],
        playlistId: candidate.youtube_playlist_id,
        teacher: candidate.teacher,
        videos: sourceRows,
      });
      expect(mapped.videos).toHaveLength(candidate.videos.length);
      expect(mapped.excludedVideos).toHaveLength(candidate.exclusions.length);
    });
  });

  it("pins the expected additive delta and immutable hashes", () => {
    expect(readiness).toContain("+3 playlists / +18 videos / +18 memberships");
    expect(readiness).toContain("+0 chapters");
    expect(readiness).toContain("413 / 4,723 / 4,729 / 263");
    review.candidates.forEach((candidate) => {
      const sourceHash = sha256(JSON.stringify({
        youtube_playlist_id: candidate.youtube_playlist_id,
        source_title: candidate.source_title,
        videos: candidate.videos,
        exclusions: candidate.exclusions,
      }));
      expect(candidate.source_snapshot_sha256).toBe(sourceHash);
      expect(readiness).toContain(sourceHash);
    });
    expect(readiness).toContain(sha256(reviewSource));
    manifestSources.forEach((source) => expect(readiness).toContain(sha256(source)));
  });
});
