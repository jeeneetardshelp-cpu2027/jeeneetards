// verifyIngestionDecisions.js — offline integrity/completion verifier.
//
// Checks a human decision worksheet against its exact review bundle. It reads
// local JSON only and has no network, database, file-writing, or import path.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Json } from "./reviewIngestion.js";
import { verifyReviewBundle } from "./verifyIngestionReview.js";
import {
  automaticContext,
  chapterDecision,
  proposalDecision,
} from "./ingestionDecisionContract.js";

const ACTIONS = ["accept", "replace", "reject"];

export function parseDecisionVerifyArgs(argv = []) {
  const args = { allowPending: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--bundle") args.bundle = argv[++index];
    else if (arg.startsWith("--bundle=")) args.bundle = arg.slice("--bundle=".length);
    else if (arg === "--decisions") args.decisions = argv[++index];
    else if (arg.startsWith("--decisions=")) args.decisions = arg.slice("--decisions=".length);
    else if (arg === "--allow-pending") args.allowPending = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const name of ["bundle", "decisions"]) {
    if (!args[name] || !args[name].toLowerCase().endsWith(".json")) {
      throw new Error(`--${name} must name a JSON file.`);
    }
  }
  return args;
}

function immutableProposalEntry(entry) {
  return {
    field: entry?.field,
    proposed_value: entry?.proposed_value ?? null,
    confidence: entry?.confidence ?? null,
    evidence: entry?.evidence ?? null,
    candidates: Array.isArray(entry?.candidates) ? entry.candidates : [],
    reviewer_action: null,
    reviewer_value: null,
    reviewer_notes: null,
  };
}

function immutableChapterEntry(entry) {
  return {
    position: entry?.position,
    youtube_video_id: entry?.youtube_video_id,
    title: entry?.title,
    proposed_chapter_id: entry?.proposed_chapter_id ?? null,
    proposed_chapter_name: entry?.proposed_chapter_name ?? null,
    confidence: entry?.confidence ?? null,
    evidence: entry?.evidence ?? null,
    alternatives: Array.isArray(entry?.alternatives) ? entry.alternatives : [],
    reviewer_action: null,
    reviewer_chapter_id: null,
    reviewer_notes: null,
  };
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function verifyDecisionWorksheet(bundle, worksheet) {
  const errors = [];
  const pending = [];
  const fail = (message) => errors.push(message);
  const waitFor = (message) => pending.push(message);
  const bundleVerification = verifyReviewBundle(bundle);
  if (!bundleVerification.valid) {
    return {
      valid: false,
      complete: false,
      errors: bundleVerification.errors.map((error) => `review bundle: ${error}`),
      pending: [],
      summary: null,
    };
  }
  if (!worksheet || typeof worksheet !== "object" || Array.isArray(worksheet)) {
    return {
      valid: false,
      complete: false,
      errors: ["decision worksheet must be a JSON object."],
      pending: [],
      summary: null,
    };
  }

  if (worksheet.schema_version !== 1) fail("worksheet schema_version must equal 1.");
  if (worksheet.kind !== "ingestion-human-decisions") {
    fail("worksheet kind must be ingestion-human-decisions.");
  }
  const safety = worksheet.safety ?? {};
  if (safety.local_only !== true) fail("worksheet local_only must be true.");
  if (safety.source_bundle_verified !== true) fail("source_bundle_verified must be true.");
  if (safety.database_writes_allowed !== false) fail("database_writes_allowed must be false.");
  if (safety.importable !== false) fail("worksheet importable must be false.");
  if (safety.human_completion_required !== true) fail("human_completion_required must be true.");
  if (Object.hasOwn(worksheet, "assignments")) fail("top-level assignments are forbidden.");

  const expectedBinding = {
    review_bundle_schema_version: bundle.schema_version,
    review_bundle_sha256: sha256Json(bundle),
    source_sha256: bundle.source.sha256,
    taxonomy_sha256: bundle.taxonomy.sha256,
    playlist_id: bundle.source.owner.playlistId,
    project_ref: bundle.database.project_ref,
  };
  if (sha256Json(worksheet.binding ?? {}) !== sha256Json(expectedBinding)) {
    fail("worksheet binding does not match the review bundle.");
  }
  if (sha256Json(worksheet.allowed_reviewer_actions ?? []) !== sha256Json(ACTIONS)) {
    fail("allowed reviewer actions were altered.");
  }

  const expectedProposals = bundle.human_review.items.map(proposalDecision);
  const actualProposals = Array.isArray(worksheet.proposal_decisions)
    ? worksheet.proposal_decisions
    : [];
  if (!Array.isArray(worksheet.proposal_decisions)) fail("proposal_decisions must be an array.");
  if (actualProposals.length !== expectedProposals.length) {
    fail("proposal decision count does not match the review bundle.");
  }
  const proposalFields = new Set();
  let completedDecisions = 0;
  for (let index = 0; index < actualProposals.length; index += 1) {
    const actual = actualProposals[index] ?? {};
    const expected = expectedProposals[index];
    if (proposalFields.has(actual.field)) fail(`duplicate proposal decision field: ${actual.field}.`);
    proposalFields.add(actual.field);
    if (!expected || sha256Json(immutableProposalEntry(actual)) !== sha256Json(expected)) {
      fail(`proposal decision ${index + 1} context does not match the review bundle.`);
    }
    const action = actual.reviewer_action;
    if (action == null) {
      waitFor(`proposal decision pending: ${actual.field ?? index + 1}.`);
      continue;
    }
    if (!ACTIONS.includes(action)) {
      fail(`proposal decision ${actual.field ?? index + 1} has an invalid action.`);
      waitFor(`proposal decision pending: ${actual.field ?? index + 1}.`);
      continue;
    }
    completedDecisions += 1;
    if (action === "accept" && actual.reviewer_value != null) {
      fail(`accepted proposal ${actual.field} must not carry a replacement value.`);
    }
    if (action === "replace") {
      if (actual.reviewer_value == null) waitFor(`replacement value pending: ${actual.field}.`);
      if (!hasText(actual.reviewer_notes)) waitFor(`replacement rationale pending: ${actual.field}.`);
    }
    if (action === "reject") {
      if (actual.reviewer_value != null) {
        fail(`rejected proposal ${actual.field} must not carry a replacement value.`);
      }
      if (!hasText(actual.reviewer_notes)) waitFor(`rejection rationale pending: ${actual.field}.`);
    }
  }

  const expectedChapters = bundle.chapter_review.rows
    .filter((row) => row.status !== "auto")
    .map(chapterDecision);
  const actualChapters = Array.isArray(worksheet.chapter_decisions)
    ? worksheet.chapter_decisions
    : [];
  if (!Array.isArray(worksheet.chapter_decisions)) fail("chapter_decisions must be an array.");
  if (actualChapters.length !== expectedChapters.length) {
    fail("chapter decision count does not match the review bundle.");
  }
  const chapterById = new Map(bundle.taxonomy.chapters.map((chapter) => [chapter.id, chapter]));
  for (let index = 0; index < actualChapters.length; index += 1) {
    const actual = actualChapters[index] ?? {};
    const expected = expectedChapters[index];
    if (!expected || sha256Json(immutableChapterEntry(actual)) !== sha256Json(expected)) {
      fail(`chapter decision ${index + 1} context does not match the review bundle.`);
    }
    const action = actual.reviewer_action;
    if (action == null) {
      waitFor(`chapter decision pending: position ${actual.position ?? index + 1}.`);
      continue;
    }
    if (!ACTIONS.includes(action)) {
      fail(`chapter decision ${index + 1} has an invalid action.`);
      waitFor(`chapter decision pending: position ${actual.position ?? index + 1}.`);
      continue;
    }
    completedDecisions += 1;
    if (action === "accept" && actual.reviewer_chapter_id != null) {
      fail(`accepted chapter position ${actual.position} must not carry a replacement id.`);
    }
    if (action === "replace") {
      const chapter = chapterById.get(actual.reviewer_chapter_id);
      if (!chapter || chapter.subject_id !== bundle.chapter_review.subject_id) {
        fail(`replacement chapter at position ${actual.position} is outside the live subject taxonomy.`);
      }
      if (!hasText(actual.reviewer_notes)) {
        waitFor(`replacement chapter rationale pending: position ${actual.position}.`);
      }
    }
    if (action === "reject") {
      if (actual.reviewer_chapter_id != null) {
        fail(`rejected chapter position ${actual.position} must not carry a replacement id.`);
      }
      if (!hasText(actual.reviewer_notes)) {
        waitFor(`chapter rejection rationale pending: position ${actual.position}.`);
      }
    }
  }

  if (sha256Json(worksheet.automatic_context ?? {}) !== sha256Json(automaticContext(bundle))) {
    fail("automatic decision context does not match the review bundle.");
  }
  if (!hasText(worksheet.reviewer?.name)) waitFor("reviewer name is pending.");
  if (!hasText(worksheet.reviewer?.reviewed_at)) {
    waitFor("reviewed_at is pending.");
  } else if (Number.isNaN(Date.parse(worksheet.reviewer.reviewed_at))) {
    fail("reviewed_at must be a valid date-time.");
  }

  const completion = worksheet.completion ?? {};
  if (completion.required_proposal_decisions !== expectedProposals.length) {
    fail("required proposal decision count is incorrect.");
  }
  if (completion.required_chapter_decisions !== expectedChapters.length) {
    fail("required chapter decision count is incorrect.");
  }
  if (completion.completed_decisions !== completedDecisions) {
    fail("completed decision count is incorrect.");
  }
  const expectedStatus = pending.length ? "pending" : "complete";
  if (completion.status !== expectedStatus) fail(`completion status must be ${expectedStatus}.`);

  return {
    valid: errors.length === 0,
    complete: errors.length === 0 && pending.length === 0,
    errors,
    pending,
    summary: {
      playlist: bundle.source.owner.playlistId,
      project_ref: bundle.database.project_ref,
      required_decisions: expectedProposals.length + expectedChapters.length,
      completed_decisions: completedDecisions,
      pending_items: pending.length,
      importable: false,
      database_writes_allowed: false,
    },
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseDecisionVerifyArgs(argv);
  const bundlePath = resolve(process.cwd(), args.bundle);
  const decisionsPath = resolve(process.cwd(), args.decisions);
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const worksheet = JSON.parse(readFileSync(decisionsPath, "utf8"));
  const result = verifyDecisionWorksheet(bundle, worksheet);
  console.log(JSON.stringify({ bundle: bundlePath, decisions: decisionsPath, ...result }, null, 2));
  if (!result.valid) process.exitCode = 1;
  else if (!result.complete && !args.allowPending) process.exitCode = 2;
  return result;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(`ingestion decision verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
