import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildReviewBundle } from "./reviewIngestion.js";
import {
  assertDecisionOutputAvailable,
  buildDecisionWorksheet,
  parseDecisionArgs,
  resolveDecisionOutputPath,
} from "./prepareIngestionDecisions.js";

const projectRef = "abcdefghijklmnopqrst";
const taxonomy = {
  marker: null,
  categories: [{ id: 20, name: "JEE", slug: "jee" }],
  subjects: [{ id: 1, name: "Physics", slug: "physics" }],
  learningGoals: [{ id: 10, name: "JEE", slug: "jee" }],
  categoryLearningGoals: [{ category_id: 20, learning_goal_id: 10 }],
  boards: [{ id: 30, name: "CBSE", slug: "cbse" }],
  classLevels: [
    { id: 39, name: "Class 10", slug: "class-10" },
    { id: 40, name: "Class 11", slug: "class-11" },
    { id: 41, name: "Class 12", slug: "class-12" },
    { id: 42, name: "Dropper", slug: "dropper" },
  ],
  learningGoalClassLevels: [
    { learning_goal_id: 10, class_level_id: 40 },
    { learning_goal_id: 10, class_level_id: 41 },
    { learning_goal_id: 10, class_level_id: 42 },
  ],
  chapters: [{ id: 101, subject_id: 1, name: "Kinematics", slug: "kinematics" }],
  teachers: [{
    id: 34,
    display_name: "Alakh Pandey",
    verified: true,
    aliases: [{ alias: "ALK", status: "verified" }],
  }],
};

function sampleBundle() {
  return buildReviewBundle({
    environment: "production",
    expectedProjectRef: projectRef,
    databaseUrl: `https://${projectRef}.supabase.co`,
    taxonomy,
    owner: {
      channelId: "UC_owner",
      channelTitle: "Example Academy",
      playlistId: "PL_review",
      playlistTitle: "JEE Class 11 Physics Complete Course",
      playlistDescription: "Faculty: Alakh Pandey",
      videoCount: 1,
    },
    videos: [{
      videoId: "abcdefghijk",
      title: "Kinematics Lecture 1",
      description: "Taught by Alakh Pandey Sir",
      tags: ["JEE", "Physics"],
      sourcePosition: 0,
      durationSeconds: 120,
      captionStatus: "available",
      embeddingStatus: "embeddable",
    }],
    generatedAt: "2026-08-18T12:00:00.000Z",
  });
}

describe("offline ingestion decision worksheet", () => {
  it("parses an explicit bundle and optional output controls", () => {
    expect(parseDecisionArgs(["--bundle=review.json", "--out", "decisions.json", "--overwrite"]))
      .toEqual({ bundle: "review.json", out: "decisions.json", overwrite: true });
    expect(() => parseDecisionArgs([])).toThrow("--bundle");
    expect(() => parseDecisionArgs(["--bundle=review.json", "--write"])).toThrow("unknown argument");
  });

  it("keeps the worksheet outside the repository and separate from its bundle", () => {
    const repoRoot = resolve("C:/workspace/repo");
    const bundle = resolve(repoRoot, "..", "outputs", "playlist.review.json");
    expect(resolveDecisionOutputPath({ bundle, repoRoot })).toEqual({
      bundlePath: bundle,
      outputPath: resolve(repoRoot, "..", "outputs", "playlist.decisions.json"),
    });
    expect(() => resolveDecisionOutputPath({
      bundle,
      out: "docs/decisions.json",
      cwd: repoRoot,
      repoRoot,
    })).toThrow("outside the repository");
    expect(() => resolveDecisionOutputPath({ bundle, out: bundle, repoRoot }))
      .toThrow("must not overwrite");
  });

  it("refuses implicit overwrite", () => {
    expect(() => assertDecisionOutputAvailable("decisions.json", false, () => true))
      .toThrow("refusing to overwrite");
    expect(() => assertDecisionOutputAvailable("decisions.json", true, () => true)).not.toThrow();
  });

  it("builds a verified, hash-bound, non-importable worksheet", () => {
    const worksheet = buildDecisionWorksheet(sampleBundle(), {
      generatedAt: "2026-08-18T13:00:00.000Z",
    });
    expect(worksheet).toMatchObject({
      schema_version: 1,
      kind: "ingestion-human-decisions",
      safety: {
        local_only: true,
        source_bundle_verified: true,
        database_writes_allowed: false,
        importable: false,
        human_completion_required: true,
      },
      binding: {
        review_bundle_schema_version: 4,
        playlist_id: "PL_review",
        project_ref: projectRef,
      },
      reviewer: { name: null, reviewed_at: null },
    });
    expect(worksheet.binding.review_bundle_sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(worksheet.proposal_decisions.length).toBeGreaterThan(0);
    expect(worksheet.proposal_decisions.every((decision) => decision.reviewer_action === null))
      .toBe(true);
    expect(worksheet.chapter_decisions).toEqual([]);
    expect(worksheet).not.toHaveProperty("assignments");
  });

  it("rejects a review bundle that no longer verifies", () => {
    const bundle = sampleBundle();
    bundle.source.videos[0].title = "tampered";
    expect(() => buildDecisionWorksheet(bundle)).toThrow("failed verification");
  });

  it("keeps the generator free of network and database code", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/scripts/prepareIngestionDecisions.js"),
      "utf8",
    );
    expect(source).not.toMatch(/\bfetch\s*\(|createClient|\.from\s*\(|service_role/iu);
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
    expect(packageJson.scripts["prepare:ingestion-decisions"])
      .toBe("node src/scripts/prepareIngestionDecisions.js");
  });
});
