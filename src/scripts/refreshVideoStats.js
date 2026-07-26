// =====================================================================
//  refreshVideoStats.js  —  fetch YouTube view/like counts, recompute
//  popularity, and roll it up onto courses. This is what makes the
//  "Most viewed" / "Most popular" sorts real.
//
//  Run locally / on a schedule (service role, server YouTube key):
//      node src/scripts/refreshVideoStats.js            # apply
//      node src/scripts/refreshVideoStats.js --dry-run  # show, write nothing
//
//  ToS: refreshes stats older than REFRESH_INTERVAL_DAYS and purges any
//  that could not be refreshed for PURGE_AFTER_DAYS (deleted/private
//  videos), keeping every stored statistic well inside YouTube's cadence.
//  Idempotent and safe to re-run.
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getVideoStats } from "./youtubeNode.js";
import { computeVideoStats, isStale, rollupPlaylist } from "./statsMath.js";

const REFRESH_INTERVAL_DAYS = 7; // re-fetch anything older than this
const PURGE_AFTER_DAYS = 30; // ToS ceiling for keeping unrefreshed stats

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
const ok = (m) => console.log(`\x1b[32m✓ ${m}\x1b[0m`);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  // Server-side key, NOT VITE_YOUTUBE_API_KEY (that one is public/bundled).
  const ytKey = env.YOUTUBE_API_KEY;

  if (!url) fail("VITE_SUPABASE_URL missing from .env");
  if (!ytKey)
    fail("YOUTUBE_API_KEY missing from .env (server key — never use VITE_YOUTUBE_API_KEY here).");
  if (!serviceKey || serviceKey.includes("paste-your"))
    fail("SUPABASE_SERVICE_ROLE_KEY not set in .env (Project Settings → API → service_role).");

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();
  console.log(dryRun ? "DRY RUN — no writes will be made.\n" : "");

  // 1. Which videos need a fetch (never-fetched or older than the interval).
  const { data: videos, error: vErr } = await db
    .from("videos")
    .select("id, youtube_video_id, published_at");
  if (vErr) fail(`reading videos: ${vErr.message}`);
  if (!videos.length) { ok("No videos in catalog — nothing to do."); process.exit(0); }

  const { data: existing, error: sErr } = await db
    .from("video_stats")
    .select("video_id, fetched_at");
  if (sErr) fail(`reading video_stats: ${sErr.message}`);
  const fetchedAt = new Map(existing.map((r) => [r.video_id, r.fetched_at]));

  const stale = videos.filter((v) => isStale(fetchedAt.get(v.id), now, REFRESH_INTERVAL_DAYS));
  console.log(`${videos.length} videos, ${stale.length} stale (older than ${REFRESH_INTERVAL_DAYS}d or never fetched).`);

  // 2. Fetch fresh statistics from YouTube (50 ids/call = 1 quota unit each).
  let updated = 0, gone = 0;
  if (stale.length) {
    const byYtId = new Map(stale.map((v) => [v.youtube_video_id, v]));
    const stats = await getVideoStats(ytKey, [...byYtId.keys()]);

    const rows = [];
    for (const [ytId, video] of byYtId) {
      const s = stats.get(ytId);
      if (!s) { gone += 1; continue; } // deleted/private on YouTube
      rows.push({
        video_id: video.id,
        ...computeVideoStats(
          { viewCount: s.viewCount, likeCount: s.likeCount, publishedAt: video.published_at },
          now,
        ),
        fetched_at: now.toISOString(),
      });
    }

    if (dryRun) {
      console.log(`Would upsert ${rows.length} stat row(s). Sample:`, rows.slice(0, 3));
    } else if (rows.length) {
      const { error } = await db.from("video_stats").upsert(rows, { onConflict: "video_id" });
      if (error) fail(`writing video_stats: ${error.message}`);
    }
    updated = rows.length;
  }

  // 3. Purge stats we could not refresh past the ToS ceiling (deleted videos).
  const purgeBefore = new Date(now.getTime() - PURGE_AFTER_DAYS * 86400_000).toISOString();
  if (dryRun) {
    const { count } = await db
      .from("video_stats")
      .select("video_id", { count: "exact", head: true })
      .lt("fetched_at", purgeBefore);
    console.log(`Would purge ${count ?? 0} stat row(s) older than ${PURGE_AFTER_DAYS}d.`);
  } else {
    const { error } = await db.from("video_stats").delete().lt("fetched_at", purgeBefore);
    if (error) fail(`purging stale stats: ${error.message}`);
  }

  // 4. Recompute the popularity rollup on every playlist from member stats.
  const { data: members, error: mErr } = await db
    .from("playlist_videos")
    .select("playlist_id, video_id");
  if (mErr) fail(`reading playlist_videos: ${mErr.message}`);

  const { data: allStats, error: aErr } = await db
    .from("video_stats")
    .select("video_id, view_count, popularity_score, fetched_at");
  if (aErr) fail(`reading video_stats for rollup: ${aErr.message}`);
  const statById = new Map(allStats.map((s) => [s.video_id, s]));

  const byPlaylist = new Map();
  for (const m of members) {
    const s = statById.get(m.video_id);
    if (!s) continue;
    if (!byPlaylist.has(m.playlist_id)) byPlaylist.set(m.playlist_id, []);
    byPlaylist.get(m.playlist_id).push(s);
  }

  let rolled = 0;
  for (const [playlistId, memberStats] of byPlaylist) {
    const roll = rollupPlaylist(memberStats);
    if (dryRun) { rolled += 1; continue; }
    const { error } = await db.from("playlists").update(roll).eq("id", playlistId);
    if (error) fail(`rolling up playlist ${playlistId}: ${error.message}`);
    rolled += 1;
  }

  ok(`${dryRun ? "[dry-run] " : ""}Refreshed ${updated} video(s), ${gone} gone, rolled up ${rolled} course(s).`);
  process.exit(0);
}

main().catch((e) => fail(e.message ?? String(e)));
