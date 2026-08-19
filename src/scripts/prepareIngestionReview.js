// prepareIngestionReview.js — one-command, fail-closed review preparation.
//
// Reads real YouTube metadata and public Supabase taxonomy, builds every local
// human-review artifact in memory, verifies the bindings, and only then writes
// them outside the repository. It has no importer or database mutation path.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { client } from "./dbProbe.js";
import {
  assertDatabaseProject,
  collectIngestionReview,
  loadRunnerEnvironment,
  writeReviewBundle,
} from "./reviewIngestion.js";
import {
  buildDecisionWorksheet,
  writeDecisionWorksheet,
} from "./prepareIngestionDecisions.js";
import { verifyReviewBundle } from "./verifyIngestionReview.js";
import { verifyDecisionWorksheet } from "./verifyIngestionDecisions.js";
import { prepareResponse, writeResponse } from "./prepareIngestionResponse.js";
import { renderReviewPacket, writeReviewPacket } from "./renderIngestionReviewPacket.js";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(here, "../..");
const SAFE_PLAYLIST_ID = /^[A-Za-z0-9_-]+$/u;
const SAFE_PROJECT_REF = /^[a-z0-9]{20}$/u;

export function parsePreparationArgs(argv = []) {
  const args = { environment: "production", check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--playlist") args.playlist = argv[++index];
    else if (arg.startsWith("--playlist=")) args.playlist = arg.slice("--playlist=".length);
    else if (arg === "--env") args.environment = argv[++index];
    else if (arg.startsWith("--env=")) args.environment = arg.slice("--env=".length);
    else if (arg === "--expected-project-ref") args.expectedProjectRef = argv[++index];
    else if (arg.startsWith("--expected-project-ref=")) {
      args.expectedProjectRef = arg.slice("--expected-project-ref=".length);
    } else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg.startsWith("--out-dir=")) args.outDir = arg.slice("--out-dir=".length);
    else if (arg === "--bundle") args.bundle = argv[++index];
    else if (arg.startsWith("--bundle=")) args.bundle = arg.slice("--bundle=".length);
    else if (arg === "--prior-manifest") args.priorManifest = argv[++index];
    else if (arg.startsWith("--prior-manifest=")) {
      args.priorManifest = arg.slice("--prior-manifest=".length);
    } else if (arg === "--check") args.check = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.playlist || !SAFE_PLAYLIST_ID.test(args.playlist)) {
    throw new Error("--playlist must be a valid YouTube playlist ID.");
  }
  if (!new Set(["production", "staging"]).has(args.environment)) {
    throw new Error("--env must be production or staging.");
  }
  if (!args.expectedProjectRef || !SAFE_PROJECT_REF.test(args.expectedProjectRef)) {
    throw new Error("--expected-project-ref must be the exact 20-character Supabase project ref.");
  }
  if (!args.outDir) throw new Error("--out-dir is required.");
  if (args.bundle && !args.bundle.toLowerCase().endsWith(".json")) {
    throw new Error("--bundle must name a review JSON file.");
  }
  if (args.priorManifest && !args.priorManifest.toLowerCase().endsWith(".json")) {
    throw new Error("--prior-manifest must name a JSON file.");
  }
  return args;
}

export function assertReusedBundleTarget(bundle, args) {
  if (bundle?.source?.owner?.playlistId !== args.playlist) {
    throw new Error("reused review bundle playlist does not match --playlist.");
  }
  if (bundle?.database?.project_ref !== args.expectedProjectRef) {
    throw new Error("reused review bundle project does not match --expected-project-ref.");
  }
  if (bundle?.database?.requested_environment !== args.environment) {
    throw new Error("reused review bundle environment does not match --env.");
  }
}

function isInside(root, target) {
  const pathFromRoot = relative(resolve(root), resolve(target));
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

export function resolvePreparationPaths({
  playlist,
  outDir,
  priorManifest,
  cwd = process.cwd(),
  repoRoot = defaultRepoRoot,
} = {}) {
  const outputDir = resolve(cwd, outDir);
  if (isInside(repoRoot, outputDir)) {
    throw new Error("ingestion review preparation output must stay outside the repository.");
  }
  const prefix = resolve(outputDir, playlist);
  return {
    outputDir,
    bundlePath: `${prefix}.review.json`,
    decisionsPath: `${prefix}.decisions.json`,
    packetPath: `${prefix}.review.md`,
    responsePath: `${prefix}.response.json`,
    priorManifestPath: priorManifest ? resolve(cwd, priorManifest) : null,
  };
}

export function assertPreparationOutputsAvailable(paths, pathExists = existsSync) {
  const existing = [
    paths.bundlePath,
    paths.decisionsPath,
    paths.packetPath,
    paths.responsePath,
  ].filter(pathExists);
  if (existing.length) {
    throw new Error(
      `refusing to overwrite existing review preparation artifact${existing.length === 1 ? "" : "s"}: `
      + `${existing.join(", ")}. Choose a new --out-dir.`,
    );
  }
}

export function prepareIngestionReviewArtifacts(
  bundle,
  {
    generatedAt = new Date().toISOString(),
    priorManifest = null,
    priorManifestLabel = null,
    priorManifestSha256 = null,
  } = {},
) {
  const bundleVerification = verifyReviewBundle(bundle);
  if (!bundleVerification.valid) {
    throw new Error(`review bundle failed verification: ${bundleVerification.errors.join(" ")}`);
  }
  const worksheet = buildDecisionWorksheet(bundle, { generatedAt });
  const worksheetVerification = verifyDecisionWorksheet(bundle, worksheet);
  if (!worksheetVerification.valid) {
    throw new Error(
      `decision worksheet failed verification: ${worksheetVerification.errors.join(" ")}`,
    );
  }
  const packet = renderReviewPacket(bundle, worksheet, {
    generatedAt,
    priorManifest,
    priorManifestLabel,
    priorManifestSha256,
  });
  const response = prepareResponse(bundle, worksheet, { generatedAt });
  return {
    bundle,
    worksheet,
    packet,
    response,
    verification: {
      bundle: bundleVerification,
      worksheet: worksheetVerification,
    },
  };
}

export function writePreparationArtifacts(paths, artifacts) {
  writeReviewBundle(paths.bundlePath, artifacts.bundle);
  writeDecisionWorksheet(paths.decisionsPath, artifacts.worksheet);
  writeReviewPacket(paths.packetPath, artifacts.packet);
  writeResponse(paths.responsePath, artifacts.response);
}

export async function collectLivePreparationBundle(
  args,
  {
    generatedAt = new Date().toISOString(),
    loadEnvironment = loadRunnerEnvironment,
    createClient = client,
    collectReview = collectIngestionReview,
  } = {},
) {
  const env = loadEnvironment({ environment: args.environment });
  assertDatabaseProject(env.databaseUrl, args.expectedProjectRef);
  const db = createClient({
    service: false,
    env: {
      VITE_SUPABASE_URL: env.databaseUrl,
      VITE_SUPABASE_ANON_KEY: env.anonKey,
    },
  });
  return collectReview({
    playlist: args.playlist,
    environment: args.environment,
    expectedProjectRef: args.expectedProjectRef,
    databaseUrl: env.databaseUrl,
    youtubeKey: env.youtubeKey,
    db,
    generatedAt,
  });
}

export async function main(argv = process.argv.slice(2)) {
  const args = parsePreparationArgs(argv);
  const paths = resolvePreparationPaths(args);
  assertPreparationOutputsAvailable(paths);
  const generatedAt = new Date().toISOString();
  let bundle;
  if (args.bundle) {
    bundle = JSON.parse(readFileSync(resolve(process.cwd(), args.bundle), "utf8"));
    assertReusedBundleTarget(bundle, args);
  } else {
    bundle = await collectLivePreparationBundle(args, { generatedAt });
  }
  const priorManifestBytes = paths.priorManifestPath
    ? readFileSync(paths.priorManifestPath)
    : null;
  const priorManifest = priorManifestBytes
    ? JSON.parse(priorManifestBytes.toString("utf8"))
    : null;
  const artifacts = prepareIngestionReviewArtifacts(bundle, {
    generatedAt,
    priorManifest,
    priorManifestLabel: paths.priorManifestPath ? basename(paths.priorManifestPath) : null,
    priorManifestSha256: priorManifestBytes
      ? createHash("sha256").update(priorManifestBytes).digest("hex")
      : null,
  });
  assertPreparationOutputsAvailable(paths);
  if (!args.check) writePreparationArtifacts(paths, artifacts);
  console.log(JSON.stringify({
    output_directory: args.check ? null : paths.outputDir,
    bundle: args.check ? null : paths.bundlePath,
    decisions: args.check ? null : paths.decisionsPath,
    packet: args.check ? null : paths.packetPath,
    response: args.check ? null : paths.responsePath,
    planned_output_directory: paths.outputDir,
    check_only: args.check,
    output_written: !args.check,
    playlist: args.playlist,
    source_videos: bundle.source.videos.length,
    required_decisions:
      artifacts.worksheet.completion.required_proposal_decisions
      + artifacts.worksheet.completion.required_chapter_decisions
      + artifacts.worksheet.completion.required_scope_decisions,
    completed_decisions: artifacts.worksheet.completion.completed_decisions,
    prior_review_attached: Boolean(priorManifest),
    live_reads_performed: !args.bundle,
    reused_verified_bundle: Boolean(args.bundle),
    database_writes_allowed: false,
    writes_attempted: false,
    importable: false,
  }, null, 2));
  return artifacts;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(`ingestion review preparation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
