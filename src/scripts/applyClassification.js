// applyClassification.js — apply the APPROVED classification to existing
// playlists (reviewed 2026-07-21): all current courses are JEE Physics
// Class 11 topics → applicable class "11th" (droppers reach them via the
// filter's Class-11-inclusion rule), audience_focus "11th".
//
// This blanket update is allowed only after a per-playlist review:
// node src/scripts/applyClassification.js --confirm --expected-count=<reviewed-count>
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  assertExpectedRowCount,
  parseBulkConfirmation,
} from "./ingestionSafety.js";

const here = dirname(fileURLToPath(import.meta.url));
const fail = (message) => {
  console.error(`\x1b[31m${message}\x1b[0m`);
  process.exit(1);
};
let expectedCount;
try {
  expectedCount = parseBulkConfirmation(process.argv.slice(2));
} catch (error) {
  fail(error.message);
}
const env = {};
for (const l of readFileSync(resolve(here, "../../.env"), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: cl, error: classError } = await db
  .from("class_levels").select("id").eq("slug", "class-11").single();
if (classError) fail(`Class lookup failed: ${classError.message}`);
const { data: pls, error: listError } = await db.from("playlists").select("id, class_levels");
if (listError) fail(`Playlist lookup failed: ${listError.message}`);
try {
  assertExpectedRowCount(expectedCount, pls.length);
} catch (error) {
  fail(error.message);
}

let n = 0;
for (const p of pls) {
  const levels = Array.from(new Set([...(p.class_levels || []), "11th"]));
  const { error: updateError } = await db
    .from("playlists")
    .update({ class_levels: levels, audience_focus: "11th" })
    .eq("id", p.id);
  if (updateError) fail(`Playlist ${p.id} update failed: ${updateError.message}`);
  const { error: junctionError } = await db.from("playlist_class_levels").upsert(
    { playlist_id: p.id, class_level_id: cl.id },
    { onConflict: "playlist_id,class_level_id", ignoreDuplicates: true }
  );
  if (junctionError) fail(`Playlist ${p.id} class link failed: ${junctionError.message}`);
  n++;
}
console.log(`\x1b[32m✓ Applied Class 11 classification + audience focus to ${n} playlist(s).\x1b[0m`);
process.exit(0);
