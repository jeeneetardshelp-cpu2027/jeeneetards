// Read-only release contract: prove the checked-in frontend capability map
// matches what an anonymous student can actually call in production.
//
// This script never writes. It refuses an inconclusive network response rather
// than treating "could not connect" as proof that a feature is absent.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { RELEASE_CAPABILITIES } from "../releaseCapabilities.js";

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

const env = readEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in .env.");
  process.exit(2);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const missing = (error) => /PGRST202|PGRST205|42P01|does not exist|schema cache/i
  .test(`${error?.code ?? ""} ${error?.message ?? ""}`);
const networkFailure = (error) => /failed to fetch|fetch failed|network|ENOTFOUND|ECONN/i
  .test(`${error?.message ?? error ?? ""}`);

function resultFrom(error, label) {
  if (!error) return { supported: true, detail: "anonymous call succeeded" };
  if (networkFailure(error)) throw new Error(`${label}: inconclusive network failure`);
  if (missing(error)) return { supported: false, detail: error.code ?? "missing" };
  // A validation error proves the function exists, but any authorization or
  // other database error means an anonymous student still cannot use it.
  if (/22023|P0001|23514/.test(error.code ?? ""))
    return { supported: true, detail: `exists (${error.code} validation)` };
  return { supported: false, detail: error.code ?? error.message ?? "unavailable" };
}

async function rpc(name, args) {
  const { error } = await db.rpc(name, args);
  return resultFrom(error, name);
}

async function boardCounts() {
  const { error } = await db
    .from("boards")
    .select("id, name, slug, playlist_boards(count)")
    .order("display_order")
    .limit(1);
  return resultFrom(error, "boards with playlist counts");
}

const actual = {
  catalogNavigation: await rpc("get_browse_curriculum", {
    p_goal: null, p_class: null, p_subject: null,
  }),
  universalSearch: await rpc("universal_search", {
    p_query: "kinematics", p_types: null, p_limit: 1, p_offset: 0,
  }),
  comparison: await rpc("get_playlist_comparison", {
    p_playlist_ids: [1, 2], p_chapter_id: 1, p_learning_goal_id: null,
  }),
  facultyRegistry: await rpc("search_teachers", {
    p_query: "abj", p_limit: 1,
  }),
  boardClassification: await boardCounts(),
};

let failed = 0;
for (const [name, expected] of Object.entries(RELEASE_CAPABILITIES)) {
  const observed = actual[name];
  const pass = observed?.supported === expected;
  if (!pass) failed += 1;
  console.log(`${pass ? "✓" : "✗"} ${name}: manifest=${expected} production=${observed?.supported} (${observed?.detail})`);
}

if (failed) {
  console.error(`\n${failed} production capability mismatch${failed === 1 ? "" : "es"}.`);
  process.exitCode = 1;
} else {
  console.log("\nProduction capability contract passed (anonymous, read-only).");
}
