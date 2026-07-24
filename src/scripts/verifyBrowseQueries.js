// verifyBrowseQueries.js — run the catalogue's REAL queries against staging.
//
// The unit tests assert what the hook *asks for* against a fake builder. They
// cannot tell us whether PostgREST accepts the syntax: an aliased nested inner
// join (`pv:playlist_videos!inner(videos!inner(chapter_id))`) plus a filter on
// `pv.videos.chapter_id` either resolves server-side or fails at runtime, and a
// mock will happily record either.
//
//   npm run verify:browse      (uses .env.staging — never production)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
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
const stg = readEnv(".env.staging");
const prod = readEnv(".env");
const URL = process.env.TEST_SUPABASE_URL ?? stg.TEST_SUPABASE_URL;
const KEY = process.env.TEST_SERVICE_KEY ?? stg.TEST_SERVICE_KEY;
const die = (m) => { console.error(`\x1b[31m${m}\x1b[0m`); process.exit(2); };
if (!URL || !KEY) die("Set TEST_SUPABASE_URL / TEST_SERVICE_KEY in .env.staging");
if (prod.VITE_SUPABASE_URL && URL === prod.VITE_SUPABASE_URL) die("Refusing: that is production.");

const db = createClient(URL, KEY, { auth: { persistSession: false } });
const PAGE_SIZE = 12;
let pass = 0, fail = 0;
const ok = (n, c, d) => { console.log(`${c ? "\x1b[32m✓" : "\x1b[31m✗"} ${n}\x1b[0m${d ? "  " + d : ""}`); c ? pass++ : fail++; };

// Exactly the column list usePlaylistBrowse builds.
const cols = (goalId, chapterId) =>
  "id, title, teacher, average_rating, ratings_count, language, content_type," +
  " difficulty, class_levels, institutes_channels(name), subjects(name)," +
  " playlist_videos(count)" +
  (goalId ? ", playlist_learning_goals!inner(learning_goal_id)" : "") +
  (chapterId ? ", pv:playlist_videos!inner(videos!inner(chapter_id))" : "");

const build = ({ goalId, subjectId, chapterId, search, page = 0 }) => {
  let q = db.from("playlists").select(cols(goalId, chapterId), { count: "exact" })
    .order("ratings_count", { ascending: false }).order("title")
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (goalId) q = q.eq("playlist_learning_goals.learning_goal_id", goalId);
  if (subjectId) q = q.eq("subject_id", subjectId);
  if (chapterId) q = q.eq("pv.videos.chapter_id", chapterId);
  if (search) q = q.ilike("title", `%${search}%`);
  return q;
};

console.log(`\x1b[36m• target: ${URL}\x1b[0m\n`);

// reference ids
const goals = (await db.from("learning_goals").select("id, slug")).data ?? [];
const chapters = (await db.from("chapters").select("id, name")).data ?? [];
const subjects = (await db.from("subjects").select("id, slug")).data ?? [];
const cats = (await db.from("categories").select("id, name")).data ?? [];
const jee = goals.find((g) => g.slug === "jee")?.id;
const neet = goals.find((g) => g.slug === "neet")?.id;
const chap = chapters[0]?.id;

// ---- FIXTURES -------------------------------------------------------------
// Without these the goal and chapter filters match zero rows, and every
// isolation assertion passes VACUOUSLY — it proves PostgREST accepts the
// syntax, not that the filter selects the right courses. Seed a known shape,
// assert against it, then remove it.
const TAG = "BQV" + Math.random().toString(36).slice(2, 7).toUpperCase();
const seeded = { playlists: [], videos: [], channel: null };

async function seed() {
  const { data: ch, error: chErr } = await db.from("institutes_channels")
    .insert({ name: `Query Fixture ${TAG}`, youtube_channel_id: `UC${TAG}fixture01` })
    .select("id").single();
  if (chErr) die(`seed channel: ${chErr.message}`);
  seeded.channel = ch.id;

  const subject = subjects.find((s) => s.slug === "physics")?.id ?? subjects[0]?.id;
  const category = cats.find((c) => c.name === "JEE")?.id ?? cats[0]?.id;

  for (const [label, goalId] of [["JEE", jee], ["NEET", neet]]) {
    const { data: pl, error } = await db.from("playlists")
      .insert({ title: `${TAG} ${label} course`, channel_id: ch.id, category_id: category, subject_id: subject })
      .select("id").single();
    if (error) die(`seed playlist: ${error.message}`);
    seeded.playlists.push(pl.id);
    await db.from("playlist_learning_goals").insert({ playlist_id: pl.id, learning_goal_id: goalId });

    const { data: v, error: vErr } = await db.from("videos")
      .insert({ youtube_video_id: `${TAG}${label.slice(0, 1)}0000000`.slice(0, 11),
                title: `${TAG} ${label} lecture`, channel_id: ch.id,
                category_id: category, subject_id: subject, chapter_id: chap })
      .select("id").single();
    if (vErr) die(`seed video: ${vErr.message}`);
    seeded.videos.push(v.id);
    await db.from("playlist_videos").insert({ playlist_id: pl.id, video_id: v.id, position: 1 });
  }
  console.log(`  seeded ${seeded.playlists.length} playlists / ${seeded.videos.length} videos (tag ${TAG})\n`);
}

async function teardown() {
  if (seeded.playlists.length) await db.from("playlists").delete().in("id", seeded.playlists);
  if (seeded.videos.length) await db.from("videos").delete().in("id", seeded.videos);
  if (seeded.channel) await db.from("institutes_channels").delete().eq("id", seeded.channel);
  const left = (await db.from("playlists").select("id").like("title", `${TAG}%`)).data ?? [];
  ok("fixtures cleaned up", left.length === 0, `${left.length} left`);
}

await seed();

// 1. unfiltered
{
  const { error, count } = await build({});
  ok("unfiltered query is accepted by PostgREST", !error, error?.message ?? `count=${count}`);
}
// 2. goal join
{
  const { data, error, count } = await build({ goalId: jee });
  ok("goal inner-join + eq is accepted", !error, error?.message ?? `jee count=${count}`);
  if (!error) {
    const ids = (data ?? []).map((r) => r.id);
    const { data: check } = await db.from("playlist_learning_goals")
      .select("playlist_id, learning_goal_id").in("playlist_id", ids.length ? ids : [-1]);
    const leaked = (check ?? []).filter((r) => ids.includes(r.playlist_id))
      .reduce((acc, r) => { (acc[r.playlist_id] ??= []).push(r.learning_goal_id); return acc; }, {});
    const bad = Object.entries(leaked).filter(([, gs]) => !gs.includes(jee));
    ok("every returned playlist really carries the JEE goal", bad.length === 0, JSON.stringify(bad));
  }
}
// 3. goal isolation: JEE vs NEET disjoint where tagging differs
{
  const a = await build({ goalId: jee });
  const b = await build({ goalId: neet });
  ok("NEET query accepted", !b.error, b.error?.message ?? `neet count=${b.count}`);
  if (!a.error && !b.error) {
    const A = new Set((a.data ?? []).map((r) => r.id));
    const overlap = (b.data ?? []).filter((r) => A.has(r.id)).map((r) => r.id);
    ok("JEE and NEET result sets are computed independently",
       a.count !== null && b.count !== null,
       `jee=${a.count} neet=${b.count} shared=${overlap.length} (shared is legitimate for multi-goal courses)`);
  }
}
// 4. THE risky one — aliased nested inner join with a nested filter
{
  const { error, count, data } = await build({ chapterId: chap });
  ok("aliased NESTED inner join (pv.videos.chapter_id) is accepted", !error,
     error?.message ?? `chapter ${chap} count=${count}`);
  if (!error && (data ?? []).length) {
    const ids = data.map((r) => r.id);
    const { data: pv } = await db.from("playlist_videos")
      .select("playlist_id, videos!inner(chapter_id)")
      .in("playlist_id", ids).eq("videos.chapter_id", chap);
    const withChapter = new Set((pv ?? []).map((r) => r.playlist_id));
    ok("every returned playlist really contains a video in that chapter",
       ids.every((id) => withChapter.has(id)),
       `${ids.filter((id) => !withChapter.has(id)).length} without`);
  }
}
// 5. goal + chapter together (both joins at once)
{
  const { error, count } = await build({ goalId: jee, chapterId: chap });
  ok("both joins combined are accepted", !error, error?.message ?? `count=${count}`);
}
// 6. pagination is exact and server-side
{
  const p0 = await build({ page: 0 });
  const p1 = await build({ page: 1 });
  ok("page 0 returns at most PAGE_SIZE rows", !p0.error && (p0.data ?? []).length <= PAGE_SIZE,
     p0.error?.message ?? `rows=${(p0.data ?? []).length} of count=${p0.count}`);
  if (!p0.error && !p1.error) {
    const a = new Set((p0.data ?? []).map((r) => r.id));
    const dupes = (p1.data ?? []).filter((r) => a.has(r.id));
    ok("page 1 does not repeat page 0", dupes.length === 0, `dupes=${dupes.length}`);
  }
  // PostgREST answers an out-of-range page with 416, so the HOOK must absorb
  // it. Assert the shape of that error so the hook's handling stays correct.
  const far = await build({ page: 999 });
  const outOfRange = far.error && (far.error.code === "PGRST103" || /range not satisfiable/i.test(far.error.message));
  ok("out-of-range page yields a recognisable 416 the hook absorbs",
     outOfRange || (!far.error && (far.data ?? []).length === 0),
     far.error ? far.error.code + " " + far.error.message : "empty");
}
// 7. count is the FULL matching total, not the page size
{
  const { count, data } = await build({});
  ok("exact count reflects the whole result set, not the page",
     count === null || count >= (data ?? []).length, `count=${count} rows=${(data ?? []).length}`);
}

// 8. NON-VACUOUS isolation: the seeded JEE course must appear under JEE and
//    must NOT appear under NEET. This is the assertion that can actually fail.
{
  const a = await build({ goalId: jee });
  const b = await build({ goalId: neet });
  const jeeIds = (a.data ?? []).map((r) => r.id);
  const neetIds = (b.data ?? []).map((r) => r.id);
  const [seededJee, seededNeet] = seeded.playlists;

  ok("seeded JEE course IS returned by the JEE filter",
     jeeIds.includes(seededJee), `jee rows=${jeeIds.length}`);
  ok("seeded JEE course is NOT returned by the NEET filter",
     !neetIds.includes(seededJee), `neet rows=${neetIds.length}`);
  ok("seeded NEET course IS returned by the NEET filter",
     neetIds.includes(seededNeet), `neet rows=${neetIds.length}`);
  ok("seeded NEET course is NOT returned by the JEE filter",
     !jeeIds.includes(seededNeet), `jee rows=${jeeIds.length}`);
}
// 9. NON-VACUOUS chapter filter
{
  const { data, error } = await build({ chapterId: chap });
  const ids = (data ?? []).map((r) => r.id);
  ok("chapter filter returns the seeded courses that have a video in it",
     !error && seeded.playlists.every((id) => ids.includes(id)),
     error?.message ?? `rows=${ids.length}`);

  const otherChapter = chapters.find((c) => c.id !== chap)?.id;
  if (otherChapter) {
    const { data: other } = await build({ chapterId: otherChapter });
    const otherIds = (other ?? []).map((r) => r.id);
    ok("a DIFFERENT chapter excludes them",
       seeded.playlists.every((id) => !otherIds.includes(id)), `rows=${otherIds.length}`);
  }
}
// 10. goal + chapter combined, non-vacuous
{
  const { data } = await build({ goalId: jee, chapterId: chap });
  const ids = (data ?? []).map((r) => r.id);
  ok("goal AND chapter together return only the JEE seeded course",
     ids.includes(seeded.playlists[0]) && !ids.includes(seeded.playlists[1]),
     `rows=${ids.length}`);
}

await teardown();

console.log(`\n${fail === 0 ? "\x1b[32m" : "\x1b[31m"}${pass} passed, ${fail} failed\x1b[0m`);
process.exitCode = fail === 0 ? 0 : 1;
