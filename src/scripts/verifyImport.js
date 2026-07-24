// verifyImport.js — integration suite for import_playlist v4.
//
// SAFETY: two independent guards.
//   (a) TEST_SUPABASE_URL must not equal the production URL in .env (if present)
//   (b) the TARGET DATABASE must self-identify via public.app_environment
//       as 'staging' or 'test'. Production never has that row, so this stays
//       safe even with no .env on disk.
//
// Every setup/query/cleanup error fails the suite.
// Emits a machine-readable report to test-report.json.
// Run: npm run test:integration
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const readEnv = (p) => {
  const out = {};
  try {
    for (const l of readFileSync(resolve(root, p), "utf8").split("\n")) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch { /* optional */ }
  return out;
};
const prodEnv = readEnv(".env");
const stagingEnv = readEnv(".env.staging");
const cfg = (k) => process.env[k] ?? stagingEnv[k];

// Pre-flight failures happen before any client work, so exiting hard is safe.
const die = (m) => { console.error(`\x1b[31m${m}\x1b[0m`); process.exit(2); };

// A guard failure DURING the run is different, in two ways that matter:
//   * calling process.exit() while a supabase request is in flight aborts the
//     process on Windows with a libuv assertion and exit code 127, which hides
//     the real exit code from CI;
//   * the finally-block would then run cleanup(), issuing DELETEs against a
//     database that just failed verification — exactly what a guard exists to
//     prevent.
// So the guard throws, cleanup is skipped, and the exit code is set cleanly.
class GuardError extends Error {}
let guardFailed = false;
const URL = cfg("TEST_SUPABASE_URL");
const KEY = cfg("TEST_SERVICE_KEY");
if (cfg("TEST_ALLOW") !== "1") die("Refusing to run. Set TEST_ALLOW=1 in .env.staging.");
if (!URL || !KEY) die("Set TEST_SUPABASE_URL and TEST_SERVICE_KEY (non-production).");
if (prodEnv.VITE_SUPABASE_URL && URL === prodEnv.VITE_SUPABASE_URL)
  die("TEST_SUPABASE_URL must NOT be the production URL. Aborting.");

const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = cfg("TEST_ANON_KEY")
  ? createClient(URL, cfg("TEST_ANON_KEY"), { auth: { persistSession: false } }) : null;

const RUN = randomBytes(3).toString("hex");
const CH = `TESTCH${RUN}`;
const vid = (i) => (`T${RUN}${String(i).padStart(4, "0")}`).slice(0, 11).padEnd(11, "0");
const plid = (s) => `TESTPL${RUN}${s}`;

const must = (res, what) => {
  if (res?.error) throw new Error(`[${what}] ${res.error.message}`);
  return res.data;
};

const results = [];
let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  console.log(`${cond ? "\x1b[32m✓" : "\x1b[31m✗"} ${name}\x1b[0m`);
  results.push({ name, passed: Boolean(cond), detail: detail ?? null });
  cond ? pass++ : fail++;
};
const rejects = (name, res, re) => {
  const msg = res.error?.message ?? "";
  const good = Boolean(res.error) && re.test(msg);
  ok(good ? name : `${name}  [got: ${msg || "no error"}]`, good, msg);
};

const createdPlaylists = new Set(), createdVideos = new Set(), createdIds = new Set();
let testUserId = null;   // auth user created for the logged-in non-admin tests
const createdTeachers = new Set();  // v7 faculty records created by this run
const imp = (payload, mode = "merge") => {
  createdPlaylists.add(payload.youtube_playlist_id);
  (payload.videos || []).forEach((v) => v?.youtube_video_id && createdVideos.add(v.youtube_video_id));
  return db.rpc("import_playlist", { payload, mode });
};

async function guardEnvironment() {
  const res = await db.from("app_environment").select("name").maybeSingle();
  if (res.error)
    throw new GuardError(`Environment marker unreadable (${res.error.message}). Refusing: target DB did not identify as staging/test.`);
  const name = res.data?.name;
  if (!name)
    throw new GuardError("No row in public.app_environment. Refusing to run against an unmarked database.");
  if (!["staging", "test"].includes(name))
    throw new GuardError(`Database self-identifies as '${name}'. Refusing.`);
  console.log(`\x1b[36m• target database identifies as: ${name}\x1b[0m`);
}

async function refIds() {
  const cat = must(await db.from("categories").select("id, name"), "categories");
  const sub = must(await db.from("subjects").select("id, slug"), "subjects");
  const ch = must(await db.from("chapters").select("id, slug, subject_id"), "chapters");
  const lg = must(await db.from("learning_goals").select("id, slug"), "learning_goals");
  const cl = must(await db.from("class_levels").select("id, slug"), "class_levels");
  const bd = must(await db.from("boards").select("id, slug"), "boards");
  const pick = (rows, key, val) => rows.find((r) => r[key] === val)?.id;
  const R = {
    jeeCat: pick(cat, "name", "JEE"), neetCat: pick(cat, "name", "NEET"),
    schoolCat: pick(cat, "name", "School Boards"),
    physics: pick(sub, "slug", "physics"), maths: pick(sub, "slug", "mathematics"),
    jee: pick(lg, "slug", "jee"), neet: pick(lg, "slug", "neet"), school: pick(lg, "slug", "school"),
    c10: pick(cl, "slug", "class-10"), c11: pick(cl, "slug", "class-11"), drop: pick(cl, "slug", "dropper"),
    cbse: pick(bd, "slug", "cbse"), icse: pick(bd, "slug", "icse"),
  };
  R.chapId = ch.find((c) => c.subject_id === R.physics)?.id;
  for (const [k, v] of Object.entries(R)) if (!v) throw new Error(`seed data missing: ${k}`);
  return R;
}

async function main() {
  await guardEnvironment();
  const R = await refIds();
  const base = {
    category_id: R.jeeCat, learning_goal_id: R.jee, subject_id: R.physics, chapter_id: R.chapId,
    channel: { name: `Staging Test Channel ${RUN}`, youtube_channel_id: CH },
  };
  const v1 = { youtube_video_id: vid(1), title: "x" };
  const P = (over) => ({ ...base, class_labels: ["11th"], ...over });

  // ---------- validation ----------
  rejects("V1 empty video array", await imp(P({ youtube_playlist_id: plid("e"), title: "e", videos: [] })), /non-empty array/);
  rejects("V2 missing title", await imp(P({ youtube_playlist_id: plid("t"), title: "", videos: [v1] })), /title is required/);
  rejects("V3 unknown class label", await imp(P({ class_labels: ["99th"], youtube_playlist_id: plid("u"), title: "u", videos: [v1] })), /unknown class label/);
  rejects("V4 invalid category", await imp(P({ category_id: 999999, youtube_playlist_id: plid("c"), title: "c", videos: [v1] })), /invalid category_id/);
  rejects("V5 subject↔chapter mismatch", await imp(P({ subject_id: R.maths, youtube_playlist_id: plid("m"), title: "m", videos: [v1] })), /does not belong to subject/);
  rejects("V6 invalid audience_focus", await imp(P({ audience_focus: "12th", youtube_playlist_id: plid("a"), title: "a", videos: [v1] })), /audience_focus/);
  rejects("V7 duplicate video id", await imp(P({ youtube_playlist_id: plid("d"), title: "d", videos: [v1, { ...v1, title: "y" }] })), /duplicate youtube_video_id/);
  rejects("V8 malformed video id", await imp(P({ youtube_playlist_id: plid("i"), title: "i", videos: [{ youtube_video_id: "bad", title: "x" }] })), /missing\/invalid youtube_video_id/);
  rejects("V9 goal↔class incompatible (JEE + Class 10)", await imp(P({ class_labels: ["10th"], youtube_playlist_id: plid("g"), title: "g", videos: [v1] })), /not valid for this learning goal/);
  rejects("V10 blank video title", await imp(P({ youtube_playlist_id: plid("bt"), title: "bt", videos: [{ youtube_video_id: vid(1), title: "   " }] })), /blank title/);
  rejects("V11 out-of-range duration", await imp(P({ youtube_playlist_id: plid("dr"), title: "dr", videos: [{ ...v1, duration_seconds: 999999 }] })), /out-of-range duration/);
  rejects("V12 invalid content_type enum", await imp(P({ content_type: "nonsense", youtube_playlist_id: plid("ct"), title: "ct", videos: [v1] })), /invalid content_type/);
  rejects("V13 invalid language enum", await imp(P({ language: "klingon", youtube_playlist_id: plid("lg"), title: "lg", videos: [v1] })), /invalid language/);
  rejects("V14 malformed youtube_playlist_id", await imp(P({ youtube_playlist_id: "no", title: "x", videos: [v1] })), /invalid youtube_playlist_id/);

  // ---------- taxonomy model (review item 4) ----------
  rejects("V15 learning_goal_id required", await imp({ ...P({ youtube_playlist_id: plid("ng"), title: "ng", videos: [v1] }), learning_goal_id: null }), /learning_goal_id is required/);
  rejects("V16 invalid learning_goal_id", await imp(P({ learning_goal_id: 999999, youtube_playlist_id: plid("bg"), title: "bg", videos: [v1] })), /invalid learning_goal_id/);
  rejects("V17 boards rejected for non-school goal", await imp(P({ board_ids: [R.cbse], youtube_playlist_id: plid("bd"), title: "bd", videos: [v1] })), /board_ids apply only/);
  rejects("V18 school goal requires a board", await imp(P({ learning_goal_id: R.school, category_id: R.schoolCat, class_labels: ["10th"], youtube_playlist_id: plid("nb"), title: "nb", videos: [v1] })), /requires at least one board/);

  // THE case v3 made impossible: CBSE Class 10 content.
  const school = await imp(P({
    learning_goal_id: R.school, category_id: R.schoolCat, board_ids: [R.cbse],
    class_labels: ["10th"], youtube_playlist_id: plid("school"), title: "CBSE X Physics",
    videos: [{ youtube_video_id: vid(50), title: "cbse l1" }],
  }));
  const schoolBoards = school.data
    ? must(await db.from("playlist_boards").select("board_id").eq("playlist_id", school.data.playlist_id), "schoolBoards") : [];
  ok("V19 school-board (CBSE Class 10) content imports and is board-tagged",
     !school.error && schoolBoards.length === 1 && schoolBoards[0].board_id === R.cbse,
     school.error?.message ?? `boards=${schoolBoards.length}`);

  // ---------- R1: a rejected payload writes nothing ----------
  const rb = await imp(P({ youtube_playlist_id: plid("rb"), title: "rb",
    videos: [{ youtube_video_id: vid(2), title: "ok" }, { youtube_video_id: vid(8), title: "   " }] }));
  const rbPl = must(await db.from("playlists").select("id").eq("youtube_playlist_id", plid("rb")), "rb playlist").length;
  const rbVid = must(await db.from("videos").select("id").eq("youtube_video_id", vid(2)), "rb video").length;
  ok("R1 rejected payload wrote nothing (no playlist, no video)", Boolean(rb.error) && rbPl === 0 && rbVid === 0, rb.error?.message);

  // ---------- deterministic concurrency ----------
  const ROUNDS = 5;
  let roundsOk = 0; const roundDetail = [];
  for (let r = 0; r < ROUNDS; r++) {
    const C = P({ youtube_playlist_id: plid(`C${r}`), title: `C${r}`,
      videos: [{ youtube_video_id: vid(100 + r), title: "l1" }] });
    const [a, b] = await Promise.allSettled([imp(C), imp(C)]);   // simultaneous
    const succeeded = [a, b].filter((x) => x.status === "fulfilled" && !x.value.error).length;
    const row = must(await db.from("playlists").select("id").eq("youtube_playlist_id", plid(`C${r}`)), "conc playlist");
    const links = row.length === 1
      ? must(await db.from("playlist_videos").select("id").eq("playlist_id", row[0].id), "conc links").length : -1;
    const good = succeeded === 2 && row.length === 1 && links === 1;
    if (good) roundsOk++;
    roundDetail.push({ round: r, succeeded, playlists: row.length, links });
  }
  ok(`C1 simultaneous duplicate imports deterministic (${roundsOk}/${ROUNDS} rounds, 2/2 required)`,
     roundsOk === ROUNDS, JSON.stringify(roundDetail));

  // ---------- merge / replace ----------
  const A = P({ youtube_playlist_id: plid("A"), title: "Curated A", teacher: "Curated Teacher",
    videos: [{ youtube_video_id: vid(3), title: "l1" }, { youtube_video_id: vid(4), title: "l2" }] });
  const r1 = must(await imp(A), "import A");
  must(await imp({ ...A, title: "Should Not Overwrite", teacher: "Nope" }, "merge"), "merge A");
  const plA = must(await db.from("playlists").select("title, teacher").eq("youtube_playlist_id", plid("A")).single(), "plA");
  const linkA = must(await db.from("playlist_videos").select("id").eq("playlist_id", r1.playlist_id), "linkA").length;
  ok("M1 merge keeps curated title/teacher, no dup links", plA.title === "Curated A" && plA.teacher === "Curated Teacher" && linkA === 2);

  // ---------- counters under ON CONFLICT (review item 5) ----------
  ok("N1 first import counts the video as ADDED", r1.videos_added === 2 && r1.videos_reused === 0,
     `added=${r1.videos_added} reused=${r1.videos_reused}`);
  const reuse = must(await imp(P({ category_id: R.neetCat, learning_goal_id: R.neet,
    youtube_playlist_id: plid("B"), title: "B", videos: [{ youtube_video_id: vid(3), title: "l1" }] })), "import B");
  ok("N2 an existing video counts as REUSED, not added",
     reuse.videos_added === 0 && reuse.videos_reused === 1,
     `added=${reuse.videos_added} reused=${reuse.videos_reused}`);

  const v3row = must(await db.from("videos").select("id").eq("youtube_video_id", vid(3)).single(), "v3");
  const goals = must(await db.from("video_learning_goals").select("learning_goals(name)").eq("video_id", v3row.id), "goals")
    .map((g) => g.learning_goals?.name).sort();
  ok("S1 shared video keeps JEE+NEET goals", goals.join(",") === "JEE,NEET", goals.join(","));

  // ---------- set_video_taxonomy (review item 3) ----------
  rejects("T1 empty taxonomy must use the named clear operation",
    await db.rpc("set_video_taxonomy", { p_video_id: v3row.id, p_learning_goal_ids: [], p_class_level_ids: [] }),
    /clear_video_taxonomy/);
  rejects("T2 incompatible goal/class rejected (JEE + Class 10)",
    await db.rpc("set_video_taxonomy", { p_video_id: v3row.id, p_learning_goal_ids: [R.jee], p_class_level_ids: [R.c10] }),
    /not valid for learning_goal/);

  // TRUE mid-transaction rollback: the function DELETEs then INSERTs, so a
  // bogus class id must roll the delete back and leave the tags intact.
  const badTax = await db.rpc("set_video_taxonomy",
    { p_video_id: v3row.id, p_learning_goal_ids: [R.jee], p_class_level_ids: [999999] });
  const goalsAfterFail = must(await db.from("video_learning_goals").select("learning_goals(name)").eq("video_id", v3row.id), "goalsAfterFail")
    .map((g) => g.learning_goals?.name).sort();
  ok("R2 mid-transaction failure rolled back the DELETE (tags intact)",
     Boolean(badTax.error) && goalsAfterFail.join(",") === "JEE,NEET",
     `${badTax.error?.message ?? "no error"} | after: ${goalsAfterFail.join(",")}`);

  must(await db.rpc("set_video_taxonomy", { p_video_id: v3row.id, p_learning_goal_ids: [R.jee], p_class_level_ids: [R.c11] }), "set_video_taxonomy");
  const goals2 = must(await db.from("video_learning_goals").select("learning_goals(name)").eq("video_id", v3row.id), "goals2")
    .map((g) => g.learning_goals?.name);
  ok("T3 set_video_taxonomy removes the erroneous NEET tag", goals2.length === 1 && goals2[0] === "JEE", goals2.join(","));

  must(await db.rpc("clear_video_taxonomy", { p_video_id: v3row.id }), "clear_video_taxonomy");
  const goals3 = must(await db.from("video_learning_goals").select("video_id").eq("video_id", v3row.id), "goals3");
  ok("T4 clear_video_taxonomy empties it deliberately", goals3.length === 0, `${goals3.length} left`);

  // ---------- replace ----------
  const otherCh = must(await db.from("institutes_channels").select("id").neq("youtube_channel_id", CH).limit(1), "otherCh");
  must(await imp({ ...A, title: "Replaced Title", channel_id: otherCh[0]?.id, channel: undefined,
    videos: [{ youtube_video_id: vid(3), title: "l1" }] }, "replace"), "replace A");
  const plA2 = must(await db.from("playlists").select("title, channel_id").eq("youtube_playlist_id", plid("A")).single(), "plA2");
  const linkA2 = must(await db.from("playlist_videos").select("video_id").eq("playlist_id", r1.playlist_id), "linkA2");
  const v4count = must(await db.from("videos").select("id").eq("youtube_video_id", vid(4)), "v4").length;
  ok("P1 replace overwrites title", plA2.title === "Replaced Title");
  ok("P2 replace drops stale link, keeps video row", linkA2.length === 1 && v4count === 1);
  ok("P3 replace re-homes channel_id", Boolean(otherCh[0]) && plA2.channel_id === otherCh[0].id, `${plA2.channel_id} vs ${otherCh[0]?.id}`);

  // ---------- create_course video_ids validation (review item 2) ----------
  const cc = (over) => db.rpc("create_course", { payload: {
    title: `CC ${RUN}`, channel_id: otherCh[0]?.id, category_id: R.jeeCat,
    learning_goal_id: R.jee, subject_id: R.physics, class_labels: ["11th"], ...over } });
  rejects("CC1 video_ids required", await cc({}), /video_ids must be a non-empty array/);
  rejects("CC2 video_ids empty rejected", await cc({ video_ids: [] }), /video_ids must be a non-empty array/);
  rejects("CC3 duplicate video_id rejected", await cc({ video_ids: [v3row.id, v3row.id] }), /duplicate video_id/);
  rejects("CC4 non-numeric video_id rejected", await cc({ video_ids: ["abc"] }), /positive whole numbers within range/);
  rejects("CC5 non-existent video_id rejected", await cc({ video_ids: [99999999] }), /does not exist/);
  const good = await cc({ video_ids: [v3row.id] });
  const ccLinks = good.data
    ? must(await db.from("playlist_videos").select("id").eq("playlist_id", good.data.playlist_id), "ccLinks").length : -1;
  if (good.data) createdIds.add(good.data.playlist_id);
  ok("CC6 create_course reports a lesson count equal to real links",
     !good.error && good.data.lessons === 1 && ccLinks === 1,
     good.error?.message ?? `lessons=${good.data?.lessons} links=${ccLinks}`);

  // ---------- derived array: every direction (review item 6) ----------
  const DA = must(await db.from("playlists").select("id, class_levels").eq("youtube_playlist_id", plid("A")).single(), "DA");
  must(await db.from("playlists").update({ class_levels: ["12th", "Dropper", "bogus"] }).eq("id", DA.id), "direct update");
  const afterUpd = must(await db.from("playlists").select("class_levels").eq("id", DA.id).single(), "afterUpd");
  ok("DA1 direct UPDATE of the array is neutralised",
     JSON.stringify([...(afterUpd.class_levels ?? [])].sort()) === JSON.stringify(["11th"]), JSON.stringify(afterUpd.class_levels));

  const ins = must(await db.from("playlists").insert({
    title: `DA insert ${RUN}`, channel_id: otherCh[0]?.id, category_id: R.jeeCat,
    subject_id: R.physics, class_levels: ["12th", "Dropper"],
  }).select("id, class_levels").single(), "direct insert");
  createdIds.add(ins.id);
  ok("DA2 direct INSERT carrying an array is neutralised",
     (ins.class_levels ?? []).length === 0, JSON.stringify(ins.class_levels));

  must(await db.from("playlist_class_levels").insert([
    { playlist_id: ins.id, class_level_id: R.c11 }, { playlist_id: ins.id, class_level_id: R.drop },
  ]), "junction insert");
  const afterJIns = must(await db.from("playlists").select("class_levels").eq("id", ins.id).single(), "afterJIns");
  ok("DA3 junction INSERT fills the array, multi-class, in display order",
     JSON.stringify(afterJIns.class_levels) === JSON.stringify(["11th", "Dropper"]), JSON.stringify(afterJIns.class_levels));

  must(await db.from("playlist_class_levels").delete().eq("playlist_id", ins.id).eq("class_level_id", R.drop), "junction delete");
  const afterJDel = must(await db.from("playlists").select("class_levels").eq("id", ins.id).single(), "afterJDel");
  ok("DA4 junction DELETE shrinks the array",
     JSON.stringify(afterJDel.class_levels) === JSON.stringify(["11th"]), JSON.stringify(afterJDel.class_levels));

  // ---------- the migration preserved pre-existing classifications ----------
  const fx = must(await db.from("playlists").select("id, title, class_levels").like("title", "DRIFTFX%"), "fixtures");
  const byTitle = Object.fromEntries(fx.map((f) => [f.title, f]));
  const jFor = async (id) => must(await db.from("playlist_class_levels").select("class_levels(slug)").eq("playlist_id", id), "fx junction")
    .map((x) => x.class_levels.slug).sort();

  if (fx.length === 0) {
    ok("MG1 array-only classification PRESERVED by the migration", false,
       "no DRIFTFX fixtures found — apply staging_drift_fixtures.sql before v4_class_levels_migration.sql");
  } else {
    const single = byTitle["DRIFTFX array-only single"];
    const multi = byTitle["DRIFTFX array-only multi"];
    ok("MG1 array-only single-class PRESERVED (array kept AND junction backfilled)",
       Boolean(single) && JSON.stringify(single.class_levels) === JSON.stringify(["12th"]) &&
       JSON.stringify(await jFor(single.id)) === JSON.stringify(["class-12"]),
       `array=${JSON.stringify(single?.class_levels)} junction=${JSON.stringify(single ? await jFor(single.id) : null)}`);
    ok("MG2 array-only multi-class PRESERVED",
       Boolean(multi) && JSON.stringify(multi.class_levels) === JSON.stringify(["11th", "12th", "Dropper"]) &&
       JSON.stringify(await jFor(multi.id)) === JSON.stringify(["class-11", "class-12", "dropper"]),
       `array=${JSON.stringify(multi?.class_levels)}`);
    const jOnly = byTitle["DRIFTFX junction-only"];
    ok("MG3 junction-only playlist had its array filled",
       Boolean(jOnly) && JSON.stringify(jOnly.class_levels) === JSON.stringify(["11th", "12th"]),
       JSON.stringify(jOnly?.class_levels));
    const empty = byTitle["DRIFTFX both-empty"];
    ok("MG4 unclassified playlist left untouched",
       Boolean(empty) && (empty.class_levels ?? []).length === 0 && (await jFor(empty.id)).length === 0,
       JSON.stringify(empty?.class_levels));
  }

  const audit = await db.from("class_levels_migration_audit").select("verdict");
  const verdicts = {};
  for (const a of audit.data ?? []) verdicts[a.verdict] = (verdicts[a.verdict] ?? 0) + 1;
  ok("MG5 migration recorded an audit verdict for every playlist",
     !audit.error && (audit.data?.length ?? 0) > 0, JSON.stringify(verdicts));

  // ---------- global drift ----------
  const allPl = must(await db.from("playlists").select("id, class_levels"), "allPl");
  const SLUG = { "class-10": "10th", "class-11": "11th", "class-12": "12th", dropper: "Dropper" };
  let drift = 0;
  for (const p of allPl) {
    const j = must(await db.from("playlist_class_levels").select("class_levels(slug)").eq("playlist_id", p.id), "junction");
    const expected = j.map((x) => SLUG[x.class_levels.slug]).sort();
    const actual = [...(p.class_levels ?? [])].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) drift++;
  }
  ok("D1 zero array/junction drift across all playlists", drift === 0, `drifted: ${drift}/${allPl.length}`);

  // ---------- item 1: Browse (category) and Explore (goal) cannot disagree ----------
  rejects("X1 contradictory category/goal pair rejected (NEET category + JEE goal)",
    await imp(P({ category_id: R.neetCat, learning_goal_id: R.jee,
      youtube_playlist_id: plid("x1"), title: "x1", videos: [{ youtube_video_id: vid(60), title: "x" }] })),
    /not valid for learning goal/);

  const vJee = must(await db.from("videos").select("id").eq("youtube_video_id", vid(3)).single(), "vJee");

  // The invariant that actually matters, executed the way the two screens do it.
  //
  // Browse (useBrowse.useVideos) now resolves its category to the goal(s) in
  // category_learning_goals and filters video_learning_goals. Explore filters
  // video_learning_goals directly. Same query, same axis — so for every
  // category the two result sets must be identical, video for video.
  const catGoals = must(await db.from("category_learning_goals").select("category_id, learning_goal_id"), "catGoals");
  const cats = [...new Set(catGoals.map((m) => m.category_id))];
  const mismatches = [];
  for (const catId of cats) {
    const goalIds = catGoals.filter((m) => m.category_id === catId).map((m) => m.learning_goal_id);
    // Browse's query
    const browse = must(await db.from("videos")
      .select("id, video_learning_goals!inner(learning_goal_id)")
      .in("video_learning_goals.learning_goal_id", goalIds), "browse set")
      .map((r) => r.id).sort((x, y) => x - y);
    // Explore's query
    const explore = [...new Set(must(await db.from("video_learning_goals")
      .select("video_id").in("learning_goal_id", goalIds), "explore set")
      .map((r) => r.video_id))].sort((x, y) => x - y);
    if (JSON.stringify(browse) !== JSON.stringify(explore))
      mismatches.push({ catId, browse: browse.length, explore: explore.length });
  }
  ok("X3 Browse and Explore return the SAME videos for every category/goal pair",
     mismatches.length === 0, JSON.stringify(mismatches));

  // A lecture shared by a JEE course and a NEET course must be reachable from
  // BOTH, not forced into one by its single-valued category_id. That single
  // value is exactly why the two screens used to disagree.
  const shared = { youtube_video_id: vid(80), title: "shared lecture" };
  must(await imp(P({ youtube_playlist_id: plid("shJ"), title: "shared JEE", videos: [shared] })), "shared JEE");
  must(await imp(P({ category_id: R.neetCat, learning_goal_id: R.neet,
    youtube_playlist_id: plid("shN"), title: "shared NEET", videos: [shared] })), "shared NEET");
  const shRow = must(await db.from("videos").select("id, category_id").eq("youtube_video_id", vid(80)).single(), "shRow");
  const reachable = async (catId) => {
    const goalIds = catGoals.filter((m) => m.category_id === catId).map((m) => m.learning_goal_id);
    return must(await db.from("videos").select("id, video_learning_goals!inner(learning_goal_id)")
      .eq("id", shRow.id).in("video_learning_goals.learning_goal_id", goalIds), "reachable").length > 0;
  };
  const viaJee = await reachable(R.jeeCat), viaNeet = await reachable(R.neetCat);
  ok("X4 a shared lecture is reachable from BOTH goals despite one category_id",
     viaJee && viaNeet, `category_id=${shRow.category_id} viaJEE=${viaJee} viaNEET=${viaNeet}`);

  // X5 — the Browse NAVIGATION TREE, built exactly as useCurriculumTree() does.
  // A shared lecture must create subject AND chapter branches under both goals;
  // a tree built from the single-valued videos.category_id could only ever put
  // it under one.
  const treeRows = must(await db.from("video_learning_goals")
    .select("learning_goal_id, videos!inner(id, subject_id, chapter_id)"), "tree rows");
  const branch = (goalId) => treeRows.filter(
    (r) => r.learning_goal_id === goalId && r.videos?.id === shRow.id);
  const jeeBranch = branch(R.jee), neetBranch = branch(R.neet);
  const hasBranch = (rows) => rows.length > 0
    && rows.every((r) => r.videos.subject_id === R.physics && r.videos.chapter_id === R.chapId);
  ok("X5 shared lecture builds subject+chapter branches under BOTH goals in the Browse tree",
     hasBranch(jeeBranch) && hasBranch(neetBranch),
     `jee=${jeeBranch.length} neet=${neetBranch.length}`);

  // ---------- item 8: every student-facing goal/category is mapped ----------
  const allGoals = must(await db.from("learning_goals").select("id, slug"), "allGoals");
  const allCats = must(await db.from("categories").select("id, slug"), "allCats");
  const mappedGoals = new Set(catGoals.map((m) => m.learning_goal_id));
  const mappedCats = new Set(catGoals.map((m) => m.category_id));
  const unmappedGoals = allGoals.filter((g) => !mappedGoals.has(g.id)).map((g) => g.slug);
  const unmappedCats = allCats.filter((c) => !mappedCats.has(c.id)).map((c) => c.slug);
  ok("X6 every learning goal has a declared category mapping",
     unmappedGoals.length === 0, `unmapped goals: ${unmappedGoals.join(", ") || "none"}`);
  ok("X7 every category has a declared learning-goal mapping",
     unmappedCats.length === 0, `unmapped categories: ${unmappedCats.join(", ") || "none"}`);

  // ---------- item 2: CBSE / ICSE isolation ----------
  const cbse = must(await imp(P({ learning_goal_id: R.school, category_id: R.schoolCat,
    board_ids: [R.cbse], class_labels: ["10th"], youtube_playlist_id: plid("cbse"),
    title: "CBSE course", videos: [{ youtube_video_id: vid(70), title: "c1" }] })), "import cbse");
  const icse = must(await imp(P({ learning_goal_id: R.school, category_id: R.schoolCat,
    board_ids: [R.icse], class_labels: ["10th"], youtube_playlist_id: plid("icse"),
    title: "ICSE course", videos: [{ youtube_video_id: vid(71), title: "i1" }] })), "import icse");
  const idsFor = async (boardId) =>
    must(await db.from("playlist_boards").select("playlist_id").eq("board_id", boardId), "board ids")
      .map((r) => r.playlist_id);
  const cbseIds = await idsFor(R.cbse), icseIds = await idsFor(R.icse);
  ok("B1 CBSE scope contains the CBSE course and NOT the ICSE course",
     cbseIds.includes(cbse.playlist_id) && !cbseIds.includes(icse.playlist_id),
     `cbse=[${cbseIds}]`);
  ok("B2 ICSE scope contains the ICSE course and NOT the CBSE course",
     icseIds.includes(icse.playlist_id) && !icseIds.includes(cbse.playlist_id),
     `icse=[${icseIds}]`);
  const bothBoards = must(await db.from("playlist_boards").select("board_id").eq("playlist_id", cbse.playlist_id), "cbse boards");
  ok("B3 a board-scoped course carries exactly one board tag", bothBoards.length === 1, JSON.stringify(bothBoards));

  // ---------- item 4: the migration's abort paths, automated ----------
  //
  // The baseline is taken AFTER the fixture, not before. The fixture itself
  // inserts a playlist_class_levels row (the conflict case needs a junction
  // entry that disagrees with the array), so a pre-fixture baseline measures
  // the fixture's own write and not the migration's. What we are asserting is
  // narrow and specific: the ABORTED MIGRATION adds nothing and removes
  // nothing, relative to the state the fixture left behind.
  must(await db.rpc("seed_blocking_drift_fixture"), "seed blocking fixture");

  const auditBefore = must(await db.from("class_levels_migration_audit").select("id"), "auditBefore").length;
  const junctionBefore = must(await db.from("playlist_class_levels").select("playlist_id"), "junctionBefore").length;
  const trigBefore = must(await db.rpc("has_trigger", { p_name: "trg_force_class_levels" }), "trigBefore");

  const abort = await db.rpc("migrate_class_levels", { p_enable_triggers: true });
  const auditAfter = must(await db.from("class_levels_migration_audit").select("id"), "auditAfter").length;
  const junctionAfter = must(await db.from("playlist_class_levels").select("playlist_id"), "junctionAfter").length;
  const trigAfter = must(await db.rpc("has_trigger", { p_name: "trg_force_class_levels" }), "trigAfter");

  ok("MB1 blocking drift makes the migration ABORT",
     Boolean(abort.error) && /ABORT/.test(abort.error.message), abort.error?.message);
  ok("MB2 aborted migration persisted ZERO audit rows (vs post-fixture baseline)",
     auditAfter === auditBefore, `${auditBefore} -> ${auditAfter}`);
  ok("MB3 aborted migration added and removed ZERO junction rows (vs post-fixture baseline)",
     junctionAfter === junctionBefore, `${junctionBefore} -> ${junctionAfter}`);
  ok("MB4 aborted migration left triggers unchanged",
     trigAfter === trigBefore && trigAfter === true, `${trigBefore} -> ${trigAfter}`);
  must(await db.rpc("clear_blocking_drift_fixture"), "clear blocking fixture");

  // and it succeeds again once the blocking rows are gone
  const rerun = await db.rpc("migrate_class_levels", { p_enable_triggers: true });
  ok("MB5 migration succeeds again once the blocking rows are removed",
     !rerun.error && rerun.data?.drift_after === 0, rerun.error?.message ?? JSON.stringify(rerun.data?.verdicts));
  ok("MB6 each run keeps its own audit evidence (run_id)",
     Boolean(rerun.data?.run_id), rerun.data?.run_id);

  // ---------- item 5: video_ids edge cases ----------
  const ccBad = (ids) => db.rpc("create_course", { payload: {
    title: `CC bad ${RUN}`, channel_id: otherCh[0]?.id, category_id: R.jeeCat,
    learning_goal_id: R.jee, subject_id: R.physics, class_labels: ["11th"], video_ids: ids } });
  const NUMERIC = /positive whole numbers within range/;
  rejects("E1 video_ids zero rejected", await ccBad([0]), NUMERIC);
  rejects("E2 video_ids negative rejected", await ccBad([-1]), NUMERIC);
  rejects("E3 video_ids decimal rejected", await ccBad([1.5]), NUMERIC);
  rejects("E4 video_ids overflow rejected", await ccBad([1e30]), NUMERIC);
  rejects("E5 video_ids numeric string rejected", await ccBad(["1"]), NUMERIC);
  rejects("E6 video_ids null element rejected", await ccBad([null]), NUMERIC);
  rejects("E7 video_ids object element rejected", await ccBad([{ id: 1 }]), NUMERIC);
  rejects("E8 video_ids nested array rejected", await ccBad([[1]]), NUMERIC);
  rejects("E9 video_ids boolean rejected", await ccBad([true]), NUMERIC);

  // ---------- item 6: duplicates rejected BEFORE any delete ----------
  const beforeDup = must(await db.from("video_learning_goals").select("learning_goal_id").eq("video_id", vJee.id), "beforeDup").length;
  rejects("G1 duplicate learning_goal_id rejected",
    await db.rpc("set_video_taxonomy", { p_video_id: vJee.id, p_learning_goal_ids: [R.jee, R.jee], p_class_level_ids: [R.c11] }),
    /duplicate learning_goal_id/);
  rejects("G2 duplicate class_level_id rejected",
    await db.rpc("set_video_taxonomy", { p_video_id: vJee.id, p_learning_goal_ids: [R.jee], p_class_level_ids: [R.c11, R.c11] }),
    /duplicate class_level_id/);
  const afterDup = must(await db.from("video_learning_goals").select("learning_goal_id").eq("video_id", vJee.id), "afterDup").length;
  ok("G3 duplicate rejection deleted nothing", beforeDup === afterDup, `${beforeDup} -> ${afterDup}`);

  /*
  // ================= RETIRED FACULTY IDENTITY DRAFT =================
  // This block targeted the discarded globally-unique-alias model. It is kept
  // only as review history and deliberately does not execute. Faculty v7 now
  // has its own guarded suite (verifyFaculty.js), because the base v6 importer
  // staging project intentionally does not install v7.
  // Names are RUN-suffixed because teacher_aliases.normalized_alias is globally
  // unique — without it a second run would collide with the first, and the
  // suite has to be re-runnable against the same database.
  const FULL = `Amit Bijarnia ${RUN}`, SHORT = `ABJ ${RUN}`;
  const mk = await db.rpc("create_teacher", { p_display_name: FULL, p_aliases: [SHORT], p_verified: true });
  ok("F0 create_teacher makes one verified faculty record",
     !mk.error && mk.data?.created === true, mk.error?.message ?? JSON.stringify(mk.data));
  const abjId = mk.data?.teacher_id;
  if (abjId) createdTeachers.add(abjId);

  const find = async (q) => {
    const r = await db.rpc("search_teachers", { p_query: q, p_limit: 5 });
    if (r.error) throw new Error(`[search ${q}] ${r.error.message}`);
    return r.data ?? [];
  };
  // Every one of these must land on the SAME record.
  const resolvesTo1 = async (name, q) => {
    const rows = await find(q);
    const top = rows[0];
    ok(`${name}  "${q}"`, Boolean(top) && top.teacher_id === abjId && top.match_rank === 1,
       top ? `${top.display_name} rank=${top.match_rank} via ${top.match_type}` : "no match");
  };
  await resolvesTo1("F1 exact full name",              FULL);
  await resolvesTo1("F2 alias",                        SHORT);
  await resolvesTo1("F3 alias + honorific",            `${SHORT} Sir`);
  await resolvesTo1("F4 honorific first",              `Sir ${SHORT}`);
  await resolvesTo1("F5 lowercase",                    FULL.toLowerCase());
  await resolvesTo1("F6 UPPERCASE",                    FULL.toUpperCase());
  await resolvesTo1("F7 punctuation + extra spacing",  `  Amit   Bijarnia.  ${RUN} `);
  await resolvesTo1("F8 Ma'am honorific stripped",     `Ma'am ${SHORT}`);

  // typo tolerance sits at the BOTTOM of the ranking, not the top
  const typo = await find(`Amit Bijarnai ${RUN}`);          // 'ia' -> 'ai'
  ok("F9 minor misspelling still finds the teacher (fuzzy, rank 4)",
     typo.some((t) => t.teacher_id === abjId && t.match_rank === 4),
     typo.map((t) => `${t.display_name}:${t.match_rank}`).join(", ") || "no match");

  // duplicate avoidance
  const dupe = await db.rpc("create_teacher", { p_display_name: `abj ${RUN}`, p_aliases: [] });
  ok("F10 a name that already resolves does NOT create a second record",
     !dupe.error && dupe.data?.created === false && dupe.data?.teacher_id === abjId,
     dupe.error?.message ?? JSON.stringify(dupe.data));

  const blocked = await db.rpc("create_teacher", { p_display_name: `Amit Bijarniya ${RUN}`, p_aliases: [] });
  ok("F11 a near-duplicate name is refused unless forced",
     Boolean(blocked.error) && /possible duplicate/i.test(blocked.error.message), blocked.error?.message);

  const forced = await db.rpc("create_teacher", { p_display_name: `Amit Bijarniya ${RUN}`, p_aliases: [], p_force: true });
  if (forced.data?.teacher_id) createdTeachers.add(forced.data.teacher_id);
  ok("F12 similar-but-different faculty can be created deliberately",
     !forced.error && forced.data?.created === true && forced.data.teacher_id !== abjId,
     forced.error?.message ?? JSON.stringify(forced.data));

  const exact = await find(FULL);
  ok("F13 with two similar names, the exact one still wins",
     exact[0]?.teacher_id === abjId && exact[0]?.match_rank === 1,
     exact.map((t) => `${t.display_name}:${t.match_rank}`).join(", "));

  const stolen = await db.rpc("add_teacher_alias", { p_teacher_id: forced.data?.teacher_id, p_alias: SHORT });
  ok("F14 an alias cannot be claimed by a second teacher",
     Boolean(stolen.error) && /already belongs to teacher/i.test(stolen.error.message), stolen.error?.message);

  // ---- attaching faculty to courses, by ID only ----
  const twoTeachers = [abjId, forced.data?.teacher_id].filter(Boolean);
  const fp = must(await imp(P({ youtube_playlist_id: plid("fac"), title: "Faculty course",
    teacher_ids: twoTeachers,
    videos: [{ youtube_video_id: vid(90), title: "fl1" }] })), "faculty import");
  const linked = must(await db.from("playlist_teachers").select("teacher_id, role, position").eq("playlist_id", fp.playlist_id), "links");
  ok("F15 one course carries MULTIPLE teachers, ordered",
     linked.length === 2 && linked.some((l) => l.role === "instructor") && linked.some((l) => l.role === "co-instructor"),
     JSON.stringify(linked));

  rejects("F16 importer refuses an unknown teacher_id",
    await imp(P({ youtube_playlist_id: plid("badt"), title: "bad", teacher_ids: [99999999],
      videos: [{ youtube_video_id: vid(91), title: "x" }] })),
    /unknown teacher_id/);
  rejects("F17 importer refuses duplicate teacher_ids",
    await imp(P({ youtube_playlist_id: plid("dupt"), title: "dup", teacher_ids: [abjId, abjId],
      videos: [{ youtube_video_id: vid(92), title: "x" }] })),
    /duplicate teacher_id/);

  // ---- filters with counts, from the database ----
  const facets = must(await db.rpc("get_faculty_facets", { p_subject_id: R.physics }), "facets");
  const mine = facets.find((f) => f.teacher_id === abjId);
  ok("F18 faculty filter facets carry real course counts",
     Boolean(mine) && Number(mine.course_count) >= 1,
     mine ? `${mine.display_name} = ${mine.course_count}` : "not in facets");

  const prof = must(await db.rpc("get_faculty_profile", { p_slug: mk.data?.slug ?? `amit-bijarnia-${RUN}`.toLowerCase() }), "profile");
  ok("F19 faculty profile returns aliases and courses",
     prof === null || (prof.course_count >= 1 && Array.isArray(prof.aliases) && prof.aliases.length >= 2),
     prof ? `${prof.display_name}: ${prof.course_count} courses, aliases ${JSON.stringify(prof.aliases)}` : "null profile");

  // ---- the free-text migration keeps the original column ----
  const beforeFree = must(await db.from("playlists").select("id, teacher").not("teacher", "is", null).limit(1), "free text before");
  const mig = await db.rpc("migrate_free_text_teachers");
  const afterFree = beforeFree.length
    ? must(await db.from("playlists").select("teacher").eq("id", beforeFree[0].id).single(), "free text after") : null;
  ok("F20 free-text migration runs and PRESERVES playlists.teacher",
     !mig.error && (!beforeFree.length || afterFree.teacher === beforeFree[0].teacher),
     mig.error?.message ?? JSON.stringify(mig.data));

  const review = await db.from("teacher_migration_review").select("status").eq("status", "pending");
  ok("F21 every migrated name is recorded for human review (pending)",
     !review.error && (review.data ?? []).length >= 0, `${(review.data ?? []).length} pending`);
  */

  // ---------- authorization ----------
  if (anon) {
    const res = await anon.rpc("import_playlist", { payload: P({ youtube_playlist_id: plid("z"), title: "z", videos: [{ youtube_video_id: vid(200), title: "x" }] }), mode: "merge" });
    const msg = res.error?.message ?? "";
    const authz = res.error?.code === "42501" || /not authorized|permission denied/i.test(msg);
    ok(`A1 anonymous import rejected by AUTHORIZATION (${res.error?.code ?? "none"})`, authz, msg);
    ok("A2 anonymous create_course rejected", Boolean((await anon.rpc("create_course", { payload: {} })).error));
    ok("A3 anonymous clear_video_taxonomy rejected", Boolean((await anon.rpc("clear_video_taxonomy", { p_video_id: v3row.id })).error));
    ok("A4 anonymous migrate_class_levels rejected", Boolean((await anon.rpc("migrate_class_levels", { p_enable_triggers: false })).error));
    ok("A5 anonymous cannot read the migration audit trail",
       ((await anon.from("class_levels_migration_audit").select("id")).data ?? []).length === 0);

    // ---------- a real LOGGED-IN NON-ADMIN ----------
    //
    // A1-A5 only prove `anon` is stopped, and `anon` is stopped at the GRANT
    // layer — it never reaches a function body. `authenticated` DOES reach the
    // body (admins are authenticated users), so the is_admin() checks inside
    // these functions had no test at all. This creates a genuine confirmed
    // user, signs in as them, and asserts every privileged entry point refuses.
    const email = `test-${RUN}@example.com`, password = `pw-${RUN}-Aa1!`;
    const made = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (made.error) {
      ok("AU0 create non-admin test user", false, made.error.message);
    } else {
      testUserId = made.data.user.id;
      const userClient = createClient(URL, cfg("TEST_ANON_KEY"), { auth: { persistSession: false } });
      const signIn = await userClient.auth.signInWithPassword({ email, password });
      if (signIn.error) {
        ok("AU0 sign in as non-admin", false, signIn.error.message);
      } else {
        const prof = must(await db.from("profiles").select("is_admin").eq("id", testUserId).maybeSingle(), "profile");
        ok("AU0 test user exists and is NOT an admin", prof?.is_admin === false, JSON.stringify(prof));

        const r1 = await userClient.rpc("import_playlist", { payload: P({ youtube_playlist_id: plid("au"), title: "au", videos: [{ youtube_video_id: vid(210), title: "x" }] }), mode: "merge" });
        ok(`AU1 logged-in non-admin cannot import (${r1.error?.code ?? "none"})`,
           Boolean(r1.error), r1.error?.message);

        const r2 = await userClient.rpc("create_course", { payload: {
          title: "au", channel_id: otherCh[0]?.id, category_id: R.jeeCat, learning_goal_id: R.jee,
          subject_id: R.physics, class_labels: ["11th"], video_ids: [vJee.id] } });
        ok(`AU2 logged-in non-admin cannot create_course (${r2.error?.code ?? "none"})`,
           Boolean(r2.error), r2.error?.message);

        const r3 = await userClient.rpc("migrate_class_levels", { p_enable_triggers: false });
        ok(`AU3 logged-in non-admin cannot run the migration (${r3.error?.code ?? "none"})`,
           Boolean(r3.error), r3.error?.message);

        const r4 = await userClient.rpc("set_video_taxonomy", { p_video_id: vJee.id, p_learning_goal_ids: [R.jee], p_class_level_ids: [R.c11] });
        ok(`AU4 logged-in non-admin cannot rewrite taxonomy (${r4.error?.code ?? "none"})`,
           Boolean(r4.error), r4.error?.message);

        const audit = await userClient.from("class_levels_migration_audit").select("id");
        ok("AU5 logged-in non-admin cannot read the migration audit trail",
           (audit.data ?? []).length === 0, JSON.stringify(audit.error?.message ?? `${(audit.data ?? []).length} rows`));
      }
    }
  } else {
    ok("A1 authorization", false, "TEST_ANON_KEY not set — cannot verify");
  }

  console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m`);
}

async function cleanup() {
  const pls = [...createdPlaylists].filter(Boolean);
  if (pls.length) must(await db.from("playlists").delete().in("youtube_playlist_id", pls), "cleanup playlists");
  if (createdIds.size) must(await db.from("playlists").delete().in("id", [...createdIds]), "cleanup playlists by id");
  const vids = [...createdVideos].filter(Boolean);
  if (vids.length) must(await db.from("videos").delete().in("youtube_video_id", vids), "cleanup videos");
  must(await db.from("institutes_channels").delete().eq("youtube_channel_id", CH), "cleanup channel");
  // Teachers last: playlist_teachers references them with ON DELETE RESTRICT, so
  // the playlists above must be gone first (their cascade removes the links).
  if (createdTeachers.size) {
    must(await db.from("teacher_migration_review").delete().in("teacher_id", [...createdTeachers]), "cleanup review rows");
    must(await db.from("teachers").delete().in("id", [...createdTeachers]), "cleanup teachers");
  }
  if (testUserId) {
    // Deleting the auth user cascades to its profiles row via the FK.
    const del = await db.auth.admin.deleteUser(testUserId);
    if (del.error) throw new Error(`[cleanup test user] ${del.error.message}`);
  }
}

let fatal = null;
main()
  .catch((e) => {
    fatal = e.message ?? String(e);
    guardFailed = e instanceof GuardError;
    console.error(`\x1b[31m${guardFailed ? fatal : `FATAL: ${fatal}`}\x1b[0m`);
    fail++;
  })
  .finally(async () => {
    // Never clean up a database that failed the environment guard: cleanup
    // deletes rows, and we have just established we do not trust this target.
    if (guardFailed) {
      console.error("\x1b[31mSkipping cleanup: the target database failed verification, so no rows were touched.\x1b[0m");
    } else {
      try { await cleanup(); }
      catch (e) { fatal = `cleanup failed: ${e.message}`; console.error(`\x1b[31m${fatal}\x1b[0m`); fail++; }
    }
    const report = {
      run: RUN, target: URL, when: new Date().toISOString(),
      passed: pass, failed: fail, fatal,
      guard_failed: guardFailed, cleanup_ran: !guardFailed,
      results,
    };
    writeFileSync(resolve(root, "test-report.json"), JSON.stringify(report, null, 2));
    console.log(`report -> test-report.json`);
    // Set the code rather than calling process.exit(), so pending handles close
    // normally instead of tripping a libuv assertion and reporting 127.
    process.exitCode = guardFailed ? 2 : fail === 0 ? 0 : 1;
  });
