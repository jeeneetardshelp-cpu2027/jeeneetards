// Disposable-staging integration verifier for the v12 mapped chapter import.
//
// This script never installs migrations. The operator must separately apply
// the reviewed v12 migration and its staging-only helper, then opt in with:
//
//   TEST_ALLOW=1 V12_TEST_ALLOW=1 npm run verify:v12-import-staging -- \
//     --confirm-disposable-v12-staging
//
// Every generated identifier is collision-checked before the first mutation.
// Cleanup revalidates the live environment, deletes only this run's exact
// catalogue fixtures, and removes protected audit evidence last.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  redactV12StagingConfig,
  validateV12StagingConfig,
  v12FixtureTokens,
} from "./v12StagingHarnessSafety.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDirectory = resolve(root, "../outputs/v12-import");
const runId = randomBytes(3).toString("hex");
const tokens = v12FixtureTokens(runId);
const chapterNames = [
  `V12 staging ${runId} chapter A`,
  `V12 staging ${runId} chapter B`,
];
const testEmail = `v12-staging-${runId}@example.com`;
const testPassword = `V12!${randomBytes(18).toString("hex")}`;

class GuardError extends Error {}

function parseEnvText(text = "") {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return values;
}

function readEnvFile(name) {
  try {
    return parseEnvText(readFileSync(resolve(root, name), "utf8"));
  } catch {
    return {};
  }
}

const productionEnv = readEnvFile(".env");
const stagingEnv = readEnvFile(".env.staging");
const setting = (name) => process.env[name] ?? stagingEnv[name];
const rawConfig = {
  allow: setting("TEST_ALLOW"),
  v12Allow: setting("V12_TEST_ALLOW"),
  url: setting("TEST_SUPABASE_URL"),
  productionUrls: [
    productionEnv.VITE_SUPABASE_URL,
    process.env.PRODUCTION_SUPABASE_URL,
  ].filter(Boolean),
  serviceKey: setting("TEST_SERVICE_KEY"),
  anonKey: setting("TEST_ANON_KEY"),
  argv: process.argv.slice(2),
};

const report = {
  version: 1,
  run_id: runId,
  started_at: new Date().toISOString(),
  target_kind: "disposable-staging-only",
  configuration: redactV12StagingConfig(rawConfig),
  guards: {
    static_configuration: false,
    live_environment: null,
    v12_capability: false,
    staging_helper_capability: false,
    anonymous_helper_denied: false,
    request_quiescence_capability: false,
    anonymous_quiescence_denied: false,
    audit_cleanup_capability: false,
    anonymous_cleanup_denied: false,
    collision_free: false,
  },
  tests: [],
  expected_audit_rows: null,
  mutations_attempted: false,
  production_touched: false,
  migrations_applied_by_harness: false,
  cleanup: {
    authorized: false,
    attempted: false,
    audit_cleanup_last: false,
    requests_quiesced: false,
    completed: false,
    deleted_audit_rows: null,
    residue: null,
    errors: [],
  },
  fatal: null,
};

let config;
let service;
let anonymous;
let references;
let createdUserId = null;
let cleanupAuthorized = false;
let mutationsAttempted = false;
let guardFailed = false;
let mainFailed = false;

function sanitize(value) {
  let output = String(value ?? "");
  const sensitive = [
    rawConfig.serviceKey,
    rawConfig.anonKey,
    rawConfig.url,
    ...(rawConfig.productionUrls ?? []),
    config?.serviceKey,
    config?.anonKey,
    config?.url,
    ...(config?.productionUrls ?? []),
    testPassword,
  ].filter((item) => typeof item === "string" && item.length > 3);
  for (const item of sensitive) output = output.split(item).join("[REDACTED]");
  return output;
}

function compactDetail(detail) {
  if (detail == null) return null;
  const text = sanitize(
    typeof detail === "string" ? detail : JSON.stringify(detail),
  );
  return text.length > 800 ? `${text.slice(0, 797)}...` : text;
}

function check(name, passed, detail = null) {
  const result = {
    name,
    passed: Boolean(passed),
    detail: compactDetail(detail),
  };
  report.tests.push(result);
  console.log(`${result.passed ? "PASS" : "FAIL"} ${name}`);
  if (!result.passed) throw new Error(`verification failed: ${name}`);
}

function responseError(response) {
  return {
    code: response?.error?.code ?? null,
    message: response?.error?.message ?? null,
  };
}

function must(response, label) {
  if (response?.error) {
    throw new Error(
      `[${label}] ${response.error.code ?? ""} ${response.error.message}`,
    );
  }
  return response.data;
}

function mustGuard(response, label) {
  try {
    return must(response, label);
  } catch (error) {
    throw new GuardError(error.message);
  }
}

function requireGuard(condition, message) {
  if (!condition) throw new GuardError(message);
}

function isAuthorizationError(response) {
  const message = response?.error?.message ?? "";
  return Boolean(response?.error) && (
    response.error.code === "42501" ||
    response.error.code === "PGRST202" ||
    /not authorized|permission denied|not allowed|could not find the function|schema cache/i.test(
      message,
    )
  );
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function allVideoIds() {
  return [
    ...tokens.videos.success,
    ...tokens.videos.anonymousDenied,
    ...tokens.videos.userDenied,
    ...Object.values(tokens.videos.concurrency),
    ...Object.values(tokens.videos.conflict),
    ...Object.values(tokens.videos.failure),
  ];
}

function makePayload({
  label,
  requestId,
  playlistId,
  videos,
  channelId,
  channel,
}) {
  return {
    request_id: requestId,
    youtube_playlist_id: playlistId,
    title: `V12 staging ${label} ${runId}`,
    category_id: references.categoryId,
    learning_goal_id: references.goalId,
    subject_id: references.subjectId,
    class_labels: ["11th"],
    manifest_sha256: sha256(`manifest:${runId}:${label}`),
    source_snapshot_sha256: sha256(`source:${runId}:${label}`),
    manifest_assignment_count: videos.length,
    ...(channelId ? { channel_id: channelId } : {}),
    ...(channel ? { channel } : {}),
    videos: videos.map(({ youtubeVideoId, chapterId }, index) => ({
      youtube_video_id: youtubeVideoId,
      title: `V12 ${label} lesson ${index + 1}`,
      duration_seconds: 600 + index,
      chapter_id: chapterId,
    })),
  };
}

async function mappedImport(client, payload, timeoutMs = 30_000) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  timer.unref?.();
  try {
    const response = await client.rpc("import_playlist_with_chapters", {
      payload,
      mode: "merge",
    }).abortSignal(controller.signal);
    return timedOut
      ? {
          data: null,
          error: {
            code: "HARNESS_TIMEOUT",
            message: `mapped import exceeded ${timeoutMs}ms and was aborted`,
          },
        }
      : response;
  } catch (error) {
    if (!timedOut) throw error;
    return {
      data: null,
      error: {
        code: "HARNESS_TIMEOUT",
        message: `mapped import exceeded ${timeoutMs}ms and was aborted`,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function assertLiveEnvironment(client) {
  const marker = mustGuard(
    await client.from("app_environment").select("name").maybeSingle(),
    "live environment marker",
  );
  requireGuard(
    ["staging", "test"].includes(marker?.name),
    `Refusing: target database identifies as ${JSON.stringify(marker?.name)}, not staging/test.`,
  );
  report.guards.live_environment = marker.name;
  return marker.name;
}

async function assertCapabilities() {
  const publicCapability = mustGuard(
    await anonymous.rpc("per_video_chapter_import_capability"),
    "public v12 capability",
  );
  requireGuard(
    publicCapability?.version === 12 &&
      publicCapability?.per_video_chapter_id === true &&
      publicCapability?.all_or_none_mapping === true &&
      publicCapability?.create_only === true &&
      publicCapability?.request_replay === true &&
      publicCapability?.audit_snapshot === true,
    "Refusing: the target does not advertise the complete v12 capability.",
  );
  report.guards.v12_capability = true;

  const helperCapability = mustGuard(
    await service.rpc("per_video_chapter_import_v12_test_capability"),
    "v12 staging helper capability",
  );
  requireGuard(
    helperCapability?.version === 12 &&
      helperCapability?.environment === "staging-test-only" &&
      helperCapability?.failure_video_prefix === "V12FX" &&
      helperCapability?.audit_playlist_prefix === "TESTV12" &&
      Number(helperCapability?.max_cleanup_request_ids) >=
        Object.keys(tokens.requestIds).length,
    "Refusing: the staging-only v12 helper capability is incomplete.",
  );
  report.guards.staging_helper_capability = true;

  const anonymousHelper = await anonymous.rpc(
    "per_video_chapter_import_v12_test_capability",
  );
  requireGuard(
    isAuthorizationError(anonymousHelper),
    "Refusing: anonymous callers can reach the service-only staging helper.",
  );
  report.guards.anonymous_helper_denied = true;

  const quiescenceProbe = await service.rpc(
    "quiesce_v12_import_test_requests",
    {
      p_run_token: runId,
      p_request_ids: [],
    },
  );
  requireGuard(
    Boolean(quiescenceProbe.error) &&
      /between 1 and 20 request_ids/i.test(quiescenceProbe.error.message),
    "Refusing: request quiescence is unavailable or has the wrong contract.",
  );
  report.guards.request_quiescence_capability = true;

  const anonymousQuiescence = await anonymous.rpc(
    "quiesce_v12_import_test_requests",
    {
      p_run_token: runId,
      p_request_ids: [],
    },
  );
  requireGuard(
    isAuthorizationError(anonymousQuiescence),
    "Refusing: anonymous callers can reach request quiescence.",
  );
  report.guards.anonymous_quiescence_denied = true;

  const cleanupProbe = await service.rpc("cleanup_v12_import_test_audit", {
    p_run_token: runId,
    p_request_ids: [],
  });
  requireGuard(
    Boolean(cleanupProbe.error) &&
      /between 1 and 20 request_ids/i.test(cleanupProbe.error.message),
    "Refusing: exact audit cleanup is unavailable or has the wrong contract.",
  );
  report.guards.audit_cleanup_capability = true;

  const anonymousCleanup = await anonymous.rpc(
    "cleanup_v12_import_test_audit",
    {
      p_run_token: runId,
      p_request_ids: [],
    },
  );
  requireGuard(
    isAuthorizationError(anonymousCleanup),
    "Refusing: anonymous callers can reach protected audit cleanup.",
  );
  report.guards.anonymous_cleanup_denied = true;
}

async function loadReferences() {
  const [category, subject, goal, classLevel] = await Promise.all([
    service.from("categories").select("id").eq("slug", "jee").maybeSingle(),
    service.from("subjects").select("id").eq("slug", "physics").maybeSingle(),
    service.from("learning_goals").select("id").eq("slug", "jee").maybeSingle(),
    service.from("class_levels").select("id").eq("slug", "class-11").maybeSingle(),
  ]);
  const rows = {
    categoryId: mustGuard(category, "JEE category")?.id,
    subjectId: mustGuard(subject, "Physics subject")?.id,
    goalId: mustGuard(goal, "JEE learning goal")?.id,
    classLevelId: mustGuard(classLevel, "Class 11 level")?.id,
  };
  for (const [name, value] of Object.entries(rows)) {
    requireGuard(
      Number.isSafeInteger(value) && value > 0,
      `Refusing: staging prerequisite ${name} is missing.`,
    );
  }
  return rows;
}

async function assertNoCollisions() {
  const playlistIds = Object.values(tokens.playlists);
  const channelIds = Object.values(tokens.channels);
  const requestIds = Object.values(tokens.requestIds);
  const checks = await Promise.all([
    service.from("playlists").select("youtube_playlist_id")
      .in("youtube_playlist_id", playlistIds),
    service.from("videos").select("youtube_video_id")
      .in("youtube_video_id", allVideoIds()),
    service.from("institutes_channels").select("youtube_channel_id")
      .in("youtube_channel_id", channelIds),
    service.from("chapters").select("id,slug")
      .eq("subject_id", references.subjectId)
      .in("slug", tokens.chapterSlugs),
    service.from("chapters").select("id,name")
      .eq("subject_id", references.subjectId)
      .in("name", chapterNames),
    service.from("playlist_import_audit").select("request_id")
      .in("request_id", requestIds),
  ]);
  const labels = [
    "playlist IDs",
    "video IDs",
    "channel IDs",
    "chapter slugs",
    "chapter names",
    "request IDs",
  ];
  checks.forEach((response, index) => {
    const rows = mustGuard(response, `collision check: ${labels[index]}`);
    requireGuard(
      rows.length === 0,
      `Refusing: generated ${labels[index]} collide with existing rows.`,
    );
  });
  report.guards.collision_free = true;
}

async function createBaseFixtures() {
  const chapters = must(
    await service.from("chapters").insert(tokens.chapterSlugs.map(
      (slug, index) => ({
        subject_id: references.subjectId,
        name: chapterNames[index],
        slug,
        display_order: 900000 + index,
      }),
    )).select("id,slug"),
    "create fixture chapters",
  );
  const chapterBySlug = Object.fromEntries(
    chapters.map((chapter) => [chapter.slug, chapter.id]),
  );
  check(
    "created two isolated staging chapters",
    chapters.length === 2 &&
      tokens.chapterSlugs.every((slug) => Number.isSafeInteger(chapterBySlug[slug])),
    { count: chapters.length },
  );

  const channelRows = [
    ["success", tokens.channels.success],
    ["concurrency", tokens.channels.concurrency],
  ].map(([kind, youtubeChannelId]) => ({
    kind,
    name: `V12 staging ${kind} ${runId}`,
    youtube_channel_id: youtubeChannelId,
  }));
  const channels = must(
    await service.from("institutes_channels").insert(
      channelRows.map(({ name, youtube_channel_id }) => ({
        name,
        youtube_channel_id,
      })),
    ).select("id,youtube_channel_id"),
    "create fixture channels",
  );
  const channelByYoutubeId = Object.fromEntries(
    channels.map((channel) => [channel.youtube_channel_id, channel.id]),
  );
  check(
    "created exact run-scoped staging channels",
    channels.length === 2,
    { count: channels.length },
  );

  return {
    chapters: tokens.chapterSlugs.map((slug) => chapterBySlug[slug]),
    successChannelId: channelByYoutubeId[tokens.channels.success],
    concurrencyChannelId: channelByYoutubeId[tokens.channels.concurrency],
  };
}

async function createNonAdminClient() {
  const created = must(
    await service.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    }),
    "create confirmed non-admin user",
  );
  createdUserId = created.user.id;

  const profile = must(
    await service.from("profiles").select("is_admin")
      .eq("id", createdUserId).maybeSingle(),
    "read non-admin profile",
  );
  check(
    "confirmed test user exists and is not an admin",
    profile?.is_admin === false,
    { is_admin: profile?.is_admin ?? null },
  );

  const client = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  must(
    await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    }),
    "sign in non-admin user",
  );
  return client;
}

async function verifyPermissionBoundaries(fixture, userClient) {
  const [chapterA, chapterB] = fixture.chapters;
  const anonymousPayload = makePayload({
    label: "anonymous denied",
    requestId: tokens.requestIds.anonymousDenied,
    playlistId: tokens.playlists.anonymousDenied,
    channelId: fixture.successChannelId,
    videos: [
      { youtubeVideoId: tokens.videos.anonymousDenied[0], chapterId: chapterA },
      { youtubeVideoId: tokens.videos.anonymousDenied[1], chapterId: chapterB },
    ],
  });
  const anonymousWrite = await mappedImport(anonymous, anonymousPayload);
  check(
    "anonymous mapped import is denied",
    isAuthorizationError(anonymousWrite),
    responseError(anonymousWrite),
  );

  const userPayload = makePayload({
    label: "user denied",
    requestId: tokens.requestIds.userDenied,
    playlistId: tokens.playlists.userDenied,
    channelId: fixture.successChannelId,
    videos: [
      { youtubeVideoId: tokens.videos.userDenied[0], chapterId: chapterA },
      { youtubeVideoId: tokens.videos.userDenied[1], chapterId: chapterB },
    ],
  });
  const userWrite = await mappedImport(userClient, userPayload);
  check(
    "confirmed non-admin mapped import is denied",
    isAuthorizationError(userWrite),
    responseError(userWrite),
  );
}

async function verifySuccessfulImport(fixture, userClient) {
  const [chapterA, chapterB] = fixture.chapters;
  const payload = makePayload({
    label: "success",
    requestId: tokens.requestIds.success,
    playlistId: tokens.playlists.success,
    channelId: fixture.successChannelId,
    videos: [
      { youtubeVideoId: tokens.videos.success[0], chapterId: chapterA },
      { youtubeVideoId: tokens.videos.success[1], chapterId: chapterB },
    ],
  });
  const first = must(
    await mappedImport(service, payload),
    "successful mapped import",
  );
  check(
    "two-chapter import returns the exact assignment summary",
    first.idempotent_replay === false &&
      first.chapter_count === 2 &&
      first.chapter_assignments === 2 &&
      first.videos_added === 2 &&
      first.videos_reused === 0,
    first,
  );

  const playlist = must(
    await service.from("playlists").select("id,youtube_playlist_id")
      .eq("youtube_playlist_id", tokens.playlists.success).single(),
    "successful playlist",
  );
  const links = must(
    await service.from("playlist_videos").select("video_id,position")
      .eq("playlist_id", playlist.id).order("position"),
    "successful playlist links",
  );
  const videos = must(
    await service.from("videos").select("id,youtube_video_id,chapter_id,title")
      .in("youtube_video_id", tokens.videos.success),
    "successful videos",
  );
  const byYoutubeId = Object.fromEntries(
    videos.map((video) => [video.youtube_video_id, video]),
  );
  check(
    "successful course has ordered links and no unclassified lesson",
    links.length === 2 &&
      links[0]?.position === 1 &&
      links[1]?.position === 2 &&
      byYoutubeId[tokens.videos.success[0]]?.chapter_id === chapterA &&
      byYoutubeId[tokens.videos.success[1]]?.chapter_id === chapterB &&
      videos.every((video) => video.chapter_id != null),
    { links, videos },
  );

  const audit = must(
    await service.from("playlist_import_audit")
      .select(
        "request_id,youtube_playlist_id,playlist_id,request_payload,before_state,after_state,result,actor_id",
      )
      .eq("request_id", tokens.requestIds.success).single(),
    "successful import audit",
  );
  check(
    "successful import stores one exact protected audit snapshot",
    audit.youtube_playlist_id === tokens.playlists.success &&
      audit.playlist_id === playlist.id &&
      stableJson(audit.request_payload) === stableJson(payload) &&
      audit.before_state?.playlist === null &&
      audit.before_state?.videos?.length === 0 &&
      audit.after_state?.playlist?.id === playlist.id &&
      audit.after_state?.videos?.length === 2 &&
      audit.result?.chapter_assignments === 2 &&
      audit.actor_id === null,
    {
      request_id: audit.request_id,
      playlist_id: audit.playlist_id,
      before_videos: audit.before_state?.videos?.length,
      after_videos: audit.after_state?.videos?.length,
    },
  );

  const anonymousAudit = await anonymous.from("playlist_import_audit")
    .select("request_id").eq("request_id", tokens.requestIds.success);
  check(
    "anonymous caller is denied access to a known import audit row",
    isAuthorizationError(anonymousAudit),
    responseError(anonymousAudit),
  );
  const userAudit = await userClient.from("playlist_import_audit")
    .select("request_id").eq("request_id", tokens.requestIds.success);
  check(
    "confirmed non-admin sees zero rows for a known import audit",
    !userAudit.error && (userAudit.data ?? []).length === 0,
    {
      ...responseError(userAudit),
      rows: userAudit.data?.length ?? null,
    },
  );
  let promoted;
  try {
    promoted = must(
      await service.from("profiles").update({ is_admin: true })
        .eq("id", createdUserId).select("is_admin").single(),
      "promote fixture user for positive audit policy check",
    );
    const adminAudit = await userClient.from("playlist_import_audit")
      .select("request_id").eq("request_id", tokens.requestIds.success);
    check(
      "promoted fixture admin reads exactly one known import audit row",
      promoted.is_admin === true &&
        !adminAudit.error &&
        adminAudit.data?.length === 1 &&
        adminAudit.data[0]?.request_id === tokens.requestIds.success,
      {
        promoted: promoted.is_admin,
        ...responseError(adminAudit),
        rows: adminAudit.data?.length ?? null,
      },
    );
  } finally {
    must(
      await service.from("profiles").update({ is_admin: false })
        .eq("id", createdUserId),
      "restore fixture user non-admin role",
    );
  }

  const replay = must(
    await mappedImport(service, payload),
    "exact request replay",
  );
  const replayAudits = must(
    await service.from("playlist_import_audit").select("id")
      .eq("request_id", tokens.requestIds.success),
    "replay audit count",
  );
  check(
    "exact replay is read-only and does not duplicate audit evidence",
    replay.idempotent_replay === true &&
      replay.playlist_id === playlist.id &&
      replayAudits.length === 1,
    { idempotent_replay: replay.idempotent_replay, audits: replayAudits.length },
  );

  const changedPayload = await mappedImport(service, {
    ...payload,
    title: `${payload.title} changed`,
  });
  check(
    "same request ID with changed payload is rejected",
    Boolean(changedPayload.error) &&
      /different payload/i.test(changedPayload.error.message),
    responseError(changedPayload),
  );

  const newRequestSameSource = await mappedImport(service, {
    ...payload,
    request_id: tokens.requestIds.newSource,
  });
  check(
    "new request cannot overwrite an existing source course",
    Boolean(newRequestSameSource.error) &&
      /already exists|create-only/i.test(newRequestSameSource.error.message),
    responseError(newRequestSameSource),
  );

  must(
    await service.from("videos").update({
      title: `Refreshed outside v12 ${runId}`,
    }).eq("youtube_video_id", tokens.videos.success[0]),
    "refresh nonstructural title",
  );
  const afterRefresh = must(
    await mappedImport(service, payload),
    "replay after nonstructural refresh",
  );
  check(
    "nonstructural video refresh does not create false replay drift",
    afterRefresh.idempotent_replay === true,
  );

  must(
    await service.from("videos").update({ chapter_id: chapterB })
      .eq("youtube_video_id", tokens.videos.success[0]),
    "create structural drift",
  );
  const drifted = await mappedImport(service, payload);
  check(
    "structural chapter drift refuses replay",
    Boolean(drifted.error) && /drift/i.test(drifted.error.message),
    responseError(drifted),
  );
  must(
    await service.from("videos").update({ chapter_id: chapterA })
      .eq("youtube_video_id", tokens.videos.success[0]),
    "restore structural state",
  );
  const restored = must(
    await mappedImport(service, payload),
    "replay after structural restore",
  );
  check(
    "restoring exact structural state restores read-only replay",
    restored.idempotent_replay === true,
  );

  const deleted = must(
    await service.from("playlists").delete().eq("id", playlist.id).select("id"),
    "delete successful playlist for stale replay",
  );
  const stale = await mappedImport(service, payload);
  check(
    "deleted course cannot be resurrected by stale request replay",
    deleted.length === 1 &&
      Boolean(stale.error) &&
      /drift/i.test(stale.error.message),
    responseError(stale),
  );
}

async function verifyInjectedRollback(fixture) {
  const [chapterA, chapterB] = fixture.chapters;
  const payload = makePayload({
    label: "failure injection",
    requestId: tokens.requestIds.failure,
    playlistId: tokens.playlists.failure,
    channel: {
      name: `V12 staging failure ${runId}`,
      youtube_channel_id: tokens.channels.failure,
    },
    videos: [
      { youtubeVideoId: tokens.videos.failure.safe, chapterId: chapterA },
      { youtubeVideoId: tokens.videos.failure.trigger, chapterId: chapterB },
    ],
  });
  const failed = await mappedImport(service, payload);
  check(
    "deterministic second-remap failure is injected",
    Boolean(failed.error) &&
      /injected v12 chapter-remap failure/i.test(failed.error.message),
    responseError(failed),
  );

  const [playlists, videos, channels, audits] = await Promise.all([
    service.from("playlists").select("id")
      .eq("youtube_playlist_id", tokens.playlists.failure),
    service.from("videos").select("id")
      .in("youtube_video_id", Object.values(tokens.videos.failure)),
    service.from("institutes_channels").select("id")
      .eq("youtube_channel_id", tokens.channels.failure),
    service.from("playlist_import_audit").select("id")
      .eq("request_id", tokens.requestIds.failure),
  ]);
  const counts = [
    must(playlists, "failure playlist residue").length,
    must(videos, "failure video residue").length,
    must(channels, "failure channel residue").length,
    must(audits, "failure audit residue").length,
  ];
  check(
    "mid-transaction failure leaves no playlist, video, channel, or audit",
    counts.every((count) => count === 0),
    { playlists: counts[0], videos: counts[1], channels: counts[2], audits: counts[3] },
  );
}

async function verifySharedVideoConcurrency(fixture) {
  const [chapterA, chapterB] = fixture.chapters;
  const payloads = [
    makePayload({
      label: "concurrency A",
      requestId: tokens.requestIds.concurrencyA,
      playlistId: tokens.playlists.concurrencyA,
      channelId: fixture.concurrencyChannelId,
      videos: [
        { youtubeVideoId: tokens.videos.concurrency.shared, chapterId: chapterA },
        { youtubeVideoId: tokens.videos.concurrency.first, chapterId: chapterB },
      ],
    }),
    makePayload({
      label: "concurrency B",
      requestId: tokens.requestIds.concurrencyB,
      playlistId: tokens.playlists.concurrencyB,
      channelId: fixture.concurrencyChannelId,
      videos: [
        { youtubeVideoId: tokens.videos.concurrency.shared, chapterId: chapterA },
        { youtubeVideoId: tokens.videos.concurrency.second, chapterId: chapterB },
      ],
    }),
  ];
  const responses = await Promise.all(
    payloads.map((payload) => mappedImport(service, payload)),
  );
  check(
    "concurrent imports sharing an identical mapping both succeed",
    responses.every((response) => !response.error),
    responses.map(responseError),
  );

  const [playlists, sharedVideos, links, audits] = await Promise.all([
    service.from("playlists").select("id,youtube_playlist_id")
      .in("youtube_playlist_id", [
        tokens.playlists.concurrencyA,
        tokens.playlists.concurrencyB,
      ]),
    service.from("videos").select("id,chapter_id")
      .eq("youtube_video_id", tokens.videos.concurrency.shared),
    service.from("playlist_videos").select("playlist_id")
      .in("playlist_id", responses.map((response) => response.data.playlist_id)),
    service.from("playlist_import_audit").select("request_id")
      .in("request_id", [
        tokens.requestIds.concurrencyA,
        tokens.requestIds.concurrencyB,
      ]),
  ]);
  const reuseCounts = responses
    .map((response) => response.data.videos_reused)
    .sort((left, right) => left - right);
  check(
    "shared-video concurrency creates one shared row and two exact courses",
    must(playlists, "concurrency playlists").length === 2 &&
      must(sharedVideos, "concurrency shared video").length === 1 &&
      sharedVideos.data[0]?.chapter_id === chapterA &&
      must(links, "concurrency links").length === 4 &&
      must(audits, "concurrency audits").length === 2 &&
      stableJson(reuseCounts) === stableJson([0, 1]),
    {
      playlists: playlists.data?.length,
      shared_videos: sharedVideos.data?.length,
      links: links.data?.length,
      audits: audits.data?.length,
      reuse_counts: reuseCounts,
    },
  );
}

async function verifyConflictingConcurrency(fixture) {
  const [chapterA, chapterB] = fixture.chapters;
  const payloads = [
    makePayload({
      label: "conflict A",
      requestId: tokens.requestIds.conflictA,
      playlistId: tokens.playlists.conflictA,
      channelId: fixture.concurrencyChannelId,
      videos: [
        { youtubeVideoId: tokens.videos.conflict.shared, chapterId: chapterA },
        { youtubeVideoId: tokens.videos.conflict.first, chapterId: chapterB },
      ],
    }),
    makePayload({
      label: "conflict B",
      requestId: tokens.requestIds.conflictB,
      playlistId: tokens.playlists.conflictB,
      channelId: fixture.concurrencyChannelId,
      videos: [
        { youtubeVideoId: tokens.videos.conflict.shared, chapterId: chapterB },
        { youtubeVideoId: tokens.videos.conflict.second, chapterId: chapterA },
      ],
    }),
  ];
  const responses = await Promise.all(
    payloads.map((payload) => mappedImport(service, payload)),
  );
  const successIndexes = responses.flatMap(
    (response, index) => response.error ? [] : [index],
  );
  const failureIndexes = responses.flatMap(
    (response, index) => response.error ? [index] : [],
  );
  check(
    "conflicting concurrent mappings permit exactly one winner",
    successIndexes.length === 1 &&
      failureIndexes.length === 1 &&
      /conflicts with the reviewed subject\/chapter mapping/i.test(
        responses[failureIndexes[0]].error.message,
      ),
    responses.map(responseError),
  );

  const winner = successIndexes[0];
  const loser = failureIndexes[0];
  const expectedSharedChapter = winner === 0 ? chapterA : chapterB;
  const winnerUnique = winner === 0
    ? tokens.videos.conflict.first
    : tokens.videos.conflict.second;
  const loserUnique = loser === 0
    ? tokens.videos.conflict.first
    : tokens.videos.conflict.second;
  const [playlists, videos, audits] = await Promise.all([
    service.from("playlists").select("youtube_playlist_id")
      .in("youtube_playlist_id", [
        tokens.playlists.conflictA,
        tokens.playlists.conflictB,
      ]),
    service.from("videos").select("youtube_video_id,chapter_id")
      .in("youtube_video_id", Object.values(tokens.videos.conflict)),
    service.from("playlist_import_audit").select("request_id")
      .in("request_id", [
        tokens.requestIds.conflictA,
        tokens.requestIds.conflictB,
      ]),
  ]);
  const playlistRows = must(playlists, "conflict playlists");
  const videoRows = must(videos, "conflict videos");
  const auditRows = must(audits, "conflict audits");
  const shared = videoRows.find(
    (video) => video.youtube_video_id === tokens.videos.conflict.shared,
  );
  check(
    "losing conflicting transaction leaves no unique playlist, video, or audit",
    playlistRows.length === 1 &&
      playlistRows[0].youtube_playlist_id === payloads[winner].youtube_playlist_id &&
      videoRows.length === 2 &&
      shared?.chapter_id === expectedSharedChapter &&
      videoRows.some((video) => video.youtube_video_id === winnerUnique) &&
      !videoRows.some((video) => video.youtube_video_id === loserUnique) &&
      auditRows.length === 1 &&
      auditRows[0].request_id === payloads[winner].request_id,
    { playlistRows, videoRows, auditRows },
  );
}

function isMissingAuthUser(error) {
  return error?.status === 404 || /user not found/i.test(error?.message ?? "");
}

async function collectResidue({ includeAudit = true } = {}) {
  const queries = await Promise.all([
    service.from("playlists").select("id")
      .in("youtube_playlist_id", Object.values(tokens.playlists)),
    service.from("videos").select("id").in("youtube_video_id", allVideoIds()),
    service.from("institutes_channels").select("id")
      .in("youtube_channel_id", Object.values(tokens.channels)),
    service.from("chapters").select("id")
      .eq("subject_id", references.subjectId)
      .in("slug", tokens.chapterSlugs),
    includeAudit
      ? service.from("playlist_import_audit").select("id")
        .in("request_id", Object.values(tokens.requestIds))
      : Promise.resolve({ data: [], error: null }),
    createdUserId
      ? service.from("profiles").select("id").eq("id", createdUserId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const values = {
    playlists: must(queries[0], "playlist residue").length,
    videos: must(queries[1], "video residue").length,
    channels: must(queries[2], "channel residue").length,
    chapters: must(queries[3], "chapter residue").length,
    audits: must(queries[4], "audit residue").length,
    profiles: must(queries[5], "profile residue").length,
    auth_users: 0,
  };
  if (createdUserId) {
    const user = await service.auth.admin.getUserById(createdUserId);
    if (user.error && !isMissingAuthUser(user.error)) {
      throw new Error(`[auth user residue] ${user.error.message}`);
    }
    values.auth_users = user.data?.user ? 1 : 0;
  }
  return values;
}

async function cleanupExactFixtures() {
  report.cleanup.attempted = true;
  const errors = report.cleanup.errors;
  try {
    await assertLiveEnvironment(service);
  } catch (error) {
    errors.push(sanitize(`cleanup guard failed: ${error.message}`));
    return;
  }

  if (createdUserId) {
    try {
      must(
        await service.from("profiles").update({ is_admin: false })
          .eq("id", createdUserId),
        "demote fixture user before quiescence",
      );
      const storedProfile = must(
        await service.from("profiles").select("is_admin")
          .eq("id", createdUserId).maybeSingle(),
        "verify fixture user demotion before quiescence",
      );
      if (storedProfile && storedProfile.is_admin !== false) {
        throw new Error("fixture user remained an admin before quiescence");
      }
    } catch (error) {
      errors.push(sanitize(error.message));
      return;
    }
  }

  try {
    const quiesced = must(
      await service.rpc("quiesce_v12_import_test_requests", {
        p_run_token: runId,
        p_request_ids: Object.values(tokens.requestIds),
      }),
      "quiesce mapped-import requests before cleanup",
    );
    if (
      quiesced.requested !== Object.values(tokens.requestIds).length ||
      quiesced.locked !== Object.values(tokens.requestIds).length
    ) {
      throw new Error(
        `quiescence count mismatch: ${JSON.stringify(quiesced)}`,
      );
    }
    report.cleanup.requests_quiesced = true;
  } catch (error) {
    errors.push(sanitize(error.message));
    return;
  }

  async function cleanupStep(label, operation) {
    try {
      must(await operation(), label);
    } catch (error) {
      errors.push(sanitize(error.message));
    }
  }

  await cleanupStep("cleanup playlists", () =>
    service.from("playlists").delete()
      .in("youtube_playlist_id", Object.values(tokens.playlists)));
  await cleanupStep("cleanup videos", () =>
    service.from("videos").delete().in("youtube_video_id", allVideoIds()));
  await cleanupStep("cleanup channels", () =>
    service.from("institutes_channels").delete()
      .in("youtube_channel_id", Object.values(tokens.channels)));
  await cleanupStep("cleanup chapters", () =>
    service.from("chapters").delete()
      .eq("subject_id", references.subjectId)
      .in("slug", tokens.chapterSlugs));
  if (createdUserId) {
    await cleanupStep("cleanup fixture admin role", () =>
      service.from("profiles").update({ is_admin: false })
        .eq("id", createdUserId));
    try {
      const deleted = await service.auth.admin.deleteUser(createdUserId);
      if (deleted.error && !isMissingAuthUser(deleted.error)) {
        throw new Error(`[cleanup auth user] ${deleted.error.message}`);
      }
    } catch (error) {
      errors.push(sanitize(error.message));
    }
  }

  try {
    const catalogueResidue = await collectResidue({ includeAudit: false });
    const nonAuditResidue = Object.entries(catalogueResidue)
      .filter(([name]) => name !== "audits")
      .some(([, count]) => count !== 0);
    if (nonAuditResidue) {
      errors.push(
        `catalogue/auth residue remains before audit cleanup: ${JSON.stringify(catalogueResidue)}`,
      );
    }
  } catch (error) {
    errors.push(sanitize(`pre-audit residue check failed: ${error.message}`));
  }

  if (errors.length === 0) {
    try {
      const auditCleanup = must(
        await service.rpc("cleanup_v12_import_test_audit", {
          p_run_token: runId,
          p_request_ids: Object.values(tokens.requestIds),
        }),
        "cleanup protected audit evidence",
      );
      report.cleanup.audit_cleanup_last = true;
      report.cleanup.deleted_audit_rows = auditCleanup.deleted;
      if (
        report.expected_audit_rows != null &&
        auditCleanup.deleted !== report.expected_audit_rows
      ) {
        errors.push(
          `audit cleanup deleted ${auditCleanup.deleted}; expected ${report.expected_audit_rows}`,
        );
      }
    } catch (error) {
      errors.push(sanitize(error.message));
    }
  }

  try {
    report.cleanup.residue = await collectResidue();
    if (Object.values(report.cleanup.residue).some((count) => count !== 0)) {
      errors.push(
        `final fixture residue remains: ${JSON.stringify(report.cleanup.residue)}`,
      );
    }
  } catch (error) {
    errors.push(sanitize(`final residue check failed: ${error.message}`));
  }
  report.cleanup.completed = errors.length === 0;
}

async function run() {
  try {
    config = validateV12StagingConfig(rawConfig);
  } catch (error) {
    throw new GuardError(error.message);
  }
  report.guards.static_configuration = true;

  const auth = { persistSession: false, autoRefreshToken: false };
  service = createClient(config.url, config.serviceKey, { auth });
  anonymous = createClient(config.url, config.anonKey, { auth });

  const environment = await assertLiveEnvironment(service);
  console.log(`Target database identifies as ${environment}.`);
  await assertCapabilities();
  references = await loadReferences();
  await assertNoCollisions();

  // Only after every read-only guard and collision check has passed may this
  // exact run ledger authorize writes and eventual cleanup.
  cleanupAuthorized = true;
  report.cleanup.authorized = true;
  mutationsAttempted = true;
  report.mutations_attempted = true;

  const fixture = await createBaseFixtures();
  const userClient = await createNonAdminClient();
  await verifyPermissionBoundaries(fixture, userClient);
  await verifySuccessfulImport(fixture, userClient);
  await verifyInjectedRollback(fixture);
  await verifySharedVideoConcurrency(fixture);
  await verifyConflictingConcurrency(fixture);

  const audits = must(
    await service.from("playlist_import_audit").select("request_id")
      .in("request_id", Object.values(tokens.requestIds)),
    "final exact audit count",
  );
  report.expected_audit_rows = audits.length;
  check(
    "only successful new requests produced audit rows",
    audits.length === 4,
    { count: audits.length, request_ids: audits.map((row) => row.request_id) },
  );
}

try {
  await run();
} catch (error) {
  mainFailed = true;
  guardFailed = error instanceof GuardError;
  report.fatal = sanitize(error?.message ?? error);
  console.error(
    sanitize(`${guardFailed ? "REFUSED" : "FATAL"}: ${error?.message ?? error}`),
  );
} finally {
  if (cleanupAuthorized && mutationsAttempted && service && references) {
    await cleanupExactFixtures();
  } else {
    console.log("Cleanup skipped: no write was authorized or attempted.");
  }

  report.finished_at = new Date().toISOString();
  report.summary = {
    passed: report.tests.filter((test) => test.passed).length,
    failed: report.tests.filter((test) => !test.passed).length,
    guard_failed: guardFailed,
    cleanup_completed: report.cleanup.completed,
  };
  mkdirSync(outputDirectory, { recursive: true });
  const reportPath = resolve(outputDirectory, `v12-staging-${runId}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Redacted report -> ${reportPath}`);

  const cleanupFailed =
    cleanupAuthorized && mutationsAttempted && !report.cleanup.completed;
  process.exitCode = guardFailed ? 2 : mainFailed || cleanupFailed ? 1 : 0;
}
