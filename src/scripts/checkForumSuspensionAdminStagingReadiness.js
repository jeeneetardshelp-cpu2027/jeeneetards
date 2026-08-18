import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/forum-suspension-admin");
const expectedProjectRef = "essmxonestbrgmgrtywn";
const productionProjectRef = "kezelafqhgqrprpadmlf";
const requiredFlag = "--confirm-forum-suspension-staging-readonly";
const activityTables = [
  "profiles",
  "forum_posts",
  "forum_comments",
  "forum_reports",
  "forum_suspensions",
  "forum_moderation_log",
  "forum_rate_events",
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

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const report = {
  version: 1,
  checked_at: new Date().toISOString(),
  project_ref: expectedProjectRef,
  operation: "read-only staging readiness",
  writes_attempted: false,
  environment: null,
  forum_mode: null,
  counts: {},
  rpc_absence: {},
  passed: false,
  fatal: null,
};

const must = (result, label) => {
  if (result?.error) {
    throw new Error(`[${label}] ${result.error.code ?? ""} ${safeMessage(result.error.message)}`);
  }
  return result.data;
};
const exactCount = async (table) => {
  const result = await service.from(table).select("*", { count: "exact", head: true });
  if (result.error) {
    throw new Error(`[count ${table}] ${result.error.code ?? ""} ${safeMessage(result.error.message)}`);
  }
  if (!Number.isInteger(result.count)) throw new Error(`[count ${table}] exact count missing`);
  return result.count;
};
const expectMissingRpc = async (name, args = undefined) => {
  const result = await service.rpc(name, args);
  if (result.error?.code !== "PGRST202") {
    throw new Error(
      `[rpc absence ${name}] expected PGRST202, received ${result.error?.code ?? "success"}`,
    );
  }
  return result.error.code;
};

const writeEvidence = () => {
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(
    outputDir,
    `forum-suspension-readiness-${report.checked_at.replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Evidence: ${outputPath}`);
};

async function check() {
  const marker = must(
    await service.from("app_environment").select("name").eq("id", true),
    "environment marker",
  );
  if (marker.length !== 1 || marker[0]?.name !== "staging") {
    throw new Error(`Refusing: expected one staging marker, received ${marker.length}.`);
  }
  report.environment = marker[0].name;

  const settings = must(
    await service.from("forum_settings").select("mode").eq("id", true),
    "forum settings",
  );
  if (settings.length !== 1 || settings[0]?.mode !== "off") {
    throw new Error("Refusing: forum mode is not off.");
  }
  report.forum_mode = settings[0].mode;

  for (const table of activityTables) report.counts[table] = await exactCount(table);

  const authResult = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUsers = must(authResult, "Auth users");
  report.counts.auth_users = authUsers.users.length;

  const nonEmpty = Object.entries(report.counts).filter(([, count]) => count !== 0);
  if (nonEmpty.length) {
    throw new Error(
      `Refusing: disposable staging is not empty (${nonEmpty.map(([name]) => name).join(", ")}).`,
    );
  }

  report.rpc_absence.forum_admin_list_suspensions = await expectMissingRpc(
    "forum_admin_list_suspensions",
  );
  report.rpc_absence.forum_stage_prepare_suspension_admin_fixtures = await expectMissingRpc(
    "forum_stage_prepare_suspension_admin_fixtures",
    { p_run_id: "readonly", p_user_ids: [] },
  );

  report.passed = true;
}

try {
  await check();
} catch (error) {
  report.fatal = safeMessage(error?.message ?? error);
} finally {
  writeEvidence();
}

if (!report.passed) {
  console.error(report.fatal);
  process.exitCode = 1;
} else {
  console.log("Forum suspension-admin staging readiness passed (read-only). ");
}
