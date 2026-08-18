import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const review = JSON.parse(readFileSync(
  "docs/reviews/unacademy-neet-first-candidate-batch-2026-08-03.json",
  "utf8",
));

const manifestPaths = [
  "docs/manifests/unacademy-neet-chemical-bonding-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-evolution-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-principles-inheritance-class-12-reviewed.json",
];
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));

describe("Unacademy NEET reviewed manifests", () => {
  it("pin the three review playlist IDs in registry order", () => {
    expect(manifests.map((manifest) => manifest.youtube_playlist_id)).toEqual(
      review.courses.map((course) => course.youtube_playlist_id),
    );
    expect(new Set(manifests.map((manifest) => manifest.request_id)).size).toBe(3);
  });

  it("match the manifests used by the fresh production dry-runs", () => {
    const hashes = manifestSources.map((source) => (
      createHash("sha256").update(source, "utf8").digest("hex")
    ));
    expect(hashes).toEqual([
        "cc51fd7a83beb8c130bbd183e320dbd5b83cf8c1778f15b4fe923ab8486906fb",
        "30931b666c8ba57be592ef362975f281c3caf27b63a8445d0d513981908fd1d5",
        "170f378cb2d2fa1658e1bfda975afde863e532e12629370d975eee46279ab3c7",
      ]);
    expect(review.courses.map((course) => course.anonymous_production_dry_run.manifest_sha256))
      .toEqual(hashes);
  });

  it("bind the exact owner-approved teacher evidence decision", () => {
    expect(new Set(manifests.map((manifest) => manifest.teacher_evidence.decision_id))).toEqual(
      new Set(["6579f542-da9b-499f-bd46-3aa796ea4f27"]),
    );
    manifests.forEach((manifest) => {
      expect(manifest.teacher_evidence.youtube_playlist_id).toBe(manifest.youtube_playlist_id);
      expect(manifest.teacher_evidence.youtube_video_ids).toEqual(
        manifest.assignments.map((assignment) => assignment.youtube_video_id),
      );
    });
  });

  it("map or exclude every reviewed source row exactly once", () => {
    manifests.forEach((manifest, index) => {
      const course = review.courses[index];
      const decisions = [...manifest.assignments, ...manifest.exclusions];
      const expectedCount = course.videos.length + course.dropped_source_videos.length;
      expect(decisions).toHaveLength(expectedCount);
      expect(new Set(decisions.map((row) => row.position)).size).toBe(expectedCount);
      expect(new Set(decisions.map((row) => row.youtube_video_id)).size).toBe(expectedCount);
    });
  });

  it("preserve the reviewed lecture order and canonical chapter assignment", () => {
    manifests.forEach((manifest, index) => {
      const course = review.courses[index];
      expect(manifest.assignments.map((row) => row.lesson_number)).toEqual(
        Array.from({ length: course.videos.length }, (_, i) => i + 1),
      );
      expect(manifest.assignments.map((row) => row.youtube_video_id)).toEqual(
        course.videos.map((video) => video.youtube_video_id),
      );
      expect(new Set(manifest.assignments.map((row) => row.chapter))).toEqual(
        new Set([course.chapter.name]),
      );
    });
  });

  it("keeps all reviewed practice and recap rows excluded", () => {
    manifests.forEach((manifest, index) => {
      const course = review.courses[index];
      expect(manifest.exclusions.map((row) => row.youtube_video_id)).toEqual(
        course.dropped_source_videos.map((video) => video.youtube_video_id),
      );
      expect(manifest.exclusions.every((row) => row.reason.trim().length > 0)).toBe(true);
    });
  });
});
