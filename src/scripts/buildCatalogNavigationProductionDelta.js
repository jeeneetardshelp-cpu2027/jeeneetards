// Build the isolated production package for catalog navigation v9.
//
// This does not connect to any database. It wraps the exact core SQL verified
// on disposable staging with production preflight/postflight assertions and
// emits a rollback, read-only evidence queries, a runbook and SHA-256 manifest.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "production/catalog_navigation_v9");

const VERIFIED_CORE_SHA = "1609de029bc1d94e07ec021fff6499f3203e669bbca0887d1013453ff7425140";
const VERIFIED_STAGING_DELTA_SHA = "3e2ca97d6a4b701e5e95afea5c64325a05beb9025423eb8304b56196dc97db98";
const VERIFIED_RUN = "50bee2";

const paths = {
  preflight: "src/migrations/catalog_navigation_v9_production_preflight.sql",
  core: "src/migrations/catalog_navigation_v9.sql",
  postflight: "src/migrations/catalog_navigation_v9_production_postflight.sql",
  rollback: "src/migrations/catalog_navigation_v9_rollback.sql",
  evidence: "src/migrations/catalog_navigation_v9_evidence.sql",
  stagingDelta: "catalog_navigation_staging_delta.sql",
  report: "catalog-navigation-test-report.json",
  wrapperReport: "catalog-navigation-v9-wrapper-test-report.json",
};

const missing = Object.entries(paths)
  .filter(([, relativePath]) => !existsSync(resolve(root, relativePath)))
  .map(([name, relativePath]) => `${name}: ${relativePath}`);
if (missing.length) {
  console.error(`REFUSING: missing production-package inputs:\n${missing.join("\n")}`);
  process.exit(1);
}

const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const core = read(paths.core);
const stagingDelta = readFileSync(resolve(root, paths.stagingDelta));
const report = JSON.parse(read(paths.report));
const wrapperReport = JSON.parse(read(paths.wrapperReport));

if (sha(core) !== VERIFIED_CORE_SHA) {
  console.error("REFUSING: catalog_navigation_v9.sql changed after its staging verification.");
  process.exit(1);
}
if (sha(stagingDelta) !== VERIFIED_STAGING_DELTA_SHA) {
  console.error("REFUSING: the staging delta no longer matches the verified artifact.");
  process.exit(1);
}
if (report.run !== VERIFIED_RUN || report.passed !== 10 || report.failed !== 0
    || report.fatal != null || report.guard_failed !== false || report.cleanup_ran !== true) {
  console.error("REFUSING: the required non-vacuous staging verification report is absent or not green.");
  process.exit(1);
}
if (wrapperReport.artifact_sha256 !== "0e639d0a102b25477d0c6f292b07ecdf14ab1a1fb470e3c65bf809013ce8c8bc"
    || wrapperReport.transaction_ended_with !== "rollback"
    || wrapperReport.final_result?.environment_after !== "staging"
    || Object.entries(wrapperReport.final_result ?? {})
      .filter(([key]) => key.endsWith("_restored"))
      .some(([, value]) => value !== true)
    || wrapperReport.production_touched !== false) {
  console.error("REFUSING: production-wrapper staging rehearsal evidence is absent or not green.");
  process.exit(1);
}

const productionSql = `-- ============================================================
-- CATALOG NAVIGATION v9 — ISOLATED PRODUCTION DELTA
--
-- AUTO-GENERATED. Do not edit by hand.
-- Core source SHA-256: ${VERIFIED_CORE_SHA}
-- Verified staging run: ${VERIFIED_RUN} (10 passed, 0 failed, cleanup clean)
--
-- DDL only: two additive indexes and two public read functions.
-- No inserts, updates, deletes, table changes, fixtures or credentials.
-- The preflight refuses staging/test targets and incompatible schemas.
-- The postflight runs in the same transaction and aborts on any mismatch.
-- ============================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- SOURCE: ${paths.preflight}
${read(paths.preflight)}

-- SOURCE: ${paths.core}
${core}

-- SOURCE: ${paths.postflight}
${read(paths.postflight)}

commit;
`;

const forbidden = [
  [/\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate|alter\s+table|drop\s+table|create\s+table)\b/i,
    "data/table-changing SQL"],
  [/\b(?:DRIFTFX|__fixture|staging_test_helpers|seed_blocking_drift_fixture)\b/i,
    "test or drift fixture"],
  [/security\s+definer/i, "SECURITY DEFINER"],
  [/(?:sb_secret_|eyJhbGciOi|AIza)[A-Za-z0-9_.-]{10,}/, "credential material"],
];
const problems = forbidden.filter(([pattern]) => pattern.test(productionSql)).map(([, label]) => label);
if (problems.length) {
  console.error(`REFUSING: generated production delta contains ${problems.join(", ")}.`);
  process.exit(1);
}

mkdirSync(outputDir, { recursive: true });
const files = {
  "production_delta.sql": productionSql,
  "rollback.sql": read(paths.rollback),
  "evidence.sql": read(paths.evidence),
  "wrapper_staging_test_report.json": `${JSON.stringify(wrapperReport, null, 2)}\n`,
};
for (const [name, value] of Object.entries(files))
  writeFileSync(resolve(outputDir, name), value, "utf8");

const hashes = Object.fromEntries(Object.entries(files).map(([name, value]) => [name, sha(value)]));
const readme = `# Catalogue navigation v9 — production runbook

**Status: PREPARED AND REVIEWED, NOT AUTHORIZED OR APPLIED.**

This folder is isolated from the older importer/taxonomy production migration.
Applying v9 cannot accidentally deploy those unrelated changes.

## Files and hashes

| File | Purpose | SHA-256 |
|---|---|---|
| \`production_delta.sql\` | Preflight + exact staging-verified core + postflight | \`${hashes["production_delta.sql"]}\` |
| \`rollback.sql\` | Removes only the two v9 functions | \`${hashes["rollback.sql"]}\` |
| \`evidence.sql\` | Read-only post-deployment checks | \`${hashes["evidence.sql"]}\` |
| \`wrapper_staging_test_report.json\` | Production-wrapper rollback rehearsal evidence | \`${hashes["wrapper_staging_test_report.json"]}\` |

Core source hash: \`${VERIFIED_CORE_SHA}\`  
Verified staging artifact hash: \`${VERIFIED_STAGING_DELTA_SHA}\`  
Staging evidence: run \`${VERIFIED_RUN}\`, **10 passed, 0 failed**, cleanup clean.
Production-wrapper rehearsal: **passed on disposable staging**, ended in
\`ROLLBACK\`, and restored the environment marker, both functions and both
indexes. Production was not contacted.

## Exact scope

- Adds \`idx_plg_goal_playlist\` and \`idx_pcl_class_playlist\` if absent.
- Adds \`get_browse_curriculum(text,text,text)\`.
- Adds \`browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)\`.
- Grants function execution to \`anon\`, \`authenticated\` and \`service_role\`.
- Writes no content rows and changes no table definition.

The functions are \`STABLE SECURITY INVOKER\` with an empty \`search_path\`.
Anonymous callers remain constrained by the existing table grants and RLS.

## Before applying

1. Create and verify a restorable Supabase backup.
2. Run evidence section 5 and save the baseline row counts.
3. Verify the three hashes against \`production_delta.sha256.txt\`.
4. Use a short maintenance window. Creating an index takes a table lock; the
   current database is small, but this should still be deliberate.
5. Stop if either v9 function already exists. The preflight refuses to replace
   an unknown implementation.

## Apply

Paste \`production_delta.sql\` into the production Supabase SQL Editor and run
it once. Any preflight, DDL or postflight failure aborts the transaction. Do
not edit the generated file, and do not continue after an error.

Deploy database first, frontend second. The existing frontend ignores these
functions; the new frontend safely falls back while they are absent.

## Evidence and rollback

Run each numbered section of \`evidence.sql\` separately. Save the outputs.
The anonymous section must return normally, PUBLIC must have no EXECUTE grant,
both indexes must exist, and content counts must equal the saved baseline.

If evidence or the browser smoke test fails, run \`rollback.sql\`. The frontend
then falls back automatically. Rollback deliberately retains the two additive
indexes because they contain no independent data and dropping them would take
another table lock.

## Honest limitations

- v9 facet counts do not accept faculty or board filters. The UI suppresses
  counts whenever either is active rather than showing misleading numbers.
- Search faceting uses a leading-wildcard title match. It is suitable for the
  current catalogue and expected thousands of courses, but must be load-tested
  before growth into the tens or hundreds of thousands.
- Staging's permanent content was empty after fixture cleanup, so the visual UI
  audit showed honest zeroes. Non-zero isolation and Dropper deduplication were
  proved by run-scoped PostgreSQL fixtures in run ${VERIFIED_RUN}.

## Smoke test

- Open \`/explore\`; goal choices load without login.
- Follow JEE → Class 11 → Physics and confirm only populated branches appear.
- Open \`/browse?goal=jee&class=11&subject=physics\`; counts render beside filters.
- Change a filter; URL, chips, results and counts agree.
- Repeat at 360 px and in dark mode; check the browser console.
`;
files["README.md"] = readme;
writeFileSync(resolve(outputDir, "README.md"), readme, "utf8");

const manifestHashes = Object.fromEntries(
  Object.entries(files).map(([name, value]) => [name, sha(value)]),
);
const manifest = `Catalogue navigation v9 production package — SHA-256\n\n${
  Object.entries(manifestHashes).map(([name, digest]) => `${digest}  ${name}`).join("\n")
}\n\nCore source: ${VERIFIED_CORE_SHA}\nVerified staging delta: ${VERIFIED_STAGING_DELTA_SHA}\nVerified run: ${VERIFIED_RUN} (10/10)\n`;
writeFileSync(resolve(outputDir, "production_delta.sha256.txt"), manifest, "utf8");

for (const [name, expected] of Object.entries(manifestHashes)) {
  const actual = sha(readFileSync(resolve(outputDir, name)));
  if (actual !== expected) {
    console.error(`REFUSING: post-write hash mismatch for ${name}`);
    process.exit(1);
  }
}

console.log(`✓ ${outputDir}`);
console.log(`  production_delta.sql sha256: ${manifestHashes["production_delta.sql"]}`);
console.log(`  core provenance: ${VERIFIED_CORE_SHA} / staging run ${VERIFIED_RUN}`);
console.log("  gates: schema preflight · no DML · invoker rights · postflight · rollback · evidence");
console.log("  no connection made; production remains untouched");
