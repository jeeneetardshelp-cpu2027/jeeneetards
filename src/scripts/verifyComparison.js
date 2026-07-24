// Destructive-fixture integration evidence for v8 comparison metadata.
// Run only on a disposable staging project after comparison_staging_delta.sql.
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
if (!URL || !SERVICE || !ANON)
  refuse("Refusing: TEST_SUPABASE_URL, TEST_SERVICE_KEY and TEST_ANON_KEY are required.");
if (production.VITE_SUPABASE_URL && URL === production.VITE_SUPABASE_URL)
  refuse("Refusing: TEST_SUPABASE_URL is the production URL.");

const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const RUN = randomBytes(3).toString("hex");
const CHANNEL = `CMPCH${RUN}`;
const playlistKey = (suffix) => `CMPPL${RUN}${suffix}`;
const videoKey = (n) => `V${RUN}${String(n).padStart(4, "0")}`;

const created = {
  playlists: [], videos: [], topics: [], chapters: [], channel: null,
};
const results = [];
let passed = 0;
let failed = 0;
let fatal = null;
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
const rejected = (result, pattern) => Boolean(result?.error) && pattern.test(result.error.message ?? "");

async function guardEnvironment() {
  const marker = await db.from("app_environment").select("name").maybeSingle();
  if (marker.error) throw new GuardError(`Environment marker unreadable: ${marker.error.message}`);
  if (!["staging", "test"].includes(marker.data?.name))
    throw new GuardError(`Target identifies as ${JSON.stringify(marker.data?.name)}, not staging/test.`);
  console.log(`Target database identifies as ${marker.data.name}. Run ${RUN}.\n`);
}

async function references() {
  const categories = must(await db.from("categories").select("id,slug"), "categories");
  const subjects = must(await db.from("subjects").select("id,slug"), "subjects");
  const chapters = must(await db.from("chapters").select("id,slug,subject_id").order("id"), "chapters");
  const goals = must(await db.from("learning_goals").select("id,slug"), "learning goals");
  const physics = subjects.find((row) => row.slug === "physics");
  const physicsChapters = chapters.filter((row) => Number(row.subject_id) === Number(physics?.id));
  const refs = {
    category: categories.find((row) => row.slug === "jee")?.id,
    subject: physics?.id,
    chapter: physicsChapters[0]?.id,
    goal: goals.find((row) => row.slug === "jee")?.id,
  };
  for (const [key, value] of Object.entries(refs))
    if (!value) throw new Error(`Staging bootstrap is missing reference: ${key}`);
  return refs;
}

async function insertOne(table, row, label) {
  const data = must(await db.from(table).insert(row).select("id").single(), label);
  return Number(data.id);
}

async function main() {
  await guardEnvironment();
  const refs = await references();
  const now = new Date().toISOString();

  // The verifier owns its cross-chapter fixture. Requiring staging to happen
  // to contain a second Physics chapter made the test fail before it tested
  // the RPC, and made a sparse-but-valid staging seed look broken.
  refs.otherChapter = await insertOne("chapters", {
    subject_id: refs.subject,
    name: `Comparison control chapter ${RUN}`,
    slug: `comparison-control-${RUN}`,
    display_order: 9999,
  }, "control chapter");
  created.chapters.push(refs.otherChapter);

  created.channel = await insertOne("institutes_channels", {
    name: `Comparison verification ${RUN}`,
    youtube_channel_id: CHANNEL,
  }, "fixture channel");

  const makePlaylist = async (suffix, title) => {
    const id = await insertOne("playlists", {
      title,
      teacher: `Teacher ${suffix}`,
      channel_id: created.channel,
      category_id: refs.category,
      subject_id: refs.subject,
      youtube_playlist_id: playlistKey(suffix),
      class_levels: ["11th"],
      language: "hinglish",
      content_type: "full-course",
      difficulty: "intermediate",
      last_verified_at: now,
    }, `playlist ${suffix}`);
    created.playlists.push(id);
    return id;
  };
  const playlistA = await makePlaylist("A", `Verified comparison A ${RUN}`);
  const playlistB = await makePlaylist("B", `Proposed comparison B ${RUN}`);
  const playlistC = await makePlaylist("C", `Wrong chapter C ${RUN}`);

  const makeVideo = async (n, chapterId, duration) => {
    const id = await insertOne("videos", {
      youtube_video_id: videoKey(n),
      title: `Comparison video ${n} ${RUN}`,
      channel_id: created.channel,
      category_id: refs.category,
      subject_id: refs.subject,
      chapter_id: chapterId,
      duration_seconds: duration,
      embedding_status: "embeddable",
      last_verified_at: now,
    }, `video ${n}`);
    created.videos.push(id);
    return id;
  };
  const videoA1 = await makeVideo(1, refs.chapter, 600);
  const videoA2 = await makeVideo(2, refs.chapter, 900);
  const videoB1 = await makeVideo(3, refs.chapter, null);
  const videoC1 = await makeVideo(4, refs.otherChapter, 300);

  must(await db.from("playlist_videos").insert([
    { playlist_id: playlistA, video_id: videoA1, position: 1 },
    { playlist_id: playlistA, video_id: videoA2, position: 2 },
    { playlist_id: playlistB, video_id: videoB1, position: 1 },
    { playlist_id: playlistC, video_id: videoC1, position: 1 },
  ]), "playlist links");

  for (let index = 1; index <= 3; index++) {
    const topic = await insertOne("topics", {
      chapter_id: refs.chapter,
      name: `Comparison topic ${RUN} ${index}`,
      slug: `comparison-${RUN}-${index}`,
      display_order: index,
    }, `topic ${index}`);
    created.topics.push(topic);
  }
  must(await db.from("learning_goal_topics").insert(created.topics.map((topic_id) => ({
    learning_goal_id: refs.goal, topic_id, is_required: true,
  }))), "goal topics");

  must(await db.from("video_topics").insert([
    { video_id: videoA1, topic_id: created.topics[0], coverage_kind: "theory", review_status: "verified", verified_at: now },
    { video_id: videoA2, topic_id: created.topics[1], coverage_kind: "practice", review_status: "verified", verified_at: now },
    { video_id: videoB1, topic_id: created.topics[0], coverage_kind: "theory", review_status: "proposed" },
  ]), "video topics");

  must(await db.from("playlist_attributes").insert([
    {
      playlist_id: playlistA, pacing: "slow", theory_percentage: 70,
      prerequisites_level: "basic", completeness_status: "complete",
      best_for: "Students building a careful foundation", review_status: "verified",
      source: "editorial-review", verified_at: now,
    },
    {
      playlist_id: playlistB, pacing: "fast", theory_percentage: 20,
      prerequisites_level: "advanced", completeness_status: "complete",
      best_for: "This proposed claim must remain private", review_status: "proposed",
      source: "editorial-review",
    },
  ]), "playlist attributes");

  const existing = must(await db.from("playlists").select("id").order("id", { ascending: false }).limit(1), "max playlist id");
  const missingId = Number(existing[0]?.id ?? 0) + 1000000;
  const requested = [playlistB, missingId, playlistA, playlistC];
  const comparison = must(await anon.rpc("get_playlist_comparison", {
    p_playlist_ids: requested,
    p_chapter_id: refs.chapter,
    p_learning_goal_id: refs.goal,
  }), "anonymous comparison");

  check("C1 anonymous comparison preserves requested order",
    comparison.length === 4 && comparison.every((row, index) => Number(row.playlist_id) === requested[index]),
    JSON.stringify(comparison));
  check("C2 missing and cross-chapter courses remain explicit",
    comparison.map((row) => row.course_status).join(",") === "ok,not-found,ok,wrong-chapter",
    JSON.stringify(comparison.map((row) => row.course_status)));

  const rowA = comparison.find((row) => Number(row.playlist_id) === playlistA);
  const rowB = comparison.find((row) => Number(row.playlist_id) === playlistB);
  const missing = comparison.find((row) => Number(row.playlist_id) === missingId);
  check("C3 lecture count and complete duration are derived",
    Number(rowA.chapter_lecture_count) === 2 && Number(rowA.chapter_duration_seconds) === 1500,
    JSON.stringify(rowA));
  check("C4 incomplete duration stays unknown instead of becoming zero",
    Number(rowB.chapter_lecture_count) === 1 && rowB.chapter_duration_seconds === null,
    JSON.stringify(rowB));
  check("C5 verified editorial attributes are public",
    rowA.pacing === "slow" && Number(rowA.theory_percentage) === 70 &&
      rowA.prerequisites_level === "basic" && rowA.completeness_status === "complete",
    JSON.stringify(rowA));
  check("C6 proposed editorial claims are invisible",
    rowB.pacing === null && rowB.theory_percentage === null &&
      rowB.prerequisites_level === null && rowB.completeness_status === null && rowB.best_for === null,
    JSON.stringify(rowB));
  check("C7 coverage uses the reviewed chapter + goal denominator",
    Number(rowA.coverage_mapped_topics) === 2 && Number(rowA.coverage_required_topics) === 3 &&
      Number(rowA.syllabus_coverage_pct) === 66.67,
    JSON.stringify(rowA));
  check("C8 proposed topic mappings do not affect coverage",
    Number(rowB.coverage_mapped_topics) === 0 && Number(rowB.coverage_required_topics) === 3 &&
      Number(rowB.syllabus_coverage_pct) === 0,
    JSON.stringify(rowB));
  check("C9 a missing course has no invented values",
    missing.title === null && missing.chapter_lecture_count === null &&
      missing.chapter_duration_seconds === null && missing.syllabus_coverage_pct === null,
    JSON.stringify(missing));

  const noGoal = must(await anon.rpc("get_playlist_comparison", {
    p_playlist_ids: [playlistA], p_chapter_id: refs.chapter, p_learning_goal_id: null,
  }), "comparison without goal");
  check("C10 coverage is unknown without a learning-goal context",
    noGoal[0].coverage_mapped_topics === null && noGoal[0].coverage_required_topics === null &&
      noGoal[0].syllabus_coverage_pct === null,
    JSON.stringify(noGoal[0]));

  const attributesLeak = await anon.from("playlist_attributes").select("playlist_id,pacing");
  const topicsLeak = await anon.from("video_topics").select("video_id,topic_id,review_status");
  check("C11 raw editorial tables are not readable anonymously",
    Boolean(attributesLeak.error) && Boolean(topicsLeak.error),
    JSON.stringify([attributesLeak.error?.message, topicsLeak.error?.message]));

  must(await db.from("video_topics").update({ review_status: "verified", verified_at: now })
    .eq("video_id", videoB1).eq("topic_id", created.topics[0]), "verify proposed topic");
  const afterReview = must(await anon.rpc("get_playlist_comparison", {
    p_playlist_ids: [playlistB], p_chapter_id: refs.chapter, p_learning_goal_id: refs.goal,
  }), "comparison after topic review");
  check("C12 an explicit review changes coverage, without changing the playlist",
    Number(afterReview[0].coverage_mapped_topics) === 1 &&
      Number(afterReview[0].syllabus_coverage_pct) === 33.33,
    JSON.stringify(afterReview[0]));

  const duplicate = await anon.rpc("get_playlist_comparison", {
    p_playlist_ids: [playlistA, playlistA], p_chapter_id: refs.chapter, p_learning_goal_id: refs.goal,
  });
  check("C13 duplicate ids are rejected specifically",
    rejected(duplicate, /must not contain duplicates/i), duplicate.error?.message ?? "no error");
  const overflow = await anon.rpc("get_playlist_comparison", {
    p_playlist_ids: [1, 2, 3, 4, 5], p_chapter_id: refs.chapter, p_learning_goal_id: refs.goal,
  });
  check("C14 more than four ids are rejected specifically",
    rejected(overflow, /at most 4/i), overflow.error?.message ?? "no error");
  const badChapter = await anon.rpc("get_playlist_comparison", {
    p_playlist_ids: [playlistA], p_chapter_id: -1, p_learning_goal_id: refs.goal,
  });
  check("C15 invalid chapter context is rejected specifically",
    rejected(badChapter, /valid chapter_id/i), badChapter.error?.message ?? "no error");

  console.log(`\n${passed} passed, ${failed} failed`);
}

async function cleanup() {
  if (created.playlists.length)
    must(await db.from("playlists").delete().in("id", created.playlists), "cleanup playlists");
  if (created.videos.length)
    must(await db.from("videos").delete().in("id", created.videos), "cleanup videos");
  if (created.topics.length)
    must(await db.from("topics").delete().in("id", created.topics), "cleanup topics");
  if (created.chapters.length)
    must(await db.from("chapters").delete().in("id", created.chapters), "cleanup chapters");
  if (created.channel)
    must(await db.from("institutes_channels").delete().eq("id", created.channel), "cleanup channel");

  const residue = {
    playlists: created.playlists.length
      ? must(await db.from("playlists").select("id").in("id", created.playlists), "verify playlists cleanup").length : 0,
    videos: created.videos.length
      ? must(await db.from("videos").select("id").in("id", created.videos), "verify videos cleanup").length : 0,
    topics: created.topics.length
      ? must(await db.from("topics").select("id").in("id", created.topics), "verify topics cleanup").length : 0,
    chapters: created.chapters.length
      ? must(await db.from("chapters").select("id").in("id", created.chapters), "verify chapters cleanup").length : 0,
    channel: created.channel
      ? must(await db.from("institutes_channels").select("id").eq("id", created.channel), "verify channel cleanup").length : 0,
  };
  if (Object.values(residue).some(Boolean)) throw new Error(`cleanup residue: ${JSON.stringify(residue)}`);
  cleanupRan = true;
  console.log(`Cleanup confirmed: ${JSON.stringify(residue)}`);
}

main().catch((error) => {
  fatal = error?.message ?? String(error);
  guardFailed = error instanceof GuardError;
  failed++;
  console.error(guardFailed ? fatal : `FATAL: ${fatal}`);
}).finally(async () => {
  if (guardFailed) {
    console.error("Cleanup skipped: environment guard failed before fixtures were created.");
  } else {
    try { await cleanup(); }
    catch (error) { fatal = `cleanup failed: ${error.message}`; failed++; console.error(fatal); }
  }
  writeFileSync(resolve(root, "comparison-test-report.json"), JSON.stringify({
    run: RUN, target: URL, when: new Date().toISOString(),
    passed, failed, fatal, guard_failed: guardFailed, cleanup_ran: cleanupRan, results,
  }, null, 2));
  console.log("report -> comparison-test-report.json");
  process.exitCode = guardFailed ? 2 : failed ? 1 : 0;
});
