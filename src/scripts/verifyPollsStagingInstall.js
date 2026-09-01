// READ-ONLY post-install verification for polls_v1 on staging.
//
// The companion to verifyPollsStagingReadiness.js: that one answers "is this
// database ready for the install", this one answers "did the install actually
// land, and is it closed".
//
// It re-proves the postflight's claims from OUTSIDE the database, as a browser
// would see it, which is the part an in-database postflight cannot check:
// the anon key must NOT be able to read a single poll table directly. That is
// the whole security model — every student path goes through a bounded
// SECURITY DEFINER RPC, and a leaked table grant would bypass the mode switch,
// the rate limits and the moderation state in one step.
//
// Strictly read-only: it never writes and never calls a write RPC, not even
// one it expects to be refused.
//
// Run: npm run verify:polls-staging-install -- --confirm-polls-staging-readonly

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/polls-v1");
const evidencePath = resolve(outputDir, "polls-staging-install.json");
const expectedProjectRef = "essmxonestbrgmgrtywn";
const productionProjectRef = "kezelafqhgqrprpadmlf";
const requiredFlag = "--confirm-polls-staging-readonly";

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

// Every RPC a browser is meant to be able to call while polls are readable.
const publicRpcs = [
  ["poll_mode", undefined],
  ["get_poll_topics", undefined],
  ["get_polls_feed", { p_sort: "new", p_topic_slug: null, p_limit: 5, p_offset: 0 }],
];

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
const anonKey = setting("TEST_ANON_KEY");

const safeMessage = (value) => {
  let output = String(value ?? "");
  for (const secret of [serviceKey, anonKey]) {
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
if (!url || !serviceKey || !anonKey) {
  throw new Error("Refusing: staging URL and both API keys are required.");
}
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

const auth = { persistSession: false, autoRefreshToken: false };
const admin = createClient(url, serviceKey, { auth });
const browser = createClient(url, anonKey, { auth });

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

/** count is the honest existence signal; a head 404 does not surface as an error. */
async function tableCount(client, table) {
  const { error, count } = await client
    .from(table)
    .select("*", { head: true, count: "exact" })
    .limit(1);
  return { error, count };
}

function writeEvidence() {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

// The mode observed during the run, so the summary can report what was
// actually found rather than a hardcoded claim.
let lastMode = "unknown";

async function check() {
  // 1. Every table exists and is empty. A fresh install has no content at all.
  for (const table of pollTables) {
    const { error, count } = await tableCount(admin, table);
    if (error) { record(`installed: ${table}`, false, error.message); continue; }
    if (count === null) { record(`installed: ${table}`, false, "absent — install incomplete"); continue; }
    // What must ALWAYS be true is that the table exists, and that the two
    // seeded ones are populated. The content tables being EMPTY is only true
    // of a fresh install — asserting it would fail the moment anyone actually
    // used staging, which is the point of having a staging database. Row
    // counts are reported, not judged.
    const seeded = table === "poll_settings" || table === "poll_image_hosts";
    record(`installed: ${table}`, seeded ? count > 0 : true,
      `${count} rows${seeded ? " (seeded — must not be empty)" : ""}`);
  }

  // 2. The mode switch answers with one of its three known values. WHICH one
  //    is an operational decision — staging is deliberately opened for testing
  //    — so asserting 'off' here failed the moment staging was used as
  //    intended. Same fix as verifyPollsProduction.js.
  const mode = await admin.rpc("poll_mode");
  const knownMode = ["off", "read_only", "open"].includes(mode.data);
  if (knownMode) lastMode = mode.data;
  record("poll_mode() reports a known mode", !mode.error && knownMode,
    mode.error ? mode.error.message : `"${mode.data}"`);

  // 3. The picture allowlist matches the seed in the migration EXACTLY.
  //
  // Read the expected hosts out of polls_v1.sql rather than hardcoding a count.
  // A hardcoded "at least 11" broke the moment commons.wikimedia.org was
  // removed from the seed and deleted from the databases — the check failed
  // while the database was correct, which is the worst kind of failing test.
  // Comparing against the source of truth also catches real drift in BOTH
  // directions: a host present in the database but not the seed (a stale
  // install, exactly what commons was) as well as one missing.
  const hosts = await admin.from("poll_image_hosts").select("host").order("host");
  if (hosts.error) {
    record("image host allowlist matches the migration seed", false, hosts.error.message);
  } else {
    const live = (hosts.data ?? []).map((h) => h.host).sort();
    const sql = readFileSync(resolve(root, "src/migrations/polls_v1.sql"), "utf8");
    const seedBlock = sql.match(/insert into public\.poll_image_hosts[\s\S]*?;/)?.[0] ?? "";
    const expected = [...seedBlock.matchAll(/\('([a-z0-9.-]+)',/g)].map((m) => m[1]).sort();
    const extra = live.filter((h) => !expected.includes(h));
    const missing = expected.filter((h) => !live.includes(h));
    const detail = extra.length || missing.length
      ? `${live.length} live vs ${expected.length} in seed${extra.length ? ` — extra: ${extra.join(", ")}` : ""}${missing.length ? ` — missing: ${missing.join(", ")}` : ""}`
      : `${live.length} hosts, exactly matching the seed`;
    record("image host allowlist matches the migration seed",
      expected.length > 0 && extra.length === 0 && missing.length === 0, detail);
  }

  // 4. THE SECURITY BOUNDARY. The anon key is what a browser actually holds.
  //    It must not be able to read any poll table directly, or the RPC layer
  //    is decoration.
  for (const table of pollTables) {
    const { error, count } = await tableCount(browser, table);
    // Denied is either an explicit error or no readable rows exposed at all.
    const denied = Boolean(error) || count === null;
    record(`anon cannot read ${table}`, denied,
      denied ? "denied" : `READABLE (${count} rows) — grant leaked`);
  }

  // 5. The public RPCs exist and are callable by anon, and return nothing
  //    while the mode is off.
  for (const [name, args] of publicRpcs) {
    const { data, error } = await browser.rpc(name, args);
    if (error) { record(`anon can call ${name}()`, false, error.message); continue; }
    // Just report the row count. The old text appended "(closed, as expected)"
    // whenever the result was empty, which conflated "no polls exist" with
    // "polls are switched off" — two different things, and the message was
    // simply wrong on an OPEN database that happened to have no content.
    record(`anon can call ${name}()`, true,
      name === "poll_mode" ? `"${data}"` : `${Array.isArray(data) ? data.length : 0} rows`);
  }

  // 6. An admin-only RPC must refuse the anon key.
  const forbidden = await browser.rpc("poll_admin_list_pending", { p_limit: 1 });
  const refused = Boolean(forbidden.error)
    || (Array.isArray(forbidden.data) && forbidden.data.length === 0);
  record("anon gets nothing from poll_admin_list_pending()", refused,
    forbidden.error ? "refused" : `${(forbidden.data ?? []).length} rows`);

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
  console.error("INSTALL NOT VERIFIED — review the failures above.");
  process.exitCode = 1;
} else {
  // Report the mode found, never a hardcoded one. The old line claimed
  // "closed" unconditionally and would have announced a false state on an
  // open database — in the one line a reader actually trusts.
  console.log(`INSTALL VERIFIED — polls_v1 present, mode "${lastMode}", no poll table readable by a browser.`);
}
