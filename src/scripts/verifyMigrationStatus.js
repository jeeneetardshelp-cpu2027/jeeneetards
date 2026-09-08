// Read-only check: does supabase/README.md's migration table tell the truth?
//
// Run it before trusting that table, and before any `db push` — push has no
// per-file selection, so "what is pending" is the one fact you must have right.
//
//   npm run verify:migration-status
//
// It compares three things: the files in supabase/migrations/, the versions the
// REAL database reports through `supabase migration list`, and the status each
// README row claims. It writes nothing, to the database or the repo.
//
// Exit 1 on any mismatch, including a row whose status cannot be read at all —
// an unreadable claim is not a passing one.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseStatusRows, compareStatus } from "./migrationStatusRows.js";

const ROOT = resolve(import.meta.dirname, "../..");
const CHAIN = resolve(ROOT, "supabase/migrations");
const README = resolve(ROOT, "supabase/README.md");

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

function appliedVersionsFromCli() {
  // `migration list` prints a JSON line last. Its `time` column is DERIVED FROM
  // THE VERSION STRING, not from when the migration ran, so it can never date
  // anything — a README row citing it as proof of an apply DATE is citing
  // nothing. Only the presence of `remote` means applied.
  const out = execFileSync("npx", ["supabase", "migration", "list"], {
    cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], shell: true,
  });
  const line = out.trim().split("\n").filter((l) => l.trim().startsWith("{")).pop();
  if (!line) throw new Error("no JSON in `supabase migration list` output — cannot read the database state");
  const { migrations } = JSON.parse(line);
  if (!Array.isArray(migrations)) throw new Error("`migration list` JSON has no migrations array");
  return migrations.filter((m) => m.remote).map((m) => m.remote);
}

const chainVersions = readdirSync(CHAIN)
  .filter((f) => /^[0-9]{14}_.+\.sql$/.test(f))
  .map((f) => f.slice(0, 14))
  .sort();

let appliedVersions;
try {
  appliedVersions = appliedVersionsFromCli();
} catch (error) {
  // A lookup that did not succeed is NOT a pass. Say so and fail.
  console.error(red("Could not read the database migration state — this is not a pass."));
  console.error(`  ${error.message}`);
  process.exit(1);
}

const rows = parseStatusRows(readFileSync(README, "utf8"));
const problems = compareStatus({ rows, appliedVersions, chainVersions });

console.log(`supabase/migrations/: ${chainVersions.length} file(s)`);
console.log(`database reports applied: ${appliedVersions.length}`);
console.log(`pending: ${chainVersions.filter((v) => !appliedVersions.includes(v)).join(", ") || "none"}`);
console.log(`README rows: ${rows.length}`);
console.log("");

for (const row of rows) {
  const truth = appliedVersions.includes(row.version) ? "applied" : "pending";
  const good = row.claimed === truth;
  console.log(`${good ? green("✓") : red("✗")} ${row.file}: says ${row.claimed ?? "nothing readable"}, is ${truth}`);
}

console.log("");
if (problems.length) {
  console.error(red(`Migration status table is WRONG in ${problems.length} place(s):`));
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(green("Every README status row matches the database."));
