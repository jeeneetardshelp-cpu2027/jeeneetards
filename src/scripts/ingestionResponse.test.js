import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  mergeReviewerResponse,
  parseResponseApplyArgs,
  resolveResponseApplyPaths,
  verifyReviewerResponse,
} from "./applyIngestionResponse.js";
import { buildDecisionWorksheet } from "./prepareIngestionDecisions.js";
import {
  parseResponsePrepareArgs,
  prepareResponse,
  resolveResponsePreparePaths,
} from "./prepareIngestionResponse.js";
import { buildReviewBundle } from "./reviewIngestion.js";

const projectRef = "abcdefghijklmnopqrst";
const taxonomy = {
  marker: null,
  categories: [{ id: 20, name: "JEE", slug: "jee" }],
  subjects: [{ id: 1, name: "Physics", slug: "physics" }],
  learningGoals: [{ id: 10, name: "JEE", slug: "jee" }],
  categoryLearningGoals: [{ category_id: 20, learning_goal_id: 10 }],
  boards: [],
  classLevels: [{ id: 40, name: "Class 11", slug: "class-11" }],
  learningGoalClassLevels: [{ learning_goal_id: 10, class_level_id: 40 }],
  chapters: [{ id: 101, subject_id: 1, name: "Kinematics", slug: "kinematics" }],
  teachers: [{
    id: 34,
    display_name: "Alakh Pandey",
    verified: true,
    aliases: [{ alias: "ALK", status: "verified" }],
  }],
};

function artifacts() {
  const bundle = buildReviewBundle({
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
      title: "Kinematics DPP Quiz 1",
      description: "Taught by Alakh Pandey Sir",
      tags: ["JEE", "Physics"],
      sourcePosition: 0,
    }],
    generatedAt: "2026-08-18T12:00:00.000Z",
  });
  const worksheet = buildDecisionWorksheet(bundle, {
    generatedAt: "2026-08-18T13:00:00.000Z",
  });
  const response = prepareResponse(bundle, worksheet, {
    generatedAt: "2026-08-18T14:00:00.000Z",
  });
  return { bundle, worksheet, response };
}

describe("offline ingestion reviewer responses", () => {
  it("parses explicit prepare and apply inputs", () => {
    expect(parseResponsePrepareArgs([
      "--bundle=review.json",
      "--decisions=decisions.json",
      "--overwrite",
    ])).toEqual({ bundle: "review.json", decisions: "decisions.json", overwrite: true });
    expect(parseResponseApplyArgs([
      "--bundle=review.json",
      "--decisions=decisions.json",
      "--response=response.json",
    ])).toEqual({
      bundle: "review.json",
      decisions: "decisions.json",
      response: "response.json",
      overwrite: false,
      check: false,
    });
    expect(parseResponseApplyArgs([
      "--bundle=review.json",
      "--decisions=decisions.json",
      "--response=response.json",
      "--check",
    ]).check).toBe(true);
    expect(() => parseResponseApplyArgs([
      "--bundle=review.json",
      "--decisions=decisions.json",
      "--response=response.json",
      "--check",
      "--overwrite",
    ])).toThrow("cannot be combined");
  });

  it("keeps response and merged outputs separate and outside the repository", () => {
    const repoRoot = resolve("C:/workspace/repo");
    const outputDir = resolve(repoRoot, "..", "outputs");
    const bundle = resolve(outputDir, "course.review.json");
    const decisions = resolve(outputDir, "course.decisions.json");
    const response = resolve(outputDir, "course.response.json");
    expect(resolveResponsePreparePaths({ bundle, decisions, repoRoot }).outputPath)
      .toBe(response);
    expect(resolveResponseApplyPaths({ bundle, decisions, response, repoRoot }).outputPath)
      .toBe(resolve(outputDir, "course.reviewed.decisions.json"));
    expect(() => resolveResponseApplyPaths({
      bundle,
      decisions,
      response,
      out: "docs/reviewed.json",
      cwd: repoRoot,
      repoRoot,
    })).toThrow("outside the repository");
  });

  it("creates a blank response bound to the exact worksheet", () => {
    const { worksheet, response } = artifacts();
    expect(response).toMatchObject({
      schema_version: 1,
      kind: "ingestion-human-response",
      safety: { database_writes_allowed: false, importable: false },
      binding: { playlist_id: "PL_review", review_bundle_sha256: worksheet.binding.review_bundle_sha256 },
      reviewer: { name: null, reviewed_at: null },
    });
    expect(response.proposal_responses.every((entry) => entry.reviewer_action == null)).toBe(true);
    expect(response.video_scope_responses).toEqual([
      expect.objectContaining({ position: 1, reviewer_action: null }),
    ]);
    expect(verifyReviewerResponse(worksheet, response)).toEqual({ valid: true, errors: [] });
  });

  it("merges a blank response without changing evidence or claiming completion", () => {
    const { bundle, worksheet, response } = artifacts();
    const merged = mergeReviewerResponse(bundle, worksheet, response);
    expect(merged.verification).toMatchObject({ valid: true, complete: false });
    expect(merged.worksheet.completion).toMatchObject({
      status: "pending",
      completed_decisions: 0,
    });
    expect(merged.worksheet.binding).toEqual(worksheet.binding);
  });

  it("preserves decisions already present in a partially reviewed worksheet", () => {
    const { bundle, worksheet, response } = artifacts();
    response.reviewer.name = "Catalog reviewer";
    response.proposal_responses[0].reviewer_action = "accept";
    const partial = mergeReviewerResponse(bundle, worksheet, response).worksheet;
    const nextResponse = prepareResponse(bundle, partial);
    expect(nextResponse.reviewer.name).toBe("Catalog reviewer");
    expect(nextResponse.proposal_responses[0].reviewer_action).toBe("accept");
  });

  it("recomputes a fully explicit legal response as complete", () => {
    const { bundle, worksheet, response } = artifacts();
    response.reviewer.name = "Catalog reviewer";
    response.reviewer.reviewed_at = "2026-08-18T15:00:00.000Z";
    for (const entry of response.proposal_responses) entry.reviewer_action = "accept";
    for (const entry of response.chapter_responses) entry.reviewer_action = "accept";
    for (const entry of response.video_scope_responses) entry.reviewer_action = "include";
    const merged = mergeReviewerResponse(bundle, worksheet, response);
    expect(merged.verification).toMatchObject({
      valid: true,
      complete: true,
      errors: [],
      pending: [],
    });
    expect(merged.worksheet.completion.status).toBe("complete");
  });

  it("rejects altered bindings, hidden fields, and illegal values", () => {
    const { bundle, worksheet, response } = artifacts();
    response.binding.source_sha256 = "0".repeat(64);
    response.proposal_responses[0].assignments = { unsafe: true };
    response.proposal_responses[0].reviewer_notes = { hidden: true };
    response.proposal_responses[0].reviewer_value = "hidden";
    const invalidShape = verifyReviewerResponse(worksheet, response);
    expect(invalidShape.valid).toBe(false);
    expect(invalidShape.errors).toEqual(expect.arrayContaining([
      "reviewer response binding does not match the decision worksheet.",
      "proposal response 1 has unexpected fields.",
      "proposal response 1 reviewer_notes must be text or null.",
      "proposal response 1 pending action must not carry a value.",
    ]));

    const legalShape = prepareResponse(bundle, worksheet);
    const language = legalShape.proposal_responses.find((entry) => entry.field === "language");
    language.reviewer_action = "replace";
    language.reviewer_value = "german";
    language.reviewer_notes = "Explicit but invalid test value.";
    expect(() => mergeReviewerResponse(bundle, worksheet, legalShape))
      .toThrow("controlled language vocabulary");
  });

  it("keeps both commands free of network, database, importer, and child-process paths", () => {
    for (const file of ["prepareIngestionResponse.js", "applyIngestionResponse.js"]) {
      const source = readFileSync(resolve(process.cwd(), "src/scripts", file), "utf8");
      expect(source).not.toMatch(/\bfetch\s*\(|createClient|\.from\s*\(|service_role/iu);
      expect(source).not.toMatch(/execFile|execSync|spawn\s*\(|child_process/iu);
    }
  });
});
