// prepareIngestionResponse.js — create a minimal, local reviewer response form.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildResponseTemplate } from "./ingestionResponseContract.js";
import { verifyDecisionWorksheet } from "./verifyIngestionDecisions.js";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(here, "../..");

export function parseResponsePrepareArgs(argv = []) {
  const args = { overwrite: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--bundle") args.bundle = argv[++index];
    else if (arg.startsWith("--bundle=")) args.bundle = arg.slice("--bundle=".length);
    else if (arg === "--decisions") args.decisions = argv[++index];
    else if (arg.startsWith("--decisions=")) args.decisions = arg.slice("--decisions=".length);
    else if (arg === "--out") args.out = argv[++index];
    else if (arg.startsWith("--out=")) args.out = arg.slice("--out=".length);
    else if (arg === "--overwrite") args.overwrite = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const name of ["bundle", "decisions"]) {
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

export function resolveResponsePreparePaths({
  bundle,
  decisions,
  out,
  cwd = process.cwd(),
  repoRoot = defaultRepoRoot,
} = {}) {
  const bundlePath = resolve(cwd, bundle);
  const decisionsPath = resolve(cwd, decisions);
  const defaultName = basename(decisionsPath).replace(/(?:\.decisions)?\.json$/iu, ".response.json");
  const outputPath = out ? resolve(cwd, out) : resolve(dirname(decisionsPath), defaultName);
  if (!outputPath.toLowerCase().endsWith(".json")) {
    throw new Error("reviewer response output must use a .json filename.");
  }
  if ([bundlePath, decisionsPath].includes(outputPath)) {
    throw new Error("reviewer response must not overwrite an input artifact.");
  }
  if (isInside(repoRoot, outputPath)) {
    throw new Error("reviewer response must stay outside the repository.");
  }
  return { bundlePath, decisionsPath, outputPath };
}

export function assertResponseOutputAvailable(outputPath, overwrite = false, pathExists = existsSync) {
  if (!overwrite && pathExists(outputPath)) {
    throw new Error(`refusing to overwrite existing reviewer response: ${outputPath}.`);
  }
}

export function prepareResponse(bundle, worksheet, options) {
  const verification = verifyDecisionWorksheet(bundle, worksheet);
  if (!verification.valid) {
    throw new Error(`decision worksheet failed verification: ${verification.errors.join(" ")}`);
  }
  return buildResponseTemplate(worksheet, options);
}

export function writeResponse(outputPath, response) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(response, null, 2)}\n`, "utf8");
}

export function main(argv = process.argv.slice(2)) {
  const args = parseResponsePrepareArgs(argv);
  const paths = resolveResponsePreparePaths(args);
  assertResponseOutputAvailable(paths.outputPath, args.overwrite);
  const bundle = JSON.parse(readFileSync(paths.bundlePath, "utf8"));
  const worksheet = JSON.parse(readFileSync(paths.decisionsPath, "utf8"));
  const response = prepareResponse(bundle, worksheet);
  writeResponse(paths.outputPath, response);
  console.log(JSON.stringify({
    output: paths.outputPath,
    playlist: response.binding.playlist_id,
    proposal_responses: response.proposal_responses.length,
    chapter_responses: response.chapter_responses.length,
    video_scope_responses: response.video_scope_responses.length,
    database_writes_allowed: false,
    importable: false,
  }, null, 2));
  return response;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(`ingestion reviewer-response preparation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
