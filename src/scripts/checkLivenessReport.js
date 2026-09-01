// =====================================================================
//  checkLivenessReport.js — the verdict step of the liveness workflow.
//
//  checkVideoLiveness.js always exits 0, so on its own a scheduled run that
//  found dead lessons is indistinguishable from one that found none. This reads
//  the report it wrote and exits non-zero when a human needs to look, which
//  turns GitHub's existing "your scheduled workflow failed" email into the
//  notification. Nothing else is needed: no bot token, no issue permissions.
//
//      node src/scripts/checkLivenessReport.js [path-to-report.json]
//
//  Exit 0 — nothing dead, nothing newly blocked.
//  Exit 1 — findings, OR the report could not be read (see livenessGate.js for
//           why unknown is treated as bad news rather than good).
// =====================================================================

import { readFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildGateVerdict, renderGateSummary } from "./livenessGate.js";

const here = dirname(fileURLToPath(import.meta.url));
const reportPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(here, "../../tmp/video-liveness-report.json");

let report = null;
try {
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (e) {
  // Left as null on purpose — buildGateVerdict turns that into an explicit
  // "unreadable" verdict rather than an empty-but-clean one.
  console.error(`Could not read ${reportPath}: ${e.message}`);
}

const verdict = buildGateVerdict(report);
const summary = renderGateSummary(verdict);
console.log(summary);

// GitHub renders this on the run page, so the answer is visible without
// downloading the artifact.
if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
  } catch (e) {
    // Never let a summary-write problem change the verdict.
    console.error(`(could not write job summary: ${e.message})`);
  }
}

process.exit(verdict.needsAttention ? 1 : 0);
