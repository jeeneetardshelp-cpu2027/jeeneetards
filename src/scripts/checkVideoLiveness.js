// =====================================================================
//  checkVideoLiveness.js  —  find rotting lessons before a student does.
//
//  The core promise of the site is "tap a lesson, it plays." But 99% of the
//  catalogue had never been re-verified since import (last_verified_at ==
//  created_at), so nobody knew which YouTube videos had since been deleted,
//  made private, or had embedding turned off. This walks every video, asks the
//  YouTube Data API its current state, and:
//
//    • embedding turned off  -> embedding_status = 'blocked'
//        The watch UI already turns 'blocked' into an honest "YouTube only"
//        link (src/MinimalUI.jsx) instead of a dead embed.
//    • deleted / private     -> embedding_status = 'unavailable'
//        Reported for manual review — NOT auto-removed, because deleting a
//        lesson can empty a chapter, and that is a content call for the owner.
//    • still plays           -> status left as-is, last_verified_at refreshed
//        so the next run can skip fresh videos and this becomes cheap to repeat.
//
//  Run locally / on a schedule (service role + server YouTube key, like
//  refreshVideoStats.js — never the VITE_ browser key):
//      node src/scripts/checkVideoLiveness.js               # apply
//      node src/scripts/checkVideoLiveness.js --dry-run     # show, write nothing
//      node src/scripts/checkVideoLiveness.js --limit 200   # only the N stalest
//      node src/scripts/checkVideoLiveness.js --max-age 30  # skip videos verified within 30d
//
//  A report of every dead / newly-blocked video is written to
//  tmp/video-liveness-report.json for the owner to act on. Idempotent.
// =====================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getVideoDetails } from "./youtubeNode.js";
import { planLivenessUpdate, groupUpdates, buildLivenessSql } from "./videoLiveness.js";

const WRITE_CHUNK = 500; // rows per update round-trip

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

function numFlag(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) ? n : fallback;
}

const fail = (m) => { console.error(`\x1b[31m✗ ${m}\x1b[0m`); process.exit(1); };
const ok = (m) => console.log(`\x1b[32m✓ ${m}\x1b[0m`);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limit = numFlag("--limit", Infinity);
  const maxAgeDays = numFlag("--max-age", 0); // 0 = re-check everything
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
  const nowIso = now.toISOString();
  console.log(dryRun ? "DRY RUN — no writes will be made.\n" : "");

  // 1. Read every video. PostgREST caps a request at 1000 rows, so page.
  const videos = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("videos")
      .select("id, youtube_video_id, embedding_status, last_verified_at")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) fail(`reading videos: ${error.message}`);
    videos.push(...data);
    if (data.length < PAGE) break;
  }
  if (!videos.length) { ok("No videos in catalog — nothing to do."); process.exit(0); }

  // 2. Skip videos verified recently (so a scheduled run is cheap), then take
  //    the stalest `--limit` of what remains.
  const ageCutoff = maxAgeDays > 0 ? now.getTime() - maxAgeDays * 86400_000 : Infinity;
  const fresh = (v) => {
    if (!Number.isFinite(ageCutoff)) return false;
    const t = v.last_verified_at ? Date.parse(v.last_verified_at) : NaN;
    return Number.isFinite(t) && t >= ageCutoff;
  };
  const due = videos
    .filter((v) => v.youtube_video_id && !fresh(v))
    .sort((a, b) => {
      const ta = a.last_verified_at ? Date.parse(a.last_verified_at) : 0;
      const tb = b.last_verified_at ? Date.parse(b.last_verified_at) : 0;
      return ta - tb; // stalest (or never-verified) first
    })
    .slice(0, Number.isFinite(limit) ? limit : undefined);

  console.log(
    `${videos.length} videos; checking ${due.length}` +
    `${maxAgeDays > 0 ? ` (skipping those verified within ${maxAgeDays}d)` : ""}` +
    `${Number.isFinite(limit) ? ` (--limit ${limit})` : ""}.`,
  );
  if (!due.length) { ok("Everything already fresh — nothing to check."); process.exit(0); }

  // 3. Ask YouTube. getVideoDetails batches 50 ids/call and omits any video the
  //    API would not return — that omission is the "dead" signal.
  let details;
  try {
    details = await getVideoDetails(ytKey, due.map((v) => v.youtube_video_id));
  } catch (e) {
    fail(`YouTube API error: ${e.message}`);
  }

  // 4. Decide each video's fate (pure, unit-tested in videoLiveness.test.js).
  const { summary, updates, dead } = planLivenessUpdate(due, details, nowIso);
  console.log(
    `\n  live & embeddable : ${summary.embeddable}\n` +
    `  embedding blocked : ${summary.blocked}\n` +
    `  dead (unavailable): ${summary.unavailable}\n` +
    `  status changed    : ${summary.changed}\n`,
  );

  // 5. Write a report of everything that needs attention, always (even in a dry
  //    run) — this is the deliverable the owner reviews before removing videos.
  const attention = updates.filter((u) => u.wasChanged);
  const report = {
    generated_at: nowIso,
    dry_run: dryRun,
    summary,
    newly_blocked: attention
      .filter((u) => u.embedding_status === "blocked")
      .map((u) => ({ id: u.id, youtube_video_id: u.youtube_video_id, was: u.previous })),
    dead: dead.map((d) => {
      const u = updates.find((x) => x.id === d.id);
      return {
        id: d.id,
        youtube_video_id: d.youtube_video_id,
        watch_url: `https://www.youtube.com/watch?v=${d.youtube_video_id}`,
        was: u?.previous ?? null,
      };
    }),
    recovered: attention
      .filter((u) => u.embedding_status === "embeddable" && u.previous !== null)
      .map((u) => ({ id: u.id, youtube_video_id: u.youtube_video_id, was: u.previous })),
  };
  const here = dirname(fileURLToPath(import.meta.url));
  const reportDir = resolve(here, "../../tmp");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = resolve(reportDir, "video-liveness-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  ok(`Report written to ${reportPath} (${report.dead.length} dead, ${report.newly_blocked.length} newly blocked).`);

  // Also emit a reviewable SQL file with just the status changes, for the
  // Supabase SQL-editor workflow (no server keys needed to apply it there).
  const sql = buildLivenessSql(updates, nowIso);
  if (sql) {
    const sqlPath = resolve(reportDir, "video-liveness-changes.sql");
    writeFileSync(sqlPath, sql);
    ok(`SQL for ${summary.changed} status change(s) written to ${sqlPath} — review, then paste it into the Supabase SQL editor to apply the changes there.`);
  }

  // 6. Persist with real UPDATEs, never upsert. `videos` has NOT NULL columns
  //    (title, channel_id, category_id, subject_id) with no defaults, so an
  //    upsert-by-id would take the INSERT path and fail the NOT NULL check
  //    before the conflict resolves. Group the work so it is a handful of bulk
  //    UPDATE ... WHERE id IN (...) calls instead of one per row:
  //      • unchanged videos -> only last_verified_at (status stays whatever it is)
  //      • changed videos   -> new embedding_status + last_verified_at, grouped
  //                            by the target status.
  const { unchanged: unchangedIds, changedByStatus } = groupUpdates(updates);

  if (dryRun) {
    console.log(`\nWould update ${updates.length} row(s):`);
    console.log(`  • ${unchangedIds.length} × refresh last_verified_at only`);
    for (const [status, ids] of changedByStatus) {
      console.log(`  • ${ids.length} × set embedding_status='${status}' + last_verified_at`);
    }
    ok("Dry run complete — no writes made.");
    process.exit(0);
  }

  // Chunk the IN() lists so no single request URL grows unbounded.
  const updateIn = async (ids, patch, label) => {
    for (let i = 0; i < ids.length; i += WRITE_CHUNK) {
      const slice = ids.slice(i, i + WRITE_CHUNK);
      const { error } = await db.from("videos").update(patch).in("id", slice);
      if (error) fail(`writing videos (${label}): ${error.message}`);
      console.log(`  ${label}: ${Math.min(i + WRITE_CHUNK, ids.length)}/${ids.length}`);
    }
  };

  await updateIn(unchangedIds, { last_verified_at: nowIso }, "verify");
  for (const [status, ids] of changedByStatus) {
    await updateIn(ids, { embedding_status: status, last_verified_at: nowIso }, status);
  }

  ok(`Done. Verified ${updates.length} video(s); ${summary.changed} status change(s).`);
  if (dead.length) {
    console.log(
      `\n\x1b[33m${dead.length} video(s) are gone from YouTube and are now marked 'unavailable'.\x1b[0m\n` +
      `Review ${reportPath} and decide whether to remove them (a chapter may lose coverage).`,
    );
  }
}

main().catch((e) => fail(e.stack || e.message));
