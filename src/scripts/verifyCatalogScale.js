// Destructive performance evidence for the production catalogue query shape.
// This creates a large, uniquely identified fixture ONLY on a disposable
// staging/test project, measures anonymous requests, and removes every row.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  boundedInteger, chunks, scaleVideoKey, timingSummary,
} from "./catalogScaleUtils.js";

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
// `set NAME=value && command` in Windows CMD can retain the space before `&&`
// in the value. Environment-file values are already trimmed by readEnv; apply
// the same rule to one-shot process overrides so an explicit `1 ` is not
// mistaken for missing authorization.
const cfg = (key) => {
  const value = process.env[key] ?? staging[key];
  return typeof value === "string" ? value.trim() : value;
};
const URL = cfg("TEST_SUPABASE_URL");
const SERVICE = cfg("TEST_SERVICE_KEY");
const ANON = cfg("TEST_ANON_KEY");
const refuse = (message) => { console.error(message); process.exit(2); };

if (cfg("TEST_ALLOW") !== "1") refuse("Refusing: set TEST_ALLOW=1 in .env.staging.");
if (cfg("SCALE_ALLOW") !== "1")
  refuse("Refusing: set SCALE_ALLOW=1 for this disposable-staging scale run.");
if (!URL || !SERVICE || !ANON)
  refuse("Refusing: TEST_SUPABASE_URL, TEST_SERVICE_KEY and TEST_ANON_KEY are required.");
if (production.VITE_SUPABASE_URL && URL === production.VITE_SUPABASE_URL)
  refuse("Refusing: TEST_SUPABASE_URL is the production URL.");

let PLAYLISTS;
let VIDEOS_PER_PLAYLIST;
let CHANNELS;
let CHAPTERS;
let TEACHERS;
let SAMPLES;
let CATALOG_BUDGET;
let FACET_BUDGET;
let PAGE_BUDGET;
try {
  PLAYLISTS = boundedInteger(cfg("SCALE_PLAYLISTS"), 1000,
    { name: "SCALE_PLAYLISTS", min: 100, max: 5000 });
  VIDEOS_PER_PLAYLIST = boundedInteger(cfg("SCALE_VIDEOS_PER_PLAYLIST"), 10,
    { name: "SCALE_VIDEOS_PER_PLAYLIST", min: 1, max: 30 });
  CHANNELS = boundedInteger(cfg("SCALE_CHANNELS"), 20,
    { name: "SCALE_CHANNELS", min: 2, max: 100 });
  CHAPTERS = boundedInteger(cfg("SCALE_CHAPTERS"), 50,
    { name: "SCALE_CHAPTERS", min: 2, max: 200 });
  TEACHERS = boundedInteger(cfg("SCALE_TEACHERS"), 200,
    { name: "SCALE_TEACHERS", min: 2, max: 1000 });
  SAMPLES = boundedInteger(cfg("SCALE_SAMPLES"), 7,
    { name: "SCALE_SAMPLES", min: 3, max: 20 });
  CATALOG_BUDGET = boundedInteger(cfg("SCALE_CATALOG_P95_MS"), 1200,
    { name: "SCALE_CATALOG_P95_MS", min: 100, max: 10000 });
  FACET_BUDGET = boundedInteger(cfg("SCALE_FACET_P95_MS"), 1800,
    { name: "SCALE_FACET_P95_MS", min: 100, max: 15000 });
  PAGE_BUDGET = boundedInteger(cfg("SCALE_PAGE_P95_MS"), 1200,
    { name: "SCALE_PAGE_P95_MS", min: 100, max: 10000 });
} catch (error) {
  refuse(`Refusing: ${error.message}`);
}

const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const RUN = randomBytes(3).toString("hex");
const PAGE_SIZE = 12;
const BATCH = 500;
const created = { playlists: [], videos: [], chapters: [], channels: [] };
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
const find = (rows, slug, label) => {
  const value = rows.find((row) => row.slug === slug)?.id;
  if (!value) throw new Error(`Staging bootstrap is missing reference: ${label}`);
  return Number(value);
};

async function guardEnvironment() {
  const marker = await db.from("app_environment").select("name").maybeSingle();
  if (marker.error) throw new GuardError(`Environment marker unreadable: ${marker.error.message}`);
  if (!["staging", "test"].includes(marker.data?.name))
    throw new GuardError(`Target identifies as ${JSON.stringify(marker.data?.name)}, not staging/test.`);
  console.log(`Target database identifies as ${marker.data.name}. Scale run ${RUN}.`);
  console.log(`Fixture: ${PLAYLISTS} playlists, ${PLAYLISTS * VIDEOS_PER_PLAYLIST} videos, ` +
    `${CHANNELS} channels, ${CHAPTERS} chapters, ${TEACHERS} teacher labels.\n`);
}

async function insertRows(table, rows, returning, label) {
  const out = [];
  let number = 0;
  for (const batch of chunks(rows, BATCH)) {
    number++;
    let query = db.from(table).insert(batch);
    if (returning) query = query.select(returning);
    const data = must(await query, `${label} batch ${number}`);
    if (returning) out.push(...(data ?? []));
  }
  return out;
}

async function deleteIds(table, ids, label) {
  let number = 0;
  for (const batch of chunks(ids, BATCH)) {
    number++;
    must(await db.from(table).delete().in("id", batch), `${label} batch ${number}`);
  }
}

async function remaining(table, ids, label) {
  let count = 0;
  let number = 0;
  for (const batch of chunks(ids, BATCH)) {
    number++;
    count += must(await db.from(table).select("id").in("id", batch),
      `${label} batch ${number}`).length;
  }
  return count;
}

async function measure(label, run, budget) {
  // Two warm requests keep connection/TLS setup out of the database budget.
  await run();
  await run();
  const values = [];
  for (let index = 0; index < SAMPLES; index++) {
    const start = performance.now();
    await run();
    values.push(performance.now() - start);
  }
  const summary = timingSummary(values);
  check(`${label} p95 stays within ${budget} ms`, summary.p95_ms <= budget,
    JSON.stringify(summary));
  return summary;
}

function browsePage({ goalId, classSlug, subjectId, chapterId, search, page = 0 }) {
  const cols =
    "id,title,teacher,average_rating,ratings_count,language,content_type,difficulty," +
    "class_levels,institutes_channels(name),subjects(name),playlist_videos(count)" +
    (goalId ? ",playlist_learning_goals!inner(learning_goal_id)" : "") +
    (classSlug ? ",pcl:playlist_class_levels!inner(class_levels!inner(slug))" : "") +
    (chapterId ? ",pv:playlist_videos!inner(videos!inner(chapter_id))" : "");
  let query = anon.from("playlists").select(cols, { count: "exact" })
    .order("ratings_count", { ascending: false }).order("title").order("id")
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (goalId) query = query.eq("playlist_learning_goals.learning_goal_id", goalId);
  if (classSlug) query = query.eq("pcl.class_levels.slug", classSlug);
  if (subjectId) query = query.eq("subject_id", subjectId);
  if (chapterId) query = query.eq("pv.videos.chapter_id", chapterId);
  if (search) query = query.ilike("title", `%${search}%`);
  return query;
}

async function seed() {
  const categories = must(await db.from("categories").select("id,slug"), "categories");
  const subjects = must(await db.from("subjects").select("id,slug"), "subjects");
  const goals = must(await db.from("learning_goals").select("id,slug"), "learning goals");
  const classes = must(await db.from("class_levels").select("id,slug"), "class levels");
  const refs = {
    jeeCategory: find(categories, "jee", "jee category"),
    physics: find(subjects, "physics", "physics subject"),
    jee: find(goals, "jee", "jee learning goal"),
    neet: find(goals, "neet", "neet learning goal"),
    class11: find(classes, "class-11", "class-11"),
    class12: find(classes, "class-12", "class-12"),
  };

  const channelRows = Array.from({ length: CHANNELS }, (_, index) => ({
    name: `Scale institute ${RUN} ${index + 1}`,
    youtube_channel_id: `SCALECH${RUN}${String(index).padStart(3, "0")}`,
  }));
  const insertedChannels = await insertRows("institutes_channels", channelRows,
    "id,youtube_channel_id", "channels");
  created.channels.push(...insertedChannels.map((row) => Number(row.id)));

  const chapterRows = Array.from({ length: CHAPTERS }, (_, index) => ({
    subject_id: refs.physics,
    name: `Scale chapter ${RUN} ${index + 1}`,
    slug: `scale-${RUN}-${index + 1}`,
    display_order: 8000 + index,
  }));
  const insertedChapters = await insertRows("chapters", chapterRows, "id,slug", "chapters");
  created.chapters.push(...insertedChapters.map((row) => Number(row.id)));

  const playlistRows = Array.from({ length: PLAYLISTS }, (_, index) => ({
    title: `Scale ${RUN} course ${String(index + 1).padStart(4, "0")}`,
    teacher: `Scale Teacher ${String(index % TEACHERS + 1).padStart(3, "0")}`,
    channel_id: created.channels[index % created.channels.length],
    category_id: refs.jeeCategory,
    subject_id: refs.physics,
    youtube_playlist_id: `SCALEPL${RUN}${String(index).padStart(5, "0")}`,
    class_levels: [],
    language: ["hinglish", "hindi", "english"][index % 3],
    content_type: ["full-course", "revision", "one-shot"][index % 3],
    difficulty: ["beginner", "intermediate", "advanced"][index % 3],
  }));
  const insertedPlaylists = await insertRows("playlists", playlistRows,
    "id,youtube_playlist_id", "playlists");
  const playlistByKey = new Map(insertedPlaylists.map((row) => [row.youtube_playlist_id, Number(row.id)]));
  const playlistIds = playlistRows.map((row) => playlistByKey.get(row.youtube_playlist_id));
  if (playlistIds.some((id) => !id)) throw new Error("Playlist insert did not return every fixture id");
  created.playlists.push(...playlistIds);

  const goalRows = [];
  const classRows = [];
  const videoRows = [];
  const videoOwner = [];
  for (let playlistIndex = 0; playlistIndex < PLAYLISTS; playlistIndex++) {
    const playlistId = playlistIds[playlistIndex];
    goalRows.push({
      playlist_id: playlistId,
      learning_goal_id: playlistIndex % 4 === 3 ? refs.neet : refs.jee,
    });
    const primaryClass = playlistIndex % 2 === 0 ? refs.class11 : refs.class12;
    classRows.push({ playlist_id: playlistId, class_level_id: primaryClass });
    if (playlistIndex % 10 === 0)
      classRows.push({
        playlist_id: playlistId,
        class_level_id: primaryClass === refs.class11 ? refs.class12 : refs.class11,
      });
    const chapterId = created.chapters[playlistIndex % created.chapters.length];
    for (let position = 0; position < VIDEOS_PER_PLAYLIST; position++) {
      const videoIndex = playlistIndex * VIDEOS_PER_PLAYLIST + position;
      videoRows.push({
        youtube_video_id: scaleVideoKey(RUN, videoIndex),
        title: `Scale ${RUN} lecture ${videoIndex + 1}`,
        channel_id: created.channels[playlistIndex % created.channels.length],
        category_id: refs.jeeCategory,
        subject_id: refs.physics,
        chapter_id: chapterId,
        duration_seconds: 600 + (position % 10) * 60,
        embedding_status: "embeddable",
      });
      videoOwner.push({ playlistId, position: position + 1 });
    }
  }

  const insertedVideos = await insertRows("videos", videoRows, "id,youtube_video_id", "videos");
  const videoByKey = new Map(insertedVideos.map((row) => [row.youtube_video_id, Number(row.id)]));
  const videoIds = videoRows.map((row) => videoByKey.get(row.youtube_video_id));
  if (videoIds.some((id) => !id)) throw new Error("Video insert did not return every fixture id");
  created.videos.push(...videoIds);

  const playlistVideoRows = videoIds.map((video_id, index) => ({
    playlist_id: videoOwner[index].playlistId,
    video_id,
    position: videoOwner[index].position,
  }));
  await insertRows("playlist_videos", playlistVideoRows, null, "playlist videos");
  await insertRows("playlist_learning_goals", goalRows, null, "playlist goals");
  await insertRows("playlist_class_levels", classRows, null, "playlist classes");
  console.log("Fixture inserted. Measuring anonymous student queries...\n");
  return { ...refs, targetChapter: created.chapters[0], targetChapterSlug: `scale-${RUN}-1` };
}

async function main() {
  await guardEnvironment();
  const refs = await seed();
  const expectedTarget = Array.from({ length: PLAYLISTS }, (_, index) => index)
    .filter((index) => index % CHAPTERS === 0 && index % 4 !== 3 && index % 2 === 0).length;

  let lastCurriculum;
  const curriculumTiming = await measure("JEE Class 11 chapter navigation", async () => {
    lastCurriculum = must(await anon.rpc("get_browse_curriculum", {
      p_goal: "jee", p_class: "class-11", p_subject: "physics",
    }), "chapter curriculum");
  }, CATALOG_BUDGET);
  const target = lastCurriculum.find((row) => Number(row.entity_id) === refs.targetChapter);
  check("curriculum remains bounded and target count is distinct",
    lastCurriculum.length <= CHAPTERS + 20 && Number(target?.course_count) === expectedTarget,
    `rows=${lastCurriculum.length} target=${target?.course_count} expected=${expectedTarget}`);

  let lastFacets;
  const facetTiming = await measure("contextual facet aggregation", async () => {
    lastFacets = must(await anon.rpc("browse_facet_counts", {
      p_goal: "jee", p_class: "class-11", p_subject: "physics",
      p_chapter: refs.targetChapterSlug, p_channel: null,
      p_language: null, p_type: null, p_difficulty: null, p_search: RUN,
    }), "facet counts");
  }, FACET_BUDGET);
  check("facet response is bounded and non-vacuous",
    lastFacets.length > 0 && lastFacets.length <= 200 &&
      lastFacets.some((row) => Number(row.n) > 0),
    `rows=${lastFacets.length}`);

  let firstPage;
  const pageTiming = await measure("filtered 12-course page with exact count", async () => {
    firstPage = await browsePage({
      goalId: refs.jee, classSlug: "class-11", subjectId: refs.physics,
      chapterId: refs.targetChapter, search: RUN, page: 0,
    });
    must(firstPage, "filtered page");
  }, PAGE_BUDGET);
  const firstIds = (firstPage.data ?? []).map((row) => Number(row.id));
  check("page is server-bounded, unique, and reports the full matching count",
    firstIds.length <= PAGE_SIZE && new Set(firstIds).size === firstIds.length &&
      Number(firstPage.count) === expectedTarget,
    `rows=${firstIds.length} unique=${new Set(firstIds).size} count=${firstPage.count} expected=${expectedTarget}`);

  const secondPage = await browsePage({
    goalId: refs.jee, classSlug: "class-11", subjectId: refs.physics,
    chapterId: refs.targetChapter, search: RUN, page: 1,
  });
  must(secondPage, "second page");
  const secondIds = (secondPage.data ?? []).map((row) => Number(row.id));
  check("stable ordering prevents duplicates across adjacent pages",
    secondIds.every((id) => !firstIds.includes(id)),
    `page0=${firstIds.length} page1=${secondIds.length}`);

  const searchTiming = await measure("leading-wildcard catalogue search", async () => {
    const page = await browsePage({ search: RUN, page: 0 });
    must(page, "search page");
    if (Number(page.count) !== PLAYLISTS)
      throw new Error(`search count=${page.count}, expected=${PLAYLISTS}`);
  }, PAGE_BUDGET);

  results.push({
    metric: "timings",
    curriculum: curriculumTiming,
    facets: facetTiming,
    filtered_page: pageTiming,
    wildcard_search: searchTiming,
  });
  console.log(`\n${passed} passed, ${failed} failed`);
}

async function cleanup() {
  await deleteIds("playlists", created.playlists, "cleanup playlists");
  await deleteIds("videos", created.videos, "cleanup videos");
  await deleteIds("chapters", created.chapters, "cleanup chapters");
  await deleteIds("institutes_channels", created.channels, "cleanup channels");
  const residue = {
    playlists: await remaining("playlists", created.playlists, "verify playlist cleanup"),
    videos: await remaining("videos", created.videos, "verify video cleanup"),
    chapters: await remaining("chapters", created.chapters, "verify chapter cleanup"),
    channels: await remaining("institutes_channels", created.channels, "verify channel cleanup"),
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
  writeFileSync(resolve(root, "catalog-scale-report.json"), JSON.stringify({
    run: RUN, target: URL, when: new Date().toISOString(),
    fixture: {
      playlists: PLAYLISTS, videos: PLAYLISTS * VIDEOS_PER_PLAYLIST,
      channels: CHANNELS, chapters: CHAPTERS, teacher_labels: TEACHERS,
    },
    budgets_ms: { curriculum_p95: CATALOG_BUDGET, facets_p95: FACET_BUDGET, page_p95: PAGE_BUDGET },
    passed, failed, fatal, guard_failed: guardFailed, cleanup_ran: cleanupRan, results,
  }, null, 2));
  console.log("report -> catalog-scale-report.json");
  process.exitCode = guardFailed ? 2 : failed ? 1 : 0;
});
