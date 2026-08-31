// READ-ONLY staging readiness check for polls_v1.
//
// polls_v1 is installed by hand in the Supabase SQL editor — nothing in this
// repo can execute DDL, and that is deliberate. This script answers the
// question you want answered BEFORE pasting 1400 lines of SQL: would the
// preflight pass, or is this database going to refuse halfway through?
//
// It checks the same things polls_v1_preflight.sql checks, over PostgREST:
//   * the target really is the disposable staging project, not production
//   * app_environment says 'staging' — polls_v1_rollback refuses anything else,
//     so installing on an unmarked database would be a one-way trip
//   * forum_v1 is present, because polls READ forum_topics and
//     forum_suspensions rather than duplicating them
//   * at least one active subject exists, or no poll could ever be filed
//   * no poll_* object already exists (the preflight refuses drift)
//
// It writes nothing to the database and calls no admin RPC.
//
// Run: npm run verify:polls-staging-readiness -- --confirm-polls-staging-readonly

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/polls-v1");
const evidencePath = resolve(outputDir, "polls-staging-readiness.json");
const expectedProjectRef = "essmxonestbrgmgrtywn";
const productionProjectRef = "kezelafqhgqrprpadmlf";
const requiredFlag = "--confirm-polls-staging-readonly";

// Every table polls_v1 creates. All of these must be ABSENT.
const pollTables = [
  "poll_settings",
  "poll_image_hosts",
  "polls",
  "poll_options",
  "poll_votes",
  "poll_comments",
  "poll_reports",
  "poll_rate_events",
];

// What polls_v1 depends on and does not create itself.
const dependencyTables = ["profiles", "forum_topics", "forum_suspensions"];

const parseEnv = (text = "") => Object.fromEntries(
  String(text).split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    return match ? [[match[1], match[2].replace(/^["']|["']$/g, "").trim()]] : [];
  }),
);
const readEnv = (name) => {
  try { return parseEnv(readFileSync(resolve(root, name), "utf8")); }
  catch { return {}; }
};
const production = readEnv(".env");
const staging = readEnv(".env.staging");
const setting = (name) => process.env[name] ?? staging[name];
const url = setting("TEST_SUPABASE_URL");
const serviceKey = setting("TEST_SERVICE_KEY");

/** Never let a key reach the console or the evidence file. */
const safeMessage = (value) => {
  let output = String(value ?? "");
  for (const secret of [serviceKey, setting("TEST_ANON_KEY")]) {
    if (secret) output = output.split(secret).join("[REDACTED]");
  }
  return output.slice(0, 1000);
};
const projectRef = (value) => {
  try { return new URL(value).hostname.split(".")[0]; }
  catch { return null; }
};

if (setting("TEST_ALLOW") !== "1") throw new Error("Refusing: TEST_ALLOW must be 1.");
if (!process.argv.includes(requiredFlag)) throw new Error(`Refusing: pass ${requiredFlag}.`);
if (!url || !serviceKey) throw new Error("Refusing: staging URL and service key are required.");
if (projectRef(url) !== expectedProjectRef) {
  throw new Error("Refusing: unexpected staging project reference.");
}
if (projectRef(url) === productionProjectRef) {
  throw new Error("Refusing: target is the production project.");
}
if (production.VITE_SUPABASE_URL
    && new URL(production.VITE_SUPABASE_URL).hostname === new URL(url).hostname) {
  throw new Error("Refusing: staging URL matches the configured production URL.");
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const report = {
  version: 1,
  checked_at: new Date().toISOString(),
  project_ref: projectRef(url),
  read_only: true,
  checks: [],
  passed: false,
  fatal: null,
};

const record = (name, ok, detail) => {
  report.checks.push({ name, ok: Boolean(ok), detail: safeMessage(detail) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${safeMessage(detail)}` : ""}`);
};

/**
 * Does a relation exist?
 *
 * NOT error-based. With `head: true`, a PostgREST 404 for an unknown relation
 * does NOT surface as an error through supabase-js — verified against a table
 * that certainly does not exist, which reported no error at all. `count` is the
 * honest signal: null when the relation is absent, a number when it is there.
 * An earlier version of this check keyed on `error` and confidently reported
 * every poll table as already installed.
 */
async function relationExists(table) {
  const { error, count } = await db
    .from(table)
    .select("*", { head: true, count: "exact" })
    .limit(1);
  if (error) return { exists: false, note: safeMessage(error.message) };
  return { exists: count !== null, note: count === null ? "absent" : `${count} rows` };
}

async function rpcExists(name, args = undefined) {
  const { error } = await db.rpc(name, args);
  return !error;
}

function writeEvidence() {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function check() {
  // 1. The rollback refuses any environment that is not staging/test, so an
  //    install onto an unmarked database could not be cleanly undone.
  const env = await db.from("app_environment").select("name").limit(1);
  if (env.error) {
    record("app_environment readable", false, env.error.message);
  } else {
    const name = env.data?.[0]?.name ?? "(empty)";
    record("app_environment is 'staging'", name === "staging",
      name === "staging" ? name : `found "${name}" — rollback would refuse here`);
  }

  // 2. polls_v1 reads these; it does not create them.
  for (const table of dependencyTables) {
    const { exists, note } = await relationExists(table);
    record(`dependency present: ${table}`, exists, note);
  }

  // 3. A poll must be filed under an active subject.
  const topics = await db.from("forum_topics").select("slug").eq("is_active", true);
  if (topics.error) {
    record("active subjects", false, topics.error.message);
  } else {
    const slugs = (topics.data ?? []).map((t) => t.slug);
    record("has at least one active subject", slugs.length > 0,
      slugs.length ? `${slugs.length}: ${slugs.join(", ")}` : "none — no poll could be filed");
  }

  // 4. The preflight refuses drift, so every poll object must be absent.
  for (const table of pollTables) {
    const { exists, note } = await relationExists(table);
    record(`not yet installed: ${table}`, !exists, exists ? `ALREADY EXISTS (${note})` : "absent");
  }
  record("not yet installed: poll_mode()", !(await rpcExists("poll_mode")),
    "the function polls_v1 creates");

  // 5. forum_v1 must really be installed, not merely have similar tables.
  const forumMode = await db.rpc("forum_mode");
  record("forum_v1 installed (forum_mode exists)", !forumMode.error,
    forumMode.error ? forumMode.error.message : `forum_mode() = "${forumMode.data}"`);

  report.passed = report.checks.every((c) => c.ok);
}

try {
  await check();
} catch (error) {
  report.fatal = safeMessage(error?.message ?? error);
} finally {
  writeEvidence();
}

console.log(`\nEvidence: ${evidencePath}`);
if (!report.passed) {
  if (report.fatal) console.error(report.fatal);
  console.error("NOT READY — resolve the failures above before installing polls_v1.");
  process.exitCode = 1;
} else {
  console.log("READY — polls_v1 preflight should pass on this database.");
}
