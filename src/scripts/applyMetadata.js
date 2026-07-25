// applyMetadata.js — apply APPROVED comparison metadata (reviewed 2026-07-21)
// to existing playlists: content type + difficulty + language. Evidence-based
// and user-approved, not invented. Run with both safeguards:
// npm run backfill -- --confirm --expected-count=<reviewed-count>
//
//   #1 Complete Kinematics (3 lectures) -> Revision; the rest -> Full course.
//   All: difficulty Advanced ("IIT JEE main advanced" content), language Hinglish.
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
  console.error(`\x1b[31m${error.message}\x1b[0m`);
  process.exit(1);
}
const env = {};
for (const l of readFileSync(resolve(here, "../../.env"), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: pls, error: listError } = await db.from("playlists").select("id");
if (listError) {
  console.error(`\x1b[31mPlaylist lookup failed: ${listError.message}\x1b[0m`);
  process.exit(1);
}
try {
  assertExpectedRowCount(expectedCount, pls.length);
} catch (error) {
  console.error(`\x1b[31m${error.message}\x1b[0m`);
  process.exit(1);
}
let n = 0;
for (const p of pls) {
  const contentType = p.id === 1 ? "revision" : "full-course";
  const { error } = await db
    .from("playlists")
    .update({ content_type: contentType, difficulty: "advanced", language: "hinglish" })
    .eq("id", p.id);
  if (error) { console.error(`✗ playlist ${p.id}: ${error.message}`); process.exit(1); }
  n++;
}
console.log(`\x1b[32m✓ Applied content type / difficulty / language to ${n} playlist(s).\x1b[0m`);
process.exit(0);
