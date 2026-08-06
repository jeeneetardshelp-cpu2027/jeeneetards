import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/forum-v1");
const expectedProjectRef = "essmxonestbrgmgrtywn";
const requiredFlag = "--confirm-forum-v1-jwt-staging";

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
const roles = ["admin", "author", "helper", "voter", "reporter"];
const fixtures = roles.map((role) => ({
  role,
  email: `forum-http-${runId}-${role}@staging.invalid`,
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
  tests: [],
  cleanup: { attempted: false, completed: false, errors: [], residue: null },
  fatal: null,
};
let postId = null;

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
const expectDenied = (result, label) => {
  record(label, Boolean(result?.error), evidence(result, result?.error ? {
    code: result.error.code ?? null,
    message: safeMessage(result.error.message),
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
  const marker = must(
    await service.from("app_environment").select("name").eq("id", true).single(),
    "environment marker",
  );
  if (marker.name !== "staging") throw new Error(`Refusing: live marker is ${JSON.stringify(marker.name)}.`);
  report.environment = marker.name;
  const mode = must(await service.rpc("forum_mode"), "forum mode before test");
  if (mode !== "off") throw new Error(`Refusing: forum mode is ${JSON.stringify(mode)}, expected off.`);
  const helper = await service.rpc("forum_stage_prepare_http_fixtures", {
    p_run_id: "00000000",
    p_user_ids: [],
  });
  if (helper.error?.code === "PGRST202") throw new Error("Refusing: staging fixture helper is missing from PostgREST.");
}

async function createAndPrepareUsers() {
  const profileGuard = await service.from("profiles")
    .select("id", { count: "exact", head: true });
  if (profileGuard.error)
    throw new Error(`[empty profile guard] ${profileGuard.error.message}`);
  if ((profileGuard.count ?? 0) !== 0)
    throw new Error("Refusing: staging profiles are not empty.");

  const creationResponses = [];
  for (const fixture of fixtures) {
    const creationResponse = await service.auth.admin.createUser({
      email: fixture.email,
      password: fixture.password,
      email_confirm: true,
      app_metadata: { forum_http_fixture: runId },
      user_metadata: { full_name: "Forum HTTP staging fixture" },
    });
    creationResponses.push(creationResponse);
    const created = must(creationResponse, `create ${fixture.role} fixture`);
    fixture.id = created.user.id;
  }
  record("five Auth Admin fixtures created", fixtures.every((fixture) => fixture.id),
    evidence(creationResponses, { count: 5 }));

  const prepareResponse = await service.rpc("forum_stage_prepare_http_fixtures", {
    p_run_id: runId,
    p_user_ids: fixtures.map((fixture) => fixture.id),
  });
  const prepared = must(prepareResponse, "prepare fixture profiles and cooldown");
  record("fixture helper prepared exact users", prepared?.users_prepared === 5
    && prepared?.profiles_prepared === 5
    && prepared?.admins_prepared === 1
    && prepared?.cooldown_satisfied === true, evidence(prepareResponse, { values: prepared }));

  for (const fixture of fixtures) {
    fixture.client = createClient(url, anonKey, { auth: authOptions });
    const signInResponse = await fixture.client.auth.signInWithPassword({
      email: fixture.email,
      password: fixture.password,
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
  const [admin, author, helper, voter, reporter] = fixtures.map((item) => item.client);
  const anonModeResponse = await anonymous.rpc("forum_mode");
  const anonMode = must(anonModeResponse, "anon mode");
  record("anonymous mode RPC is off", anonMode === "off",
    evidence(anonModeResponse, { value: anonMode }));
  const offTopicsResponse = await anonymous.rpc("get_forum_topics");
  const offTopics = must(offTopicsResponse, "anon topics while off");
  record("anonymous topics fail closed while off",
    offTopics.length === 0, evidence(offTopicsResponse, { count: offTopics.length }));
  expectDenied(await anonymous.rpc("forum_create_post", {
    p_topic_slug: "physics", p_title: "Denied anonymous post", p_body: "Should never exist.",
  }), "anonymous cannot call publishing RPC");
  expectDenied(await author.rpc("forum_admin_set_mode", { p_mode: "open" }),
    "non-admin JWT cannot change forum mode");

  const openResponse = await admin.rpc("forum_admin_set_mode", { p_mode: "open" });
  const openMode = must(openResponse, "open forum");
  record("admin JWT opens forum", openMode === "open",
    evidence(openResponse, { value: openMode }));
  const openTopicsResponse = await anonymous.rpc("get_forum_topics");
  const openTopics = must(openTopicsResponse, "anon topics while open");
  record("anonymous sees six active topics", openTopics.length === 6,
    evidence(openTopicsResponse, { count: openTopics.length }));

  const createPostResponse = await author.rpc("forum_create_post", {
    p_topic_slug: "physics",
    p_title: `HTTP JWT staging post ${runId}`,
    p_body: "A disposable staging post used to verify real PostgREST JWT authorization.",
  });
  postId = Number(must(createPostResponse, "author creates post"));
  record("authenticated author creates post", Number.isSafeInteger(postId) && postId > 0,
    evidence(createPostResponse, { post_id: postId }));

  expectDenied(await helper.rpc("forum_edit_post", {
    p_post_id: postId,
    p_title: "Unauthorized edit",
    p_body: "Another authenticated student must not edit this post.",
  }), "ownership blocks another authenticated editor");

  const createCommentResponse = await helper.rpc("forum_create_comment", {
    p_post_id: postId,
    p_parent_id: null,
    p_body: "Disposable authenticated comment.",
  });
  const commentId = Number(must(createCommentResponse, "helper creates comment"));
  record("authenticated comment succeeds", Number.isSafeInteger(commentId) && commentId > 0,
    evidence(createCommentResponse, { comment_id: commentId }));
  const voteResponse = await voter.rpc("forum_cast_vote", {
    p_target_type: "post", p_target_id: postId, p_value: 1,
  });
  must(voteResponse, "voter casts upvote");

  const feedResponse = await anonymous.rpc("get_forum_feed", {
    p_sort: "new", p_limit: 25,
  });
  const feed = must(feedResponse, "anonymous feed");
  const feedPost = feed.find((row) => Number(row.id) === postId);
  record("anonymous feed reflects comment and vote", feedPost?.score === 1
    && feedPost?.comment_count === 1, evidence(feedResponse, feedPost ? {
      score: feedPost.score, comment_count: feedPost.comment_count,
    } : { found: false }));
  expectDenied(await author.from("forum_posts").select("id").limit(1),
    "authenticated JWT cannot select forum base table");

  for (const [client, reason] of [
    [helper, "off_topic"], [voter, "spam"], [reporter, "other"],
  ]) {
    must(await client.rpc("forum_submit_report", {
      p_target_type: "post", p_target_id: postId, p_reason: reason,
      p_note: `HTTP JWT staging report ${runId}`,
    }), `submit ${reason} report`);
  }
  const hiddenFeedResponse = await anonymous.rpc("get_forum_feed", {
    p_sort: "new", p_limit: 25,
  });
  const hiddenFeed = must(hiddenFeedResponse, "anonymous feed after reports");
  record("three genuine reporter JWTs auto-hide post",
    !hiddenFeed.some((row) => Number(row.id) === postId),
    evidence(hiddenFeedResponse, { post_present: false }));

  const reportsResponse = await admin.rpc("forum_admin_list_reports", { p_limit: 100 });
  const reports = must(reportsResponse, "admin lists reports")
    .filter((row) => Number(row.target_id) === postId);
  record("admin JWT sees all three pending reports", reports.length === 3,
    evidence(reportsResponse, { count: reports.length }));
  must(await admin.rpc("forum_admin_moderate", {
    p_target_type: "post", p_target_id: postId, p_action: "unhide",
    p_reason: "HTTP JWT staging verification", p_report_id: null,
  }), "admin unhides post");
  const readOnlyModeResponse = await admin.rpc("forum_admin_set_mode", { p_mode: "read_only" });
  const readOnlyMode = must(readOnlyModeResponse, "read-only mode");
  record("admin JWT enables read-only mode", readOnlyMode === "read_only",
    evidence(readOnlyModeResponse, { value: readOnlyMode }));
  expectDenied(await author.rpc("forum_create_post", {
    p_topic_slug: "physics", p_title: "Denied read-only post", p_body: "Must be rejected.",
  }), "read-only blocks authenticated publishing over HTTP");
  const readOnlyPostResponse = await anonymous
    .rpc("get_forum_post", { p_post_id: postId })
    .single();
  const readOnlyPost = must(readOnlyPostResponse, "read-only post");
  record("read-only still permits public thread reads", Number(readOnlyPost?.id) === postId,
    evidence(readOnlyPostResponse, { post_id: Number(readOnlyPost?.id) || null }));
  const offModeResponse = await admin.rpc("forum_admin_set_mode", { p_mode: "off" });
  const offMode = must(offModeResponse, "off mode");
  record("admin JWT returns forum to off", offMode === "off",
    evidence(offModeResponse, { value: offMode }));
  const offFeedResponse = await anonymous.rpc("get_forum_feed", { p_sort: "new", p_limit: 25 });
  const offFeed = must(offFeedResponse, "off feed");
  record("off mode empties anonymous feed", offFeed.length === 0,
    evidence(offFeedResponse, { count: offFeed.length }));
  const recountResponse = await admin.rpc("forum_recount_metrics", { p_apply: false });
  const recount = must(recountResponse, "metric recount");
  record("metric recount reports no drift", recount.length === 0,
    evidence(recountResponse, { count: recount.length }));
}

async function cleanup() {
  report.cleanup.attempted = true;
  const ids = fixtures.map((fixture) => fixture.id).filter(Boolean);
  try {
    const marker = must(
      await service.from("app_environment").select("name").eq("id", true).single(),
      "cleanup environment marker",
    );
    if (marker.name !== "staging") throw new Error("cleanup refused outside staging");

    const adminClient = fixtures[0].client;
    if (adminClient) {
      const modeResult = await adminClient.rpc("forum_admin_set_mode", { p_mode: "off" });
      if (modeResult.error && !/not authorized/i.test(modeResult.error.message))
        throw new Error(`cleanup mode: ${modeResult.error.message}`);
    }
    if (postId) {
      must(await service.from("forum_moderation_log").delete().eq("target_id", postId),
        "delete target moderation logs");
      must(await service.from("forum_reports").delete()
        .eq("target_type", "post").eq("target_id", postId), "delete target reports");
      must(await service.from("forum_posts").delete().eq("id", postId), "delete target post");
    }
    if (ids.length) {
      must(await service.from("forum_moderation_log").delete().in("actor_id", ids),
        "delete fixture moderation logs");
      must(await service.from("forum_rate_events").delete().in("user_id", ids),
        "delete fixture rate events");
      for (const fixture of fixtures) {
        if (fixture.id) must(await service.auth.admin.deleteUser(fixture.id),
          `delete ${fixture.role} fixture`);
      }
    }

    const residue = {
      fixture_profiles: ids.length
        ? await exactCount("profiles", (query) => query.in("id", ids)) : 0,
      posts: postId ? await exactCount("forum_posts", (query) => query.eq("id", postId)) : 0,
      reports: postId ? await exactCount("forum_reports", (query) => query
        .eq("target_type", "post").eq("target_id", postId)) : 0,
      fixture_logs: ids.length
        ? await exactCount("forum_moderation_log", (query) => query.in("actor_id", ids)) : 0,
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
  const outputPath = resolve(outputDir, `forum-v1-jwt-${runId}.json`);
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Evidence: ${outputPath}`);
  if (mainError) throw mainError;
  console.log("Forum v1 genuine HTTP/PostgREST JWT staging verification passed.");
}

main().catch((error) => {
  console.error(safeMessage(error?.message ?? error));
  process.exitCode = 1;
});
