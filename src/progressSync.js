// progressSync.js — best-effort sync of watch progress to Supabase for
// signed-in students. localStorage (progress.js) stays the primary,
// synchronous read path; this pushes updates to the server in the
// background and pulls them back down once on sign-in, so "Continue
// watching" and resume points follow a student across devices.
//
// Sync cadence (owner decision, 2026-07-31): periodic during playback
// (~25s, inside the chosen 20-30s window) + whenever the player reports a
// pause/tab-close/lesson-switch (YouTubePlayer already flushes onProgress
// at those moments — see its reportProgress/flushOnPageHide), plus an
// immediate, unthrottled push when a lesson starts (marks it watched) or
// finishes. A failed push is silent and non-blocking: it never interrupts
// playback, and the next tick or event retries with fresher numbers.

import { supabase, isSupabaseConfigured } from "./supabaseClient";

const TABLE = "video_progress";
const SYNC_INTERVAL_MS = 25000;

const lastSyncedAt = new Map(); // `${playlistId}:${videoDbId}` -> timestamp

function syncKey(playlistId, videoDbId) {
  return `${playlistId}:${videoDbId}`;
}

async function pushNow(userId, entry) {
  try {
    await supabase.from(TABLE).upsert(
      {
        user_id: userId,
        playlist_id: Number(entry.playlistId),
        video_id: Number(entry.videoDbId),
        chapter_id: entry.chapterId ?? null,
        position_seconds: Number.isFinite(entry.position) ? Math.max(0, entry.position) : 0,
        duration_seconds: Number(entry.duration) > 0 ? entry.duration : null,
        watched: Boolean(entry.watched),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,playlist_id,video_id" },
    );
  } catch {
    // Offline or transient failure — localStorage already has this position.
  }
}

// entry: { playlistId, videoDbId, chapterId, position, duration, watched }
// videoDbId is the numeric videos.id (the FK target), NOT the YouTube id.
export function queueProgressSync(userId, entry, { force = false } = {}) {
  if (!isSupabaseConfigured || !userId || !entry?.playlistId || !entry?.videoDbId) return;
  // Refuse a position we cannot vouch for rather than coercing it to 0 in
  // pushNow. A synthesised 0 is not harmless: it is written to the server with
  // a fresh timestamp, and on the next device it looks like the newest known
  // position for that lesson — i.e. an invented "start from the beginning".
  if (!Number.isFinite(Number(entry.position))) return;
  const key = syncKey(entry.playlistId, entry.videoDbId);
  const now = Date.now();
  if (!force && now - (lastSyncedAt.get(key) ?? 0) < SYNC_INTERVAL_MS) return;
  lastSyncedAt.set(key, now);
  pushNow(userId, entry);
}

// One-time pull on sign-in. Embeds videos()/playlists() so each row carries
// enough to reconstruct a localStorage entry without a second round trip.
export async function pullServerProgress(userId) {
  if (!isSupabaseConfigured || !userId) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("playlist_id, chapter_id, position_seconds, duration_seconds, watched, updated_at, " +
      "videos(youtube_video_id, title), playlists(title)")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data
    .filter((row) => row.videos?.youtube_video_id)
    .map((row) => ({
      playlistId: row.playlist_id,
      chapterId: row.chapter_id,
      courseTitle: row.playlists?.title ?? null,
      videoId: row.videos.youtube_video_id,
      videoTitle: row.videos?.title ?? null,
      position: row.position_seconds,
      duration: row.duration_seconds,
      watched: row.watched,
      updatedAt: new Date(row.updated_at).getTime(),
    }));
}
