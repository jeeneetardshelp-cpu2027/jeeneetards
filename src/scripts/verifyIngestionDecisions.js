// verifyIngestionDecisions.js — offline integrity/completion verifier.
//
// Checks a human decision worksheet against its exact review bundle. It reads
// local JSON only and has no network, database, file-writing, or import path.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Json } from "./reviewIngestion.js";
import { verifyReviewBundle } from "./verifyIngestionReview.js";
import { METADATA_OPTIONS } from "./ingestionSafety.js";
import { CLASS_SLUG_TO_LABEL } from "../classLevels.js";
import {
  automaticContext,
  chapterDecision,
  proposalDecision,
  scopeDecision,
} from "./ingestionDecisionContract.js";

const ACTIONS = ["accept", "replace", "reject"];
const SCOPE_ACTIONS = ["include", "exclude"];
const CONTENT_TYPES = new Set(METADATA_OPTIONS.contentType);
const LANGUAGES = new Set(METADATA_OPTIONS.language);
const DIFFICULTIES = new Set(METADATA_OPTIONS.difficulty);
const CLASS_SLUG_BY_LABEL = Object.freeze(Object.fromEntries(
  Object.entries(CLASS_SLUG_TO_LABEL).map(([slug, label]) => [label, slug]),
));

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

function immutableScopeEntry(entry) {
  return {
    position: entry?.position,
    youtube_video_id: entry?.youtube_video_id,
    title: entry?.title,
    evidence: entry?.evidence ?? null,
    signals: Array.isArray(entry?.signals) ? entry.signals : [],
    teacher_candidate_ids: Array.isArray(entry?.teacher_candidate_ids)
      ? entry.teacher_candidate_ids
      : [],
    reviewer_action: null,
    reviewer_notes: null,
  };
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function replacementErrors(field, value, bundle) {
  const taxonomy = bundle.taxonomy;
  const ids = (rows) => new Set(rows.map((row) => row.id));
  if (field === "subject_id" && !ids(taxonomy.subjects).has(value)) {
    return ["must be a live subject id"];
  }
  if (field === "learning_goal_id" && !ids(taxonomy.learningGoals).has(value)) {
    return ["must be a live learning-goal id"];
  }
  if (field === "category_id" && !ids(taxonomy.categories).has(value)) {
    return ["must be a live category id"];
  }
  if (field === "teacher_id" && !ids(taxonomy.teachers).has(value)) {
    return ["must be a live teacher id"];
  }
  if (field === "board_ids") {
    if (!Array.isArray(value) || value.length === 0) return ["must be a non-empty array"];
    if (new Set(value).size !== value.length) return ["must not contain duplicate board ids"];
    const boardIds = ids(taxonomy.boards);
    if (value.some((id) => !boardIds.has(id))) return ["contains a board id outside live taxonomy"];
  }
  if (field === "class_labels") {
    if (!Array.isArray(value) || value.length === 0) return ["must be a non-empty array"];
    if (new Set(value).size !== value.length) return ["must not contain duplicate class labels"];
    if (value.some((label) => !Object.hasOwn(CLASS_SLUG_BY_LABEL, label))) {
      return ["contains an unsupported class label"];
    }
  }
  if (field === "content_type" && !CONTENT_TYPES.has(value)) {
    return ["must use the controlled content-type vocabulary"];
  }
  if (field === "language" && !LANGUAGES.has(value)) {
    return ["must use the controlled language vocabulary"];
  }
  if (field === "audience_focus" && !Object.hasOwn(CLASS_SLUG_BY_LABEL, value)) {
    return ["must use a supported class label"];
  }
  if (field === "difficulty" && !DIFFICULTIES.has(value)) {
    return ["must use the controlled difficulty vocabulary"];
  }
  return [];
}

function effectiveProposalState(bundle, actualProposals) {
  const actualByField = new Map(actualProposals.map((entry) => [entry?.field, entry]));
  return Object.fromEntries(Object.entries(bundle.proposal.decisions).map(([field, proposal]) => {
    if (proposal.status === "auto") return [field, { final: true, value: proposal.value }];
    const actual = actualByField.get(field);
    if (!ACTIONS.includes(actual?.reviewer_action)) {
      return [field, { final: false, value: proposal.value }];
    }
    if (actual.reviewer_action === "replace") {
      return [field, { final: true, value: actual.reviewer_value }];
    }
    if (actual.reviewer_action === "reject") return [field, { final: true, value: null }];
    return [field, { final: true, value: proposal.value }];
  }));
}

function validateEffectiveRelationships(bundle, state, fail) {
  const goal = bundle.taxonomy.learningGoals.find(
    (row) => row.id === state.learning_goal_id?.value,
  );
  if (state.category_id?.final && state.learning_goal_id?.final
      && state.category_id.value != null && state.learning_goal_id.value != null) {
    const legal = bundle.taxonomy.categoryLearningGoals.some(
      (mapping) => mapping.category_id === state.category_id.value
        && mapping.learning_goal_id === state.learning_goal_id.value,
    );
    if (!legal) fail("resolved category_id is not legal for the resolved learning_goal_id.");
  }
  if (state.board_ids?.final && state.learning_goal_id?.final && Array.isArray(state.board_ids.value)) {
    if (goal?.slug !== "school" && state.board_ids.value.length > 0) {
      fail("resolved board_ids must be empty outside the School learning goal.");
    }
    if (goal?.slug === "school" && state.board_ids.value.length === 0) {
      fail("resolved School board_ids must not be empty.");
    }
  }
  if (state.class_labels?.final && state.learning_goal_id?.final
      && Array.isArray(state.class_labels.value) && state.learning_goal_id.value != null) {
    const classBySlug = new Map(bundle.taxonomy.classLevels.map((row) => [row.slug, row]));
    const legalMappings = new Set(bundle.taxonomy.learningGoalClassLevels
      .filter((mapping) => mapping.learning_goal_id === state.learning_goal_id.value)
      .map((mapping) => mapping.class_level_id));
    for (const label of state.class_labels.value) {
      const classLevel = classBySlug.get(CLASS_SLUG_BY_LABEL[label]);
      if (!classLevel || !legalMappings.has(classLevel.id)) {
        fail(`resolved class label ${label} is incompatible with the resolved learning goal.`);
      }
    }
  }
  if (state.audience_focus?.final && state.class_labels?.final
      && state.audience_focus.value != null && Array.isArray(state.class_labels.value)
      && !state.class_labels.value.includes(state.audience_focus.value)) {
    fail("resolved audience_focus must be one of the resolved class_labels.");
  }
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

  if (worksheet.schema_version !== 2) fail("worksheet schema_version must equal 2.");
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
  if (sha256Json(worksheet.allowed_scope_actions ?? []) !== sha256Json(SCOPE_ACTIONS)) {
    fail("allowed scope actions were altered.");
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
      if (actual.reviewer_value != null) {
        for (const error of replacementErrors(actual.field, actual.reviewer_value, bundle)) {
          fail(`replacement value for ${actual.field} ${error}.`);
        }
      }
    }
    if (action === "reject") {
      if (actual.reviewer_value != null) {
        fail(`rejected proposal ${actual.field} must not carry a replacement value.`);
      }
      if (!hasText(actual.reviewer_notes)) waitFor(`rejection rationale pending: ${actual.field}.`);
    }
  }

  validateEffectiveRelationships(bundle, effectiveProposalState(bundle, actualProposals), fail);

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

  const expectedScopeDecisions = bundle.video_review.scope_review.rows.map(scopeDecision);
  const actualScopeDecisions = Array.isArray(worksheet.video_scope_decisions)
    ? worksheet.video_scope_decisions
    : [];
  if (!Array.isArray(worksheet.video_scope_decisions)) {
    fail("video_scope_decisions must be an array.");
  }
  if (actualScopeDecisions.length !== expectedScopeDecisions.length) {
    fail("video scope decision count does not match the review bundle.");
  }
  const scopePositions = new Set();
  for (let index = 0; index < actualScopeDecisions.length; index += 1) {
    const actual = actualScopeDecisions[index] ?? {};
    const expected = expectedScopeDecisions[index];
    if (scopePositions.has(actual.position)) {
      fail(`duplicate video scope decision position: ${actual.position}.`);
    }
    scopePositions.add(actual.position);
    if (!expected || sha256Json(immutableScopeEntry(actual)) !== sha256Json(expected)) {
      fail(`video scope decision ${index + 1} context does not match the review bundle.`);
    }
    const action = actual.reviewer_action;
    if (action == null) {
      waitFor(`video scope decision pending: position ${actual.position ?? index + 1}.`);
      continue;
    }
    if (!SCOPE_ACTIONS.includes(action)) {
      fail(`video scope decision ${index + 1} has an invalid action.`);
      waitFor(`video scope decision pending: position ${actual.position ?? index + 1}.`);
      continue;
    }
    completedDecisions += 1;
    if (action === "exclude" && !hasText(actual.reviewer_notes)) {
      waitFor(`video exclusion rationale pending: position ${actual.position}.`);
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
  if (completion.required_scope_decisions !== expectedScopeDecisions.length) {
    fail("required video scope decision count is incorrect.");
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
      required_decisions: expectedProposals.length + expectedChapters.length
        + expectedScopeDecisions.length,
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
