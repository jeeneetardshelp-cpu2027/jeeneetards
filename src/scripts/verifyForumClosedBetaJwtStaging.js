import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/forum-closed-beta-v1");
const expectedProjectRef = "essmxonestbrgmgrtywn";
const requiredFlag = "--confirm-forum-beta-jwt-staging";
const expectedCheckCount = 31;
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
const runId = randomBytes(4).toString("hex");
const authOptions = { persistSession: false, autoRefreshToken: false };

if (setting("TEST_ALLOW") !== "1") throw new Error("Refusing: TEST_ALLOW must be 1.");
if (!process.argv.includes(requiredFlag)) throw new Error(`Refusing: pass ${requiredFlag}.`);
if (!url || !serviceKey || !anonKey) throw new Error("Refusing: staging URL and both API keys are required.");
const target = new URL(url);
if (target.hostname.split(".")[0] !== expectedProjectRef)
  throw new Error("Refusing: unexpected staging project reference.");
if (production.VITE_SUPABASE_URL
    && new URL(production.VITE_SUPABASE_URL).hostname === target.hostname)
  throw new Error("Refusing: staging URL matches production.");

const service = createClient(url, serviceKey, { auth: authOptions });
const anonymous = createClient(url, anonKey, { auth: authOptions });
const roles = ["admin", "member", "outsider"];
const fixtures = roles.map((role) => ({
  role,
  email: `forum-beta-http-${runId}-${role}@staging.invalid`,
  password: `ForumBeta-${randomBytes(24).toString("base64url")}`,
  id: null,
  client: null,
}));
const username = (index) => `stage_beta_${runId}_${index + 1}`;
const report = {
  version: 1,
  run_id: runId,
  started_at: new Date().toISOString(),
  project_ref: expectedProjectRef,
  environment: null,
  transport: "Supabase Auth password JWT plus PostgREST HTTP RPC",
  tests: [],
  cleanup: { attempted: false, completed: false, errors: [], residue: null },
  fatal: null,
};
const postIds = [];

const safeMessage = (value) => {
  let output = String(value ?? "");
  for (const secret of [serviceKey, anonKey, ...fixtures.map((item) => item.password)])
    if (secret) output = output.split(secret).join("[REDACTED]");
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
  report.tests.push({ name, passed: Boolean(passed), detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  if (!passed) throw new Error(`verification failed: ${name}`);
};
const must = (result, label) => {
  if (result?.error) throw new Error(`[${label}] ${result.error.code ?? ""} ${result.error.message}`);
  return result.data;
};
const expectDenied = (result, label, expectedMessage = null) => {
  const messageMatches = !expectedMessage
    || String(result?.error?.message ?? "").includes(expectedMessage);
  record(label, Boolean(result?.error) && messageMatches, evidence(result, result?.error ? {
    code: result.error.code ?? null,
    message: safeMessage(result.error.message),
    expected_message_matched: messageMatches,
  } : { unexpected: "request succeeded" }));
};
const decodeJwtPayload = (token) => {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
};
const exactCount = async (table, configure = (query) => query) => {
  const result = await configure(service.from(table).select("*", { count: "exact", head: true }));
  if (result.error) throw new Error(`[count ${table}] ${result.error.message}`);
  return result.count ?? 0;
};

async function verifyLiveGuard() {
  const markerResponse = await service.from("app_environment")
    .select("name").eq("id", true).single();
  const marker = must(markerResponse, "environment marker");
  if (marker.name !== "staging")
    throw new Error(`Refusing: live marker is ${JSON.stringify(marker.name)}.`);
  report.environment = marker.name;
  const modeResponse = await service.rpc("forum_mode");
  const mode = must(modeResponse, "forum mode before test");
  if (mode !== "off") throw new Error(`Refusing: forum mode is ${JSON.stringify(mode)}, expected off.`);
  const helper = await service.rpc("forum_stage_prepare_beta_http_fixtures", {
    p_run_id: "00000000", p_user_ids: [],
  });
  if (helper.error?.code === "PGRST202")
    throw new Error("Refusing: beta staging fixture helper is missing from PostgREST.");
  const guards = await Promise.all([
    exactCount("profiles"),
    exactCount("forum_posts"),
    exactCount("forum_comments"),
    exactCount("forum_votes"),
    exactCount("forum_reports"),
  ]);
  if (guards.some((count) => count !== 0))
    throw new Error(`Refusing: disposable staging stores are not empty: ${JSON.stringify(guards)}.`);
}

async function createAndPrepareUsers() {
  const creationResponses = [];
  for (const fixture of fixtures) {
    const creationResponse = await service.auth.admin.createUser({
      email: fixture.email,
      password: fixture.password,
      email_confirm: true,
      app_metadata: { forum_beta_http_fixture: runId },
      user_metadata: { full_name: "Forum beta HTTP staging fixture" },
    });
    creationResponses.push(creationResponse);
    const created = must(creationResponse, `create ${fixture.role} fixture`);
    fixture.id = created.user.id;
  }
  record("three marked Auth Admin fixtures created",
    fixtures.every((fixture) => fixture.id), evidence(creationResponses, { count: 3 }));

  const prepareResponse = await service.rpc("forum_stage_prepare_beta_http_fixtures", {
    p_run_id: runId,
    p_user_ids: fixtures.map((fixture) => fixture.id),
  });
  const prepared = must(prepareResponse, "prepare beta fixture profiles and cooldown");
  record("fixture helper prepared exact beta users", prepared?.users_prepared === 3
    && prepared?.profiles_prepared === 3
    && prepared?.admins_prepared === 1
    && prepared?.cooldown_satisfied === true, evidence(prepareResponse, {
    users_prepared: prepared?.users_prepared ?? null,
    profiles_prepared: prepared?.profiles_prepared ?? null,
    admins_prepared: prepared?.admins_prepared ?? null,
    cooldown_satisfied: prepared?.cooldown_satisfied ?? null,
  }));

  for (const fixture of fixtures) {
    fixture.client = createClient(url, anonKey, { auth: authOptions });
    const signInResponse = await fixture.client.auth.signInWithPassword({
      email: fixture.email, password: fixture.password,
    });
    const signedIn = must(signInResponse, `sign in ${fixture.role}`);
    const payload = decodeJwtPayload(signedIn.session?.access_token);
    record(`${fixture.role} received genuine authenticated JWT`,
      Boolean(signedIn.session?.access_token)
      && payload?.sub === fixture.id
      && payload?.role === "authenticated",
      evidence(signInResponse, {
        subject_matches: payload?.sub === fixture.id,
        role: payload?.role ?? null,
      }));
  }
}

async function runHttpJourney() {
  const [admin, member, outsider] = fixtures.map((item) => item.client);
  const modeResponse = await anonymous.rpc("forum_mode");
  const mode = must(modeResponse, "anonymous mode");
  record("anonymous mode RPC starts off", mode === "off",
    evidence(modeResponse, { value: mode }));
  const offTopicsResponse = await anonymous.rpc("get_forum_topics");
  const offTopics = must(offTopicsResponse, "off topics");
  record("off mode hides public topics", offTopics.length === 0,
    evidence(offTopicsResponse, { count: offTopics.length }));
  expectDenied(await anonymous.rpc("forum_is_beta_member"),
    "anonymous cannot call private membership check");
  const outsiderBeforeResponse = await outsider.rpc("forum_is_beta_member");
  const outsiderBefore = must(outsiderBeforeResponse, "outsider membership before enrollment");
  record("non-member self-check starts false", outsiderBefore === false,
    evidence(outsiderBeforeResponse, { value: outsiderBefore }));
  expectDenied(await outsider.rpc("forum_admin_set_beta_member", {
    p_username: username(2), p_enabled: true,
  }), "non-admin cannot enroll beta members", "not authorized");
  expectDenied(await outsider.from("forum_beta_members").select("user_id"),
    "authenticated JWT cannot read private beta table");

  const enrollResponse = await admin.rpc("forum_admin_set_beta_member", {
    p_username: username(1), p_enabled: true,
  });
  const enrolled = must(enrollResponse, "admin enrolls member");
  record("admin enrolls one member", enrolled === true,
    evidence(enrollResponse, { value: enrolled }));
  const listResponse = await admin.rpc("forum_admin_list_beta_members");
  const members = must(listResponse, "admin lists beta members");
  record("admin list returns exact enrolled member and adder", members.length === 1
    && members[0]?.username === username(1)
    && members[0]?.added_by_username === username(0), evidence(listResponse, {
    count: members.length,
    username_matches: members[0]?.username === username(1),
    adder_matches: members[0]?.added_by_username === username(0),
  }));
  const memberCheckResponse = await member.rpc("forum_is_beta_member");
  const memberCheck = must(memberCheckResponse, "member self-check");
  record("enrolled member self-check is true", memberCheck === true,
    evidence(memberCheckResponse, { value: memberCheck }));

  const betaResponse = await admin.rpc("forum_admin_set_mode", { p_mode: "beta" });
  const betaMode = must(betaResponse, "set beta mode");
  record("admin JWT opens closed beta", betaMode === "beta",
    evidence(betaResponse, { value: betaMode }));
  const betaTopicsResponse = await anonymous.rpc("get_forum_topics");
  const betaTopics = must(betaTopicsResponse, "beta topics");
  record("anonymous readers see six topics during beta", betaTopics.length === 6,
    evidence(betaTopicsResponse, { count: betaTopics.length }));
  expectDenied(await outsider.rpc("forum_create_post", {
    p_topic_slug: "physics",
    p_title: "Non-member beta write must fail",
    p_body: "This disposable request must never create a row.",
  }), "non-member publishing is denied in beta", "closed beta access is required");

  const createResponse = await member.rpc("forum_create_post", {
    p_topic_slug: "physics",
    p_title: `Closed beta HTTP post ${runId}`,
    p_body: "A disposable staging post proving the enrolled-member writer gate.",
  });
  const betaPostId = Number(must(createResponse, "member creates beta post"));
  postIds.push(betaPostId);
  record("enrolled member creates beta post",
    Number.isSafeInteger(betaPostId) && betaPostId > 0,
    evidence(createResponse, { post_id: betaPostId }));
  const commentResponse = await member.rpc("forum_create_comment", {
    p_post_id: betaPostId,
    p_parent_id: null,
    p_body: "Disposable beta member comment.",
  });
  const commentId = Number(must(commentResponse, "member creates comment"));
  record("enrolled member creates beta comment",
    Number.isSafeInteger(commentId) && commentId > 0,
    evidence(commentResponse, { comment_id: commentId }));
  const readResponse = await anonymous.rpc("get_forum_post", {
    p_post_id: betaPostId,
  }).single();
  const readPost = must(readResponse, "anonymous beta post read");
  record("anonymous reader can open beta thread", Number(readPost?.id) === betaPostId,
    evidence(readResponse, { post_id: Number(readPost?.id) || null }));

  const safetyReportResponse = await outsider.rpc("forum_submit_report", {
    p_target_type: "post",
    p_target_id: betaPostId,
    p_reason: "self_harm",
    p_note: "Disposable urgent-safety path verification.",
  });
  const safetyReportId = Number(must(safetyReportResponse, "non-member safety report"));
  record("non-member can submit urgent safety report",
    Number.isSafeInteger(safetyReportId) && safetyReportId > 0,
    evidence(safetyReportResponse, { report_id: safetyReportId }));
  const reportsResponse = await admin.rpc("forum_admin_list_reports", { p_limit: 100 });
  const reports = must(reportsResponse, "admin lists beta reports")
    .filter((row) => Number(row.id) === safetyReportId);
  record("admin receives urgent report with moderation context", reports.length === 1
    && reports[0]?.reason === "self_harm"
    && Number(reports[0]?.post_id) === betaPostId
    && reports[0]?.target_exists === true
    && typeof reports[0]?.content_preview === "string", evidence(reportsResponse, {
    count: reports.length,
    urgent_reason_matches: reports[0]?.reason === "self_harm",
    post_matches: Number(reports[0]?.post_id) === betaPostId,
    context_present: typeof reports[0]?.content_preview === "string",
  }));

  const removeResponse = await admin.rpc("forum_admin_set_beta_member", {
    p_username: username(1), p_enabled: false,
  });
  const stillMember = must(removeResponse, "admin removes member");
  record("admin removes enrolled member", stillMember === false,
    evidence(removeResponse, { value: stillMember }));
  const removedCheckResponse = await member.rpc("forum_is_beta_member");
  const removedCheck = must(removedCheckResponse, "removed member self-check");
  record("removed member self-check becomes false", removedCheck === false,
    evidence(removedCheckResponse, { value: removedCheck }));
  expectDenied(await member.rpc("forum_create_post", {
    p_topic_slug: "physics",
    p_title: "Removed member beta write must fail",
    p_body: "This disposable request must never create a row.",
  }), "removed member immediately loses beta write access", "closed beta access is required");

  const openResponse = await admin.rpc("forum_admin_set_mode", { p_mode: "open" });
  const openMode = must(openResponse, "set open mode");
  record("open mode remains available to admin", openMode === "open",
    evidence(openResponse, { value: openMode }));
  const openPostResponse = await outsider.rpc("forum_create_post", {
    p_topic_slug: "mathematics",
    p_title: `Open compatibility post ${runId}`,
    p_body: "A disposable control proving open mode retains its reviewed meaning.",
  });
  const openPostId = Number(must(openPostResponse, "outsider open post"));
  postIds.push(openPostId);
  record("non-member can write when mode is open",
    Number.isSafeInteger(openPostId) && openPostId > 0,
    evidence(openPostResponse, { post_id: openPostId }));

  const readOnlyResponse = await admin.rpc("forum_admin_set_mode", { p_mode: "read_only" });
  const readOnlyMode = must(readOnlyResponse, "set read-only mode");
  record("admin can pause contributions with read-only mode", readOnlyMode === "read_only",
    evidence(readOnlyResponse, { value: readOnlyMode }));
  expectDenied(await member.rpc("forum_create_post", {
    p_topic_slug: "physics",
    p_title: "Read-only write must fail",
    p_body: "This disposable request must never create a row.",
  }), "read-only blocks publishing before membership evaluation", "forum is not open");
  const offResponse = await admin.rpc("forum_admin_set_mode", { p_mode: "off" });
  const offMode = must(offResponse, "restore off mode");
  record("admin returns forum to off", offMode === "off",
    evidence(offResponse, { value: offMode }));
  const finalListResponse = await admin.rpc("forum_admin_list_beta_members");
  const finalMembers = must(finalListResponse, "final beta member list");
  record("beta membership list is empty before cleanup", finalMembers.length === 0,
    evidence(finalListResponse, { count: finalMembers.length }));
}

async function cleanup() {
  report.cleanup.attempted = true;
  const ids = fixtures.map((fixture) => fixture.id).filter(Boolean);
  let betaMemberCount = 0;
  try {
    const marker = must(await service.from("app_environment")
      .select("name").eq("id", true).single(), "cleanup environment marker");
    if (marker.name !== "staging") throw new Error("cleanup refused outside staging");

    const adminClient = fixtures[0].client;
    if (adminClient) {
      const modeResult = await adminClient.rpc("forum_admin_set_mode", { p_mode: "off" });
      if (modeResult.error && !/not authorized/i.test(modeResult.error.message))
        throw new Error(`cleanup mode: ${modeResult.error.message}`);
      for (let index = 0; index < fixtures.length; index += 1) {
        const removal = await adminClient.rpc("forum_admin_set_beta_member", {
          p_username: username(index), p_enabled: false,
        });
        if (removal.error && !/not authorized|not found/i.test(removal.error.message))
          throw new Error(`cleanup beta member ${index}: ${removal.error.message}`);
      }
      const membershipResponse = await adminClient.rpc("forum_admin_list_beta_members");
      betaMemberCount = must(membershipResponse, "cleanup beta member list").length;
    }
    if (postIds.length) {
      must(await service.from("forum_reports").delete()
        .eq("target_type", "post").in("target_id", postIds), "delete beta reports");
      must(await service.from("forum_posts").delete().in("id", postIds), "delete beta posts");
    }
    if (ids.length) {
      must(await service.from("forum_moderation_log").delete().in("actor_id", ids),
        "delete fixture moderation logs by actor");
      must(await service.from("forum_moderation_log").delete().in("target_user_id", ids),
        "delete fixture moderation logs by target");
      must(await service.from("forum_rate_events").delete().in("user_id", ids),
        "delete fixture rate events");
      for (const fixture of fixtures) {
        if (fixture.id) must(await service.auth.admin.deleteUser(fixture.id),
          `delete ${fixture.role} fixture`);
      }
    }

    let fixtureAuthUsers = 0;
    for (const id of ids) {
      const lookup = await service.auth.admin.getUserById(id);
      if (!lookup.error && lookup.data?.user) fixtureAuthUsers += 1;
    }
    const residue = {
      fixture_auth_users: fixtureAuthUsers,
      fixture_profiles: ids.length
        ? await exactCount("profiles", (query) => query.in("id", ids)) : 0,
      beta_members: betaMemberCount,
      posts: postIds.length
        ? await exactCount("forum_posts", (query) => query.in("id", postIds)) : 0,
      comments: postIds.length
        ? await exactCount("forum_comments", (query) => query.in("post_id", postIds)) : 0,
      votes: postIds.length
        ? await exactCount("forum_votes", (query) => query.in("post_id", postIds)) : 0,
      reports: postIds.length
        ? await exactCount("forum_reports", (query) => query
          .eq("target_type", "post").in("target_id", postIds)) : 0,
      fixture_user_stats: ids.length
        ? await exactCount("forum_user_stats", (query) => query.in("user_id", ids)) : 0,
      fixture_logs: ids.length
        ? await exactCount("forum_moderation_log", (query) => query.in("actor_id", ids)) : 0,
      fixture_target_user_logs: ids.length
        ? await exactCount("forum_moderation_log", (query) => query.in("target_user_id", ids)) : 0,
      fixture_rate_events: ids.length
        ? await exactCount("forum_rate_events", (query) => query.in("user_id", ids)) : 0,
    };
    report.cleanup.residue = residue;
    report.cleanup.completed = Object.values(residue).every((count) => count === 0)
      && must(await service.rpc("forum_mode"), "cleanup forum mode") === "off";
    if (!report.cleanup.completed) throw new Error(`cleanup residue: ${JSON.stringify(residue)}`);
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
    await runHttpJourney();
    if (report.tests.length !== expectedCheckCount)
      throw new Error(`verification count drifted: ${report.tests.length}/${expectedCheckCount}`);
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
  const outputPath = resolve(outputDir, `forum-closed-beta-v1-jwt-${runId}.json`);
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Evidence: ${outputPath}`);
  if (mainError) throw mainError;
  console.log(`Forum closed-beta genuine HTTP/PostgREST JWT staging verification passed (${report.tests.length}/${expectedCheckCount}).`);
}

main().catch((error) => {
  console.error(safeMessage(error?.message ?? error));
  process.exitCode = 1;
});
