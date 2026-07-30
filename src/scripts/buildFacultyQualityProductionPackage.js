import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const order = [
  "src/migrations/faculty_quality_production_preflight.sql",
  "src/migrations/teachers_v7.sql",
  "src/migrations/teachers_v7_import.sql",
  "src/migrations/teachers_v7_admin_ui.sql",
  // search_latin_key_v11 must precede universal_search_v11: the latter's own
  // preflight refuses to continue without it. Was "universal_search.sql" (the
  // pre-v11 file) until 2026-07-30 -- that stale copy would have silently
  // regressed search_v11_2026-07-30.sql's already-live fixes (non-sargable
  // predicates, single-token-only matching, no Hinglish bridge) on any future
  // rebuild of this package. See docs/schema_reference.md's Import/Catalog
  // Management "Discrepancies" section for how this was found.
  "src/migrations/search_latin_key_v11.sql",
  "src/migrations/universal_search_v11.sql",
  "src/migrations/content_quality_v10.sql",
  "src/migrations/faculty_quality_production_postflight.sql",
];
const missing = order.filter((rel) => !existsSync(resolve(root, rel)));
if (missing.length) {
  console.error(`REFUSING: missing sources: ${missing.join(", ")}`);
  process.exit(1);
}

let sql = `-- AUTO-GENERATED — FACULTY + CONTENT QUALITY PRODUCTION PACKAGE.
-- Requires a verified recent backup and explicit production approval.
-- Additive identity/editorial schema. It never scans legacy names and never
-- creates or merges a teacher without a later human review decision.
`;
for (const rel of order) {
  sql += `\n\n-- ============================================================\n-- ${rel}\n-- ============================================================\n\n`;
  sql += readFileSync(resolve(root, rel), "utf8");
}

const forbidden = [
  [/insert\s+into\s+public\.app_environment/i, "environment seed"],
  [/DRIFTFX|TESTPL|__fixture_playlist/i, "test fixture"],
  [/create\s+or\s+replace\s+function\s+public\.__assert_not_production/i, "staging guard helper"],
];
const hits = forbidden.filter(([pattern]) => pattern.test(sql)).map(([, label]) => label);
if (hits.length) {
  console.error(`REFUSING: production package contains ${hits.join(", ")}`);
  process.exit(1);
}

const outDir = resolve(root, "production");
if (!existsSync(outDir)) mkdirSync(outDir);
const outPath = resolve(outDir, "faculty_quality_production.sql");
const manifestPath = resolve(outDir, "faculty_quality_production.sha256.txt");
writeFileSync(outPath, sql, "utf8");
const sha = createHash("sha256").update(Buffer.from(sql, "utf8")).digest("hex");
writeFileSync(manifestPath, `${sha}  faculty_quality_production.sql\n`, "utf8");
console.log(`✓ production/faculty_quality_production.sql (${order.length} sources, ${Math.round(Buffer.byteLength(sql) / 1024)} KB)`);
console.log(`  sha256: ${sha}`);
console.log("  self-check: no staging markers or fixture helpers");

