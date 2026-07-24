// Prepare, verify, or clean one exact disposable-staging fixture for the real
// signed-in report browser journey. This script never targets production and
// never prints the generated student's credentials.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import {
  chmodSync, existsSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  REPORT_BROWSER_STATE_VERSION,
  fixtureTokens,
  isMissingAuthUser,
  parseEnvText,
  validateFixtureConfig,
  validateFixtureState,
} from "./reportBrowserFixtureUtils.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const statePath = resolve(root, ".report-browser-fixture.json");
const reportPath = resolve(root, "report-browser-test-report.json");
const action = process.argv[2];
const refuse = (message) => { console.error(message); process.exit(2); };

if (!["prepare", "verify", "cleanup"].includes(action))
  refuse("Usage: reportBrowserFixture.js prepare|verify|cleanup");

const readEnv = (name) => {
  try { return parseEnvText(readFileSync(resolve(root, name), "utf8")); }
  catch { return {}; }
};
const production = readEnv(".env");
const staging = readEnv(".env.staging");
const cfg = (key) => process.env[key] ?? staging[key];
const URL = cfg("TEST_SUPABASE_URL");
const SERVICE = cfg("TEST_SERVICE_KEY");
const ANON = cfg("TEST_ANON_KEY");

try {
  validateFixtureConfig({
    allow: cfg("TEST_ALLOW"),
    url: URL,
    serviceKey: SERVICE,
    anonKey: ANON,
    productionUrl: production.VITE_SUPABASE_URL,
  });
} catch (error) {
  refuse(error.message);
}

const auth = { persistSession: false, autoRefreshToken: false };
const db = createClient(URL, SERVICE, { auth });

const must = (result, label) => {
  if (result?.error) throw new Error(`[${label}] ${result.error.code ?? ""} ${result.error.message}`);
  return result.data;
};

async function assertStaging() {
  const marker = await db.from("app_environment").select("name").maybeSingle();
  if (marker.error) throw new Error(`Environment marker unreadable: ${marker.error.message}`);
  if (!["staging", "test"].includes(marker.data?.name))
    throw new Error(`Target identifies as ${JSON.stringify(marker.data?.name)}, not staging/test.`);
  return marker.data.name;
}

function readState() {
  if (!existsSync(statePath))
    throw new Error("No report browser fixture exists. Run prepare:report-browser first.");
  return validateFixtureState(JSON.parse(readFileSync(statePath, "utf8")), URL);
}

function readCleanupState() {
  if (!existsSync(statePath))
    throw new Error("No report browser fixture exists. Run prepare:report-browser first.");
  return validateFixtureState(
    JSON.parse(readFileSync(statePath, "utf8")), URL, { requireComplete: false },
  );
}

function persistState(state, { exclusive = false } = {}) {
  writeFileSync(statePath, JSON.stringify(state, null, 2), {
    flag: exclusive ? "wx" : "w",
    mode: 0o600,
  });
  try { chmodSync(statePath, 0o600); } catch { /* Windows ACLs are authoritative. */ }
}

async function deleteFixture(state, { tolerateMissingUser = true } = {}) {
  if (state.userId) must(await db.from("content_reports").delete()
    .eq("reporter_id", state.userId), "delete user reports");
  if (state.videoId) must(await db.from("content_reports").delete()
    .eq("target_type", "video").eq("target_id", state.videoId), "delete target reports");
  if (state.playlistId) must(await db.from("playlists").delete()
    .eq("id", state.playlistId), "delete playlist");
  if (state.videoId) must(await db.from("videos").delete().eq("id", state.videoId), "delete video");
  if (state.channelId) must(await db.from("institutes_channels").delete()
    .eq("id", state.channelId), "delete channel");

  if (state.userId) {
    const deletedUser = await db.auth.admin.deleteUser(state.userId);
    if (deletedUser.error && !(tolerateMissingUser && isMissingAuthUser(deletedUser.error)))
      throw new Error(`[delete user] ${deletedUser.error.message}`);
  }
}

async function residue(state) {
  const reportsByUser = state.userId
    ? must(await db.from("content_reports").select("id").eq("reporter_id", state.userId), "reporter residue")
    : [];
  const reportsByTarget = state.videoId
    ? must(await db.from("content_reports").select("id")
      .eq("target_type", "video").eq("target_id", state.videoId), "target residue")
    : [];
  const playlists = state.playlistId
    ? must(await db.from("playlists").select("id").eq("id", state.playlistId), "playlist residue") : [];
  const videos = state.videoId
    ? must(await db.from("videos").select("id").eq("id", state.videoId), "video residue") : [];
  const channels = state.channelId
    ? must(await db.from("institutes_channels").select("id")
      .eq("id", state.channelId), "channel residue") : [];
  let authUsers = 0;
  if (state.userId) {
    const user = await db.auth.admin.getUserById(state.userId);
    authUsers = user.error && isMissingAuthUser(user.error) ? 0 : user.data?.user ? 1 : 0;
    if (user.error && !isMissingAuthUser(user.error)) throw new Error(`[user residue] ${user.error.message}`);
  }
  return {
    reports: new Set([...reportsByUser, ...reportsByTarget].map((row) => row.id)).size,
    playlists: playlists.length,
    videos: videos.length,
    channels: channels.length,
    authUsers,
  };
}

async function prepare() {
  if (existsSync(statePath))
    throw new Error("A fixture state already exists. Run cleanup:report-browser before preparing another.");

  const runId = randomBytes(3).toString("hex");
  const tokens = fixtureTokens(runId);
  const password = `R!${randomBytes(16).toString("hex")}`;
  const partial = {
    version: REPORT_BROWSER_STATE_VERSION,
    runId,
    supabaseUrl: URL,
    email: tokens.email,
    password,
    userId: null,
    playlistId: null,
    videoId: null,
    channelId: null,
    expectedReason: tokens.expectedReason,
    expectedNote: tokens.expectedNote,
    createdAt: new Date().toISOString(),
  };
  // Persist the recovery token before the first database write, then update it
  // immediately after each generated id. Cleanup accepts this partial shape.
  persistState(partial, { exclusive: true });

  try {
    const category = must(await db.from("categories").select("id,slug")
      .order("display_order").limit(1).single(), "category");
    const subject = must(await db.from("subjects").select("id,slug")
      .order("display_order").limit(1).single(), "subject");
    const chapter = must(await db.from("chapters").select("id")
      .eq("subject_id", subject.id).order("display_order").limit(1).maybeSingle(), "chapter");
    const goal = must(await db.from("learning_goals").select("id")
      .eq("slug", "jee").limit(1).maybeSingle(), "learning goal");
    const classLevel = must(await db.from("class_levels").select("id")
      .eq("slug", "class-11").limit(1).maybeSingle(), "class level");

    const channel = must(await db.from("institutes_channels").insert({
      name: `Report browser fixture ${runId}`,
      youtube_channel_id: tokens.channelYoutubeId,
    }).select("id").single(), "channel");
    partial.channelId = channel.id;
    persistState(partial);

    const playlist = must(await db.from("playlists").insert({
      title: `Report browser course ${runId}`,
      teacher: "Temporary staging teacher",
      description: "Disposable signed-in report browser fixture.",
      channel_id: channel.id,
      category_id: category.id,
      subject_id: subject.id,
      youtube_playlist_id: tokens.playlistYoutubeId,
      class_levels: [],
      language: "hinglish",
      content_type: "full-course",
      difficulty: "intermediate",
      last_verified_at: new Date().toISOString(),
    }).select("id").single(), "playlist");
    partial.playlistId = playlist.id;
    persistState(partial);

    const video = must(await db.from("videos").insert({
      youtube_video_id: tokens.videoYoutubeId,
      title: `Report browser lecture ${runId}`,
      description: "Disposable browser verification lecture.",
      channel_id: channel.id,
      category_id: category.id,
      subject_id: subject.id,
      chapter_id: chapter?.id ?? null,
      duration_seconds: 600,
      embedding_status: "embeddable",
      last_verified_at: new Date().toISOString(),
    }).select("id").single(), "video");
    partial.videoId = video.id;
    persistState(partial);

    must(await db.from("playlist_videos").insert({
      playlist_id: playlist.id, video_id: video.id, position: 1,
    }), "playlist video");
    if (goal?.id) must(await db.from("playlist_learning_goals").insert({
      playlist_id: playlist.id, learning_goal_id: goal.id,
    }), "playlist goal");
    if (classLevel?.id) must(await db.from("playlist_class_levels").insert({
      playlist_id: playlist.id, class_level_id: classLevel.id,
    }), "playlist class");

    const created = must(await db.auth.admin.createUser({
      email: partial.email,
      password: partial.password,
      email_confirm: true,
    }), "create user");
    partial.userId = created.user.id;
    persistState(partial);
    console.log(`Fixture ready on staging. Run ${runId}.`);
    console.log(`Browser route: /course/${partial.playlistId}?previewReports=1`);
    console.log("Credentials were written only to the ignored local fixture-state file.");
  } catch (error) {
    try {
      await deleteFixture(partial);
      const remaining = await residue(partial);
      if (!Object.values(remaining).every((count) => count === 0))
        throw new Error(`residue remains: ${JSON.stringify(remaining)}`);
      rmSync(statePath, { force: true });
    } catch (cleanupError) {
      throw new Error(
        `${error.message}; PARTIAL CLEANUP FAILED: ${cleanupError.message}. ` +
        "Recovery state was retained for cleanup:report-browser.",
      );
    }
    throw error;
  }
}

async function verify() {
  const state = readState();
  const reports = must(await db.from("content_reports")
    .select("id,status,target_type,target_id,reason,note,reporter_id,created_at")
    .eq("reporter_id", state.userId)
    .eq("target_type", "video")
    .eq("target_id", state.videoId), "browser report evidence");
  const checks = [
    ["exactly one browser report exists", reports.length === 1, `count=${reports.length}`],
    ["report belongs to the temporary signed-in user", reports[0]?.reporter_id === state.userId],
    ["report targets the temporary lecture", reports[0]?.target_id === state.videoId],
    ["moderation status is server-controlled pending", reports[0]?.status === "pending"],
    ["selected reason reached the database", reports[0]?.reason === state.expectedReason],
    ["browser-only evidence note reached the database", reports[0]?.note === state.expectedNote],
    ["server timestamp follows fixture creation", reports[0]?.created_at >= state.createdAt],
  ];
  let failed = 0;
  for (const [name, passed, detail] of checks) {
    console.log(`${passed ? "PASS" : "FAIL"} ${name}${!passed && detail ? ` (${detail})` : ""}`);
    if (!passed) failed++;
  }
  writeFileSync(reportPath, JSON.stringify({
    run_id: state.runId,
    passed: checks.length - failed,
    failed,
    checks: checks.map(([name, passed]) => ({ name, passed })),
  }, null, 2));
  if (failed) throw new Error(`${failed} browser evidence check(s) failed.`);
  console.log(`\n${checks.length} passed, 0 failed`);
  console.log(`report -> ${reportPath.split(/[\\/]/).pop()}`);
}

async function cleanup() {
  const state = readCleanupState();
  await deleteFixture(state);
  const remaining = await residue(state);
  const clean = Object.values(remaining).every((count) => count === 0);
  console.log(`Cleanup ${clean ? "confirmed" : "INCOMPLETE"}: ${JSON.stringify(remaining)}`);
  if (!clean) throw new Error("Fixture cleanup left database residue; local state was retained.");
  rmSync(statePath);
  console.log("Local credential state deleted.");
}

try {
  const environment = await assertStaging();
  console.log(`Target database identifies as ${environment}.`);
  if (action === "prepare") await prepare();
  else if (action === "verify") await verify();
  else await cleanup();
} catch (error) {
  console.error(`FATAL: ${error?.message ?? error}`);
  process.exitCode = 1;
}
