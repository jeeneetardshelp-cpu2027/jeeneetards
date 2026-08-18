import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/forum-suspension-admin");
const expectedProjectRef = "essmxonestbrgmgrtywn";
const requiredFlag = "--confirm-forum-suspension-admin-jwt-staging";
const authOptions = { persistSession: false, autoRefreshToken: false };

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

if (setting("TEST_ALLOW") !== "1") throw new Error("Refusing: TEST_ALLOW must be 1.");
if (!process.argv.includes(requiredFlag)) throw new Error(`Refusing: pass ${requiredFlag}.`);
if (!url || !serviceKey || !anonKey) throw new Error("Refusing: staging URL and both API keys are required.");
const target = new URL(url);
if (target.hostname.split(".")[0] !== expectedProjectRef)
  throw new Error("Refusing: unexpected staging project reference.");
if (production.VITE_SUPABASE_URL
    && new URL(production.VITE_SUPABASE_URL).hostname === target.hostname)
  throw new Error("Refusing: staging URL matches production.");

const runId = randomBytes(4).toString("hex");
const service = createClient(url, serviceKey, { auth: authOptions });
const anonymous = createClient(url, anonKey, { auth: authOptions });
const fixtures = ["admin", "student"].map((role) => ({
  role,
  email: `forum-suspension-${runId}-${role}@staging.invalid`,
  password: `Forum-${randomBytes(24).toString("base64url")}`,
  id: null,
  client: null,
}));
const report = {
  version: 1,
  run_id: runId,
  started_at: new Date().toISOString(),
  project_ref: expectedProjectRef,
  environment: null,
  transport: "Supabase Auth password JWT plus PostgREST HTTP RPC",
  checks: [],
  cleanup: { attempted: false, completed: false, errors: [], residue: null },
  fatal: null,
};
const createdPostIds = [];

const safeMessage = (value) => {
  let output = String(value ?? "");
  for (const secret of [serviceKey, anonKey, ...fixtures.map((item) => item.password)]) {
    if (secret) output = output.split(secret).join("[REDACTED]");
  }
  return output.slice(0, 1000);
};
const responseShape = (value, depth = 0) => {
  if (value === null) return { type: "null" };
  if (value === undefined) return { type: "undefined" };
  if (Array.isArray(value)) return {
    type: "array",
    length: value.length,
    item: value.length && depth < 3 ? responseShape(value[0], depth + 1) : null,
  };
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return {
      type: "object",
      keys,
      fields: depth < 3 ? Object.fromEntries(
        keys.map((key) => [key, responseShape(value[key], depth + 1)]),
      ) : null,
    };
  }
  return { type: typeof value };
};
const evidence = (rawResponse, facts = {}) => ({
  raw_response_shape: responseShape(rawResponse),
  ...facts,
});
const record = (name, passed, detail) => {
  if (!detail || !("raw_response_shape" in detail))
    throw new Error(`evidence detail missing raw_response_shape: ${name}`);
  report.checks.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) throw new Error(`verification failed: ${name}`);
};
const must = (result, label) => {
  if (result?.error) {
    throw new Error(`[${label}] ${result.error.code ?? ""} ${safeMessage(result.error.message)}`);
  }
  return result.data;
};
const expectDenied = (result, label, messagePattern = null) => {
  const message = safeMessage(result?.error?.message);
  const passed = Boolean(result?.error) && (!messagePattern || messagePattern.test(message));
  record(label, passed, evidence(result, result?.error ? {
    code: result.error.code ?? null,
    message_matches: messagePattern ? messagePattern.test(message) : true,
  } : { unexpected: "request succeeded" }));
};
const decodeJwtPayload = (token) => {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
};
const exactCount = async (table, configure = (query) => query) => {
  const result = await configure(service.from(table).select("*", { count: "exact", head: true }));
  if (result.error) throw new Error(`[count ${table}] ${safeMessage(result.error.message)}`);
  return result.count ?? 0;
};

async function verifyLiveGuard() {
  const markerResponse = await service.from("app_environment")
    .select("name").eq("id", true).single();
  const marker = must(markerResponse, "environment marker");
  if (marker.name !== "staging") {
    throw new Error(`Refusing: live marker is ${JSON.stringify(marker.name)}.`);
  }
  report.environment = marker.name;
  const modeResponse = await service.rpc("forum_mode");
  const mode = must(modeResponse, "forum mode before test");
  if (mode !== "off") throw new Error(`Refusing: forum mode is ${JSON.stringify(mode)}, expected off.`);

  const helperProbe = await service.rpc("forum_stage_prepare_suspension_admin_fixtures", {
    p_run_id: "invalid",
    p_user_ids: [],
  });
  if (helperProbe.error?.code === "PGRST202") {
    throw new Error("Refusing: suspension fixture helper is missing from PostgREST.");
  }
  if (!helperProbe.error) throw new Error("Refusing: invalid helper probe unexpectedly succeeded.");

  const counts = Object.fromEntries(await Promise.all(
    [
      "profiles", "forum_posts", "forum_comments", "forum_reports",
      "forum_suspensions", "forum_moderation_log", "forum_rate_events",
    ].map(async (table) => [table, await exactCount(table)]),
  ));
  const empty = Object.values(counts).every((count) => count === 0);
  record("disposable clone contains no profiles or forum activity", empty,
    evidence([markerResponse, modeResponse], { counts }));
}

async function createAndPrepareUsers() {
  const creationResponses = [];
  for (const fixture of fixtures) {
    const response = await service.auth.admin.createUser({
      email: fixture.email,
      password: fixture.password,
      email_confirm: true,
      app_metadata: { forum_suspension_fixture: runId },
      user_metadata: { full_name: "Forum suspension staging fixture" },
    });
    creationResponses.push(response);
    const created = must(response, `create ${fixture.role} fixture`);
    fixture.id = created.user.id;
  }
  record("two staging.invalid Auth fixtures created",
    fixtures.every((fixture) => fixture.id), evidence(creationResponses, { count: 2 }));

  const prepareResponse = await service.rpc(
    "forum_stage_prepare_suspension_admin_fixtures",
    { p_run_id: runId, p_user_ids: fixtures.map((fixture) => fixture.id) },
  );
  const prepared = must(prepareResponse, "prepare suspension fixtures");
  record("helper prepared exact users and cooldown", prepared?.users_prepared === 2
    && prepared?.profiles_prepared === 2
    && prepared?.admins_prepared === 1
    && prepared?.cooldown_satisfied === true,
  evidence(prepareResponse, {
    users_prepared: prepared?.users_prepared ?? null,
    profiles_prepared: prepared?.profiles_prepared ?? null,
    admins_prepared: prepared?.admins_prepared ?? null,
    cooldown_satisfied: prepared?.cooldown_satisfied === true,
  }));

  for (const fixture of fixtures) {
    fixture.client = createClient(url, anonKey, { auth: authOptions });
    const response = await fixture.client.auth.signInWithPassword({
      email: fixture.email,
      password: fixture.password,
    });
    const signedIn = must(response, `sign in ${fixture.role}`);
    const payload = decodeJwtPayload(signedIn.session?.access_token);
    record(`${fixture.role} received genuine authenticated JWT`,
      Boolean(signedIn.session?.access_token)
      && payload?.sub === fixture.id
      && payload?.role === "authenticated",
    evidence(response, {
      subject_matches: payload?.sub === fixture.id,
      role_is_authenticated: payload?.role === "authenticated",
    }));
  }
}

async function runJourney() {
  const [adminFixture, studentFixture] = fixtures;
  const admin = adminFixture.client;
  const student = studentFixture.client;
  const studentUsername = `stage_suspend_${runId}_2`;

  expectDenied(await anonymous.rpc("forum_admin_list_suspensions"),
    "anonymous cannot list suspensions");
  expectDenied(await student.rpc("forum_admin_list_suspensions"),
    "non-admin JWT cannot list suspensions", /not authorized/i);
  expectDenied(await student.rpc("forum_admin_set_suspension_by_username", {
    p_username: studentUsername, p_days: 3, p_reason: "Unauthorized attempt",
  }), "non-admin JWT cannot suspend", /not authorized/i);

  must(await admin.rpc("forum_admin_set_mode", { p_mode: "open" }), "open forum for write proof");
  const beforeResponse = await student.rpc("forum_create_post", {
    p_topic_slug: "physics",
    p_title: `Before suspension ${runId}`,
    p_body: "Disposable staging post proving this student could contribute before suspension.",
  });
  const beforePostId = Number(must(beforeResponse, "student post before suspension"));
  createdPostIds.push(beforePostId);
  record("student contributes before suspension", Number.isSafeInteger(beforePostId),
    evidence(beforeResponse, { post_created: Number.isSafeInteger(beforePostId) }));

  const suspendResponse = await admin.rpc("forum_admin_set_suspension_by_username", {
    p_username: studentUsername.toUpperCase(),
    p_days: 3,
    p_reason: "JWT staging suspension proof",
  }).single();
  const suspended = must(suspendResponse, "suspend by username");
  record("admin suspends by case-insensitive public username",
    suspended?.username === studentUsername
      && Boolean(suspended?.suspended_until)
      && suspended?.reason === "JWT staging suspension proof",
  evidence(suspendResponse, {
    username_matches: suspended?.username === studentUsername,
    deadline_present: Boolean(suspended?.suspended_until),
    reason_matches: suspended?.reason === "JWT staging suspension proof",
  }));

  const actorResponse = await service.from("forum_suspensions")
    .select("user_id,created_by").eq("user_id", studentFixture.id).single();
  const actor = must(actorResponse, "recorded suspension actor");
  const logResponse = await service.from("forum_moderation_log")
    .select("actor_id,target_user_id,action")
    .eq("target_user_id", studentFixture.id).eq("action", "suspend").single();
  const log = must(logResponse, "recorded suspension log");
  record("nested security-definer delegation records the real admin actor",
    actor.created_by === adminFixture.id
      && log.actor_id === adminFixture.id
      && log.target_user_id === studentFixture.id,
  evidence([actorResponse, logResponse], {
    row_actor_is_admin: actor.created_by === adminFixture.id,
    log_actor_is_admin: log.actor_id === adminFixture.id,
    log_target_is_student: log.target_user_id === studentFixture.id,
  }));

  const listResponse = await admin.rpc("forum_admin_list_suspensions");
  const listed = must(listResponse, "admin lists suspensions");
  record("admin list returns actionable suspension context",
    listed.length === 1
      && listed[0]?.username === studentUsername
      && listed[0]?.created_by_username === `stage_suspend_${runId}_1`
      && listed[0]?.is_active === true,
  evidence(listResponse, {
    count: listed.length,
    username_matches: listed[0]?.username === studentUsername,
    actor_username_matches: listed[0]?.created_by_username === `stage_suspend_${runId}_1`,
    active: listed[0]?.is_active === true,
  }));

  expectDenied(await student.rpc("forum_create_post", {
    p_topic_slug: "physics",
    p_title: `Blocked suspension ${runId}`,
    p_body: "This post must never be created while the staging fixture is suspended.",
  }), "suspended student is blocked from contribution", /temporarily suspended/i);

  const liftResponse = await admin.rpc("forum_admin_set_suspension_by_username", {
    p_username: studentUsername,
    p_days: null,
    p_reason: "JWT staging proof complete",
  }).single();
  const lifted = must(liftResponse, "lift suspension by username");
  record("admin lifts suspension by username",
    lifted?.username === studentUsername && lifted?.suspended_until === null,
  evidence(liftResponse, {
    username_matches: lifted?.username === studentUsername,
    deadline_is_null: lifted?.suspended_until === null,
  }));

  const emptyListResponse = await admin.rpc("forum_admin_list_suspensions");
  const emptyList = must(emptyListResponse, "list after lift");
  record("lift removes student from suspension list", emptyList.length === 0,
    evidence(emptyListResponse, { count: emptyList.length }));

  const afterResponse = await student.rpc("forum_create_post", {
    p_topic_slug: "physics",
    p_title: `After suspension ${runId}`,
    p_body: "Disposable staging post proving contribution resumes after the suspension is lifted.",
  });
  const afterPostId = Number(must(afterResponse, "student post after lift"));
  createdPostIds.push(afterPostId);
  record("student contributes again after lift", Number.isSafeInteger(afterPostId),
    evidence(afterResponse, { post_created: Number.isSafeInteger(afterPostId) }));

  const actionsResponse = await service.from("forum_moderation_log")
    .select("actor_id,target_user_id,action").eq("target_user_id", studentFixture.id)
    .in("action", ["suspend", "unsuspend"]).order("id");
  const actions = must(actionsResponse, "suspension action trail");
  record("audit trail contains one suspend and one unsuspend by the admin",
    actions.length === 2
      && actions[0]?.action === "suspend"
      && actions[1]?.action === "unsuspend"
      && actions.every((row) => row.actor_id === adminFixture.id),
  evidence(actionsResponse, {
    count: actions.length,
    ordered_actions_match: actions[0]?.action === "suspend"
      && actions[1]?.action === "unsuspend",
    every_actor_is_admin: actions.every((row) => row.actor_id === adminFixture.id),
  }));

  must(await admin.rpc("forum_admin_set_mode", { p_mode: "off" }), "restore off mode");
  const finalModeResponse = await service.rpc("forum_mode");
  record("forum mode restored to off", must(finalModeResponse, "final mode") === "off",
    evidence(finalModeResponse, { value_is_off: finalModeResponse.data === "off" }));
}

async function cleanup() {
  report.cleanup.attempted = true;
  const ids = fixtures.map((fixture) => fixture.id).filter(Boolean);
  try {
    const marker = must(await service.from("app_environment")
      .select("name").eq("id", true).single(), "cleanup environment marker");
    if (marker.name !== "staging") throw new Error("cleanup refused outside staging");

    must(await service.from("forum_settings").update({ mode: "off" }).eq("id", true),
      "force forum mode off");
    if (ids.length) {
      must(await service.from("forum_suspensions").delete().in("user_id", ids),
        "delete fixture suspensions");
      must(await service.from("forum_moderation_log").delete().or(
        `actor_id.in.(${ids.join(",")}),target_user_id.in.(${ids.join(",")})`,
      ), "delete fixture moderation logs");
      must(await service.from("forum_rate_events").delete().in("user_id", ids),
        "delete fixture rate events");
      must(await service.from("forum_posts").delete().in("author_id", ids),
        "delete fixture posts");
      for (const fixture of fixtures) {
        if (fixture.id) must(await service.auth.admin.deleteUser(fixture.id),
          `delete ${fixture.role} fixture`);
      }
    }

    const residue = {
      fixture_profiles: ids.length
        ? await exactCount("profiles", (query) => query.in("id", ids)) : 0,
      fixture_suspensions: ids.length
        ? await exactCount("forum_suspensions", (query) => query.in("user_id", ids)) : 0,
      fixture_logs: ids.length
        ? await exactCount("forum_moderation_log", (query) => query.or(
          `actor_id.in.(${ids.join(",")}),target_user_id.in.(${ids.join(",")})`,
        )) : 0,
      fixture_posts: ids.length
        ? await exactCount("forum_posts", (query) => query.in("author_id", ids)) : 0,
      fixture_rate_events: ids.length
        ? await exactCount("forum_rate_events", (query) => query.in("user_id", ids)) : 0,
      auth_users: 0,
    };
    for (const fixture of fixtures) {
      if (!fixture.id) continue;
      const response = await service.auth.admin.getUserById(fixture.id);
      if (!response.error && response.data?.user) residue.auth_users += 1;
    }
    const mode = must(await service.rpc("forum_mode"), "cleanup forum mode");
    report.cleanup.residue = residue;
    report.cleanup.completed = mode === "off"
      && Object.values(residue).every((count) => count === 0);
    if (!report.cleanup.completed) {
      throw new Error(`cleanup residue: ${JSON.stringify(residue)}`);
    }
  } catch (error) {
    report.cleanup.errors.push(safeMessage(error?.message ?? error));
    report.cleanup.completed = false;
    throw error;
  }
}

async function main() {
  let mainError = null;
  try {
    await verifyLiveGuard();
    await createAndPrepareUsers();
    await runJourney();
  } catch (error) {
    mainError = error;
    report.fatal = safeMessage(error?.message ?? error);
  }

  try { await cleanup(); }
  catch (cleanupError) {
    if (!mainError) {
      mainError = cleanupError;
      report.fatal = safeMessage(cleanupError?.message ?? cleanupError);
    }
  }

  report.finished_at = new Date().toISOString();
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, `forum-suspension-admin-jwt-${runId}.json`);
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Evidence: ${outputPath}`);
  if (mainError) throw mainError;
  console.log("Forum suspension-admin genuine HTTP/PostgREST JWT staging verification passed.");
}

main().catch((error) => {
  console.error(safeMessage(error?.message ?? error));
  process.exitCode = 1;
});
