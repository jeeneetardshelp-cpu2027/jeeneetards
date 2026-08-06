import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readinessPath = "docs/unacademy-neet-fourteenth-batch-readiness-2026-08-06.md";
const reviewPath = "docs/reviews/unacademy-neet-fourteenth-candidate-batch-2026-08-06.json";
const manifestPaths = [
  "docs/manifests/unacademy-neet-friction-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-cell-unit-life-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-plant-anatomy-class-11-reviewed.json",
];
const readiness = readFileSync(readinessPath, "utf8");
const reviewSource = readFileSync(reviewPath, "utf8");
const review = JSON.parse(reviewSource);
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const decisionId = "b19eaa58-7931-4c84-8cea-8b6622230b4d";

describe("Unacademy NEET fourteenth-batch readiness", () => {
  it("keeps the batch review-only and pins the official source", () => {
    expect(review.review_status).toBe("owner_approval_required");
    expect(review.proposed_decision_id).toBe(decisionId);
    expect(review.channel).toMatchObject({
      handle: "@UnacademyNEET",
      youtube_channel_id: "UCdQwYksctqqiRwqp3PiJMWA",
      production_institute_id: 147,
      playlist_count: 736,
    });
    expect(readiness).toContain("No production import");
    expect(readiness).toContain("No `release` push");
  });

  it("pins the three existing Class 11 taxonomy targets and verified teachers", () => {
    expect(review.candidates.map((candidate) => ({
      subject: candidate.subject_id,
      chapter: candidate.chapter_id,
      classLevel: candidate.class_level_id,
      teacher: candidate.teacher_id,
    }))).toEqual([
      { subject: 1, chapter: 7, classLevel: 2, teacher: 34 },
      { subject: 4, chapter: 107, classLevel: 2, teacher: 33 },
      { subject: 4, chapter: 97, classLevel: 2, teacher: 33 },
    ]);
  });

  it("keeps natural lecture order and excludes only reviewed non-lecture rows", () => {
    expect(review.candidates.map((candidate) => candidate.videos.length)).toEqual([4, 4, 6]);
    expect(review.candidates.map((candidate) => candidate.exclusions.length)).toEqual([2, 1, 1]);
    for (const candidate of review.candidates) {
      expect(candidate.videos.map((video) => (
        Number(video.title.match(/\bL\s*(\d+)\b/i)?.[1])
      ))).toEqual(candidate.videos.map((_, index) => index + 1));
    }
    expect(review.candidates.flatMap((candidate) => candidate.exclusions)
      .map((row) => row.reason)).toEqual(["quiz", "private_unavailable", "quiz", "quiz"]);
  });

  it("pins unique, embeddable, duration-complete, unreused lectures", () => {
    const retained = review.candidates.flatMap((candidate) => candidate.videos);
    expect(retained).toHaveLength(14);
    expect(new Set(retained.map((video) => video.youtube_video_id)).size).toBe(14);
    expect(retained.every((video) => (
      video.duration_seconds > 0 && video.embedding_status === "embeddable"
    ))).toBe(true);
    expect(review.preflight).toMatchObject({
      source_collision_count: 0,
      retained_video_collision_count: 0,
      cross_candidate_retained_video_collision_count: 0,
    });
  });

  it("pins the quiet baseline and both JEE integrity boundaries", () => {
    expect(review.preflight).toMatchObject({
      playlists: 400,
      videos: 4641,
      memberships: 4647,
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

  it("records the three evidence-based deferrals", () => {
    expect(review.deferred).toHaveLength(3);
    expect(review.deferred.some((entry) => entry.includes("Ionic Equilibrium"))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("Excretory Products"))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("Isolation of Elements"))).toBe(true);
  });
});
