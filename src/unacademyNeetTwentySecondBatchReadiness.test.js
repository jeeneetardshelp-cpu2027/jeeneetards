import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateChapterManifest } from "./scripts/ingestionSafety.js";

const reviewPath =
  "docs/reviews/unacademy-neet-twenty-second-candidate-batch-2026-08-16.json";
const readinessPath =
  "docs/unacademy-neet-twenty-second-batch-readiness-2026-08-16.md";
const manifestPaths = [
  "docs/manifests/unacademy-neet-work-energy-power-class-11-reviewed.json",
  "docs/manifests/unacademy-neet-solutions-class-12-reviewed.json",
  "docs/manifests/unacademy-neet-periodic-table-class-11-reviewed.json",
];

const reviewSource = readFileSync(reviewPath, "utf8");
const review = JSON.parse(reviewSource);
const readiness = readFileSync(readinessPath, "utf8");
const manifestSources = manifestPaths.map((path) => readFileSync(path, "utf8"));
const manifests = manifestSources.map((source) => JSON.parse(source));

function snapshotHash(candidate) {
  const rows = [...candidate.videos, ...candidate.exclusions]
    .sort((left, right) => left.source_position - right.source_position)
    .map((row) => `${row.source_position}\t${row.youtube_video_id}`)
    .join("\n");
  return createHash("sha256").update(`${rows}\n`).digest("hex");
}

describe("Unacademy NEET twenty-second-batch readiness", () => {
  it("keeps the package behind an explicit owner gate", () => {
    expect(review.review_status).toBe("owner_approval_required");
    expect(review.proposed_decision_id).toBe("fbf7b3a1-0a19-4dae-b5fe-d967b94f3a7c");
    expect(readiness).toContain("OWNER APPROVAL REQUIRED - NO PRODUCTION WRITE");
    expect(readiness).toContain("no `release` push");
  });

  it("pins the candidate review hash", () => {
    const reviewHash = createHash("sha256").update(reviewSource).digest("hex");
    expect(reviewHash).toBe(
      "fdf0f8cb6a1584c31b82624611b8bb00d6f2f37659820eface75734655ceafeb",
    );
    expect(readiness).toContain(reviewHash);
  });

  it("pins the current catalogue and protected JEE boundary", () => {
    expect(review.preflight).toMatchObject({
      playlists: 421,
      videos: 4746,
      memberships: 4752,
      chapters: 263,
      chapter_class_levels: 92,
      teachers: 37,
      faculty_links: 176,
      quality_reviews: 47,
      source_collision_count: 0,
      retained_video_collision_count: 0,
      title_collision_count: 0,
      protected_jee_courses: 82,
      protected_jee_memberships: 1304,
      protected_jee_fingerprint: "30eee4a4a6842e5beeb7c97083d7f812",
    });
  });

  it("contains exactly three collision-free sources, 22 lectures, and six exclusions", () => {
    expect(review.candidates).toHaveLength(3);
    expect(new Set(review.candidates.map((candidate) => candidate.youtube_playlist_id)).size)
      .toBe(3);
    expect(review.candidates.flatMap((candidate) => candidate.videos)).toHaveLength(22);
    expect(review.candidates.flatMap((candidate) => candidate.exclusions)).toHaveLength(6);
    expect(review.candidates.every((candidate) =>
      candidate.source_collision_count === 0 &&
      candidate.video_collision_count === 0 &&
      candidate.title_collision_count === 0)).toBe(true);
    expect(review.candidates.flatMap((candidate) => [
      ...candidate.videos,
      ...candidate.exclusions,
    ]).every((video) =>
      video.duration_seconds > 0 && video.embedding_status === "embeddable"))
      .toBe(true);
    expect(review.candidates.every((candidate) =>
      snapshotHash(candidate) === candidate.source_snapshot_sha256)).toBe(true);
  });

  it("reuses the exact existing verified teachers under the proposed decision", () => {
    expect(review.candidates.map((candidate) => [
      candidate.teacher_id,
      candidate.teacher,
      candidate.teacher_verified,
    ])).toEqual([
      [34, "Mahendra Singh", true],
      [36, "Anoop Vashishtha", true],
      [36, "Anoop Vashishtha", true],
    ]);
    expect(manifests.every((manifest) =>
      manifest.teacher_evidence.decision_id === review.proposed_decision_id)).toBe(true);
    expect(review.teacher_normalization_gate.status).toBe("existing_verified_records");
  });

  it("pins the approved reviewed course titles and their exact manifests", () => {
    expect(review.reviewed_course_title_support).toMatchObject({
      approved_on: "2026-08-16",
      status: "validated",
      course_titles: ["Work, Energy and Power", "Solutions", "Periodic Table"],
    });
    expect(manifests.map((manifest) => manifest.course_title)).toEqual(
      review.candidates.map((candidate) => candidate.course_title),
    );
    expect(manifestSources.map((source) =>
      createHash("sha256").update(source).digest("hex")))
      .toEqual(review.anonymous_dry_runs.map((run) => run.manifest_sha256));
  });

  it("maps every retained and excluded row exhaustively", () => {
    review.candidates.forEach((candidate, index) => {
      const manifest = manifests[index];
      expect(manifest.youtube_playlist_id).toBe(candidate.youtube_playlist_id);
      expect(manifest.assignments.map((row) => row.youtube_video_id))
        .toEqual(candidate.videos.map((row) => row.youtube_video_id));
      expect(manifest.exclusions.map((row) => row.youtube_video_id))
        .toEqual(candidate.exclusions.map((row) => row.youtube_video_id));

      const mapped = validateChapterManifest({
        manifest,
        playlistId: candidate.youtube_playlist_id,
        teacher: candidate.teacher,
        videos: [...candidate.videos, ...candidate.exclusions]
          .sort((left, right) => left.source_position - right.source_position)
          .map((row) => ({
            videoId: row.youtube_video_id,
            title: row.title,
            sourcePosition: row.source_position - 1,
            position: row.source_position - 1,
            durationSeconds: row.duration_seconds,
            embeddingStatus: row.embedding_status,
          })),
      });
      expect(mapped.videos).toHaveLength(candidate.videos.length);
      expect(mapped.excludedVideos).toHaveLength(candidate.exclusions.length);
      expect(mapped.videos.length + mapped.excludedVideos.length)
        .toBe(candidate.source_item_count);
    });
  });

  it("records natural Periodic Table lecture ordering without rewriting source positions", () => {
    const candidate = review.candidates[2];
    const manifest = manifests[2];
    expect(candidate.natural_lesson_order_source_positions).toEqual([1, 2, 3, 5, 4]);
    expect(manifest.assignments.map((row) => row.position)).toEqual([1, 2, 3, 4, 5]);
    expect(manifest.assignments.map((row) => row.lesson_number)).toEqual([1, 2, 3, 5, 4]);
    expect([...manifest.assignments]
      .sort((left, right) => left.lesson_number - right.lesson_number)
      .map((row) => row.position)).toEqual([1, 2, 3, 5, 4]);
  });

  it("records three clean anonymous production dry-runs", () => {
    expect(review.anonymous_dry_runs).toHaveLength(3);
    expect(review.anonymous_dry_runs.every((run) =>
      run.status === "ok" && run.review === 0 && run.blocked === 0)).toBe(true);
    expect(review.anonymous_dry_runs.map((run) => run.assignments)).toEqual([11, 6, 5]);
    expect(review.anonymous_dry_runs.map((run) => run.exclusions)).toEqual([2, 4, 0]);
    expect(readiness).toContain("1 ok / 0 review / 0 blocked");
    expect(readiness).toContain("5359ca045ea084d6d53c058aee2a849c353b9f8a632eedc0835247955c85f896");
    expect(readiness).toContain("168b1c1b67e09dff873df557d981e0e48525fd2ed4ffdc48d0b34b52eb0620a2");
    expect(readiness).toContain("38b76f705d97406203d7c722fda9cc230875e98ea645af55950be787fc537da0");
  });

  it("keeps out-of-syllabus Solid State and incomplete sources outside this gate", () => {
    expect(review.deferred.some((entry) => entry.includes("Solid State"))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("chapter_class_levels"))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("Gaseous State"))).toBe(true);
    expect(review.deferred.some((entry) => entry.includes("Phoenix"))).toBe(true);
    expect(review.current_curriculum_scope_review).toMatchObject({
      reviewed_on: "2026-08-16",
      status: "out_of_current_syllabus_deferred",
      solid_state_present_in_neet_2026: false,
      solid_state_present_in_cbse_2026_27_theory: false,
      deferred_source_playlist: {
        youtube_playlist_id: "PLsgHooHkqhhPosUFvFYWQvl8WobRKF3t3",
        usable_videos: 8,
        production_source_collisions: 0,
        production_video_collisions: 0,
      },
    });
    expect(readiness).toContain("Do **not** create that row");
    expect(readiness).toContain("supplementary/archive taxonomy");
    expect(readiness).toContain("+3 playlists / +22 videos / +22 memberships / +0");
    expect(readiness).toContain("No faculty mutation, quality-review transition");
  });
});
