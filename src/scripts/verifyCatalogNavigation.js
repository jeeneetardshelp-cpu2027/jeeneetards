// Destructive-fixture evidence for v9 bounded curriculum navigation/facets.
// Run only on disposable staging after catalog_navigation_staging_delta.sql.
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
const CHANNEL = `NAVCH${RUN}`;
const playlistKey = (suffix) => `NAVPL${RUN}${suffix}`;
const videoKey = (n) => `N${RUN}${String(n).padStart(4, "0")}`;

const created = { playlists: [], videos: [], chapters: [], channel: null };
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
const bySlug = (rows, slug) => rows.find((row) => row.slug === slug);
const facetMap = (rows) => {
  const out = {};
  for (const row of rows ?? []) {
    out[row.facet] ??= {};
    out[row.facet][row.value] = Number(row.n);
  }
  return out;
};

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
  const goals = must(await db.from("learning_goals").select("id,slug"), "learning goals");
  const classes = must(await db.from("class_levels").select("id,slug"), "class levels");
  const refs = {
    jeeCategory: bySlug(categories, "jee")?.id,
    neetCategory: bySlug(categories, "neet")?.id,
    physics: bySlug(subjects, "physics")?.id,
    chemistry: bySlug(subjects, "chemistry")?.id,
    biology: bySlug(subjects, "biology")?.id,
    jee: bySlug(goals, "jee")?.id,
    neet: bySlug(goals, "neet")?.id,
    class11: bySlug(classes, "class-11")?.id,
    class12: bySlug(classes, "class-12")?.id,
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
  const r = await references();
  const now = new Date().toISOString();

  // Capture the existing staging state before fixtures. Assertions below use
  // deltas, so permanent drift fixtures or later editorial content cannot
  // make an otherwise-correct verification fail (or pass) by coincidence.
  const baselineGoals = must(await anon.rpc("get_browse_curriculum", {
    p_goal: null, p_class: null, p_subject: null,
  }), "baseline goals");
  const baselineGoalCounts = Object.fromEntries(
    baselineGoals.map((row) => [row.slug, Number(row.course_count)]),
  );
  const baselineJeeSubjects = must(await anon.rpc("get_browse_curriculum", {
    p_goal: "jee", p_class: null, p_subject: null,
  }), "baseline JEE subjects");
  const baselineJeeSubjectCounts = Object.fromEntries(
    baselineJeeSubjects.map((row) => [row.slug, Number(row.course_count)]),
  );
  const baselineJee11Subjects = must(await anon.rpc("get_browse_curriculum", {
    p_goal: "jee", p_class: "class-11", p_subject: null,
  }), "baseline JEE class 11 subjects");
  const baselineJee11Counts = Object.fromEntries(
    baselineJee11Subjects.map((row) => [row.slug, Number(row.course_count)]),
  );

  for (const [slug, subject, name] of [
    ["physics", r.physics, "Physics"],
    ["chemistry", r.chemistry, "Chemistry"],
    ["biology", r.biology, "Biology"],
  ]) {
    const id = await insertOne("chapters", {
      subject_id: subject,
      name: `${name} navigation fixture ${RUN}`,
      slug: `nav-${slug}-${RUN}`,
      display_order: 9998,
    }, `${slug} chapter`);
    created.chapters.push(id);
  }
  const [physicsChapter, chemistryChapter, biologyChapter] = created.chapters;

  created.channel = await insertOne("institutes_channels", {
    name: `Navigation verification ${RUN}`,
    youtube_channel_id: CHANNEL,
  }, "fixture channel");

  const specs = [
    { key: "A", title: `JEE 11 Physics ${RUN}`, category: r.jeeCategory, subject: r.physics,
      chapter: physicsChapter, goals: [r.jee], classes: [r.class11],
      language: "hinglish", type: "full-course", difficulty: "intermediate" },
    { key: "B", title: `JEE 12 Chemistry ${RUN}`, category: r.jeeCategory, subject: r.chemistry,
      chapter: chemistryChapter, goals: [r.jee], classes: [r.class12],
      language: "english", type: "revision", difficulty: "advanced" },
    { key: "C", title: `NEET 11 Biology ${RUN}`, category: r.neetCategory, subject: r.biology,
      chapter: biologyChapter, goals: [r.neet], classes: [r.class11],
      language: "hindi", type: "full-course", difficulty: "beginner" },
    { key: "D", title: `Shared 11 12 Physics ${RUN}`, category: r.jeeCategory, subject: r.physics,
      chapter: physicsChapter, goals: [r.jee, r.neet], classes: [r.class11, r.class12],
      language: "hinglish", type: "one-shot", difficulty: "advanced" },
    { key: "E", title: `Untagged JEE Physics ${RUN}`, category: r.jeeCategory, subject: r.physics,
      chapter: physicsChapter, goals: [r.jee], classes: [],
      language: "hinglish", type: "full-course", difficulty: "intermediate" },
  ];

  for (let index = 0; index < specs.length; index++) {
    const spec = specs[index];
    const playlist = await insertOne("playlists", {
      title: spec.title,
      teacher: `Navigation Teacher ${spec.key}`,
      channel_id: created.channel,
      category_id: spec.category,
      subject_id: spec.subject,
      youtube_playlist_id: playlistKey(spec.key),
      class_levels: [],
      language: spec.language,
      content_type: spec.type,
      difficulty: spec.difficulty,
      last_verified_at: now,
    }, `playlist ${spec.key}`);
    created.playlists.push(playlist);

    const video = await insertOne("videos", {
      youtube_video_id: videoKey(index + 1),
      title: `Navigation video ${spec.key} ${RUN}`,
      channel_id: created.channel,
      category_id: spec.category,
      subject_id: spec.subject,
      chapter_id: spec.chapter,
      duration_seconds: 600,
      embedding_status: "embeddable",
      last_verified_at: now,
    }, `video ${spec.key}`);
    created.videos.push(video);

    must(await db.from("playlist_videos").insert({ playlist_id: playlist, video_id: video, position: 1 }),
      `playlist video ${spec.key}`);
    must(await db.from("playlist_learning_goals").insert(spec.goals.map((learning_goal_id) => ({
      playlist_id: playlist, learning_goal_id,
    }))), `playlist goals ${spec.key}`);
    if (spec.classes.length)
      must(await db.from("playlist_class_levels").insert(spec.classes.map((class_level_id) => ({
        playlist_id: playlist, class_level_id,
      }))), `playlist classes ${spec.key}`);
  }

  const goals = must(await anon.rpc("get_browse_curriculum", {
    p_goal: null, p_class: null, p_subject: null,
  }), "goal curriculum");
  const goalCounts = Object.fromEntries(goals.map((row) => [row.slug, Number(row.course_count)]));
  check("N1 anonymous curriculum returns bounded goal counts",
    goalCounts.jee - (baselineGoalCounts.jee ?? 0) === 4 &&
      goalCounts.neet - (baselineGoalCounts.neet ?? 0) === 2 &&
      goals.every((row) => row.level === "goal"),
    JSON.stringify(goals));

  const jeeSubjects = must(await anon.rpc("get_browse_curriculum", {
    p_goal: "jee", p_class: null, p_subject: null,
  }), "JEE subjects");
  const jeeSubjectCounts = Object.fromEntries(jeeSubjects.map((row) => [row.slug, Number(row.course_count)]));
  check("N2 JEE subject navigation is non-vacuous and excludes Biology",
    jeeSubjectCounts.physics - (baselineJeeSubjectCounts.physics ?? 0) === 3 &&
      jeeSubjectCounts.chemistry - (baselineJeeSubjectCounts.chemistry ?? 0) === 1 &&
      (jeeSubjectCounts.biology ?? 0) - (baselineJeeSubjectCounts.biology ?? 0) === 0,
    JSON.stringify(jeeSubjects));

  const jee11Subjects = must(await anon.rpc("get_browse_curriculum", {
    p_goal: "jee", p_class: "class-11", p_subject: null,
  }), "JEE class 11 subjects");
  const jee11Counts = Object.fromEntries(jee11Subjects.map((row) => [row.slug, Number(row.course_count)]));
  check("N3 selected class removes branches populated only for another class",
    jee11Counts.physics - (baselineJee11Counts.physics ?? 0) === 2 &&
      (jee11Counts.chemistry ?? 0) - (baselineJee11Counts.chemistry ?? 0) === 0 &&
      (jee11Counts.biology ?? 0) - (baselineJee11Counts.biology ?? 0) === 0,
    JSON.stringify(jee11Subjects));

  const chapters = must(await anon.rpc("get_browse_curriculum", {
    p_goal: "jee", p_class: "class-11", p_subject: "physics",
  }), "JEE Physics chapters");
  const fixtureChapter = chapters.find((row) => Number(row.entity_id) === physicsChapter);
  check("N4 chapter navigation returns distinct course counts, not raw video rows",
    Number(fixtureChapter?.course_count) === 2 && chapters.every((row) => row.level === "chapter"),
    JSON.stringify(chapters));

  const allFacets = facetMap(must(await anon.rpc("browse_facet_counts", {
    p_goal: null, p_class: null, p_subject: null, p_chapter: null, p_channel: null,
    p_language: null, p_type: null, p_difficulty: null, p_search: RUN,
  }), "all facets"));
  check("F1 one anonymous call returns every populated facet",
    allFacets.goal?.jee === 4 && allFacets.goal?.neet === 2 &&
      allFacets.subject?.physics === 3 && allFacets.language?.hinglish === 3 &&
      allFacets.type?.["full-course"] === 3,
    JSON.stringify(allFacets));

  check("F2 Dropper option uses superset semantics and DISTINCT playlist counts",
    allFacets.class?.["class-11"] === 3 && allFacets.class?.["class-12"] === 2 &&
      allFacets.class?.dropper === 4,
    JSON.stringify(allFacets.class));

  const jeePhysicsFacets = facetMap(must(await anon.rpc("browse_facet_counts", {
    p_goal: "jee", p_class: null, p_subject: "physics", p_chapter: null, p_channel: null,
    p_language: null, p_type: null, p_difficulty: null, p_search: RUN,
  }), "JEE Physics facets"));
  check("F3 a facet excludes its own filter so students can switch alternatives",
    jeePhysicsFacets.subject?.physics === 3 && jeePhysicsFacets.subject?.chemistry === 1,
    JSON.stringify(jeePhysicsFacets.subject));

  const jee11Facets = facetMap(must(await anon.rpc("browse_facet_counts", {
    p_goal: "jee", p_class: "class-11", p_subject: null, p_chapter: null, p_channel: null,
    p_language: null, p_type: null, p_difficulty: null, p_search: RUN,
  }), "JEE class 11 facets"));
  check("F4 every other active filter applies to a facet count",
    jee11Facets.subject?.physics === 2 && jee11Facets.subject?.chemistry == null,
    JSON.stringify(jee11Facets.subject));

  const dropperFacets = facetMap(must(await anon.rpc("browse_facet_counts", {
    p_goal: "jee", p_class: "dropper", p_subject: null, p_chapter: null, p_channel: null,
    p_language: null, p_type: null, p_difficulty: null, p_search: RUN,
  }), "Dropper facets"));
  check("F5 multi-tag courses remain one result under a Dropper filter",
    dropperFacets.subject?.physics === 2 && dropperFacets.subject?.chemistry === 1,
    JSON.stringify(dropperFacets.subject));

  const searchMiss = must(await anon.rpc("browse_facet_counts", {
    p_goal: null, p_class: null, p_subject: null, p_chapter: null, p_channel: null,
    p_language: null, p_type: null, p_difficulty: null, p_search: `missing-${RUN}`,
  }), "search miss facets");
  check("F6 a search miss returns an honest empty set", searchMiss.length === 0, JSON.stringify(searchMiss));

  console.log(`\n${passed} passed, ${failed} failed`);
}

async function cleanup() {
  if (created.playlists.length)
    must(await db.from("playlists").delete().in("id", created.playlists), "cleanup playlists");
  if (created.videos.length)
    must(await db.from("videos").delete().in("id", created.videos), "cleanup videos");
  if (created.chapters.length)
    must(await db.from("chapters").delete().in("id", created.chapters), "cleanup chapters");
  if (created.channel)
    must(await db.from("institutes_channels").delete().eq("id", created.channel), "cleanup channel");

  const residue = {
    playlists: created.playlists.length
      ? must(await db.from("playlists").select("id").in("id", created.playlists), "verify playlist cleanup").length : 0,
    videos: created.videos.length
      ? must(await db.from("videos").select("id").in("id", created.videos), "verify video cleanup").length : 0,
    chapters: created.chapters.length
      ? must(await db.from("chapters").select("id").in("id", created.chapters), "verify chapter cleanup").length : 0,
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
  writeFileSync(resolve(root, "catalog-navigation-test-report.json"), JSON.stringify({
    run: RUN, target: URL, when: new Date().toISOString(),
    passed, failed, fatal, guard_failed: guardFailed, cleanup_ran: cleanupRan, results,
  }, null, 2));
  console.log("report -> catalog-navigation-test-report.json");
  process.exitCode = guardFailed ? 2 : failed ? 1 : 0;
});
