import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readinessPath = "docs/unacademy-neet-eleventh-batch-readiness-2026-08-06.md";
const reviewPath = "docs/reviews/unacademy-neet-eleventh-candidate-batch-2026-08-06.json";
const manifestPaths = [
  "docs/manifests/unacademy-neet-chemical-equilibrium-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-surface-chemistry-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-p-block-elements-class-12-reviewed.json",
];
const readiness = readFileSync(readinessPath, "utf8");
const reviewSource = readFileSync(reviewPath, "utf8");
const review = JSON.parse(reviewSource);
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const decisionId = "d8125eb3-7281-43da-bfd4-61acd655121f";

describe("Unacademy NEET eleventh-batch readiness", () => {
  it("is preparation-only and pins the exact official source boundary", () => {
    expect(review.review_status).toBe("candidate_review_complete_owner_evidence_pending");
    expect(review.proposed_decision_id).toBe(decisionId);
    expect(review.channel).toMatchObject({
      handle: "@UnacademyNEET",
      youtube_channel_id: "UCdQwYksctqqiRwqp3PiJMWA",
      production_institute_id: 147,
      playlist_count: 736,
    });
    expect(readiness).toContain("No production write");
    expect(readiness).toContain("Production execution remains a separate gate");
  });

  it("pins the three reviewed playlists, taxonomy, scopes, and verified teacher", () => {
    expect(review.candidates.map((candidate) => candidate.youtube_playlist_id)).toEqual([
      "PLsgHooHkqhhPqS8MzgJCKn9bJwGRsR3Jl",
      "PLsgHooHkqhhP5Nu98FZfS--EqYQpo15KT",
      "PLsgHooHkqhhM_8IsqTEL1V6sDYskLuymO",
    ]);
    expect(review.candidates.map((candidate) => [
      candidate.subject_id,
      candidate.chapter_id,
      candidate.class_level_id,
      candidate.class_level,
      candidate.teacher_id,
      candidate.teacher,
    ])).toEqual([
      [2, 30, 2, "class-11", 36, "Anoop Vashishtha"],
      [2, 32, 3, "class-12", 36, "Anoop Vashishtha"],
      [2, 93, 3, "class-12", 36, "Anoop Vashishtha"],
    ]);
  });

  it("keeps complete natural lecture sequences and excludes only reviewed quizzes", () => {
    expect(review.candidates.map((candidate) => candidate.videos.length)).toEqual([10, 5, 10]);
    expect(review.candidates.map((candidate) => candidate.exclusions.length)).toEqual([0, 2, 0]);
    expect(review.candidates.map((candidate) => candidate.videos.map((video) => (
      Number(video.title.match(/\bL\s?(\d+)\b/i)?.[1])
    )))).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      [1, 2, 3, 4, 5],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    ]);
    expect(review.candidates[1].exclusions.every((row) => row.reason === "quiz")).toBe(true);
  });

  it("pins 25 unique, embeddable, duration-complete, unreused lectures", () => {
    const videos = review.candidates.flatMap((candidate) => candidate.videos);
    expect(videos).toHaveLength(25);
    expect(new Set(videos.map((video) => video.youtube_video_id)).size).toBe(25);
    expect(videos.every((video) => (
      video.duration_seconds > 0 && video.embedding_status === "embeddable"
    ))).toBe(true);
    expect(review.candidates.every((candidate) => (
      candidate.source_collision_count === 0 && candidate.video_collision_count === 0
    ))).toBe(true);
    expect(review.preflight).toMatchObject({
      source_collision_count: 0,
      retained_video_collision_count: 0,
      cross_candidate_retained_video_collision_count: 0,
    });
  });

  it("pins the current catalogue and both JEE integrity boundaries", () => {
    expect(review.preflight).toMatchObject({
      playlists: 394,
      videos: 4578,
      memberships: 4584,
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

  it("binds exact playlist-specific teacher evidence and mappings", () => {
    expect(manifests.map((manifest) => manifest.youtube_playlist_id)).toEqual(
      review.candidates.map((candidate) => candidate.youtube_playlist_id),
    );
    expect(new Set(manifests.map((manifest) => manifest.request_id)).size).toBe(3);
    expect(manifests.every((manifest) => (
      manifest.teacher_evidence.decision_id === decisionId
      && manifest.teacher_evidence.teacher === "Anoop Vashishtha"
      && manifest.teacher_evidence.youtube_playlist_id === manifest.youtube_playlist_id
      && manifest.teacher_evidence.youtube_video_ids.length === manifest.assignments.length
    ))).toBe(true);
    expect(manifests.map((manifest) => manifest.assignments.length)).toEqual([10, 5, 10]);
    expect(manifests.map((manifest) => manifest.exclusions.length)).toEqual([0, 2, 0]);
    expect(manifests.every((manifest) => manifest.assignments.every(
      (row, index) => row.lesson_number === index + 1,
    ))).toBe(true);
  });

  it("pins immutable review, source-snapshot, and manifest hashes", () => {
    expect(sha256(reviewSource)).toBe(
      "359c962a51aaae458743bd46553446d0988aae0b1dc1fbf2e8964b95c9a1a400",
    );
    expect(review.candidates.map((candidate) => sha256(JSON.stringify({
      youtube_playlist_id: candidate.youtube_playlist_id,
      source_title: candidate.source_title,
      videos: candidate.videos,
      exclusions: candidate.exclusions,
    })))).toEqual([
      "e6feeab7ac984edcd316a4aee700dc23593c5a276d6e66f379371a1f9b0296ac",
      "0d791b1b922a3208c8d0e899e93972026ea145a7a383bc985db3ac976c60b230",
      "1d440750d5566618c4ba4d5c63987f2df738752e1add2bdbb19cde95625b24fa",
    ]);
    expect(manifestSources.map(sha256)).toEqual([
      "bbbf4dc07bf64c08cca9d5973e381ee4443c9187d87338318570e64fd3327b7a",
      "08549a06e9b0f03b2cad85ee7823bb304a4f3c1c37d42246d8cdfc4b813b863d",
      "8953b553b5fd6799e1805ced1e197b056f208398d3be4be067de2217a5f1c606",
    ]);
    for (const hash of [
      "359c962a51aaae458743bd46553446d0988aae0b1dc1fbf2e8964b95c9a1a400",
      "bbbf4dc07bf64c08cca9d5973e381ee4443c9187d87338318570e64fd3327b7a",
      "08549a06e9b0f03b2cad85ee7823bb304a4f3c1c37d42246d8cdfc4b813b863d",
      "8953b553b5fd6799e1805ced1e197b056f208398d3be4be067de2217a5f1c606",
    ]) expect(readiness).toContain(hash);
  });

  it("defers incomplete or materially larger sources", () => {
    expect(review.deferred.some((entry) => (
      entry.includes("Coordination Compounds") && entry.includes("Lecture 11")
    ))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("Atomic Structure"))).toBe(true);
    expect(readiness).toContain("Projected additive delta if separately approved");
  });
});
