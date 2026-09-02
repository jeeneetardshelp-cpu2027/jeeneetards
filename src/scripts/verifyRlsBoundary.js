// Read-only privacy contract: prove the anon key still sees only what it
// should. Mirrors verifyProductionCapabilities.js — same env handling, same
// refusal to treat a network failure as proof of anything.
//
// WHY THIS EXISTS. The anon key ships inside every browser bundle, so row-level
// security is not one defence among several: it is the whole boundary. An
// audit on 2026-09-02 found that boundary sound — student watch history and
// abuse reports were invisible to anon while rows existed, ratings exposed the
// review but not the reviewer, and polls and forum were reachable only through
// SECURITY DEFINER functions. Nothing tested any of it. A later migration could
// grant SELECT on the wrong table and every check in this repository would stay
// green.
//
// It never writes. A write that unexpectedly succeeded would itself be the
// damage, so this only ever reads, and only ever reports counts and column
// names — never a row's contents.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(file = ".env") {
  const out = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const at = line.indexOf("=");
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}

const env = fs.existsSync(".env") ? { ...process.env, ...readEnv() } : process.env;
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in .env.");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const networkFailure = (error) => /failed to fetch|fetch failed|network|ENOTFOUND|ECONN/i
  .test(`${error?.message ?? error ?? ""}`);

// Ask for a bounded count without pulling rows.
async function anonCount(table, columns = "*") {
  const { count, error } = await db.from(table).select(columns, { count: "exact", head: true });
  if (error) {
    if (networkFailure(error)) throw new Error(`${table}: inconclusive network failure`);
    return { denied: true, code: error.code ?? "denied" };
  }
  return { denied: false, count: Number(count ?? 0) };
}

// What must never be readable by an anonymous visitor, and why it matters.
// Two shapes count as safe: the table refuses anon outright, or RLS returns no
// rows. Both mean a signed-out stranger learns nothing.
const PRIVATE = [
  ["video_progress", "which lessons a signed-in student has watched"],
  ["study_days", "a student's study streak"],
  ["content_reports", "who reported what, and the note they wrote"],
  ["video_comments", "student comments"],
  ["teacher_name_proposals", "unreviewed identity proposals about real people"],
  ["teacher_proposal_decisions", "the moderation decision log"],
];

// Reachable only through SECURITY DEFINER functions, never as tables.
//
// The third slot names columns to ask for BY NAME as well. A denied `select=*`
// does not prove a named column is denied: playlist_ratings below refuses `*`
// outright and serves "id,rating,review" happily, because the grant is
// column-level. So a table checked only through `*` can be leaking a column.
const RPC_ONLY = [
  ["polls", "poll rows are served by get_polls_feed"],
  ["poll_options", "options ride with the feed"],
  ["forum_topics", "forum reads go through their own functions"],
  ["forum_posts", "forum reads go through their own functions"],
  // Deliberately HERE and not in PRIVATE, which is the point of this entry.
  // PRIVATE accepts "readable but 0 rows" as safe, and search_gap_log is empty
  // on production today — so a PRIVATE check would pass exactly as happily if
  // anon held full SELECT on it, and would keep passing until the first row
  // arrived. What it stores is free text a student typed into the search box,
  // which makes it the last table that should be graded on a technicality.
  // anon writes through log_search_gap (SECURITY DEFINER) and holds no table
  // privilege at all; only admins read it.
  ["search_gap_log", "the words a student typed when a search found nothing",
    ["query_text", "query_key"]],
];

// Readable, but only the columns the product actually shows.
const COLUMN_SCOPED = [
  ["playlist_ratings", "id,rating,review", ["user_id"], "a review is public; who wrote it is not"],
];

// The catalogue. If these stop being readable, signed-out browsing breaks.
const PUBLIC = ["playlists", "videos", "subjects", "chapters", "learning_goals", "institutes_channels"];

const problems = [];
const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { problems.push(m); console.log(`\x1b[31m✗\x1b[0m ${m}`); };

console.log("Anonymous privacy boundary (read-only)\n");

for (const [table, why] of PRIVATE) {
  const r = await anonCount(table);
  if (r.denied) ok(`${table}: anon refused (${r.code}) — ${why}`);
  else if (r.count === 0) ok(`${table}: readable but RLS returns 0 rows — ${why}`);
  else bad(`${table}: ANON CAN READ ${r.count} row(s) — ${why}`);
}

for (const [table, why, columns = []] of RPC_ONLY) {
  const r = await anonCount(table);
  if (r.denied) ok(`${table}: anon refused (${r.code}) — ${why}`);
  else bad(`${table}: anon can select the table directly (${r.count} row(s)) — ${why}`);
  for (const column of columns) {
    const c = await anonCount(table, column);
    if (c.denied) ok(`${table}.${column}: anon refused (${c.code}) even when named`);
    else bad(`${table}.${column}: ANON CAN READ IT (${c.count} row(s)) — ${why}`);
  }
}

for (const [table, allowed, forbidden, why] of COLUMN_SCOPED) {
  const good = await anonCount(table, allowed);
  if (good.denied) bad(`${table}: the columns the product shows (${allowed}) are not readable — ${why}`);
  else ok(`${table}: "${allowed}" readable — ${why}`);
  for (const column of forbidden) {
    const r = await anonCount(table, column);
    if (r.denied) ok(`${table}.${column}: anon refused (${r.code})`);
    else bad(`${table}.${column}: ANON CAN READ IT — ${why}`);
  }
}

for (const table of PUBLIC) {
  const r = await anonCount(table);
  if (r.denied) bad(`${table}: anon CANNOT read it — signed-out browsing would break`);
  else ok(`${table}: readable (${r.count} rows) — the catalogue, public by design`);
}

console.log("");
if (problems.length) {
  console.error(`Privacy boundary FAILED with ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("Anonymous privacy boundary holds.");
