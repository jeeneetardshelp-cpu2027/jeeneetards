import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateChapterManifest } from "./scripts/ingestionSafety.js";

const readinessPath = "docs/unacademy-neet-fifteenth-batch-readiness-2026-08-06.md";
const reviewPath = "docs/reviews/unacademy-neet-fifteenth-candidate-batch-2026-08-06.json";
const manifestPaths = [
  "docs/manifests/unacademy-neet-alcohols-phenols-ethers-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-fluid-mechanics-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-kinematics-1d-class-11-reviewed.json",
];
const readiness = readFileSync(readinessPath, "utf8");
const reviewSource = readFileSync(reviewPath, "utf8");
const review = JSON.parse(reviewSource);
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const decisionId = "5b4b1d41-b7dc-4f12-80cf-b490e72edd96";

describe("Unacademy NEET fifteenth-batch readiness", () => {
  it("records the guarded partial production execution and pins the official channel", () => {
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
    expect(readiness).toContain("first course was imported create-only");
    expect(readiness).toContain("course `423`");
    expect(readiness).toContain("STOPPED before dry-run/write");
    expect(readiness).toContain("No `release` push");
  });

  it("records the source-mutation stop and exact postflight boundaries", () => {
    expect(readiness).toContain("b7a1b79c07792331919693f1b38a1ef899715cd46b5615721a4fd28b7bcca0e3");
    expect(readiness).toContain("d3d1be7d7eae2571d5dbfece4921e6c50bac95d500ccd6a55459d017a5cdc478");
    expect(readiness).toContain("+1 playlist / +11 videos / +11 memberships / +0 chapters; 0 reused");
    expect(readiness).toContain("404 / 4,666 / 4,672 / 263");
    expect(readiness).toContain("82 courses / 1,304");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("course 3 was not attempted");
    expect(readiness).toContain("fifteenth batch is now complete");
    expect(readiness).toContain("courses 423-425");
    expect(readiness).toContain("+3 playlists / +28 videos / +28 memberships / +0 chapters");
    expect(readiness).toContain("406 / 4,683 / 4,689 / 263");
  });

  it("pins the reviewed taxonomy, class scopes, and verified teachers", () => {
    expect(review.candidates.map((candidate) => ({
      subject: candidate.subject_id,
      chapter: candidate.chapter_id,
      classLevel: candidate.class_level_id,
      teacher: candidate.teacher_id,
      verified: candidate.teacher_verified,
    }))).toEqual([
      { subject: 2, chapter: 92, classLevel: 3, teacher: 36, verified: true },
      { subject: 1, chapter: 26, classLevel: 2, teacher: 34, verified: true },
      { subject: 1, chapter: 1, classLevel: 2, teacher: 34, verified: true },
    ]);
    expect(review.candidates.map((candidate) => candidate.mapping_rationale))
      .toEqual(expect.arrayContaining([
        expect.stringContaining("Organic Compounds Containing Oxygen"),
        expect.stringContaining("Mechanical Properties of Fluids"),
        expect.stringContaining("Kinematics"),
      ]));
  });

  it("keeps natural lecture order and excludes only reviewed rows", () => {
    expect(review.candidates.map((candidate) => candidate.videos.length)).toEqual([11, 11, 6]);
    expect(review.candidates.map((candidate) => candidate.exclusions.length)).toEqual([1, 1, 3]);
    for (const candidate of review.candidates) {
      expect(candidate.videos.map((video) => (
        Number(video.title.match(/\bL(?:ecture)?\s*-?\s*(\d+)\b/i)?.[1])
      ))).toEqual(candidate.videos.map((_, index) => index + 1));
    }
    expect(review.candidates[0].exclusions[0].reason)
      .toBe("different_chapter_aldehydes_ketones_carboxylic_acids");
    expect(review.candidates.slice(1).flatMap((candidate) => candidate.exclusions)
      .every((row) => row.reason === "quiz")).toBe(true);
  });

  it("pins unique, embeddable, duration-complete, unreused lectures", () => {
    const retained = review.candidates.flatMap((candidate) => candidate.videos);
    expect(retained).toHaveLength(28);
    expect(new Set(retained.map((video) => video.youtube_video_id)).size).toBe(28);
    expect(retained.every((video) => (
      video.duration_seconds > 0 && video.embedding_status === "embeddable"
    ))).toBe(true);
    expect(review.preflight).toMatchObject({
      source_collision_count: 0,
      retained_video_collision_count: 0,
      cross_candidate_retained_video_collision_count: 0,
    });
  });

  it("pins the fresh production baseline and both JEE boundaries", () => {
    expect(review.preflight).toMatchObject({
      playlists: 403,
      videos: 4655,
      memberships: 4661,
      chapters: 263,
      chapter_class_levels: 92,
      teachers: 32,
      faculty_links: 158,
      quality_reviews: 29,
      protected_jee_courses: 82,
      protected_jee_memberships: 1304,
      protected_jee_fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
      rolling_jee_courses: 212,
      rolling_jee_memberships: 2848,
      rolling_jee_fingerprint: "9eea2b44f0b19c08cc0907c57e091342",
    });
  });

  it("binds exact playlist-specific teacher evidence and assignments", () => {
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
        .toEqual(candidate.videos.map((_, lesson) => lesson + 1));
      expect(manifest.assignments.every((row) => row.chapter === candidate.chapter)).toBe(true);
      expect(manifest.exclusions.map((row) => row.reason))
        .toEqual(candidate.exclusions.map((row) => row.reason));
    }
  });

  it("passes the production importer manifest contract against the reviewed source rows", () => {
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

  it("pins immutable review, source-snapshot, and manifest hashes", () => {
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

  it("records the evidence-based deferrals", () => {
    expect(review.deferred.some((entry) => entry.includes("Organisms and Populations"))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("Aldehydes, Ketones"))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("Dr. Sachin Kapur"))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("Photosynthesis"))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("Ionic Equilibrium"))).toBe(true);
  });
});
