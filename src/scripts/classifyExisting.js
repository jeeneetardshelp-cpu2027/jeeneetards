// =====================================================================
//  classifyExisting.js  —  one-off: tag existing playlists with a class.
//
//  The current catalogue is all JEE Physics (Kinematics, Laws of Motion,
//  Friction) — Class 11 curriculum — so this tags every playlist as "11th"
//  and writes the matching playlist_class_levels junction row. Correct
//  classification, not invented data; adjust per-course later in admin.
//
//  Run only after reviewing the selected row count:
//  node src/scripts/classifyExisting.js --confirm --expected-count=<reviewed-count>
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  assertExpectedRowCount,
  parseBulkConfirmation,
} from "./ingestionSafety.js";

const here = dirname(fileURLToPath(import.meta.url));
let expectedCount;
try {
  expectedCount = parseBulkConfirmation(process.argv.slice(2));
} catch (error) {
  console.error("Bulk classification stopped: " + error.message);
  process.exit(1);
}
const env = {};
for (const line of readFileSync(resolve(here, "../../.env"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const fail = (m) => { console.error("✗ " + m); process.exit(1); };
if (!env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY.includes("paste-your"))
  fail("SUPABASE_SERVICE_ROLE_KEY missing from .env");

const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: cl, error: clErr } = await db
  .from("class_levels").select("id").eq("slug", "class-11").single();
if (clErr) fail("class_levels lookup: " + clErr.message);
const class11 = cl.id;

const { data: pls, error: plErr } = await db.from("playlists").select("id, class_levels");
if (plErr) fail("playlists: " + plErr.message);
try {
  assertExpectedRowCount(expectedCount, pls.length);
} catch (error) {
  fail(error.message);
}

let updated = 0;
for (const p of pls) {
  const levels = Array.from(new Set([...(p.class_levels || []), "11th"]));
  const { error: uErr } = await db.from("playlists").update({ class_levels: levels }).eq("id", p.id);
  if (uErr) fail(`update playlist ${p.id}: ${uErr.message}`);
  const { error: jErr } = await db.from("playlist_class_levels").upsert(
    { playlist_id: p.id, class_level_id: class11 },
    { onConflict: "playlist_id,class_level_id", ignoreDuplicates: true }
  );
  if (jErr) fail(`junction playlist ${p.id}: ${jErr.message}`);
  updated++;
}
console.log(`\x1b[32m✓ Tagged ${updated} playlist(s) as Class 11 (array + junction).\x1b[0m`);
process.exit(0);
