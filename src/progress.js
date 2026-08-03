// progress.js — lightweight watch history in the browser's localStorage.
//
// No account, no database table: progress is per-device and private. This
// powers "Continue watching", "Recently viewed", resume-at-lesson, and the
// watched ticks in the lesson list. If we later add accounts, this becomes
// the offline mirror of a server-side progress table.

const KEY = "ll_progress_v1";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0;
}

function isVideoId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasCompleteContinueIdentity(entry) {
  return isPositiveInteger(entry?.playlistId)
    && isPositiveInteger(entry?.chapterId)
    && isVideoId(entry?.lastVideoId)
    && Number.isFinite(entry?.updatedAt)
    && entry.updatedAt > 0;
}

function isValidPosition(position) {
  if (!isObject(position)) return false;
  const time = Number(position.t);
  const duration = position.d == null ? null : Number(position.d);
  return Number.isFinite(time)
    && time >= 0
    && (duration === null || (Number.isFinite(duration) && duration > 0))
    && Number.isFinite(position.at)
    && position.at > 0;
}

function hasValidPositions(entry) {
  return isObject(entry?.positions)
    && Object.entries(entry.positions).some(([videoId, position]) => (
      isVideoId(videoId) && isValidPosition(position)
    ));
}

function hasWatchedVideos(entry) {
  return Array.isArray(entry?.watched) && entry.watched.some(isVideoId);
}

function isValidStoredEntry(key, entry) {
  if (!isObject(entry) || !isPositiveInteger(key) || Number(entry.playlistId) !== Number(key)) {
    return false;
  }

  // KEEP anything carrying provably-real data, even if the course-level
  // "continue" fields are incomplete.
  //
  // This used to be all-or-nothing: an entry that had any continue field but
  // failed hasCompleteContinueIdentity (e.g. chapterId null, which is exactly
  // what a lesson whose video spans several chapters produces) was dropped
  // WHOLESALE by readAll -- taking the student's watched ticks and every
  // resume point with it, and persisting the deletion. That is silent data
  // loss, and it was unnecessary: the guards that stop a broken record
  // rendering already live at the consumers -- getContinueWatching filters on
  // hasCompleteContinueIdentity, and getRecentChapters skips a falsy
  // chapterId. Rejection here only ever destroyed salvageable data.
  //
  // Genuine garbage (wrong shape, key/playlistId mismatch, no real positions
  // and no real watched ids) is still rejected.
  return hasCompleteContinueIdentity(entry)
    || hasValidPositions(entry)
    || hasWatchedVideos(entry);
}

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) {
      localStorage.removeItem(KEY);
      return {};
    }

    const validEntries = Object.fromEntries(
      Object.entries(parsed).filter(([key, entry]) => isValidStoredEntry(key, entry)),
    );
    if (Object.keys(validEntries).length !== Object.keys(parsed).length) {
      if (Object.keys(validEntries).length) writeAll(validEntries);
      else localStorage.removeItem(KEY);
    }
    return validEntries;
  } catch {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* storage is blocked */
    }
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
  // chapterId is NOT required to record a watch. A lesson that legitimately
  // spans several chapters carries chapter_id NULL (the catalogue's own
  // convention for "no single correct chapter"), and demanding one here meant
  // such a lesson recorded NOTHING locally — no watched tick, no course entry —
  // while the sync still pushed watched:true and then overwrote it with
  // watched:false read back from the local state that was never written.
  // Only the Continue-watching CARD needs a chapterId, because it builds a
  // /course/:id/chapter/:id URL — and getContinueWatching already enforces that
  // via hasCompleteContinueIdentity.
  if (!isPositiveInteger(playlistId) || !isVideoId(videoId)) {
    return null;
  }
  const all = readAll();
  const key = String(playlistId);
  const prev = all[key] ?? { watched: [] };
  const previousWatched = Array.isArray(prev.watched) ? prev.watched : [];
  const watched = previousWatched.includes(videoId)
    ? previousWatched
    : [...previousWatched, videoId];

  const entry = {
    playlistId: Number(playlistId),
    // null, never NaN, when this lesson has no single chapter. The
    // Continue-watching card builds /course/:id/chapter/:chapterId, so it
    // cannot be rendered for such a lesson — getContinueWatching filters it out
    // on exactly this field. The watched tick and resume point below are still
    // recorded, which is the part that actually matters to the student.
    chapterId: isPositiveInteger(chapterId) ? Number(chapterId) : null,
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
  if (!isPositiveInteger(playlistId) || !isVideoId(videoId)) return null;
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
    .filter(hasCompleteContinueIdentity)
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

// Wipe this device's watch history. Called on sign-out: ll_progress_v1 is a
// single un-namespaced store shared by whoever is using the browser, and
// mergeRemoteEntry only ever ADDS rows, so without this a shared machine (a
// school lab, a family laptop) accumulates a union of every student who has
// signed in — each one seeing the others' courses under "Continue watching"
// and their watched ticks on the lesson lists, with no way to tell whose is
// whose. Safe to lose: a signed-in student's progress is on the server and
// comes back on next sign-in.
export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — nothing to clear */
  }
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
  if (!isPositiveInteger(playlistId)
    || !isPositiveInteger(chapterId)
    || !isVideoId(videoId)
    || !Number.isFinite(updatedAt)
    || updatedAt <= 0) return null;
  const all = readAll();
  const key = String(playlistId);
  const prev = all[key] ?? { playlistId: Number(playlistId), watched: [] };

  // FORWARD-ONLY, and that means the POSITION, not just the timestamp. A
  // newer timestamp carrying a smaller position (a stray 0 from another
  // device, or a re-open that never played) must not wipe out a real resume
  // point — the timestamp alone was the whole bug: a row 1ms newer saying
  // "position 0" destroyed a genuine 12-minute resume point.
  // A finished lesson is the one legitimate way position goes "backwards":
  // getLessonPosition stores seconds=duration on completion and then reads it
  // as restart-from-0, so a remote row at/near its duration still wins.
  const priorPos = prev.positions?.[videoId];
  const remoteT = Number(position) || 0;
  const remoteD = Number(duration) > 0 ? Number(duration) : null;
  const remoteIsFinished = remoteD !== null && remoteT >= 0.95 * remoteD;
  const priorT = Number(priorPos?.t) || 0;
  if (!priorPos || (updatedAt > priorPos.at && (remoteT >= priorT || remoteIsFinished))) {
    prev.positions = {
      ...(prev.positions ?? {}),
      [videoId]: { t: remoteT, d: remoteD, at: updatedAt },
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
