import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reviewSource = readFileSync(
  "docs/reviews/unacademy-neet-first-candidate-batch-2026-08-03.json",
  "utf8",
);
const review = JSON.parse(reviewSource);

describe("Unacademy NEET first candidate review", () => {
  it("pins the completed owner-approved import and its safety conditions", () => {
    expect(review.status).toBe("imported-production");
    expect(review.read_only).toBe(false);
    expect(review.attribution.requires_owner_decision_for_this_batch).toBe(false);
    expect(review.attribution.decision_id).toBe("6579f542-da9b-499f-bd46-3aa796ea4f27");
    expect(review.approval.status).toBe("approved-for-create-only-sequential-import");
  });

  it("matches the hash recorded in the production handoff", () => {
    expect(createHash("sha256").update(reviewSource, "utf8").digest("hex")).toBe(
      "e52912308e05a5da3047e65cbf08a97bf3d6eb32e2732c6710462cdcfca24f82",
    );
  });

  it("pins three playlist-backed courses and 44 unique lecture videos", () => {
    expect(review.courses).toHaveLength(3);
    expect(review.courses.map((course) => course.videos.length)).toEqual([15, 15, 14]);
    const videos = review.courses.flatMap((course) => course.videos);
    expect(videos).toHaveLength(44);
    expect(new Set(videos.map((video) => video.youtube_video_id)).size).toBe(44);
    expect(videos.every((video) => video.duration_seconds > 0)).toBe(true);
    expect(review.selection_policy.production_video_reuse).toBe(0);
    expect(review.selection_policy.cross_candidate_video_reuse).toBe(0);
  });

  it("keeps practice and revision outside the lecture catalogue", () => {
    const dropped = review.courses.flatMap((course) => course.dropped_source_videos);
    expect(dropped).toHaveLength(10);
    expect(dropped.every((video) => /practice|recap|revision|DPP/i.test(video.reason))).toBe(true);
    const keptIds = new Set(
      review.courses.flatMap((course) => course.videos.map((video) => video.youtube_video_id)),
    );
    expect(dropped.every((video) => !keptIds.has(video.youtube_video_id))).toBe(true);
  });

  it("pins three independent clean anonymous production dry-runs", () => {
    expect(review.courses.map((course) => course.anonymous_production_dry_run.status)).toEqual([
      "ok",
      "ok",
      "ok",
    ]);
    expect(review.courses.every((course) => (
      course.anonymous_production_dry_run.effective_status === "ok"
      && course.anonymous_production_dry_run.quality_findings === 0
      && course.anonymous_production_dry_run.readiness_findings === 0
      && course.anonymous_production_dry_run.mapped_capability_version === 12
    ))).toBe(true);
  });

  it("uses existing canonical chapters with exact class scopes", () => {
    expect(review.courses.map((course) => ({
      chapter: course.chapter,
      class_levels: course.class_levels,
    }))).toEqual([
      {
        chapter: { id: 86, name: "Chemical Bonding and Molecular Structure" },
        class_levels: ["class-11"],
      },
      {
        chapter: { id: 110, name: "Evolution" },
        class_levels: ["class-12"],
      },
      {
        chapter: { id: 122, name: "Principles of Inheritance and Variation" },
        class_levels: ["class-12"],
      },
    ]);
    expect(review.projected_final_counts).toEqual({
      playlists: 332,
      videos: 3908,
      memberships: 3914,
      chapters: 245,
    });
  });

  it("records three zero-reuse production imports and the exact final delta", () => {
    expect(review.courses.map((course) => course.production_import.course_id)).toEqual([
      341,
      342,
      343,
    ]);
    expect(review.courses.map((course) => course.production_import.videos_added)).toEqual([
      15,
      15,
      14,
    ]);
    expect(review.courses.every((course) => (
      course.production_import.videos_reused === 0
      && course.production_import.chapters_created === 0
      && course.production_import.protected_jee_fingerprint_after
        === "c742fabf93ff8dd33d6ecd5eb4793db0"
    ))).toBe(true);
    expect(review.final_verification).toMatchObject({
      playlists: 332,
      videos: 3908,
      memberships: 3914,
      chapters: 245,
      courses_added: 3,
      videos_added: 44,
      memberships_added: 44,
      videos_reused: 0,
      unexpected_video_reuse: 0,
    });
  });

  it("pins the protected and rolling JEE evidence separately", () => {
    expect(review.baseline).toMatchObject({
      protected_jee_courses: 83,
      protected_jee_memberships: 1307,
      protected_jee_fingerprint: "c742fabf93ff8dd33d6ecd5eb4793db0",
      rolling_jee_courses: 178,
      rolling_jee_memberships: 2391,
      rolling_jee_fingerprint: "0ed8376c5c5cea7d06b3beafbc59c45f",
    });
  });
});
