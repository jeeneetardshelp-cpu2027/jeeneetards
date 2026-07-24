// Destructive-fixture integration evidence for v10 content quality.
// Staging only; exact run-scoped cleanup; never writes to production.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
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
if (!URL || !SERVICE || !ANON) refuse("Refusing: staging URL, service key and anon key are required.");
if (production.VITE_SUPABASE_URL && URL === production.VITE_SUPABASE_URL)
  refuse("Refusing: TEST_SUPABASE_URL is the production URL.");

const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const RUN = randomBytes(3).toString("hex");
const CHANNEL = `QCH${RUN}00`;
const YPL = `QPL${RUN}quality`;
const YVID = `Q${RUN}0001`;
const created = { playlist: null, teacher: null, video: null, channel: null };
const results = [];
let passed = 0;
let failed = 0;
let guardFailed = false;
let cleanupRan = false;

class GuardError extends Error {}
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
const authRejected = (result) => Boolean(result?.error) &&
  (result.error.code === "42501" || /not authorized|permission denied/i.test(result.error.message ?? ""));

async function guard() {
  const marker = await db.from("app_environment").select("name").maybeSingle();
  if (marker.error) throw new GuardError(`Environment marker unreadable: ${marker.error.message}`);
  if (!['staging','test'].includes(marker.data?.name))
    throw new GuardError(`Target identifies as ${JSON.stringify(marker.data?.name)}, not staging/test.`);
  console.log(`Target database identifies as ${marker.data.name}. Run ${RUN}.\n`);
}

async function refs() {
  const categories = must(await db.from("categories").select("id,slug"), "categories");
  const subjects = must(await db.from("subjects").select("id,slug"), "subjects");
  const goals = must(await db.from("learning_goals").select("id,slug"), "goals");
  const physics = subjects.find((row) => row.slug === "physics")?.id;
  const chapters = must(await db.from("chapters").select("id,subject_id").eq("subject_id", physics).limit(1), "chapters");
  const out = {
    category: categories.find((row) => row.slug === "jee")?.id,
    subject: physics,
    goal: goals.find((row) => row.slug === "jee")?.id,
    chapter: chapters[0]?.id,
  };
  for (const [key, value] of Object.entries(out)) if (!value) throw new Error(`Missing staging reference: ${key}`);
  return out;
}

async function main() {
  await guard();
  const r = await refs();

  const capability = must(await db.rpc("content_quality_capability"), "capability");
  check("Q1 service role sees the explicit quality capability", capability.source_title_supported === true);
  check("Q2 anonymous quality capability is rejected", authRejected(await anon.rpc("content_quality_capability")));

  const teacher = must(await db.rpc("create_teacher", {
    // A person-like fixture name is intentional. “Quality Faculty” is rightly
    // classified as an organization/team by the v7 identity guard.
    p_display_name: `Amit Sharma ${RUN}`, p_aliases: [], p_verified: true,
    p_duplicate_acknowledged: false,
  }), "teacher");
  created.teacher = Number(teacher.teacher_id);

  const payload = {
    youtube_playlist_id: YPL,
    source_title: `RAW source | JEE ${RUN}`,
    title: "Newton's Laws of Motion",
    teacher: `Legacy ${RUN}`,
    category_id: r.category, learning_goal_id: r.goal,
    subject_id: r.subject, chapter_id: r.chapter,
    class_labels: ["11th"],
    content_type: "full-course", language: "hinglish", difficulty: "advanced",
    teacher_ids: [created.teacher],
    channel: { name: `Quality Channel ${RUN}`, youtube_channel_id: CHANNEL },
    videos: [{ youtube_video_id: YVID, title: `Raw lecture ${RUN}` }],
  };
  const imported = must(await db.rpc("import_playlist_with_teachers", { payload, mode: "merge" }), "import");
  created.playlist = Number(imported.playlist_id);
  const row = must(await db.from("playlists")
    .select("id,title,source_title,title_review_status,faculty_credit_status,source_title_changed")
    .eq("id", created.playlist).single(), "playlist");
  created.channel = must(await db.from("institutes_channels").select("id").eq("youtube_channel_id", CHANNEL).single(), "channel").id;
  created.video = must(await db.from("videos").select("id").eq("youtube_video_id", YVID).single(), "video").id;
  check("Q3 import preserves raw source separately from the curated title",
    row.title === "Newton's Laws of Motion" && row.source_title === payload.source_title,
    JSON.stringify(row));
  check("Q4 explicit faculty ids create identified credit without name guessing",
    row.faculty_credit_status === "identified");

  const queue = must(await db.rpc("get_content_quality_queue", { p_ready: false, p_limit: 100, p_offset: 0 }), "queue");
  const queued = queue.find((item) => Number(item.playlist_id) === created.playlist);
  check("Q5 a new import stays queued until an editor approves its title",
    queued?.missing_fields?.includes("title-review") && queued?.quality_ready === false,
    JSON.stringify(queued));

  const reviewed = must(await db.rpc("review_playlist_quality", {
    p_playlist_id: created.playlist,
    p_display_title: "Newton's Laws of Motion",
    p_teacher_ids: [created.teacher],
    p_faculty_status: "identified",
    p_content_type: "full-course", p_language: "hinglish", p_difficulty: "advanced",
    p_note: "Reviewed fixture",
  }), "review");
  check("Q6 an explicit complete review makes the course quality-ready",
    reviewed.quality_ready === true && reviewed.missing_fields.length === 0,
    JSON.stringify(reviewed));

  const badIdentity = await db.rpc("review_playlist_quality", {
    p_playlist_id: created.playlist,
    p_display_title: "Invented replacement",
    p_teacher_ids: [999999999], p_faculty_status: "identified",
    p_content_type: "full-course", p_language: "hinglish", p_difficulty: "advanced",
    p_note: "must roll back",
  });
  const afterBad = must(await db.from("playlists").select("title").eq("id", created.playlist).single(), "after invalid teacher");
  check("Q7 an unknown faculty id rejects the whole review before title mutation",
    Boolean(badIdentity.error) && /unknown teacher_id/i.test(badIdentity.error.message) && afterBad.title === "Newton's Laws of Motion",
    badIdentity.error?.message);

  const badTeam = await db.rpc("review_playlist_quality", {
    p_playlist_id: created.playlist, p_display_title: row.title,
    p_teacher_ids: [created.teacher], p_faculty_status: "team",
    p_content_type: "full-course", p_language: "hinglish", p_difficulty: "advanced",
    p_note: "Institute team",
  });
  check("Q8 team credit refuses contradictory individual faculty ids",
    Boolean(badTeam.error) && /team credit cannot carry/i.test(badTeam.error.message), badTeam.error?.message);

  const changed = { ...payload, source_title: `UPDATED raw source ${RUN}`, title: "Untrusted reimport title" };
  delete changed.teacher_ids;
  must(await db.rpc("import_playlist_with_quality", { payload: changed, mode: "merge" }), "reimport changed source");
  const afterSource = must(await db.from("playlists").select("title,source_title,source_title_changed")
    .eq("id", created.playlist).single(), "after source change");
  check("Q9 merge keeps the approved display title but flags a changed source title",
    afterSource.title === "Newton's Laws of Motion" && afterSource.source_title_changed === true
      && afterSource.source_title === changed.source_title,
    JSON.stringify(afterSource));

  const audits = must(await db.from("playlist_quality_reviews").select("id").eq("playlist_id", created.playlist), "audits");
  check("Q10 the successful decision produced one append-only audit row", audits.length === 1, JSON.stringify(audits));
  const anonAudits = await anon.from("playlist_quality_reviews").select("id").eq("playlist_id", created.playlist);
  const auditReadBlocked = (!anonAudits.error && anonAudits.data.length === 0)
    || (anonAudits.error && (anonAudits.error.code === "42501"
      || /permission denied|not authorized/i.test(anonAudits.error.message ?? "")));
  check("Q11 students cannot read editorial audit rows", auditReadBlocked,
    anonAudits.error?.message ?? JSON.stringify(anonAudits.data));

  const anonQueue = await anon.rpc("get_content_quality_queue", { p_ready: false, p_limit: 10, p_offset: 0 });
  check("Q12 anonymous users cannot enter the editorial queue", authRejected(anonQueue), anonQueue.error?.message);
}

async function cleanup() {
  cleanupRan = true;
  if (created.playlist) await db.from("playlists").delete().eq("id", created.playlist);
  if (created.video) await db.from("videos").delete().eq("id", created.video);
  if (created.channel) await db.from("institutes_channels").delete().eq("id", created.channel);
  if (created.teacher) await db.from("teachers").delete().eq("id", created.teacher);
  const counts = {};
  for (const [table, column, value] of [
    ["playlists", "id", created.playlist], ["videos", "id", created.video],
    ["institutes_channels", "id", created.channel], ["teachers", "id", created.teacher],
  ]) {
    if (!value) { counts[table] = 0; continue; }
    const result = await db.from(table).select(column, { count: "exact", head: true }).eq(column, value);
    counts[table] = result.count ?? -1;
  }
  console.log(`Cleanup confirmed: ${JSON.stringify(counts)}`);
}

try {
  await main();
} catch (error) {
  if (error instanceof GuardError) guardFailed = true;
  console.error(`FATAL: ${error.message}`);
  failed++;
} finally {
  if (!guardFailed) await cleanup();
  const report = { run: RUN, passed, failed, guard_failed: guardFailed, cleanup_ran: cleanupRan, results };
  writeFileSync(resolve(root, "content-quality-test-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`report -> content-quality-test-report.json`);
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
