// Offline verifier for a complete ingestion-review preparation receipt.

import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PREPARATION_ARTIFACT_KEYS,
  verifyPreparationReceipt,
} from "./ingestionPreparationReceipt.js";

export function parsePreparationVerifyArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--receipt") args.receipt = argv[++index];
    else if (arg.startsWith("--receipt=")) args.receipt = arg.slice("--receipt=".length);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.receipt || !args.receipt.toLowerCase().endsWith(".json")) {
    throw new Error("--receipt must name a preparation receipt JSON file.");
  }
  return args;
}

export function loadReceiptArtifacts(receiptPath, receipt) {
  const artifactDirectory = dirname(receiptPath);
  return Object.fromEntries(PREPARATION_ARTIFACT_KEYS.map((key) => {
    const file = receipt?.artifacts?.[key]?.file;
    if (typeof file !== "string" || basename(file) !== file) {
      throw new Error(`receipt artifact ${key} must use a plain filename.`);
    }
    return [key, readFileSync(resolve(artifactDirectory, file), "utf8")];
  }));
}

export function main(argv = process.argv.slice(2)) {
  const args = parsePreparationVerifyArgs(argv);
  const receiptPath = resolve(process.cwd(), args.receipt);
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  const texts = loadReceiptArtifacts(receiptPath, receipt);
  const result = verifyPreparationReceipt(receipt, texts);
  console.log(JSON.stringify({ receipt: receiptPath, ...result }, null, 2));
  if (!result.valid) process.exitCode = 1;
  return result;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(`ingestion preparation verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
