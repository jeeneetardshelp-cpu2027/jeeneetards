import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDecisionWorksheet } from "./prepareIngestionDecisions.js";
import { buildReviewBundle } from "./reviewIngestion.js";
import {
  parseDecisionVerifyArgs,
  verifyDecisionWorksheet,
} from "./verifyIngestionDecisions.js";

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

function flaggedBundle() {
  const bundle = sampleBundle();
  return buildReviewBundle({
    environment: "production",
    expectedProjectRef: projectRef,
    databaseUrl: `https://${projectRef}.supabase.co`,
    taxonomy,
    owner: bundle.source.owner,
    videos: [{
      videoId: "abcdefghijk",
      title: "Kinematics DPP Quiz 1",
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

function unresolvedClassBundle() {
  return buildReviewBundle({
    environment: "production",
    expectedProjectRef: projectRef,
    databaseUrl: `https://${projectRef}.supabase.co`,
    taxonomy,
    owner: {
      channelId: "UC_owner",
      channelTitle: "Example Academy",
      playlistId: "PL_review",
      playlistTitle: "JEE Physics",
      playlistDescription: "Faculty: Alakh Pandey",
      videoCount: 1,
    },
    videos: [{
      videoId: "abcdefghijk",
      title: "Kinematics Topic 1",
      description: "Taught by Alakh Pandey Sir",
      tags: ["JEE", "Physics"],
      sourcePosition: 0,
    }],
    generatedAt: "2026-08-18T12:00:00.000Z",
  });
}

function completedWorksheet(bundle) {
  const worksheet = buildDecisionWorksheet(bundle, {
    generatedAt: "2026-08-18T13:00:00.000Z",
  });
  worksheet.reviewer.name = "Catalog reviewer";
  worksheet.reviewer.reviewed_at = "2026-08-18T14:00:00.000Z";
  for (const decision of worksheet.proposal_decisions) decision.reviewer_action = "accept";
  for (const decision of worksheet.chapter_decisions) decision.reviewer_action = "accept";
  for (const decision of worksheet.video_scope_decisions) decision.reviewer_action = "include";
  worksheet.completion.completed_decisions = worksheet.proposal_decisions.length
    + worksheet.chapter_decisions.length
    + worksheet.video_scope_decisions.length;
  worksheet.completion.status = "complete";
  return worksheet;
}

describe("offline ingestion decision verification", () => {
  it("parses bundle, decisions, and the explicit pending override", () => {
    expect(parseDecisionVerifyArgs([
      "--bundle=review.json",
      "--decisions",
      "decisions.json",
      "--allow-pending",
    ])).toEqual({
      bundle: "review.json",
      decisions: "decisions.json",
      allowPending: true,
    });
    expect(() => parseDecisionVerifyArgs(["--bundle=review.json"])).toThrow("--decisions");
  });

  it("accepts an intact blank worksheet as valid but incomplete", () => {
    const bundle = sampleBundle();
    const result = verifyDecisionWorksheet(bundle, buildDecisionWorksheet(bundle));
    expect(result.valid).toBe(true);
    expect(result.complete).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.pending).toEqual(expect.arrayContaining([
      "reviewer name is pending.",
      "reviewed_at is pending.",
    ]));
    expect(result.summary.completed_decisions).toBe(0);
  });

  it("accepts a fully completed worksheet without making it importable", () => {
    const bundle = sampleBundle();
    const result = verifyDecisionWorksheet(bundle, completedWorksheet(bundle));
    expect(result).toMatchObject({
      valid: true,
      complete: true,
      errors: [],
      pending: [],
      summary: { importable: false, database_writes_allowed: false },
    });
  });

  it("rejects binding or immutable proposal-context tampering", () => {
    const bundle = sampleBundle();
    const worksheet = buildDecisionWorksheet(bundle);
    worksheet.binding.source_sha256 = "0".repeat(64);
    worksheet.proposal_decisions[0].evidence = "changed";
    const result = verifyDecisionWorksheet(bundle, worksheet);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "worksheet binding does not match the review bundle.",
      "proposal decision 1 context does not match the review bundle.",
    ]));
  });

  it("requires replacement values and rationales before completion", () => {
    const bundle = sampleBundle();
    const worksheet = completedWorksheet(bundle);
    worksheet.proposal_decisions[0].reviewer_action = "replace";
    worksheet.completion.status = "pending";
    const result = verifyDecisionWorksheet(bundle, worksheet);
    expect(result.valid).toBe(true);
    expect(result.complete).toBe(false);
    expect(result.pending).toEqual(expect.arrayContaining([
      expect.stringContaining("replacement value pending"),
      expect.stringContaining("replacement rationale pending"),
    ]));
  });

  it("rejects replacement metadata and teacher ids outside controlled live values", () => {
    const bundle = sampleBundle();
    const worksheet = completedWorksheet(bundle);
    const language = worksheet.proposal_decisions.find((entry) => entry.field === "language");
    const teacher = worksheet.proposal_decisions.find((entry) => entry.field === "teacher_id");
    language.reviewer_action = "replace";
    language.reviewer_value = "german";
    language.reviewer_notes = "Test invalid vocabulary.";
    teacher.reviewer_action = "replace";
    teacher.reviewer_value = 999;
    teacher.reviewer_notes = "Test unknown teacher.";
    const result = verifyDecisionWorksheet(bundle, worksheet);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "replacement value for language must use the controlled language vocabulary.",
      "replacement value for teacher_id must be a live teacher id.",
    ]));
  });

  it("accepts legal controlled replacements", () => {
    const bundle = sampleBundle();
    const worksheet = completedWorksheet(bundle);
    const language = worksheet.proposal_decisions.find((entry) => entry.field === "language");
    const teacher = worksheet.proposal_decisions.find((entry) => entry.field === "teacher_id");
    language.reviewer_action = "replace";
    language.reviewer_value = "english";
    language.reviewer_notes = "Reviewed source audio.";
    teacher.reviewer_action = "replace";
    teacher.reviewer_value = 34;
    teacher.reviewer_notes = "Confirmed against reviewed faculty evidence.";
    expect(verifyDecisionWorksheet(bundle, worksheet)).toMatchObject({
      valid: true,
      complete: true,
      errors: [],
    });
  });

  it("rejects incompatible resolved class and audience decisions", () => {
    const bundle = unresolvedClassBundle();
    const worksheet = completedWorksheet(bundle);
    const classes = worksheet.proposal_decisions.find((entry) => entry.field === "class_labels");
    const audience = worksheet.proposal_decisions.find((entry) => entry.field === "audience_focus");
    classes.reviewer_action = "replace";
    classes.reviewer_value = ["10th"];
    classes.reviewer_notes = "Test incompatible entrance-exam class.";
    audience.reviewer_action = "replace";
    audience.reviewer_value = "12th";
    audience.reviewer_notes = "Test cross-field mismatch.";
    const result = verifyDecisionWorksheet(bundle, worksheet);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "resolved class label 10th is incompatible with the resolved learning goal.",
      "resolved audience_focus must be one of the resolved class_labels.",
    ]));
  });

  it("requires a written rationale when a reviewer excludes a flagged video", () => {
    const bundle = flaggedBundle();
    const worksheet = completedWorksheet(bundle);
    worksheet.video_scope_decisions[0].reviewer_action = "exclude";
    worksheet.completion.status = "pending";
    const incomplete = verifyDecisionWorksheet(bundle, worksheet);
    expect(incomplete.valid).toBe(true);
    expect(incomplete.complete).toBe(false);
    expect(incomplete.pending).toContain("video exclusion rationale pending: position 1.");

    worksheet.video_scope_decisions[0].reviewer_notes = "Practice quiz is outside lecture scope.";
    worksheet.completion.status = "complete";
    const complete = verifyDecisionWorksheet(bundle, worksheet);
    expect(complete.valid).toBe(true);
    expect(complete.complete).toBe(true);
  });

  it("rejects tampered scope evidence or an invented scope action", () => {
    const bundle = flaggedBundle();
    const worksheet = buildDecisionWorksheet(bundle);
    worksheet.video_scope_decisions[0].signals = [];
    worksheet.video_scope_decisions[0].reviewer_action = "delete";
    const result = verifyDecisionWorksheet(bundle, worksheet);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "video scope decision 1 context does not match the review bundle.",
      "video scope decision 1 has an invalid action.",
    ]));
  });

  it("keeps the verifier offline and read-only", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/scripts/verifyIngestionDecisions.js"),
      "utf8",
    );
    expect(source).not.toMatch(/\bfetch\s*\(|createClient|\.from\s*\(|writeFile|service_role/iu);
    const contract = readFileSync(
      resolve(process.cwd(), "src/scripts/ingestionDecisionContract.js"),
      "utf8",
    );
    expect(contract).not.toMatch(/\bfetch\s*\(|createClient|\.from\s*\(|writeFile|service_role/iu);
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
    expect(packageJson.scripts["verify:ingestion-decisions"])
      .toBe("node src/scripts/verifyIngestionDecisions.js");
  });
});
