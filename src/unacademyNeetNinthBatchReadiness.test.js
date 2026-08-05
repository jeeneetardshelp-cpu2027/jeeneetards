import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readiness = readFileSync(
  "docs/unacademy-neet-ninth-batch-readiness-2026-08-05.md",
  "utf8",
);
const reviewSource = readFileSync(
  "docs/reviews/unacademy-neet-ninth-candidate-batch-2026-08-05.json",
  "utf8",
);
const review = JSON.parse(reviewSource);
const manifestPaths = [
  "docs/manifests/unacademy-neet-sexual-reproduction-flowering-plants-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-alternating-current-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-chemical-kinetics-class-12-reviewed.json",
];
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));

const decisionId = "b988e5f2-fbf5-4cba-bb7a-54d3dd35a3a6";
const reviewHash = "b5d6212f49c5fd3cd499e4f02ebe1b0cda53e3ab41d7ead5a2a2818060d1805b";

describe("Unacademy NEET ninth-batch candidate review", () => {
  it("records the owner approval without widening the safety boundary", () => {
    expect(review.review_status).toBe("candidate_review_complete_owner_evidence_pending");
    expect(review.proposed_decision_id).toBe(decisionId);
    expect(readiness).toContain("the owner approved");
    expect(readiness).toContain("does not authorize");
    expect(readiness).toContain("Stop on reuse, drift, or any blocker");
  });

  it("pins the three exact official source playlists", () => {
    expect(review.channel).toMatchObject({
      handle: "@UnacademyNEET",
      youtube_channel_id: "UCdQwYksctqqiRwqp3PiJMWA",
      production_institute_id: 147,
      playlist_count: 736,
    });
    expect(review.candidates.map((candidate) => candidate.youtube_playlist_id)).toEqual([
      "PLsgHooHkqhhNIEDFQnuZzTGUq9Nl2BANa",
      "PLsgHooHkqhhNaF6JnP38ojTYkuAZ5YFvd",
      "PLsgHooHkqhhNWeJHJ0f68rVPOY81tbaJa",
    ]);
  });

  it("pins complete natural lecture sequences and explicit exclusions", () => {
    expect(review.candidates.map((candidate) => candidate.videos.length)).toEqual([12, 6, 9]);
    expect(review.candidates.map((candidate) => candidate.exclusions.length)).toEqual([3, 1, 5]);
    expect(review.candidates.map((candidate) => (
      candidate.videos.map((video) => Number(video.title.match(/\bL\s?(\d+)\b/i)?.[1]))
    ))).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
    ]);
    for (const candidate of review.candidates) {
      const retained = candidate.videos.map((video) => video.source_position);
      const excluded = candidate.exclusions.map((video) => video.source_position);
      expect(retained).toEqual(candidate.retained_source_positions);
      expect(excluded).toEqual(candidate.excluded_source_positions);
      expect(new Set([...retained, ...excluded]).size).toBe(retained.length + excluded.length);
    }
  });

  it("pins taxonomy, class scopes, and existing verified teachers", () => {
    expect(review.candidates.map((candidate) => [
      candidate.subject_id,
      candidate.chapter_id,
      candidate.class_level_id,
      candidate.class_level,
      candidate.teacher_id,
      candidate.teacher,
    ])).toEqual([
      [4, 125, 3, "class-12", 33, "Pradeep Singh"],
      [1, 14, 3, "class-12", 34, "Mahendra Singh"],
      [2, 35, 3, "class-12", 36, "Anoop Vashishtha"],
    ]);
  });

  it("pins 27 unique, embeddable, duration-complete, unreused lectures", () => {
    const videos = review.candidates.flatMap((candidate) => candidate.videos);
    expect(videos).toHaveLength(27);
    expect(new Set(videos.map((video) => video.youtube_video_id)).size).toBe(27);
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

  it("pins the production baselines and immutable source evidence", () => {
    expect(review.preflight).toMatchObject({
      playlists: 388,
      videos: 4539,
      memberships: 4545,
      chapters: 247,
      protected_jee_courses: 82,
      protected_jee_memberships: 1304,
      protected_jee_fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
      rolling_jee_courses: 212,
      rolling_jee_memberships: 2848,
      rolling_jee_fingerprint: "9eea2b44f0b19c08cc0907c57e091342",
    });
    expect(review.candidates.map((candidate) => candidate.source_snapshot_sha256)).toEqual([
      "c7257a9f0ab5b59ee66961c6afb1bdd1bcc4adf8f1c9eb63d0c9cc3bb1d6bc29",
      "93d0edd374fd5aec27a189aff2dc440a29c943cf5bd83f6eb04df4edf33fe913",
      "37fe28c3f8665222ec9def54325ba2e48ab3ce9019458a18c4be2b10112a3d0c",
    ]);
    expect(createHash("sha256").update(reviewSource, "utf8").digest("hex")).toBe(reviewHash);
    expect(readiness).toContain(reviewHash);
    expect(readiness).toContain(decisionId);
  });

  it("binds the exact approved teacher evidence and lecture-only mappings", () => {
    expect(manifests.map((manifest) => manifest.youtube_playlist_id)).toEqual(
      review.candidates.map((candidate) => candidate.youtube_playlist_id),
    );
    expect(new Set(manifests.map((manifest) => manifest.request_id)).size).toBe(3);
    expect(manifests.map((manifest) => manifest.teacher_evidence.teacher)).toEqual([
      "Pradeep Singh",
      "Mahendra Singh",
      "Anoop Vashishtha",
    ]);
    expect(manifests.every((manifest) => (
      manifest.teacher_evidence.decision_id === decisionId
      && manifest.teacher_evidence.youtube_playlist_id === manifest.youtube_playlist_id
      && manifest.teacher_evidence.youtube_video_ids.length === manifest.assignments.length
    ))).toBe(true);
    expect(manifests.map((manifest) => manifest.assignments.length)).toEqual([12, 6, 9]);
    expect(manifests.map((manifest) => manifest.exclusions.length)).toEqual([3, 1, 5]);
    expect(manifests.every((manifest) => manifest.assignments.every(
      (row, index) => row.lesson_number === index + 1,
    ))).toBe(true);
  });

  it("pins the immutable approved manifest hashes", () => {
    expect(manifestSources.map((source) => (
      createHash("sha256").update(source, "utf8").digest("hex")
    ))).toEqual([
      "ab72202c44b715ac7f2281035f4f755743686c21945ce42dbc5b57d33c5eb913",
      "5a82097859bb77eba78c28d59fd7a390f5a6de8cc0e0d3514a38e78b77521ccc",
      "69ec046c66d0a65271c44c123f47e39e048f61af100b0e6398c7987ab2b43eff",
    ]);
    for (const hash of [
      "ab72202c44b715ac7f2281035f4f755743686c21945ce42dbc5b57d33c5eb913",
      "5a82097859bb77eba78c28d59fd7a390f5a6de8cc0e0d3514a38e78b77521ccc",
      "69ec046c66d0a65271c44c123f47e39e048f61af100b0e6398c7987ab2b43eff",
    ]) {
      expect(readiness).toContain(hash);
    }
  });
});
