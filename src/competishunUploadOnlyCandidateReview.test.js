import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reviewSource = readFileSync(
  "docs/reviews/competishun-upload-only-candidate-batch-2026-08-03.json",
  "utf8",
);
const review = JSON.parse(reviewSource);

describe("Competishun upload-only candidate review", () => {
  it("is explicitly read-only and not production authorization", () => {
    expect(review.status).toBe("review-ready-not-authorized");
    expect(review.read_only).toBe(true);
    expect(review.attribution.requires_owner_reaffirmation_for_this_batch).toBe(true);
  });

  it("matches the hash reviewed in the readiness report", () => {
    expect(createHash("sha256").update(reviewSource, "utf8").digest("hex")).toBe(
      "62277b6f2378d448f87b1ea7578682b426cfa2c9b4b0f87712b67d8cef1cd850",
    );
  });

  it("pins two source-ID-null courses and five unique official-channel videos", () => {
    expect(review.courses).toHaveLength(2);
    expect(review.courses.every((course) => course.youtube_playlist_id === null)).toBe(true);
    expect(
      review.courses.every((course) =>
        ["full-course", "one-shot", "revision", "pyq", "practice"].includes(
          course.content_type,
        ),
      ),
    ).toBe(true);

    const videos = review.courses.flatMap((course) => course.videos);
    expect(videos).toHaveLength(5);
    expect(new Set(videos.map((video) => video.youtube_video_id)).size).toBe(5);
    expect(videos.every((video) => video.privacy_status === "public")).toBe(true);
    expect(videos.every((video) => video.embedding_status === "allowed")).toBe(true);
  });

  it("preserves reviewed ordering and canonical chapter assignments", () => {
    const [jahnTeller, ioqc] = review.courses;
    expect(jahnTeller.chapter).toEqual({ id: 87, name: "Coordination Compounds" });
    expect(jahnTeller.videos.map((video) => video.position)).toEqual([1, 2]);
    expect(ioqc.chapter).toEqual({ id: 295, name: "IOQC Solutions" });
    expect(ioqc.videos.map((video) => video.position)).toEqual([1, 2, 3]);
  });

  it("pins the post-v14 protected JEE safety baseline", () => {
    expect(review.baseline).toMatchObject({
      protected_jee_courses: 83,
      protected_jee_memberships: 1307,
      protected_jee_fingerprint: "c742fabf93ff8dd33d6ecd5eb4793db0",
    });
  });
});
