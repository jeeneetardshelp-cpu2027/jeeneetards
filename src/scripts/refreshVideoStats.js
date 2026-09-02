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
const PAGE = 1000; // PostgREST's own ceiling per request

/**
 * Read a whole table, not the first page of it.
 *
 * PostgREST caps an unbounded select at 1000 rows and says nothing about it.
 * That silently made this job a no-op for most of the catalogue: 5,471 videos
 * and 5,477 playlist_videos rows, of which it saw 1,000 each — so 82% of the
 * library never got stats, and the rollup that decides course popularity was
 * computed from a fifth of its members. Both failures look exactly like
 * success in the console output.
 */
async function readAll(db, table, columns, orderBy = "id") {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) fail(`reading ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

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
  const videos = await readAll(db, "videos", "id, youtube_video_id, published_at");
  if (!videos.length) { ok("No videos in catalog — nothing to do."); process.exit(0); }

  const existing = await readAll(db, "video_stats", "video_id, fetched_at", "video_id");
  const fetchedAt = new Map(existing.map((r) => [r.video_id, r.fetched_at]));

  const stale = videos.filter((v) => isStale(fetchedAt.get(v.id), now, REFRESH_INTERVAL_DAYS));
  console.log(`${videos.length} videos, ${stale.length} stale (older than ${REFRESH_INTERVAL_DAYS}d or never fetched).`);

  // 2. Fetch fresh statistics from YouTube (50 ids/call = 1 quota unit each).
  let updated = 0, gone = 0;
  if (stale.length) {
    const byYtId = new Map(stale.map((v) => [v.youtube_video_id, v]));
    const stats = await getVideoStats(ytKey, [...byYtId.keys()]);

    const rows = [];
    // Publish dates we learned from YouTube for videos the catalogue had none
    // for. Backfilled below so the NEXT run — and anything else that wants a
    // video's age — does not have to ask YouTube again.
    const backfill = [];
    for (const [ytId, video] of byYtId) {
      const s = stats.get(ytId);
      if (!s) { gone += 1; continue; } // deleted/private on YouTube
      // Prefer what YouTube just told us over what the row holds: published_at
      // is null on every video in production today, and passing that null is
      // what silently reduced popularity_score to a raw view count.
      const publishedAt = s.publishedAt ?? video.published_at ?? null;
      if (s.publishedAt && !video.published_at) {
        backfill.push({ id: video.id, published_at: s.publishedAt });
      }
      rows.push({
        video_id: video.id,
        ...computeVideoStats(
          { viewCount: s.viewCount, likeCount: s.likeCount, publishedAt },
          now,
        ),
        fetched_at: now.toISOString(),
      });
    }

    if (backfill.length) {
      if (dryRun) {
        console.log(`Would backfill published_at on ${backfill.length} video(s).`);
      } else {
        // UPDATE per row, not upsert. videos.id is GENERATED ALWAYS, so any
        // statement naming it is refused outright ("cannot insert a
        // non-DEFAULT value into column id") — and an upsert always names the
        // conflict target. Each row carries a different date, so there is no
        // single-statement form; batched concurrently to keep it to seconds.
        //
        // Non-fatal on purpose. This is an optimisation — the stats written
        // below already use the date fetched from YouTube — so a failure here
        // must not cost the run its actual work.
        let backfilled = 0;
        let failedBackfills = 0;
        for (let i = 0; i < backfill.length; i += 50) {
          const results = await Promise.all(
            backfill.slice(i, i + 50).map(({ id, published_at }) =>
              db.from("videos").update({ published_at }).eq("id", id)),
          );
          for (const { error } of results) {
            if (error) failedBackfills += 1;
            else backfilled += 1;
          }
        }
        console.log(
          `Backfilled published_at on ${backfilled} video(s)`
          + `${failedBackfills ? `, ${failedBackfills} failed` : ""}.`,
        );
      }
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
  const members = await readAll(db, "playlist_videos", "playlist_id, video_id");

  const allStats = await readAll(db, "video_stats", "video_id, view_count, popularity_score, fetched_at", "video_id");
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
