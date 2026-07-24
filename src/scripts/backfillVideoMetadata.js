// =====================================================================
//  backfillVideoMetadata.js  —  fill duration/captions/embeddable on
//  videos that don't have them yet, from the YouTube API.
//
//  Run locally (service role, never deployed):
//      node src/scripts/backfillVideoMetadata.js
//
//  Idempotent: only touches rows where duration_seconds is null, so
//  re-running is safe and cheap.
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getVideoDetails } from "./youtubeNode.js";

function loadEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, "../../.env");
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

const fail = (m) => { console.error(`\x1b[31m✗ ${m}\x1b[0m`); process.exit(1); };

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  // Node-side key, NOT the VITE_ one. Anything prefixed VITE_ is inlined into
  // the public browser bundle, so it must be referrer-restricted and is not the
  // right credential for a server-side script that can burn quota in bulk.
  const ytKey = env.YOUTUBE_API_KEY;

  if (!url) fail("VITE_SUPABASE_URL missing from .env");
  if (!ytKey)
    fail("YOUTUBE_API_KEY missing from .env (server-side key — do NOT use VITE_YOUTUBE_API_KEY, that one is public).");
  if (!serviceKey || serviceKey.includes("paste-your"))
    fail("SUPABASE_SERVICE_ROLE_KEY not set in .env (Project Settings → API → service_role).");

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Only rows still missing duration.
  const { data: rows, error } = await db
    .from("videos")
    .select("id, youtube_video_id")
    .is("duration_seconds", null);
  if (error) fail(`reading videos: ${error.message}`);

  if (!rows.length) {
    console.log("Nothing to backfill — every video already has a duration.");
    process.exit(0);
  }
  console.log(`Backfilling ${rows.length} video(s)…`);

  const byYtId = new Map(rows.map((r) => [r.youtube_video_id, r.id]));
  const details = await getVideoDetails(ytKey, [...byYtId.keys()]);

  const now = new Date().toISOString();
  let updated = 0, missing = 0;

  for (const [ytId, rowId] of byYtId) {
    const d = details.get(ytId);
    if (!d) { missing += 1; continue; } // removed/private on YouTube
    const { error: upErr } = await db
      .from("videos")
      .update({
        duration_seconds: d.durationSeconds,
        caption_status: d.captionStatus,
        embedding_status: d.embeddingStatus,
        last_verified_at: now,
      })
      .eq("id", rowId);
    if (upErr) fail(`updating video ${rowId}: ${upErr.message}`);
    updated += 1;
  }

  console.log(`\x1b[32m✓ Updated ${updated} video(s).\x1b[0m`);
  if (missing) console.log(`  ${missing} not found on YouTube (removed/private) — left as-is.`);
  process.exit(0);
}

main().catch((e) => fail(e.message ?? String(e)));
