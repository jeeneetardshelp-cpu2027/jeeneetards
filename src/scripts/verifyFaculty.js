// verifyFaculty.js — destructive-fixture integration evidence for corrected v7.
//
// SAFETY:
//   1. TEST_ALLOW=1 is required.
//   2. The target URL must differ from the production URL in .env.
//   3. The database itself must contain app_environment = staging|test.
//   4. Cleanup uses exact run-scoped ids; never wildcard prefixes.
//
// Run only after applying staging_bootstrap.sql and faculty_staging_delta.sql to
// a fresh disposable Supabase project:
//   npm run verify:faculty
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
  } catch { /* optional file */ }
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
const CHANNEL = `FCH${RUN}00`;
const playlistId = (suffix) => `FPL${RUN}${suffix}`;
const videoId = (n) => `F${RUN}${String(n).padStart(4, "0")}`;

const createdPlaylistIds = new Set();
const createdVideoIds = new Set();
const createdTeacherIds = new Set();
const createdProposalIds = new Set();
let testUserId = null;
let guardFailed = false;
let cleanupRan = false;
const results = [];
let passed = 0;
let failed = 0;

class GuardError extends Error {}
const must = (result, label) => {
  if (result?.error) throw new Error(`[${label}] ${result.error.code ?? ""} ${result.error.message}`);
  return result.data;
};
const exactCount = (result, label) => {
  if (result?.error) throw new Error(`[${label}] ${result.error.code ?? ""} ${result.error.message}`);
  if (!Number.isInteger(result.count)) throw new Error(`[${label}] database did not return an exact count`);
  return result.count;
};
const check = (name, condition, detail = null) => {
  const ok = Boolean(condition);
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? `\n    ${detail}` : ""}`);
  results.push({ name, passed: ok, detail });
  ok ? passed++ : failed++;
};
const rejectedByAuthorization = (result) => {
  const message = result?.error?.message ?? "";
  return Boolean(result?.error) &&
    (result.error.code === "42501" || /not authorized|permission denied/i.test(message));
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
  const chapters = must(await db.from("chapters").select("id,slug,subject_id"), "chapters");
  const goals = must(await db.from("learning_goals").select("id,slug"), "learning_goals");
  const bySlug = (rows, slug) => rows.find((row) => row.slug === slug)?.id;
  const physics = bySlug(subjects, "physics");
  const refs = {
    category: bySlug(categories, "jee"),
    subject: physics,
    chapter: chapters.find((row) => row.subject_id === physics)?.id,
    goal: bySlug(goals, "jee"),
  };
  for (const [name, value] of Object.entries(refs))
    if (!value) throw new Error(`Staging bootstrap is missing reference: ${name}`);
  return refs;
}

function payload(refs, suffix, extra = {}) {
  const youtube_playlist_id = playlistId(suffix);
  const youtube_video_id = videoId(createdVideoIds.size + 1);
  createdPlaylistIds.add(youtube_playlist_id);
  createdVideoIds.add(youtube_video_id);
  return {
    youtube_playlist_id,
    title: `Faculty verification ${suffix} ${RUN}`,
    category_id: refs.category,
    learning_goal_id: refs.goal,
    subject_id: refs.subject,
    chapter_id: refs.chapter,
    class_labels: ["11th"],
    channel: { name: `Faculty verification ${RUN}`, youtube_channel_id: CHANNEL },
    videos: [{ youtube_video_id, title: `Faculty fixture ${suffix}` }],
    ...extra,
  };
}

async function createTeacher(name, acknowledged = false) {
  const result = await db.rpc("create_teacher", {
    p_display_name: name,
    p_aliases: [],
    p_verified: true,
    p_duplicate_acknowledged: acknowledged,
  });
  const data = must(result, `create_teacher ${name}`);
  createdTeacherIds.add(Number(data.teacher_id));
  return Number(data.teacher_id);
}

async function main() {
  await guardEnvironment();
  const refs = await references();

  const normalized = must(await db.rpc("normalize_person_name", {
    p_name: `डॉ. अमित बिजारणिया ${RUN}`,
  }), "Unicode normalization");
  check("F1 Devanagari survives faculty normalization",
    typeof normalized === "string" && normalized.includes("अमित") && normalized.includes("बिजारणिया"),
    `normalized=${JSON.stringify(normalized)}`);

  const sharedName = `Amit Bijarnia ${RUN}`;
  const sharedAlias = `ABJ${RUN}`;
  const first = await createTeacher(sharedName, false);
  const blockedDuplicate = await db.rpc("create_teacher", {
    p_display_name: sharedName, p_aliases: [], p_verified: true,
    p_duplicate_acknowledged: false,
  });
  check("F2 matching names require explicit duplicate acknowledgement",
    Boolean(blockedDuplicate.error) && /existing faculty already match/i.test(blockedDuplicate.error.message),
    blockedDuplicate.error?.message ?? "duplicate was created silently");
  const second = await createTeacher(sharedName, true);
  check("F3 two real people may share one display name", first !== second, `${first}, ${second}`);

  must(await db.rpc("add_teacher_alias", {
    p_teacher_id: first, p_alias: sharedAlias, p_type: "initials", p_verified: true,
  }), "first shared alias");
  must(await db.rpc("add_teacher_alias", {
    p_teacher_id: second, p_alias: sharedAlias, p_type: "initials", p_verified: true,
  }), "second shared alias");

  const publicHits = must(await anon.rpc("search_teachers", {
    p_query: sharedAlias, p_limit: 10,
  }), "public faculty search");
  const exactIds = publicHits.filter((row) => Number(row.match_rank) === 1).map((row) => Number(row.teacher_id));
  check("F4 a shared verified alias returns both people",
    exactIds.includes(first) && exactIds.includes(second) && exactIds.length === 2,
    JSON.stringify(publicHits));
  check("F5 public results mark the exact alias as ambiguous",
    publicHits.filter((row) => exactIds.includes(Number(row.teacher_id))).every((row) => row.is_ambiguous === true),
    JSON.stringify(publicHits));

  const resolution = must(await db.rpc("resolve_teacher_exact", { p_name: sharedAlias }), "exact resolution");
  check("F6 exact resolution refuses to pick an ambiguous identity",
    resolution?.resolved === false && resolution?.reason === "ambiguous" && resolution.candidates?.length === 2,
    JSON.stringify(resolution));

  const universal = must(await anon.rpc("universal_search", {
    p_query: sharedAlias, p_types: ["faculty"], p_limit: 10, p_offset: 0,
  }), "universal faculty search");
  check("F7 universal student search preserves both ambiguous faculty candidates",
    universal.filter((row) => row.group_key === "faculty").length === 2,
    JSON.stringify(universal));

  const proposedAlias = `Unreviewed${RUN}`;
  must(await db.rpc("add_teacher_alias", {
    p_teacher_id: first, p_alias: proposedAlias, p_type: "nickname", p_verified: false,
  }), "proposed alias");
  const hidden = must(await anon.rpc("search_teachers", {
    p_query: proposedAlias, p_limit: 10,
  }), "public proposed-alias search");
  check("F8 a proposed alias is invisible to students", hidden.length === 0, JSON.stringify(hidden));
  const adminHits = must(await db.rpc("search_teacher_candidates", {
    p_query: proposedAlias, p_limit: 10,
  }), "admin candidate search");
  check("F9 the admin review search can see the proposed alias",
    adminHits.some((row) => Number(row.teacher_id) === first && row.alias_status === "proposed"),
    JSON.stringify(adminHits));

  const directAliases = must(await anon.from("teacher_aliases")
    .select("teacher_id,alias,status").in("teacher_id", [first, second]), "anon aliases");
  check("F10 direct REST exposes only verified aliases",
    directAliases.length >= 4 && directAliases.every((row) => row.status === "verified") &&
      directAliases.filter((row) => row.alias === sharedAlias).length === 2,
    JSON.stringify(directAliases));

  // The scanner must create proposals only. Capture the exact new proposal ids
  // because staging_bootstrap contains other legacy free-text values too.
  const legacy = `Legacy Faculty ${RUN}`;
  const legacyPayload = payload(refs, "LEG", { teacher: legacy });
  must(await db.rpc("import_playlist", { payload: legacyPayload, mode: "merge" }), "legacy import");
  const proposalsBefore = must(await db.from("teacher_name_proposals").select("id"), "proposals before");
  const proposalBeforeIds = new Set(proposalsBefore.map((row) => Number(row.id)));
  const countsBefore = {
    teachers: exactCount(await db.from("teachers").select("id", { count: "exact", head: true }), "teachers before count"),
    aliases: exactCount(await db.from("teacher_aliases").select("id", { count: "exact", head: true }), "aliases before count"),
    links: exactCount(await db.from("playlist_teachers").select("playlist_id", { count: "exact", head: true }), "links before count"),
  };
  const scan = must(await db.rpc("scan_free_text_teachers"), "proposal scan");
  const proposalsAfter = must(await db.from("teacher_name_proposals").select("id,raw_teacher,status"), "proposals after");
  proposalsAfter.filter((row) => !proposalBeforeIds.has(Number(row.id)))
    .forEach((row) => createdProposalIds.add(Number(row.id)));
  const afterCounts = {
    teachers: exactCount(await db.from("teachers").select("id", { count: "exact", head: true }), "teachers after count"),
    aliases: exactCount(await db.from("teacher_aliases").select("id", { count: "exact", head: true }), "aliases after count"),
    links: exactCount(await db.from("playlist_teachers").select("playlist_id", { count: "exact", head: true }), "links after count"),
  };
  check("F11 scanning legacy text creates proposals but no identities or links",
    scan.teachers_created === 0 && scan.aliases_created === 0 && scan.playlist_links_created === 0 &&
      countsBefore.teachers === afterCounts.teachers && countsBefore.aliases === afterCounts.aliases &&
      countsBefore.links === afterCounts.links &&
      proposalsAfter.some((row) => row.raw_teacher === legacy && row.status === "pending"),
    JSON.stringify({ scan, countsBefore, afterCounts }));

  const invalidPayload = payload(refs, "BAD", { teacher_ids: [999999999] });
  const invalid = await db.rpc("import_playlist_with_teachers", { payload: invalidPayload, mode: "merge" });
  const invalidRows = must(await db.from("playlists").select("id")
    .eq("youtube_playlist_id", invalidPayload.youtube_playlist_id), "invalid rollback lookup");
  check("F12 an unknown faculty id is rejected before any playlist write",
    Boolean(invalid.error) && /unknown teacher_id/i.test(invalid.error.message) && invalidRows.length === 0,
    `${invalid.error?.message ?? "no error"}; rows=${invalidRows.length}`);

  const linkedPayload = payload(refs, "LINK", { teacher_ids: [first, second] });
  const linkedImport = must(await db.rpc("import_playlist_with_teachers", {
    payload: linkedPayload, mode: "merge",
  }), "faculty-aware import");
  const playlist = Number(linkedImport.playlist_id);
  const links = must(await db.from("playlist_teachers").select("teacher_id,role,position")
    .eq("playlist_id", playlist).order("position"), "ordered faculty links");
  check("F13 non-empty teacher_ids replaces with an explicit teaching order",
    links.length === 2 && Number(links[0].teacher_id) === first && links[0].role === "instructor" &&
      Number(links[1].teacher_id) === second && links[1].role === "co-instructor",
    JSON.stringify(links));

  const preservePayload = { ...linkedPayload };
  delete preservePayload.teacher_ids;
  must(await db.rpc("import_playlist", { payload: preservePayload, mode: "merge" }), "omitted faculty import");
  const preserved = must(await db.from("playlist_teachers").select("teacher_id")
    .eq("playlist_id", playlist), "preserved links");
  check("F14 an omitted teacher_ids key preserves existing links", preserved.length === 2, JSON.stringify(preserved));

  must(await db.rpc("import_playlist_with_teachers", {
    payload: { ...linkedPayload, teacher_ids: [] }, mode: "merge",
  }), "clear faculty links");
  const cleared = must(await db.from("playlist_teachers").select("teacher_id")
    .eq("playlist_id", playlist), "cleared links");
  check("F15 an explicit empty teacher_ids array clears links", cleared.length === 0, JSON.stringify(cleared));

  const anonPayload = payload(refs, "ANON", { teacher_ids: [first] });
  const anonImport = await anon.rpc("import_playlist_with_teachers", { payload: anonPayload, mode: "merge" });
  check("F16 anonymous faculty import is rejected by authorization",
    rejectedByAuthorization(anonImport), anonImport.error?.message ?? "no error");
  check("F17 anonymous admin candidate search is rejected",
    rejectedByAuthorization(await anon.rpc("search_teacher_candidates", { p_query: sharedAlias, p_limit: 5 })));
  check("F18 anonymous proposal review is rejected",
    rejectedByAuthorization(await anon.rpc("get_faculty_review_groups", { p_status: "pending" })));

  const email = `faculty-${RUN}@example.com`;
  const password = `Faculty-${RUN}-Aa1!`;
  const made = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (made.error) throw new Error(`[create non-admin user] ${made.error.message}`);
  testUserId = made.data.user.id;
  const user = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  must(await user.auth.signInWithPassword({ email, password }), "sign in non-admin");
  const userSearch = await user.rpc("search_teacher_candidates", { p_query: sharedAlias, p_limit: 5 });
  const userImport = await user.rpc("import_playlist_with_teachers", { payload: anonPayload, mode: "merge" });
  const userReview = await user.rpc("get_faculty_review_groups", { p_status: "pending" });
  check("F19 signed-in non-admin is rejected by all faculty admin entry points",
    [userSearch, userImport, userReview].every(rejectedByAuthorization),
    JSON.stringify([userSearch.error?.message, userImport.error?.message, userReview.error?.message]));

  console.log(`\n${passed} passed, ${failed} failed`);
}

async function cleanup() {
  const playlistIds = [...createdPlaylistIds];
  if (playlistIds.length)
    must(await db.from("playlists").delete().in("youtube_playlist_id", playlistIds), "cleanup playlists");
  const videoIds = [...createdVideoIds];
  if (videoIds.length)
    must(await db.from("videos").delete().in("youtube_video_id", videoIds), "cleanup videos");
  must(await db.from("institutes_channels").delete().eq("youtube_channel_id", CHANNEL), "cleanup channel");
  if (createdProposalIds.size)
    must(await db.from("teacher_name_proposals").delete().in("id", [...createdProposalIds]), "cleanup proposals");
  if (createdTeacherIds.size)
    must(await db.from("teachers").delete().in("id", [...createdTeacherIds]), "cleanup teachers");
  if (testUserId) {
    const removed = await db.auth.admin.deleteUser(testUserId);
    if (removed.error) throw new Error(`[cleanup user] ${removed.error.message}`);
  }

  const residue = {
    playlists: must(await db.from("playlists").select("id").in("youtube_playlist_id", playlistIds), "verify playlist cleanup").length,
    videos: must(await db.from("videos").select("id").in("youtube_video_id", videoIds), "verify video cleanup").length,
    channel: must(await db.from("institutes_channels").select("id").eq("youtube_channel_id", CHANNEL), "verify channel cleanup").length,
    teachers: createdTeacherIds.size
      ? must(await db.from("teachers").select("id").in("id", [...createdTeacherIds]), "verify teacher cleanup").length : 0,
    proposals: createdProposalIds.size
      ? must(await db.from("teacher_name_proposals").select("id").in("id", [...createdProposalIds]), "verify proposal cleanup").length : 0,
  };
  if (Object.values(residue).some(Boolean)) throw new Error(`cleanup residue: ${JSON.stringify(residue)}`);
  cleanupRan = true;
  console.log(`Cleanup confirmed: ${JSON.stringify(residue)}`);
}

let fatal = null;
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
  writeFileSync(resolve(root, "faculty-test-report.json"), JSON.stringify({
    run: RUN, target: URL, when: new Date().toISOString(),
    passed, failed, fatal, guard_failed: guardFailed, cleanup_ran: cleanupRan, results,
  }, null, 2));
  console.log("report -> faculty-test-report.json");
  process.exitCode = guardFailed ? 2 : failed ? 1 : 0;
});
