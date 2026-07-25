// Browser acceptance journey for the Phase 6 catalog-management UI.
// It is hard-bound to staging, restores every edited catalog value, and
// removes the disposable administrator even when the journey fails.
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { randomBytes } from "node:crypto";
import {
  mkdirSync, readFileSync, writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeUrl, parseEnvText, validateFixtureConfig,
} from "./reportBrowserFixtureUtils.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "../outputs/phase-6");
const browserUrl = "http://127.0.0.1:4174";
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const readEnv = (name) => {
  try { return parseEnvText(readFileSync(resolve(root, name), "utf8")); }
  catch { return {}; }
};
const production = readEnv(".env");
const staging = readEnv(".env.staging");
const cfg = (key) => process.env[key] ?? staging[key];
const url = cfg("TEST_SUPABASE_URL");
const serviceKey = cfg("TEST_SERVICE_KEY");
const anonKey = cfg("TEST_ANON_KEY");

validateFixtureConfig({
  allow: cfg("TEST_ALLOW"),
  url,
  serviceKey,
  anonKey,
  productionUrl: production.VITE_SUPABASE_URL,
});
if (normalizeUrl(url).includes("kezelafqhgqrprpadmlf"))
  throw new Error("Refusing: the staging journey cannot target the production project.");

const auth = { persistSession: false, autoRefreshToken: false };
const db = createClient(url, serviceKey, { auth });
const runId = randomBytes(4).toString("hex");
const email = `manage-ui-${runId}@example.invalid`;
const password = randomBytes(24).toString("base64url");
let userId = null;
let vite = null;
let browser = null;
let fixture = null;

const must = (result, label) => {
  if (result?.error)
    throw new Error(`[${label}] ${result.error.code ?? ""} ${result.error.message}`);
  return result.data;
};
const classLabel = (slug) => {
  if (slug === "dropper") return "Dropper";
  const match = String(slug ?? "").match(/^class-(\d+)$/);
  return match ? `Class ${match[1]}` : String(slug ?? "");
};
const waitForServer = async () => {
  const end = Date.now() + 30_000;
  while (Date.now() < end) {
    try {
      const response = await fetch(browserUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("The staging Vite server did not start within 30 seconds.");
};
const manageRows = async (search = "") => must(
  await db.rpc("get_manage_playlists", {
    p_search: search,
    p_limit: 100,
    p_offset: 0,
  }),
  "list managed playlists",
);
const findCurrent = async () => {
  const rows = await manageRows(fixture.title);
  const row = rows.find(
    (candidate) => Number(candidate.playlist_id) === Number(fixture.playlistId),
  );
  if (!row) throw new Error("The selected staging playlist disappeared.");
  return row;
};
const exactIds = (value) => [...(value ?? [])].map(Number).sort((a, b) => a - b);
const sameIds = (left, right) => (
  JSON.stringify(exactIds(left)) === JSON.stringify(exactIds(right))
);

async function deleteFixture() {
  if (!fixture) return;
  if (fixture.playlistId) {
    const { data: playlist } = await db.from("playlists")
      .select("id,title").eq("id", fixture.playlistId).maybeSingle();
    if (playlist) {
      must(await db.rpc("delete_managed_playlist", {
        p_playlist_id: fixture.playlistId,
        p_expected_title: playlist.title,
      }), "delete disposable playlist");
    }
  }
  if (fixture.videoId)
    must(await db.from("videos").delete().eq("id", fixture.videoId), "delete disposable video");
  const chapterIds = [fixture.wrongChapterId, fixture.correctChapterId].filter(Boolean);
  if (chapterIds.length)
    must(
      await db.from("chapters").delete().in("id", chapterIds),
      "delete disposable chapters",
    );
}

async function clickAndWaitForRpc(page, rpcName, button) {
  const response = page.waitForResponse((candidate) => (
    candidate.url().includes(`/rest/v1/rpc/${rpcName}`)
    && candidate.request().method() === "POST"
  ));
  await button.click();
  const result = await response;
  if (!result.ok())
    throw new Error(`${rpcName} returned HTTP ${result.status()}.`);
}

async function main() {
  const marker = must(
    await db.from("app_environment").select("name").maybeSingle(),
    "environment marker",
  );
  if (!["staging", "test"].includes(marker?.name))
    throw new Error(`Refusing: target identifies as ${JSON.stringify(marker?.name)}.`);

  const [channelResult, categoryResult, goalResult, subjectResult, classLevels] =
  await Promise.all([
    db.from("institutes_channels").select("id,name").order("id").limit(1).single(),
    db.from("categories").select("id,name,slug").eq("slug", "jee").single(),
    db.from("learning_goals").select("id,name,slug").eq("slug", "jee").single(),
    db.from("subjects").select("id,name").order("id").limit(1).single(),
    db.from("class_levels").select("id,slug,display_order")
      .in("slug", ["class-11", "class-12"]).order("display_order"),
  ]);
  const channel = must(channelResult, "fixture channel");
  const category = must(categoryResult, "JEE category");
  const goal = must(goalResult, "JEE learning goal");
  const subject = must(subjectResult, "fixture subject");
  const classRows = must(classLevels, "class levels");
  const class11 = classRows.find((row) => row.slug === "class-11");
  const class12 = classRows.find((row) => row.slug === "class-12");
  if (!class11 || !class12)
    throw new Error("Staging needs Class 11 and Class 12 for this disposable journey.");

  fixture = {
    playlistId: null,
    title: `Manage UI course ${runId}`,
    videoId: null,
    videoTitle: `Manage UI lecture ${runId}`,
    wrongChapterId: null,
    correctChapterId: null,
    correctChapterName: `Correct staging chapter ${runId}`,
    class11Id: Number(class11.id),
    class12Id: Number(class12.id),
    class12Label: classLabel(class12.slug),
    goalId: Number(goal.id),
  };
  const wrongChapter = must(await db.from("chapters").insert({
    name: `Wrong staging chapter ${runId}`,
    slug: `wrong-staging-chapter-${runId}`,
    subject_id: subject.id,
  }).select("id,name").single(), "create wrong chapter");
  fixture.wrongChapterId = Number(wrongChapter.id);
  const correctChapter = must(await db.from("chapters").insert({
    name: `Correct staging chapter ${runId}`,
    slug: `correct-staging-chapter-${runId}`,
    subject_id: subject.id,
  }).select("id,name").single(), "create correct chapter");
  fixture.correctChapterId = Number(correctChapter.id);
  const video = must(await db.from("videos").insert({
    youtube_video_id: `M${runId}AB`,
    title: fixture.videoTitle,
    channel_id: channel.id,
    category_id: category.id,
    subject_id: subject.id,
    chapter_id: wrongChapter.id,
  }).select("id,title").single(), "create disposable video");
  fixture.videoId = Number(video.id);
  const playlist = must(await db.from("playlists").insert({
    title: fixture.title,
    slug: `manage-ui-course-${runId}`,
    channel_id: channel.id,
    category_id: category.id,
    subject_id: subject.id,
    teacher: "Phase 6 test",
    youtube_playlist_id: `PLMANAGEUI${runId}`,
    content_type: "full-course",
    language: "hindi",
    difficulty: "advanced",
    audience_focus: "11th",
  }).select("id,title").single(), "create disposable playlist");
  fixture.playlistId = Number(playlist.id);
  must(await db.from("playlist_videos").insert({
    playlist_id: fixture.playlistId,
    video_id: fixture.videoId,
    position: 1,
  }), "link disposable video");
  must(await db.from("playlist_learning_goals").insert({
    playlist_id: fixture.playlistId,
    learning_goal_id: fixture.goalId,
  }), "tag disposable playlist goal");
  must(await db.from("playlist_class_levels").insert([
    { playlist_id: fixture.playlistId, class_level_id: fixture.class11Id },
    { playlist_id: fixture.playlistId, class_level_id: fixture.class12Id },
  ]), "tag disposable playlist classes");

  const created = must(await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  }), "create disposable admin");
  userId = created.user.id;
  must(await db.from("profiles").update({ is_admin: true }).eq("id", userId)
    .select("id").single(), "grant disposable admin");

  const childEnv = {
    ...process.env,
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_ANON_KEY: anonKey,
  };
  delete childEnv.TEST_SERVICE_KEY;
  delete childEnv.SUPABASE_SERVICE_ROLE_KEY;
  delete childEnv.YOUTUBE_API_KEY;
  vite = spawn(process.execPath, [
    resolve(root, "node_modules/vite/bin/vite.js"),
    "--host", "127.0.0.1",
    "--port", "4174",
    "--strictPort",
  ], {
    cwd: root,
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  await waitForServer();

  browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const clockResponse = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: anonKey },
  });
  const serverDate = new Date(clockResponse.headers.get("date") ?? "");
  if (!Number.isFinite(serverDate.getTime()))
    throw new Error("Supabase did not provide a usable server clock for the staging browser.");
  await page.clock.setFixedTime(serverDate);
  await page.goto(`${browserUrl}/admin`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const signInResponse = page.waitForResponse((candidate) => (
    candidate.url().includes("/auth/v1/token")
    && candidate.request().method() === "POST"
  ));
  await page.getByRole("button", { name: "Sign in" }).click();
  const authResponse = await signInResponse;
  if (!authResponse.ok())
    throw new Error(`Disposable admin sign-in returned HTTP ${authResponse.status()}.`);
  await page.waitForFunction(() => (
    Object.keys(window.localStorage).some((key) => (
      key.startsWith("sb-") && key.endsWith("-auth-token")
    ))
  ));
  const storedSession = await page.evaluate(() => {
    const key = Object.keys(window.localStorage).find((candidate) => (
      candidate.startsWith("sb-") && candidate.endsWith("-auth-token")
    ));
    const value = key ? window.localStorage.getItem(key) : null;
    let parsed = null;
    try { parsed = value ? JSON.parse(value) : null; }
    catch { /* The diagnostic below will report an unreadable session. */ }
    return {
      key,
      hasAccessToken: Boolean(parsed?.access_token),
      storedUserId: parsed?.user?.id ?? null,
      expiresAt: parsed?.expires_at ?? null,
      browserNow: Math.floor(Date.now() / 1000),
    };
  });
  if (!storedSession.hasAccessToken || storedSession.storedUserId !== userId)
    throw new Error(`Browser did not persist the expected disposable admin session (${JSON.stringify(storedSession)}).`);
  try {
    await page.getByRole("button", { name: "Manage" }).waitFor();
  } catch {
    await page.screenshot({
      path: resolve(outputDir, "manage-staging-signin-failure.png"),
      fullPage: true,
    });
    const visibleState = (await page.locator("body").innerText())
      .replace(email, "[disposable admin]")
      .slice(0, 500);
    throw new Error(
      `Admin tabs did not appear after sign-in. Page state: ${visibleState}; `
      + `persisted session: ${JSON.stringify(storedSession)}`,
    );
  }
  await page.getByRole("button", { name: "Manage" }).click();

  await page.getByPlaceholder("Search title, teacher, or playlist ID").fill(fixture.title);
  await page.getByRole("button", { name: "Search" }).click();
  const editButton = page.getByRole("button", { name: `Edit ${fixture.title}` });
  await editButton.waitFor();
  await editButton.click();
  await page.screenshot({
    path: resolve(outputDir, "manage-staging-wrong-values.png"),
    fullPage: true,
  });

  await page.getByLabel("Language").selectOption("english");
  await page.getByRole("checkbox", {
    name: `Class levels: ${fixture.class12Label}`,
    exact: true,
  }).uncheck();
  await clickAndWaitForRpc(
    page,
    "update_managed_playlist",
    page.getByRole("button", { name: "Save playlist changes" }),
  );

  await page.getByLabel(`Chapter for ${fixture.videoTitle}`)
    .selectOption(String(fixture.correctChapterId));
  await clickAndWaitForRpc(
    page,
    "reassign_video_chapter",
    page.getByRole("button", { name: `Save chapter for ${fixture.videoTitle}` }),
  );

  const corrected = await findCurrent();
  const correctedVideo = corrected.videos.find(
    (item) => Number(item.video_id) === fixture.videoId,
  );
  if (
    corrected.language !== "english"
    || !sameIds(corrected.class_level_ids, [fixture.class11Id])
    || Number(correctedVideo?.chapter_id) !== fixture.correctChapterId
  ) throw new Error("The staging database did not retain all three UI corrections.");
  await page.screenshot({
    path: resolve(outputDir, "manage-staging-corrected.png"),
    fullPage: true,
  });

  mkdirSync(outputDir, { recursive: true });
  const report = {
    target: marker.name,
    disposable_playlist_id: fixture.playlistId,
    disposable_video_id: fixture.videoId,
    passed: 3,
    failed: 0,
    corrected_through_ui: true,
    checks: [
      { behavior: "language correction", passed: true },
      { behavior: "class-level correction", passed: true },
      { behavior: "chapter correction", passed: true },
    ],
  };
  writeFileSync(
    resolve(outputDir, "manage-staging-ui-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(`Target database identifies as: ${marker.name}`);
  console.log("PASS language correction through the Manage UI");
  console.log("PASS class-level correction through the Manage UI");
  console.log("PASS chapter correction through the Manage UI");
  console.log("PASS disposable staging fixture selected through the Manage UI");
  console.log("3 passed, 0 failed");
}

let journeyError = null;
try {
  mkdirSync(outputDir, { recursive: true });
  await main();
} catch (error) {
  journeyError = error;
}

const cleanupErrors = [];
const cleanupStep = async (action) => {
  try { await action(); }
  catch (error) { cleanupErrors.push(error.message); }
};
await cleanupStep(async () => {
  await deleteFixture();
});
await cleanupStep(async () => {
  if (browser) await browser.close();
});
if (vite) vite.kill();
await cleanupStep(async () => {
  if (!userId) return;
  const deleted = await db.auth.admin.deleteUser(userId);
  if (deleted.error)
    throw new Error(`[delete disposable admin] ${deleted.error.message}`);
});
if (cleanupErrors.length) {
  const cleanupError = new Error(cleanupErrors.join("; "));
  journeyError = journeyError
    ? new Error(`${journeyError.message}; cleanup failed: ${cleanupError.message}`)
    : cleanupError;
}

if (journeyError) throw journeyError;
