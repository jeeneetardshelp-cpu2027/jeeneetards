// progress.js — lightweight watch history in the browser's localStorage.
//
// No account, no database table: progress is per-device and private. This
// powers "Continue watching", "Recently viewed", resume-at-lesson, and the
// watched ticks in the lesson list. If we later add accounts, this becomes
// the offline mirror of a server-side progress table.

const KEY = "ll_progress_v1";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAll(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* storage full or blocked — progress is best-effort */
  }
}

// Record that lesson playback actually started. One entry per course
// (playlist), updated in place. Returns the updated entry so callers can
// reflect it immediately. Route entry and lesson selection must not call this.
export function recordLessonView({
  playlistId, chapterId, courseTitle, videoId, videoTitle, position, totalLessons,
}) {
  if (!playlistId || !videoId) return null;
  const all = readAll();
  const key = String(playlistId);
  const prev = all[key] ?? { watched: [] };
  const watched = prev.watched.includes(videoId)
    ? prev.watched
    : [...prev.watched, videoId];

  const entry = {
    playlistId: Number(playlistId),
    chapterId: Number(chapterId),
    courseTitle: courseTitle ?? prev.courseTitle ?? "Course",
    lastVideoId: videoId,
    lastVideoTitle: videoTitle ?? "",
    lastPosition: position ?? null,
    totalLessons: totalLessons ?? prev.totalLessons ?? null,
    watched,
    updatedAt: Date.now(),
  };
  // Per-lesson resume points are owned by recordLessonPosition; a new view
  // must not wipe them when it rebuilds the entry.
  if (prev.positions) entry.positions = prev.positions;
  all[key] = entry;
  writeAll(all);
  return entry;
}

// Fine-grained resume point for one lesson, merged into the course entry.
// Deliberately narrow: it never marks a video watched and never moves
// lastVideoId/lastVideoTitle — recordLessonView owns those. Playback should
// always follow a recordLessonView, but the store tolerates a missing entry
// by creating a minimal one rather than throwing.
export function recordLessonPosition({ playlistId, videoId, seconds, duration }) {
  if (!playlistId || !videoId) return null;
  const t = Number(seconds);
  if (!Number.isFinite(t) || t < 0) return null;
  const d = Number(duration);
  const all = readAll();
  const key = String(playlistId);
  const entry = all[key] ?? { playlistId: Number(playlistId), watched: [] };
  entry.positions = {
    ...(entry.positions ?? {}),
    [videoId]: { t, d: Number.isFinite(d) && d > 0 ? d : null, at: Date.now() },
  };
  entry.updatedAt = Date.now();
  all[key] = entry;
  writeAll(all);
  return entry;
}

// Where to resume a lesson, in seconds. 0 means "start from the beginning":
// unknown video, a tiny scrub (under 10s is not a session), or a finished
// watch (at or past 95% of the duration, or within 30s of the end — restart
// rather than resume into the outro). A position with no usable duration
// can't be judged finished, so any real position resumes as-is.
export function getLessonPosition(playlistId, videoId) {
  const pos = readAll()[String(playlistId)]?.positions?.[videoId];
  if (!pos) return 0;
  const t = Number(pos.t);
  if (!Number.isFinite(t) || t < 10) return 0;
  const d = Number(pos.d);
  if (!Number.isFinite(d) || d <= 0) return t;
  if (t >= 0.95 * d || d - t < 30) return 0;
  return t;
}

// Player preferences (playback rate) live under their own key: they apply
// device-wide across every course, not per-course, so they don't belong in
// the progress entries.
const PREFS_KEY = "ll_player_prefs_v1";

export function getPlayerPrefs() {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return { rate: typeof prefs.rate === "number" ? prefs.rate : null };
  } catch {
    return { rate: null };
  }
}

export function savePlayerPrefs({ rate }) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ rate }));
  } catch {
    /* storage full or blocked — prefs are best-effort */
  }
}

// Most recently watched courses, newest first.
export function getContinueWatching(limit = 4) {
  return Object.values(readAll())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

// Most recently viewed chapters (deduped), newest first.
export function getRecentChapters(limit = 6) {
  const seen = new Set();
  const out = [];
  for (const e of Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt)) {
    if (!e.chapterId || seen.has(e.chapterId)) continue;
    seen.add(e.chapterId);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

// Which lesson videos of a course have actually started playing.
export function getWatchedVideoIds(playlistId) {
  return readAll()[String(playlistId)]?.watched ?? [];
}

// Full per-course entry for a truthful Continue button. Reading progress does
// not create it; only genuine YouTube PLAYING events write progress.
export function getCourseProgress(playlistId) {
  return readAll()[String(playlistId)] ?? null;
}

// Fold one server-side video_progress row into this device's localStorage,
// called once per row after a sign-in pull (see progressSync.js). Only ever
// moves data FORWARD: a row is applied only where it is more advanced than
// what is already on this device, so a fresh sign-in on a second device
// can't overwrite progress this device made moments ago but hasn't synced
// yet. `updatedAt` must be the server row's own timestamp (ms), not now().
export function mergeRemoteEntry({
  playlistId, chapterId, courseTitle, videoId, videoTitle, position, duration, watched, updatedAt,
}) {
  if (!playlistId || !videoId || !Number.isFinite(updatedAt)) return null;
  const all = readAll();
  const key = String(playlistId);
  const prev = all[key] ?? { playlistId: Number(playlistId), watched: [] };

  const priorPos = prev.positions?.[videoId];
  if (!priorPos || updatedAt > priorPos.at) {
    prev.positions = {
      ...(prev.positions ?? {}),
      [videoId]: { t: Number(position) || 0, d: Number(duration) > 0 ? Number(duration) : null, at: updatedAt },
    };
  }

  if (watched && !prev.watched.includes(videoId)) {
    prev.watched = [...prev.watched, videoId];
  }

  // "Most recently watched" course-level fields only move forward too — a
  // stale row for a video the student opened months ago must not clobber
  // what this device already knows was watched more recently.
  if (!prev.updatedAt || updatedAt > prev.updatedAt) {
    prev.chapterId = chapterId ?? prev.chapterId;
    prev.courseTitle = courseTitle ?? prev.courseTitle ?? "Course";
    prev.lastVideoId = videoId;
    prev.lastVideoTitle = videoTitle ?? prev.lastVideoTitle ?? "";
    prev.updatedAt = updatedAt;
  }

  all[key] = prev;
  writeAll(all);
  return prev;
}
