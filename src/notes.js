// notes.js — per-lesson study notes in the browser's localStorage.
//
// No account, no database table (yet): a student's notes are device-local and
// private, exactly like progress.js. This is the first surface that lets a
// student STUDY on the site rather than only watch — jot a formula, a doubt, or
// the minute a concept clicks — and because the notes live here, they are a
// reason to come back that YouTube cannot match.
//
// Keyed by (playlistId, videoId) so every lesson keeps its own notes. A note
// optionally carries the playback second it was taken at, so the panel can jump
// the player back to that moment. If accounts later grow a video_notes table,
// this becomes its offline mirror — the same path progress.js took to
// video_progress.

const KEY = "ll_notes_v1";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isPositiveInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}
function isVideoId(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// A note is real if it has an id, non-empty text, a valid creation time, and
// either no timestamp or a finite non-negative one. Anything else is corruption
// and is dropped on read rather than rendered.
function isValidNote(note) {
  if (!isObject(note)) return false;
  if (typeof note.id !== "string" || note.id.length === 0) return false;
  if (typeof note.text !== "string" || note.text.trim().length === 0) return false;
  if (!(Number.isFinite(note.at) && note.at > 0)) return false;
  if (note.t === null || note.t === undefined) return true;
  return Number.isFinite(note.t) && note.t >= 0;
}

// Keep only the well-formed notes for a (playlist, video) bucket.
function cleanBucket(bucket) {
  const out = {};
  if (!isObject(bucket)) return out;
  for (const [videoId, notes] of Object.entries(bucket)) {
    if (!isVideoId(videoId) || !Array.isArray(notes)) continue;
    const valid = notes.filter(isValidNote);
    if (valid.length) out[videoId] = valid;
  }
  return out;
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
    const clean = {};
    for (const [playlistId, bucket] of Object.entries(parsed)) {
      if (!isPositiveInteger(playlistId)) continue;
      const cleaned = cleanBucket(bucket);
      if (Object.keys(cleaned).length) clean[playlistId] = cleaned;
    }
    // Persist the pruned shape only if something was actually dropped, so a
    // healthy store is never rewritten on every read.
    if (JSON.stringify(clean) !== JSON.stringify(parsed)) {
      if (Object.keys(clean).length) writeAll(clean);
      else localStorage.removeItem(KEY);
    }
    return clean;
  } catch {
    try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
    return {};
  }
}

function writeAll(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {
    /* storage full or blocked — notes are best-effort */
  }
}

// Notes for one lesson, ordered for reading: timestamped notes first in
// playback order, then untimed notes in the order they were written. Callers
// get a fresh array they may not mutate in place.
export function getNotes(playlistId, videoId) {
  if (!isPositiveInteger(playlistId) || !isVideoId(videoId)) return [];
  const notes = readAll()[String(playlistId)]?.[videoId] ?? [];
  return [...notes].sort((a, b) => {
    const at = a.t == null, bt = b.t == null;
    if (at !== bt) return at ? 1 : -1;     // untimed sink below timed
    if (!at && a.t !== b.t) return a.t - b.t; // both timed: by playback second
    return a.at - b.at;                     // stable: by creation time
  });
}

function newId() {
  // Unique enough for a single device: creation ms plus a short random tail so
  // two notes taken in the same millisecond don't collide.
  return `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// Add a note to a lesson. `t` is the playback second (or null for an untimed
// note). Empty text is rejected (returns null) — the panel disables the button,
// this is the last line of defence. Returns the created note.
export function addNote({ playlistId, videoId, text, t = null }) {
  if (!isPositiveInteger(playlistId) || !isVideoId(videoId)) return null;
  const clean = typeof text === "string" ? text.trim() : "";
  if (!clean) return null;
  const seconds = Number.isFinite(t) && t >= 0 ? Math.floor(t) : null;
  const note = { id: newId(), text: clean, t: seconds, at: Date.now() };

  const all = readAll();
  const key = String(playlistId);
  const bucket = all[key] ?? {};
  bucket[videoId] = [...(bucket[videoId] ?? []), note];
  all[key] = bucket;
  writeAll(all);
  return note;
}

// Replace a note's text. Returns the updated note, or null if it does not exist
// or the new text is empty.
export function updateNote({ playlistId, videoId, id, text }) {
  if (!isPositiveInteger(playlistId) || !isVideoId(videoId)) return null;
  const clean = typeof text === "string" ? text.trim() : "";
  if (!clean) return null;
  const all = readAll();
  const list = all[String(playlistId)]?.[videoId];
  if (!Array.isArray(list)) return null;
  const idx = list.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  const updated = { ...list[idx], text: clean };
  list[idx] = updated;
  writeAll(all);
  return updated;
}

// Remove one note. Returns true if it was there.
export function deleteNote({ playlistId, videoId, id }) {
  if (!isPositiveInteger(playlistId) || !isVideoId(videoId)) return false;
  const all = readAll();
  const key = String(playlistId);
  const list = all[key]?.[videoId];
  if (!Array.isArray(list)) return false;
  const next = list.filter((n) => n.id !== id);
  if (next.length === list.length) return false;
  if (next.length) all[key][videoId] = next;
  else {
    delete all[key][videoId];
    if (!Object.keys(all[key]).length) delete all[key];
  }
  writeAll(all);
  return true;
}

// Wipe this device's notes. Called on sign-out for the same reason
// clearProgress is: ll_notes_v1 is one un-namespaced store shared by whoever
// uses the browser, so on a shared machine one student's notes must not linger
// for the next. Safe to lose while notes are device-local; once a video_notes
// table exists this will pull them back on the next sign-in.
export function clearNotes() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}
