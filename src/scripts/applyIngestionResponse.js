// applyIngestionResponse.js — merge explicit human responses into a new local worksheet.
//
// This command never edits the source worksheet. It verifies the response's
// exact hash binding, copies only whitelisted reviewer fields, recomputes
// completion, and writes a separate non-importable worksheet outside the repo.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildResponseTemplate,
  PROPOSAL_ACTIONS,
  responseBinding,
  SCOPE_ACTIONS,
} from "./ingestionResponseContract.js";
import { sha256Json } from "./reviewIngestion.js";
import { verifyDecisionWorksheet } from "./verifyIngestionDecisions.js";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(here, "../..");

export function parseResponseApplyArgs(argv = []) {
  const args = { overwrite: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--bundle") args.bundle = argv[++index];
    else if (arg.startsWith("--bundle=")) args.bundle = arg.slice("--bundle=".length);
    else if (arg === "--decisions") args.decisions = argv[++index];
    else if (arg.startsWith("--decisions=")) args.decisions = arg.slice("--decisions=".length);
    else if (arg === "--response") args.response = argv[++index];
    else if (arg.startsWith("--response=")) args.response = arg.slice("--response=".length);
    else if (arg === "--out") args.out = argv[++index];
    else if (arg.startsWith("--out=")) args.out = arg.slice("--out=".length);
    else if (arg === "--overwrite") args.overwrite = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const name of ["bundle", "decisions", "response"]) {
    if (!args[name] || !args[name].toLowerCase().endsWith(".json")) {
      throw new Error(`--${name} must name a JSON file.`);
    }
  }
  return args;
}

function isInside(root, target) {
  const pathFromRoot = relative(resolve(root), resolve(target));
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

export function resolveResponseApplyPaths({
  bundle,
  decisions,
  response,
  out,
  cwd = process.cwd(),
  repoRoot = defaultRepoRoot,
} = {}) {
  const bundlePath = resolve(cwd, bundle);
  const decisionsPath = resolve(cwd, decisions);
  const responsePath = resolve(cwd, response);
  const defaultName = basename(decisionsPath).replace(
    /(?:\.decisions)?\.json$/iu,
    ".reviewed.decisions.json",
  );
  const outputPath = out ? resolve(cwd, out) : resolve(dirname(decisionsPath), defaultName);
  if (!outputPath.toLowerCase().endsWith(".json")) {
    throw new Error("merged decision worksheet output must use a .json filename.");
  }
  if ([bundlePath, decisionsPath, responsePath].includes(outputPath)) {
    throw new Error("merged worksheet must not overwrite an input artifact.");
  }
  if (isInside(repoRoot, outputPath)) {
    throw new Error("merged worksheet must stay outside the repository.");
  }
  return { bundlePath, decisionsPath, responsePath, outputPath };
}

export function assertMergedOutputAvailable(outputPath, overwrite = false, pathExists = existsSync) {
  if (!overwrite && pathExists(outputPath)) {
    throw new Error(`refusing to overwrite existing merged worksheet: ${outputPath}.`);
  }
}

function sameKeys(value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return sha256Json(Object.keys(value).sort()) === sha256Json([...expectedKeys].sort());
}

function validateResponseEntries(actual, expected, identityKeys, editableKeys, label, errors) {
  if (!Array.isArray(actual)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  if (actual.length !== expected.length) errors.push(`${label} count does not match the worksheet.`);
  const keys = [...identityKeys, ...editableKeys];
  for (let index = 0; index < actual.length; index += 1) {
    const entry = actual[index];
    const expectedEntry = expected[index];
    if (!sameKeys(entry, keys)) errors.push(`${label} ${index + 1} has unexpected fields.`);
    for (const key of identityKeys) {
      if (!expectedEntry || entry?.[key] !== expectedEntry[key]) {
        errors.push(`${label} ${index + 1} identity does not match the worksheet.`);
        break;
      }
    }
    if (entry?.reviewer_action != null && typeof entry.reviewer_action !== "string") {
      errors.push(`${label} ${index + 1} reviewer_action must be text or null.`);
    }
    if (entry?.reviewer_notes != null && typeof entry.reviewer_notes !== "string") {
      errors.push(`${label} ${index + 1} reviewer_notes must be text or null.`);
    }
  }
}

export function verifyReviewerResponse(worksheet, response) {
  const errors = [];
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return { valid: false, errors: ["reviewer response must be a JSON object."] };
  }
  const template = buildResponseTemplate(worksheet, { generatedAt: response.generated_at });
  if (!sameKeys(response, Object.keys(template))) errors.push("reviewer response has unexpected fields.");
  if (response.schema_version !== 1) errors.push("response schema_version must equal 1.");
  if (response.kind !== "ingestion-human-response") {
    errors.push("response kind must be ingestion-human-response.");
  }
  if (typeof response.generated_at !== "string" || Number.isNaN(Date.parse(response.generated_at))) {
    errors.push("response generated_at must be a valid date-time.");
  }
  if (sha256Json(response.safety ?? {}) !== sha256Json(template.safety)) {
    errors.push("reviewer response safety contract was altered.");
  }
  if (sha256Json(response.binding ?? {}) !== sha256Json(responseBinding(worksheet))) {
    errors.push("reviewer response binding does not match the decision worksheet.");
  }
  if (sha256Json(response.allowed_reviewer_actions ?? []) !== sha256Json(PROPOSAL_ACTIONS)) {
    errors.push("reviewer response proposal actions were altered.");
  }
  if (sha256Json(response.allowed_scope_actions ?? []) !== sha256Json(SCOPE_ACTIONS)) {
    errors.push("reviewer response scope actions were altered.");
  }
  if (!sameKeys(response.reviewer, ["name", "reviewed_at", "notes"])) {
    errors.push("reviewer identity has unexpected fields.");
  }
  for (const key of ["name", "reviewed_at", "notes"]) {
    const value = response.reviewer?.[key];
    if (value != null && typeof value !== "string") {
      errors.push(`reviewer ${key} must be text or null.`);
    }
  }
  validateResponseEntries(
    response.proposal_responses,
    template.proposal_responses,
    ["field"],
    ["reviewer_action", "reviewer_value", "reviewer_notes"],
    "proposal response",
    errors,
  );
  const proposalResponses = Array.isArray(response.proposal_responses)
    ? response.proposal_responses
    : [];
  for (const [index, entry] of proposalResponses.entries()) {
    if (entry?.reviewer_action == null && entry?.reviewer_value != null) {
      errors.push(`proposal response ${index + 1} pending action must not carry a value.`);
    }
  }
  validateResponseEntries(
    response.chapter_responses,
    template.chapter_responses,
    ["position", "youtube_video_id"],
    ["reviewer_action", "reviewer_chapter_id", "reviewer_notes"],
    "chapter response",
    errors,
  );
  const chapterResponses = Array.isArray(response.chapter_responses)
    ? response.chapter_responses
    : [];
  for (const [index, entry] of chapterResponses.entries()) {
    if (entry?.reviewer_action == null && entry?.reviewer_chapter_id != null) {
      errors.push(`chapter response ${index + 1} pending action must not carry a chapter id.`);
    }
  }
  validateResponseEntries(
    response.video_scope_responses,
    template.video_scope_responses,
    ["position", "youtube_video_id"],
    ["reviewer_action", "reviewer_notes"],
    "video scope response",
    errors,
  );
  return { valid: errors.length === 0, errors };
}

export function mergeReviewerResponse(bundle, worksheet, response) {
  const baseVerification = verifyDecisionWorksheet(bundle, worksheet);
  if (!baseVerification.valid) {
    throw new Error(`decision worksheet failed verification: ${baseVerification.errors.join(" ")}`);
  }
  const responseVerification = verifyReviewerResponse(worksheet, response);
  if (!responseVerification.valid) {
    throw new Error(`reviewer response failed verification: ${responseVerification.errors.join(" ")}`);
  }
  const merged = structuredClone(worksheet);
  merged.reviewer = structuredClone(response.reviewer);
  for (let index = 0; index < merged.proposal_decisions.length; index += 1) {
    const source = response.proposal_responses[index];
    Object.assign(merged.proposal_decisions[index], {
      reviewer_action: source.reviewer_action,
      reviewer_value: source.reviewer_value,
      reviewer_notes: source.reviewer_notes,
    });
  }
  for (let index = 0; index < merged.chapter_decisions.length; index += 1) {
    const source = response.chapter_responses[index];
    Object.assign(merged.chapter_decisions[index], {
      reviewer_action: source.reviewer_action,
      reviewer_chapter_id: source.reviewer_chapter_id,
      reviewer_notes: source.reviewer_notes,
    });
  }
  for (let index = 0; index < merged.video_scope_decisions.length; index += 1) {
    const source = response.video_scope_responses[index];
    Object.assign(merged.video_scope_decisions[index], {
      reviewer_action: source.reviewer_action,
      reviewer_notes: source.reviewer_notes,
    });
  }
  merged.completion.completed_decisions = merged.proposal_decisions
    .filter((entry) => PROPOSAL_ACTIONS.includes(entry.reviewer_action)).length
    + merged.chapter_decisions
      .filter((entry) => PROPOSAL_ACTIONS.includes(entry.reviewer_action)).length
    + merged.video_scope_decisions
      .filter((entry) => SCOPE_ACTIONS.includes(entry.reviewer_action)).length;
  merged.completion.status = "complete";
  let verification = verifyDecisionWorksheet(bundle, merged);
  if (verification.pending.length) {
    merged.completion.status = "pending";
    verification = verifyDecisionWorksheet(bundle, merged);
  }
  if (!verification.valid) {
    throw new Error(`merged worksheet failed verification: ${verification.errors.join(" ")}`);
  }
  return { worksheet: merged, verification };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseResponseApplyArgs(argv);
  const paths = resolveResponseApplyPaths(args);
  assertMergedOutputAvailable(paths.outputPath, args.overwrite);
  const bundle = JSON.parse(readFileSync(paths.bundlePath, "utf8"));
  const worksheet = JSON.parse(readFileSync(paths.decisionsPath, "utf8"));
  const response = JSON.parse(readFileSync(paths.responsePath, "utf8"));
  const merged = mergeReviewerResponse(bundle, worksheet, response);
  mkdirSync(dirname(paths.outputPath), { recursive: true });
  writeFileSync(paths.outputPath, `${JSON.stringify(merged.worksheet, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    output: paths.outputPath,
    playlist: merged.worksheet.binding.playlist_id,
    valid: merged.verification.valid,
    complete: merged.verification.complete,
    completed_decisions: merged.verification.summary.completed_decisions,
    pending_items: merged.verification.summary.pending_items,
    database_writes_allowed: false,
    importable: false,
  }, null, 2));
  return merged;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(`ingestion reviewer-response apply failed: ${error.message}`);
    process.exitCode = 1;
  }
}
