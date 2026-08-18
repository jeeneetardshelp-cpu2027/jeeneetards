import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateChapterManifest } from "./scripts/ingestionSafety.js";

const reviewPath =
  "docs/reviews/unacademy-neet-nineteenth-candidate-batch-2026-08-07.json";
const readinessPath =
  "docs/unacademy-neet-nineteenth-batch-readiness-2026-08-07.md";
const manifests = [
  "docs/manifests/unacademy-neet-d-f-block-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-amines-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-thermochemistry-class-11-reviewed.json",
];

const review = JSON.parse(readFileSync(reviewPath, "utf8"));
const readiness = readFileSync(readinessPath, "utf8");
const parsedManifests = manifests.map((path) => JSON.parse(readFileSync(path, "utf8")));

function snapshotHash(candidate) {
  const rows = [...candidate.videos, ...candidate.exclusions]
    .sort((a, b) => a.source_position - b.source_position)
    .map((row) => `${row.source_position}\t${row.youtube_video_id}`)
    .join("\n");
  return createHash("sha256").update(`${rows}\n`).digest("hex");
}

describe("Unacademy NEET nineteenth-batch readiness", () => {
  it("records the approved guarded production content import", () => {
    expect(review.review_status).toBe("owner_approval_required");
    expect(review.proposed_decision_id).toBe("e6539ac8-512b-4e76-8bd1-774c1a3c4bdc");
    expect(readiness).toContain("CONTENT IMPORT COMPLETED IN PRODUCTION");
    expect(readiness).toContain("No schema migration, faculty-link write");
    expect(readiness).toContain("1 ok / 0 review / 0 blocked");
  });

  it("pins the exact quiet-window baseline and protected JEE boundary", () => {
    expect(review.preflight).toMatchObject({
      playlists: 413,
      videos: 4723,
      memberships: 4729,
      chapters: 263,
      source_collision_count: 0,
      retained_video_collision_count: 0,
      protected_jee_courses: 82,
      protected_jee_memberships: 1304,
      protected_jee_fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
    });
  });

  it("contains exactly three clean official sources and eight retained videos", () => {
    expect(review.candidates).toHaveLength(3);
    expect(new Set(review.candidates.map((candidate) => candidate.youtube_playlist_id)).size).toBe(3);
    expect(review.candidates.flatMap((candidate) => candidate.videos)).toHaveLength(8);
    expect(review.candidates.flatMap((candidate) => candidate.videos)
      .every((video) => video.duration_seconds > 0 && video.embedding_status === "embeddable")).toBe(true);
    expect(review.candidates.every((candidate) => snapshotHash(candidate) === candidate.source_snapshot_sha256)).toBe(true);
  });

  it("maps every retained row exactly once and excludes only the Thermochemistry quiz", () => {
    expect(parsedManifests).toHaveLength(3);
    for (const [index, manifest] of parsedManifests.entries()) {
      expect(manifest.youtube_playlist_id).toBe(review.candidates[index].youtube_playlist_id);
      expect(manifest.teacher_evidence.decision_id).toBe(review.proposed_decision_id);
      expect(manifest.assignments.map((row) => row.youtube_video_id))
        .toEqual(review.candidates[index].videos.map((row) => row.youtube_video_id));
      expect(manifest.assignments.map((row) => row.lesson_number))
        .toEqual(manifest.assignments.map((_, rowIndex) => rowIndex + 1));
    }
    expect(parsedManifests[0].exclusions).toEqual([]);
    expect(parsedManifests[1].exclusions).toEqual([]);
    expect(parsedManifests[2].exclusions).toEqual([
      { position: 4, youtube_video_id: "cv6mAJ4wd3Q", reason: "quiz" },
    ]);
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
        manifest: parsedManifests[index],
        playlistId: candidate.youtube_playlist_id,
        teacher: candidate.teacher,
        videos: sourceRows,
      });
      expect(mapped.videos).toHaveLength(candidate.videos.length);
      expect(mapped.excludedVideos).toHaveLength(candidate.exclusions.length);
    });
  });

  it("records exact additive deltas and the decisive postflight", () => {
    expect(readiness).toContain("+3 playlists / +8 videos / +8 memberships");
    expect(readiness).toContain("416 / 4,731 / 4,737 / 263");
    expect(readiness).toContain("| 1 | 433 |");
    expect(readiness).toContain("| 2 | 434 |");
    expect(readiness).toContain("| 3 | 435 |");
    expect(readiness).toContain("`4814`-`4815`");
    expect(readiness).toContain("`4816`-`4818`");
    expect(readiness).toContain("`4819`-`4821`");
    expect(readiness).toContain("2026-08-07T13:38:16.994248Z");
    expect(readiness).toContain("all eight retained YouTube video IDs exist exactly once");
    expect(readiness).toContain("cv6mAJ4wd3Q` remains absent");
    expect(readiness).toContain("82 / 1,304");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("212 / 2,848");
    expect(readiness).toContain("9eea2b44f0b19c08cc0907c57e091342");
  });

  it("records anonymous browse and first/last player evidence", () => {
    expect(readiness).toContain("https://www.jeeneetard.com/course/433/chapter/45");
    expect(readiness).toContain("https://www.jeeneetard.com/course/434/chapter/48");
    expect(readiness).toContain("https://www.jeeneetard.com/course/435/chapter/29");
    for (const videoId of [
      "0BwLckcTdUA", "3ZlCJ1keY6s", "MQ-3hQrodgU",
      "5YTW3Cn198A", "xpTqTM1fk1c", "7_lzRbhRJYA",
    ]) expect(readiness).toContain(videoId);
    expect(readiness).toContain("playlist_teachers` rows and quality-review transitions remain");
  });
});
