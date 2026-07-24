// applyClassification.js — apply the APPROVED classification to existing
// playlists (reviewed 2026-07-21): all current courses are JEE Physics
// Class 11 topics → applicable class "11th" (droppers reach them via the
// filter's Class-11-inclusion rule), audience_focus "11th".
//
// Not invented / not blanket: this is the result of the per-playlist review
// the user approved. Run once: node src/scripts/applyClassification.js
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

const { data: cl } = await db.from("class_levels").select("id").eq("slug", "class-11").single();
const { data: pls } = await db.from("playlists").select("id, class_levels");

let n = 0;
for (const p of pls) {
  const levels = Array.from(new Set([...(p.class_levels || []), "11th"]));
  await db.from("playlists").update({ class_levels: levels, audience_focus: "11th" }).eq("id", p.id);
  await db.from("playlist_class_levels").upsert(
    { playlist_id: p.id, class_level_id: cl.id },
    { onConflict: "playlist_id,class_level_id", ignoreDuplicates: true }
  );
  n++;
}
console.log(`\x1b[32m✓ Applied Class 11 classification + audience focus to ${n} playlist(s).\x1b[0m`);
process.exit(0);
