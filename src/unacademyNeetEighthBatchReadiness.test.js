import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readiness = readFileSync(
  "docs/unacademy-neet-eighth-batch-readiness-2026-08-05.md",
  "utf8",
);
const reviewSource = readFileSync(
  "docs/reviews/unacademy-neet-eighth-candidate-batch-2026-08-05.json",
  "utf8",
);
const review = JSON.parse(reviewSource);
const manifestPaths = [
  "docs/manifests/unacademy-neet-redox-reactions-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-cell-organelles-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-molecular-basis-class-12-reviewed.json",
];
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));

describe("Unacademy NEET eighth-batch production evidence", () => {
  it("pins the three approved official playlists and unique requests", () => {
    expect(manifests.map((manifest) => manifest.youtube_playlist_id)).toEqual([
      "PLsgHooHkqhhPnLRiFEOjuIGraO0odfi1I",
      "PLsgHooHkqhhNW-QJ3H58FESiVXdxHYoqw",
      "PLsgHooHkqhhOO8a8vMQLe_CVVzttQd_Dh",
    ]);
    expect(new Set(manifests.map((manifest) => manifest.request_id)).size).toBe(3);
  });

  it("maps complete natural lecture sequences to the reviewed chapters", () => {
    expect(manifests.map((manifest) => manifest.assignments.length)).toEqual([7, 9, 9]);
    expect(manifests.every((manifest) => manifest.exclusions.length === 0)).toBe(true);
    expect(manifests.map((manifest) => (
      [...new Set(manifest.assignments.map((row) => row.chapter))]
    ))).toEqual([
      ["Redox Reactions"],
      ["Cell: The Unit of Life"],
      ["Molecular Basis of Inheritance"],
    ]);
    expect(manifests.every((manifest) => (
      manifest.assignments.every((row, index) => row.lesson_number === index + 1)
    ))).toBe(true);
  });

  it("pins taxonomy, teacher identities, class scopes, and zero collisions", () => {
    expect(review.channel).toMatchObject({
      youtube_channel_id: "UCdQwYksctqqiRwqp3PiJMWA",
      production_institute_id: 147,
    });
    expect(review.candidates.map((candidate) => [
      candidate.course_id,
      candidate.chapter_id,
      candidate.class_level,
      candidate.teacher_id,
    ])).toEqual([
      [405, 95, "class-11", 36],
      [406, 107, "class-11", 33],
      [407, 128, "class-12", 33],
    ]);
    expect(review.candidates.every((candidate) => (
      candidate.source_collision_count === 0
      && candidate.video_collision_count === 0
    ))).toBe(true);
  });

  it("pins all 25 unique embeddable retained lectures", () => {
    const videos = review.candidates.flatMap((candidate) => candidate.videos);
    expect(videos).toHaveLength(25);
    expect(new Set(videos.map((video) => video.youtube_video_id)).size).toBe(25);
    expect(videos.every((video) => (
      video.duration_seconds > 0 && video.embedding_status === "embeddable"
    ))).toBe(true);
  });

  it("binds the exact owner-reviewed teacher evidence", () => {
    expect(manifests.map((manifest) => manifest.teacher_evidence.teacher)).toEqual([
      "Anoop Vashishtha",
      "Pradeep Singh",
      "Pradeep Singh",
    ]);
    expect(manifests.every((manifest) => (
      manifest.teacher_evidence.decision_id === "809b153c-b5ff-48e0-a869-02faa49b0e8f"
      && manifest.teacher_evidence.youtube_playlist_id === manifest.youtube_playlist_id
      && manifest.teacher_evidence.youtube_video_ids.length === manifest.assignments.length
    ))).toBe(true);
    expect(manifests[1].teacher_evidence.source_label).toContain("Pradeep S");
    expect(manifests[2].teacher_evidence.source_label).toContain("Pradeep Sir");
  });

  it("pins the immutable manifest hashes and execution result", () => {
    expect(manifestSources.map((source) => (
      createHash("sha256").update(source, "utf8").digest("hex")
    ))).toEqual([
      "0e1714afa4cc276c97a814eb32d06dd2deb8523fd43598b89622439b103a9847",
      "ae8327c5681f172568c870020dbd088071b4d90ec37e8064b6706f7f87660313",
      "2674164b6bd4f9299a21dd3668c502c620a44da4c48d856be10dd1c45553e8c0",
    ]);
    expect(createHash("sha256").update(reviewSource, "utf8").digest("hex"))
      .toBe("5528688daa52efd989ef030b0c935d49f4d462eab134c0cedef98478430cbbea");
    expect(readiness).toContain("courses `405`, `406`, and `407`");
    expect(readiness).toContain("388 playlists / 4,539 videos / 4,545");
    expect(readiness).toContain("30eee4a4a6842e5beeb7c97083d7f812");
    expect(readiness).toContain("No migration, restore, clone, or `release` push occurred");
  });
});
