// Destructive-fixture integration evidence for content report hardening.
// Refuses production, requires an explicit staging marker, and cleans exact ids.
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readEnv = (name) => {
  const out = {};
  try {
    for (const line of readFileSync(resolve(root, name), "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch { /* optional */ }
  return out;
};

const production = readEnv(".env");
const staging = readEnv(".env.staging");
const cfg = (key) => process.env[key] ?? staging[key];
const URL = cfg("TEST_SUPABASE_URL");
const SERVICE = cfg("TEST_SERVICE_KEY");
const ANON = cfg("TEST_ANON_KEY");
const refuse = (message) => { console.error(message); process.exit(2); };

if (cfg("TEST_ALLOW") !== "1") refuse("Refusing: set TEST_ALLOW=1 in .env.staging.");
if (!URL || !SERVICE || !ANON)
  refuse("Refusing: TEST_SUPABASE_URL, TEST_SERVICE_KEY and TEST_ANON_KEY are required.");
if (production.VITE_SUPABASE_URL && URL === production.VITE_SUPABASE_URL)
  refuse("Refusing: TEST_SUPABASE_URL is the production URL.");

const auth = { persistSession: false, autoRefreshToken: false };
const db = createClient(URL, SERVICE, { auth });
const anon = createClient(URL, ANON, { auth });
const user = createClient(URL, ANON, { auth });
const RUN = randomBytes(3).toString("hex");
const CHANNEL = `REPORT${RUN}`;
const VIDEO = (n) => `R${RUN}${String(n).padStart(4, "0")}`;
const REPORT = resolve(root, "content-reports-hardening-test-report.json");

let guardPassed = false;
let channelId = null;
let userId = null;
const videoIds = [];
const results = [];
let passed = 0;
let failed = 0;
let fatal = null;

const must = (result, label) => {
  if (result?.error) throw new Error(`[${label}] ${result.error.code ?? ""} ${result.error.message}`);
  return result.data;
};
const check = (name, condition, detail = null) => {
  const ok = Boolean(condition);
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? `\n    ${detail}` : ""}`);
  results.push({ name, passed: ok, detail });
  ok ? passed++ : failed++;
};
const denied = (result) => Boolean(result?.error) &&
  (result.error.code === "42501" || /permission denied|row-level security|authenticated reporter/i.test(result.error.message));

async function guard() {
  const marker = await db.from("app_environment").select("name").maybeSingle();
  if (marker.error) throw new Error(`Environment marker unreadable: ${marker.error.message}`);
  if (!["staging", "test"].includes(marker.data?.name))
    throw new Error(`Target identifies as ${JSON.stringify(marker.data?.name)}, not staging/test.`);
  guardPassed = true;
  console.log(`Target database identifies as ${marker.data.name}. Run ${RUN}.\n`);
}

async function fixtures() {
  const category = must(await db.from("categories").select("id").limit(1).single(), "category");
  const subject = must(await db.from("subjects").select("id").limit(1).single(), "subject");
  const channel = must(await db.from("institutes_channels").insert({
    name: `Report verifier ${RUN}`, youtube_channel_id: CHANNEL,
  }).select("id").single(), "channel");
  channelId = channel.id;

  const rows = Array.from({ length: 11 }, (_, i) => ({
    youtube_video_id: VIDEO(i + 1),
    title: `Report verifier video ${i + 1} ${RUN}`,
    channel_id: channelId,
    category_id: category.id,
    subject_id: subject.id,
  }));
  const videos = must(await db.from("videos").insert(rows).select("id"), "videos");
  videoIds.push(...videos.map((row) => row.id));

  const email = `report-${RUN}@example.invalid`;
  const password = `R!${randomBytes(12).toString("hex")}`;
  const created = must(await db.auth.admin.createUser({
    email, password, email_confirm: true,
  }), "create user");
  userId = created.user.id;
  must(await user.auth.signInWithPassword({ email, password }), "sign in user");
}

const payload = (targetId, extra = {}) => ({
  target_type: "video",
  target_id: targetId,
  reason: "broken",
  reporter_id: userId,
  note: `Verifier ${RUN}`,
  ...extra,
});

async function main() {
  await guard();
  await fixtures();

  const anonInsert = await anon.from("content_reports").insert({
    target_type: "video", target_id: videoIds[0], reason: "broken", reporter_id: null,
  });
  check("R1 anonymous report submission is rejected", denied(anonInsert), anonInsert.error?.message);

  const missingReporter = await user.from("content_reports").insert({
    target_type: "video", target_id: videoIds[0], reason: "broken",
  });
  check("R2 signed-in reports require the caller's reporter id", denied(missingReporter), missingReporter.error?.message);

  const spoofed = await user.from("content_reports").insert(payload(videoIds[0], {
    reporter_id: randomUUID(),
  }));
  check("R3 a signed-in user cannot spoof another reporter", denied(spoofed), spoofed.error?.message);

  const unknown = await user.from("content_reports").insert(payload(9_000_000_000));
  check("R4 an unknown target is rejected specifically",
    unknown.error?.code === "22023" && /unknown video target/i.test(unknown.error.message),
    unknown.error?.message);

  const oversized = await user.from("content_reports").insert(payload(videoIds[0], {
    note: "x".repeat(1001),
  }));
  check("R5 oversized notes are rejected specifically",
    oversized.error?.code === "22023" && /1000 characters/i.test(oversized.error.message),
    oversized.error?.message);

  const first = await user.from("content_reports").insert(payload(videoIds[0], {
    status: "dismissed", created_at: "2000-01-01T00:00:00Z",
  }));
  check("R6 a valid signed-in report succeeds", !first.error, first.error?.message);

  const storedFirst = must(await db.from("content_reports")
    .select("status,created_at")
    .eq("reporter_id", userId)
    .eq("target_id", videoIds[0])
    .single(), "stored first report");
  check("R7 client moderation state and timestamp are overwritten",
    storedFirst.status === "pending" && new Date(storedFirst.created_at).getUTCFullYear() !== 2000,
    JSON.stringify(storedFirst));

  const duplicate = await user.from("content_reports").insert(payload(videoIds[0]));
  check("R8 an equivalent pending report is rejected",
    duplicate.error?.code === "23505" && /already pending/i.test(duplicate.error.message),
    duplicate.error?.message);

  for (let i = 1; i <= 8; i++)
    must(await user.from("content_reports").insert(payload(videoIds[i])), `report ${i + 1}`);

  const concurrent = await Promise.all([
    user.from("content_reports").insert(payload(videoIds[9])),
    user.from("content_reports").insert(payload(videoIds[10])),
  ]);
  const successes = concurrent.filter((result) => !result.error).length;
  const limited = concurrent.filter((result) => /rate limit exceeded/i.test(result.error?.message ?? "")).length;
  check("R9 concurrent requests cannot race past the hourly limit",
    successes === 1 && limited === 1,
    JSON.stringify(concurrent.map((result) => result.error?.message ?? "success")));

  const rows = must(await db.from("content_reports").select("id")
    .eq("reporter_id", userId), "service report count");
  check("R10 the hourly limit leaves exactly ten reports", rows.length === 10, `count=${rows.length}`);

  const privateRead = await user.from("content_reports").select("id").eq("reporter_id", userId);
  check("R11 students cannot read moderation reports",
    Boolean(privateRead.error) || privateRead.data?.length === 0,
    JSON.stringify(privateRead.data));
}

async function cleanup() {
  if (!guardPassed) return;
  if (videoIds.length)
    must(await db.from("content_reports").delete().eq("target_type", "video").in("target_id", videoIds), "delete reports");
  if (videoIds.length) must(await db.from("videos").delete().in("id", videoIds), "delete videos");
  if (channelId) must(await db.from("institutes_channels").delete().eq("id", channelId), "delete channel");
  if (userId) must(await db.auth.admin.deleteUser(userId), "delete user");

  const reportResidue = videoIds.length
    ? must(await db.from("content_reports").select("id").eq("target_type", "video").in("target_id", videoIds), "report cleanup")
    : [];
  const videoResidue = videoIds.length
    ? must(await db.from("videos").select("id").in("id", videoIds), "video cleanup")
    : [];
  const channelResidue = channelId
    ? must(await db.from("institutes_channels").select("id").eq("id", channelId), "channel cleanup")
    : [];
  console.log(`Cleanup confirmed: ${JSON.stringify({
    reports: reportResidue.length,
    videos: videoResidue.length,
    channels: channelResidue.length,
  })}`);
}

try {
  await main();
} catch (error) {
  fatal = error?.message ?? String(error);
  console.error(`FATAL: ${fatal}`);
  failed++;
} finally {
  try { await cleanup(); } catch (error) {
    const message = `cleanup failed: ${error?.message ?? error}`;
    console.error(message);
    fatal = fatal ? `${fatal}; ${message}` : message;
    failed++;
  }
  writeFileSync(REPORT, JSON.stringify({ run_id: RUN, passed, failed, fatal, results }, null, 2));
  console.log(`report -> ${REPORT.split(/[\\/]/).pop()}`);
}

if (failed) process.exitCode = 1;
else console.log(`\n${passed} passed, 0 failed`);
