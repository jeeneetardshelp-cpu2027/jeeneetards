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
  all[key] = entry;
  writeAll(all);
  return entry;
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
