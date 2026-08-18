import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reviewSource = readFileSync(
  "docs/reviews/competishun-math-olympiad-qualifier-candidate-2026-08-03.json",
  "utf8",
);
const review = JSON.parse(reviewSource);

describe("Competishun Mathematics Olympiad qualifier candidate review", () => {
  it("is explicitly read-only and not production authorization", () => {
    expect(review.status).toBe("review-ready-not-authorized");
    expect(review.read_only).toBe(true);
    expect(review.attribution.requires_owner_reaffirmation_for_this_batch).toBe(true);
    expect(review.approval_required).toHaveLength(4);
  });

  it("matches the hash reviewed in the readiness report", () => {
    expect(createHash("sha256").update(reviewSource, "utf8").digest("hex")).toBe(
      "74a36d79fbf709c5a9ade7c3fca74dfeccbfa8f5e410928e84e2fe8df36c6d3f",
    );
  });

  it("pins four unique official-channel videos in natural exam order", () => {
    expect(review.courses).toHaveLength(1);
    const course = review.courses[0];
    expect(course.youtube_playlist_id).toBeNull();
    expect(course.videos.map((video) => video.youtube_video_id)).toEqual([
      "dows6wBBk3A",
      "3YvuUlM2OHY",
      "2qm5UjRyIcs",
      "X3BWR79DtyU",
    ]);
    expect(course.videos.map((video) => video.position)).toEqual([1, 2, 3, 4]);
    expect(new Set(course.videos.map((video) => video.youtube_video_id)).size).toBe(4);
    expect(course.videos.every((video) => video.privacy_status === "public")).toBe(true);
    expect(course.videos.every((video) => video.embedding_status === "allowed")).toBe(true);
    expect(review.source.candidate_videos_in_public_playlists).toBe(0);
  });

  it("keeps the qualifier separate from INMO and requires one additive chapter", () => {
    expect(review.reference_data.proposed_chapter).toEqual({
      name: "PRMO and IOQM Solutions",
      exists: false,
      requires_create_only_reference_write: true,
      must_not_be_collapsed_into: "INMO Solutions",
    });
    expect(review.courses[0].projected_delta).toEqual({
      playlists: 1,
      videos: 4,
      memberships: 4,
      chapters: 1,
    });
  });

  it("pins the post-v14 protected JEE safety baseline", () => {
    expect(review.baseline).toMatchObject({
      protected_jee_courses: 83,
      protected_jee_memberships: 1307,
      protected_jee_fingerprint: "c742fabf93ff8dd33d6ecd5eb4793db0",
    });
  });
});
