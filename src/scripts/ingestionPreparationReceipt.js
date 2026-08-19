// Immutable completion receipt for one local ingestion-review preparation set.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { verifyReviewerResponse } from "./applyIngestionResponse.js";
import { sha256Json } from "./reviewIngestion.js";
import { verifyDecisionWorksheet } from "./verifyIngestionDecisions.js";
import { verifyReviewBundle } from "./verifyIngestionReview.js";

export const PREPARATION_ARTIFACT_KEYS = Object.freeze([
  "review_bundle",
  "decision_worksheet",
  "review_packet",
  "reviewer_response",
]);

export function jsonArtifactText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function preparationArtifactTexts({ bundle, worksheet, packet, response }) {
  return {
    review_bundle: jsonArtifactText(bundle),
    decision_worksheet: jsonArtifactText(worksheet),
    review_packet: packet,
    reviewer_response: jsonArtifactText(response),
  };
}

export function writePreparationReceipt(outputPath, receipt) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, jsonArtifactText(receipt), "utf8");
}

function requiredDecisionCount(worksheet) {
  return worksheet.completion.required_proposal_decisions
    + worksheet.completion.required_chapter_decisions
    + worksheet.completion.required_scope_decisions;
}

export function buildPreparationReceipt({
  bundle,
  worksheet,
  packet,
  response,
  fileNames,
  generatedAt,
  liveReadsPerformed,
  reusedVerifiedBundle,
  priorManifestSha256 = null,
}) {
  const texts = preparationArtifactTexts({ bundle, worksheet, packet, response });
  return {
    schema_version: 1,
    kind: "ingestion-review-preparation-receipt",
    generated_at: generatedAt,
    safety: {
      local_only: true,
      database_writes_allowed: false,
      writes_attempted: false,
      importable: false,
      human_decisions_required: true,
    },
    binding: {
      playlist_id: worksheet.binding.playlist_id,
      project_ref: worksheet.binding.project_ref,
      review_bundle_sha256: worksheet.binding.review_bundle_sha256,
      decision_worksheet_sha256: sha256Json(worksheet),
    },
    preparation: {
      live_reads_performed: liveReadsPerformed,
      reused_verified_bundle: reusedVerifiedBundle,
      prior_review_attached: priorManifestSha256 != null,
      prior_manifest_sha256: priorManifestSha256,
      required_decisions: requiredDecisionCount(worksheet),
      completed_decisions: worksheet.completion.completed_decisions,
    },
    artifacts: Object.fromEntries(PREPARATION_ARTIFACT_KEYS.map((key) => [key, {
      file: fileNames[key],
      sha256: sha256Text(texts[key]),
    }])),
  };
}

function parseJsonArtifact(text, label, errors) {
  try {
    return JSON.parse(text);
  } catch {
    errors.push(`${label} is not valid JSON.`);
    return null;
  }
}

function responseIsBlank(response) {
  const reviewer = response?.reviewer ?? {};
  if ([reviewer.name, reviewer.reviewed_at, reviewer.notes].some((value) => value != null)) {
    return false;
  }
  const rows = [
    ...(response?.proposal_responses ?? []),
    ...(response?.chapter_responses ?? []),
    ...(response?.video_scope_responses ?? []),
  ];
  return rows.every((row) => Object.entries(row).every(
    ([key, value]) => !key.startsWith("reviewer_") || value == null,
  ));
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return sha256Json(actual) === sha256Json([...expected].sort());
}

export function verifyPreparationReceipt(receipt, texts) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return { valid: false, errors: ["receipt must be a JSON object."], summary: null };
  }
  if (receipt.schema_version !== 1) fail("receipt schema_version must equal 1.");
  if (receipt.kind !== "ingestion-review-preparation-receipt") {
    fail("receipt kind is invalid.");
  }
  if (!hasExactKeys(receipt, [
    "schema_version",
    "kind",
    "generated_at",
    "safety",
    "binding",
    "preparation",
    "artifacts",
  ])) fail("receipt has unexpected fields.");
  if (typeof receipt.generated_at !== "string" || Number.isNaN(Date.parse(receipt.generated_at))) {
    fail("receipt generated_at must be a valid date-time.");
  }
  const safety = receipt.safety ?? {};
  if (!hasExactKeys(safety, [
    "local_only",
    "database_writes_allowed",
    "writes_attempted",
    "importable",
    "human_decisions_required",
  ])) fail("receipt safety contract has unexpected fields.");
  if (
    safety.local_only !== true
    || safety.database_writes_allowed !== false
    || safety.writes_attempted !== false
    || safety.importable !== false
    || safety.human_decisions_required !== true
  ) {
    fail("receipt safety contract is invalid.");
  }
  const artifacts = receipt.artifacts ?? {};
  if (!hasExactKeys(artifacts, PREPARATION_ARTIFACT_KEYS)) {
    fail("receipt artifacts have unexpected fields.");
  }
  for (const key of PREPARATION_ARTIFACT_KEYS) {
    const entry = artifacts[key];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`receipt artifact ${key} is missing.`);
      continue;
    }
    if (!hasExactKeys(entry, ["file", "sha256"])) {
      fail(`receipt artifact ${key} has unexpected fields.`);
    }
    if (typeof entry.file !== "string" || basename(entry.file) !== entry.file) {
      fail(`receipt artifact ${key} must use a plain filename.`);
    }
    if (!/^[0-9a-f]{64}$/u.test(entry.sha256 ?? "")) {
      fail(`receipt artifact ${key} SHA-256 is invalid.`);
    }
    if (typeof texts?.[key] !== "string") {
      fail(`receipt artifact text ${key} is missing.`);
    } else if (sha256Text(texts[key]) !== entry.sha256) {
      fail(`receipt artifact ${key} hash does not match.`);
    }
  }
  const bundle = parseJsonArtifact(texts?.review_bundle ?? "", "review bundle", errors);
  const worksheet = parseJsonArtifact(
    texts?.decision_worksheet ?? "",
    "decision worksheet",
    errors,
  );
  const response = parseJsonArtifact(
    texts?.reviewer_response ?? "",
    "reviewer response",
    errors,
  );
  const bundleVerification = bundle ? verifyReviewBundle(bundle) : null;
  if (bundleVerification && !bundleVerification.valid) {
    fail(`review bundle verification failed: ${bundleVerification.errors.join(" ")}`);
  }
  const worksheetVerification = bundle && worksheet
    ? verifyDecisionWorksheet(bundle, worksheet)
    : null;
  if (worksheetVerification && !worksheetVerification.valid) {
    fail(`decision worksheet verification failed: ${worksheetVerification.errors.join(" ")}`);
  }
  const responseVerification = worksheet && response
    ? verifyReviewerResponse(worksheet, response)
    : null;
  if (responseVerification && !responseVerification.valid) {
    fail(`reviewer response verification failed: ${responseVerification.errors.join(" ")}`);
  }
  if (response && !responseIsBlank(response)) {
    fail("initial reviewer response must remain blank.");
  }
  const binding = receipt.binding ?? {};
  if (!hasExactKeys(binding, [
    "playlist_id",
    "project_ref",
    "review_bundle_sha256",
    "decision_worksheet_sha256",
  ])) fail("receipt binding has unexpected fields.");
  const preparation = receipt.preparation ?? {};
  if (!hasExactKeys(preparation, [
    "live_reads_performed",
    "reused_verified_bundle",
    "prior_review_attached",
    "prior_manifest_sha256",
    "required_decisions",
    "completed_decisions",
  ])) fail("receipt preparation has unexpected fields.");
  if (
    typeof preparation.live_reads_performed !== "boolean"
    || typeof preparation.reused_verified_bundle !== "boolean"
    || preparation.live_reads_performed === preparation.reused_verified_bundle
  ) {
    fail("receipt must identify exactly one live or reused-bundle preparation mode.");
  }
  if (typeof preparation.prior_review_attached !== "boolean") {
    fail("receipt prior-review flag must be boolean.");
  }
  if (
    preparation.prior_review_attached
      ? !/^[0-9a-f]{64}$/u.test(preparation.prior_manifest_sha256 ?? "")
      : preparation.prior_manifest_sha256 != null
  ) {
    fail("receipt prior-review hash does not match its attachment flag.");
  }
  if (worksheet) {
    if (binding.playlist_id !== worksheet.binding.playlist_id) fail("receipt playlist differs.");
    if (binding.project_ref !== worksheet.binding.project_ref) fail("receipt project differs.");
    if (binding.review_bundle_sha256 !== worksheet.binding.review_bundle_sha256) {
      fail("receipt review-bundle binding differs.");
    }
    if (binding.decision_worksheet_sha256 !== sha256Json(worksheet)) {
      fail("receipt worksheet binding differs.");
    }
    if (receipt.generated_at !== worksheet.generated_at) {
      fail("receipt generation time differs from the decision worksheet.");
    }
    if (preparation.required_decisions !== requiredDecisionCount(worksheet)) {
      fail("receipt required-decision count differs.");
    }
    if (preparation.completed_decisions !== 0 || worksheet.completion.completed_decisions !== 0) {
      fail("initial preparation must contain zero completed decisions.");
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    summary: worksheet ? {
      playlist: worksheet.binding.playlist_id,
      project_ref: worksheet.binding.project_ref,
      required_decisions: requiredDecisionCount(worksheet),
      completed_decisions: worksheet.completion.completed_decisions,
      artifact_count: PREPARATION_ARTIFACT_KEYS.length,
      database_writes_allowed: false,
      importable: false,
    } : null,
  };
}
