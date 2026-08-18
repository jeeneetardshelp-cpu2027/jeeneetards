// prepareIngestionDecisions.js — offline human-decision worksheet generator.
//
// Converts one verified ingestion review bundle into a hash-bound, explicitly
// non-importable worksheet. It reads and writes local JSON only; it has no
// network, database, or importer path.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  automaticContext,
  chapterDecision,
  proposalDecision,
} from "./ingestionDecisionContract.js";
import { sha256Json } from "./reviewIngestion.js";
import { verifyReviewBundle } from "./verifyIngestionReview.js";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(here, "../..");

export function parseDecisionArgs(argv = []) {
  const args = { overwrite: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--bundle") args.bundle = argv[++index];
    else if (arg.startsWith("--bundle=")) args.bundle = arg.slice("--bundle=".length);
    else if (arg === "--out") args.out = argv[++index];
    else if (arg.startsWith("--out=")) args.out = arg.slice("--out=".length);
    else if (arg === "--overwrite") args.overwrite = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.bundle || !args.bundle.toLowerCase().endsWith(".json")) {
    throw new Error("--bundle must name a review JSON file.");
  }
  return args;
}

function isInside(root, target) {
  const pathFromRoot = relative(resolve(root), resolve(target));
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

export function resolveDecisionOutputPath({
  bundle,
  out,
  cwd = process.cwd(),
  repoRoot = defaultRepoRoot,
} = {}) {
  const bundlePath = resolve(cwd, bundle);
  const defaultName = basename(bundlePath).replace(/(?:\.review)?\.json$/iu, ".decisions.json");
  const outputPath = out ? resolve(cwd, out) : resolve(dirname(bundlePath), defaultName);
  if (!outputPath.toLowerCase().endsWith(".json")) {
    throw new Error("decision worksheet output must use a .json filename.");
  }
  if (resolve(outputPath) === bundlePath) {
    throw new Error("decision worksheet must not overwrite its review bundle.");
  }
  if (isInside(repoRoot, outputPath)) {
    throw new Error("decision worksheet must stay outside the repository.");
  }
  return { bundlePath, outputPath };
}

export function assertDecisionOutputAvailable(
  outputPath,
  overwrite = false,
  pathExists = existsSync,
) {
  if (!overwrite && pathExists(outputPath)) {
    throw new Error(
      `refusing to overwrite existing decision worksheet: ${outputPath}. `
      + "Choose another --out path or pass --overwrite explicitly.",
    );
  }
}

export function buildDecisionWorksheet(
  bundle,
  { generatedAt = new Date().toISOString() } = {},
) {
  const verification = verifyReviewBundle(bundle);
  if (!verification.valid) {
    throw new Error(`review bundle failed verification: ${verification.errors.join(" ")}`);
  }
  const proposalDecisions = bundle.human_review.items.map(proposalDecision);
  const chapterDecisions = bundle.chapter_review.rows
    .filter((row) => row.status !== "auto")
    .map(chapterDecision);
  return {
    schema_version: 1,
    kind: "ingestion-human-decisions",
    generated_at: generatedAt,
    safety: {
      local_only: true,
      source_bundle_verified: true,
      database_writes_allowed: false,
      importable: false,
      human_completion_required: true,
    },
    binding: {
      review_bundle_schema_version: bundle.schema_version,
      review_bundle_sha256: sha256Json(bundle),
      source_sha256: bundle.source.sha256,
      taxonomy_sha256: bundle.taxonomy.sha256,
      playlist_id: bundle.source.owner.playlistId,
      project_ref: bundle.database.project_ref,
    },
    reviewer: {
      name: null,
      reviewed_at: null,
      notes: null,
    },
    allowed_reviewer_actions: ["accept", "replace", "reject"],
    proposal_decisions: proposalDecisions,
    chapter_decisions: chapterDecisions,
    automatic_context: automaticContext(bundle),
    completion: {
      status: "pending",
      required_proposal_decisions: proposalDecisions.length,
      required_chapter_decisions: chapterDecisions.length,
      completed_decisions: 0,
    },
  };
}

export function writeDecisionWorksheet(outputPath, worksheet) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(worksheet, null, 2)}\n`, "utf8");
}

export function main(argv = process.argv.slice(2)) {
  const args = parseDecisionArgs(argv);
  const { bundlePath, outputPath } = resolveDecisionOutputPath(args);
  assertDecisionOutputAvailable(outputPath, args.overwrite);
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const worksheet = buildDecisionWorksheet(bundle);
  writeDecisionWorksheet(outputPath, worksheet);
  console.log(JSON.stringify({
    output: outputPath,
    playlist: worksheet.binding.playlist_id,
    source_bundle_verified: true,
    required_proposal_decisions: worksheet.completion.required_proposal_decisions,
    required_chapter_decisions: worksheet.completion.required_chapter_decisions,
    database_writes_allowed: false,
    importable: false,
  }, null, 2));
  return worksheet;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(`ingestion decision preparation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
