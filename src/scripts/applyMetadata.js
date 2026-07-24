// applyMetadata.js — apply APPROVED comparison metadata (reviewed 2026-07-21)
// to existing playlists: content type + difficulty + language. Evidence-based
// and user-approved, not invented. Run once: node src/scripts/applyMetadata.js
//
//   #1 Complete Kinematics (3 lectures) -> Revision; the rest -> Full course.
//   All: difficulty Advanced ("IIT JEE main advanced" content), language Hinglish.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const l of readFileSync(resolve(here, "../../.env"), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}
const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: pls } = await db.from("playlists").select("id");
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
