// revision.js — which chapters are worth going back to, in the browser's
// localStorage.
//
// WHY A SEPARATE STORE. This cannot be derived from progress.js. That store is
// keyed by COURSE: entry.chapterId is only the last chapter viewed in it, and
// positions[videoId] carries no chapter at all. Worse, positions[videoId].at is
// overwritten on every replay, so even the dates are a last-touch, not a
// finish. The one moment the app knows "this student has finished every lesson
// of chapter 27" is when ChapterCleared computes it on the watch page — so that
// is where a record is written, and nowhere else.
//
// SPACING BY CALENDAR, NOT SPACED REPETITION. There is no quiz here and no
// recall signal, so this cannot know what a student has forgotten and must
// never imply that it does. All it knows is the date a chapter was finished.
// The ladder below is a plain calendar prompt built on that one honest fact.
//
// Device-local like notes.js, progress.js and streak.js, and cleared on
// sign-out with them: ll_revision_v1 is un-namespaced and shared by whoever
// uses the browser, so a school-lab machine must not hand one student another
// student's revision queue.

const KEY = "ll_revision_v1";
const DAY_MS = 86400000;

// Days after finishing (or after the last revision) before a chapter is worth
// suggesting again. Widely spaced on purpose: this competes with a student's
// actual timetable, and a prompt that arrives too often is one they learn to
// ignore. After the last rung a chapter graduates and is never suggested again.
export const REVISION_LADDER = [7, 21, 60, 150];

// Past this, "revise" is the wrong word — a chapter three months overdue needs
// relearning, and the queue refuses to accumulate debt it cannot help with.
export const STALE_AFTER_DAYS = 90;

// "Not now" buys a week. It never touches the ladder.
const SNOOZE_DAYS = 7;

// Re-watching lessons in a chapter counts as revising it, but only once per
// cooldown: finishing lesson 14 and replaying lesson 3 the same evening is one
// study session, not two revisions.
const WATCH_COOLDOWN_DAYS = 3;

// Roughly a full syllabus of chapters (the catalogue has 263). Large enough
// that no real student hits it, small enough to stay a few kilobytes.
const MAX_ITEMS = 200;

/** Local calendar day as YYYY-MM-DD — a student's day, not UTC's. */
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const positiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const cleanText = (value) => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};
// Number(null) is 0, not NaN — so a null revisedAt read back as the epoch, and
// `revisedAt ?? clearedAt` then scheduled every chapter from 1970 and dropped
// it as stale. Absent must stay absent.
const finiteTime = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** `${courseId}:${chapterId}` — one record per chapter per course. */
export const itemId = (courseId, chapterId) => `${courseId}:${chapterId}`;

// A record is only usable if it can name the chapter AND link to it. Anything
// missing one of those is dropped rather than rendered with a "Chapter"
// placeholder — the same rule progress.js applies to continue-watching.
function normaliseItem(raw) {
  const courseId = positiveInt(raw?.courseId);
  const chapterId = positiveInt(raw?.chapterId);
  const chapterName = cleanText(raw?.chapterName);
  const clearedAt = finiteTime(raw?.clearedAt);
  if (!courseId || !chapterId || !chapterName || clearedAt === null) return null;

  const step = Number(raw?.step);
  return {
    id: itemId(courseId, chapterId),
    courseId,
    chapterId,
    chapterName,
    // Optional context. Null is a real answer and is rendered as nothing.
    courseTitle: cleanText(raw?.courseTitle),
    subject: cleanText(raw?.subject),
    totalLessons: positiveInt(raw?.totalLessons),
    clearedAt,
    step: Number.isInteger(step) && step >= 0 ? Math.min(step, REVISION_LADDER.length) : 0,
    revisedAt: finiteTime(raw?.revisedAt),
    revisedVia: raw?.revisedVia === "marked" || raw?.revisedVia === "watched" ? raw.revisedVia : null,
    snoozedUntil: finiteTime(raw?.snoozedUntil),
    graduated: raw?.graduated === true,
  };
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const items = Array.isArray(raw?.items)
      ? raw.items.map(normaliseItem).filter(Boolean)
      : [];
    // Last write wins on a duplicate id, which can only happen if the store was
    // hand-edited or written by an older build.
    const byId = new Map(items.map((item) => [item.id, item]));
    return {
      pausedOn: /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.pausedOn ?? "")) ? raw.pausedOn : null,
      items: [...byId.values()],
    };
  } catch {
    // Corrupt or blocked storage must not break the homepage; an empty queue is
    // the honest reading of "we cannot tell".
    return { pausedOn: null, items: [] };
  }
}

function write(state) {
  try {
    // Over the cap, graduated records go first (they are never surfaced again),
    // then the oldest finishes.
    let items = state.items;
    if (items.length > MAX_ITEMS) {
      const ranked = [...items].sort((a, b) => {
        if (a.graduated !== b.graduated) return a.graduated ? 1 : -1;
        return b.clearedAt - a.clearedAt;
      });
      items = ranked.slice(0, MAX_ITEMS);
    }
    localStorage.setItem(KEY, JSON.stringify({ pausedOn: state.pausedOn, items }));
  } catch {
    /* storage blocked — the queue simply does not persist */
  }
}

/** When this chapter next becomes worth suggesting. null once graduated. */
export function dueAt(item) {
  if (item.graduated || item.step >= REVISION_LADDER.length) return null;
  const from = item.revisedAt ?? item.clearedAt;
  return from + REVISION_LADDER[item.step] * DAY_MS;
}

/**
 * Record that a chapter was finished. CREATE-IF-ABSENT, deliberately: the
 * ChapterCleared card is a derivation of stored positions, not an event, so it
 * renders again on every later visit to a cleared chapter. Overwriting here
 * would reset the ladder to day zero every time the student opened the page,
 * and the chapter would never come due.
 */
export function recordChapterCleared(input, now = new Date()) {
  // The caller's measured finish time wins, because "now" is not the finish:
  // this is written the first time the app OBSERVES the chapter complete, and
  // on a second device — or after any sign-out and sign-in — that is the day of
  // the visit. A supplied date is only trusted when it is real and in the past;
  // a future timestamp is a broken clock, not evidence.
  const supplied = finiteTime(input?.clearedAt);
  const clearedAt = supplied !== null && supplied > 0 && supplied <= now.getTime()
    ? supplied
    : now.getTime();
  const item = normaliseItem({ ...input, clearedAt });
  if (!item) return null;
  const state = read();
  if (state.items.some((existing) => existing.id === item.id)) return null;
  state.items = [...state.items, item];
  write(state);
  return item;
}

function advance(state, id, at, via) {
  const items = state.items.map((item) => {
    if (item.id !== id) return item;
    const step = Math.min(item.step + 1, REVISION_LADDER.length);
    return {
      ...item,
      step,
      revisedAt: at,
      revisedVia: via,
      snoozedUntil: null,
      graduated: step >= REVISION_LADDER.length,
    };
  });
  write({ ...state, items });
  return items.find((item) => item.id === id) ?? null;
}

/** The student's own "I've revised this" — their assertion, not our inference. */
export function markChapterRevised({ courseId, chapterId }, now = new Date()) {
  const id = itemId(courseId, chapterId);
  const state = read();
  if (!state.items.some((item) => item.id === id)) return null;
  return advance(state, id, now.getTime(), "marked");
}

/**
 * Playback in an already-cleared chapter. A student who re-watched it HAS
 * revised it, and must not then be told to revise it — but only once per
 * cooldown, so one evening's replaying cannot walk a chapter up the ladder.
 * Never creates a record: a chapter that was never cleared is not being
 * revised, it is being learned.
 */
export function recordChapterWatched({ courseId, chapterId }, now = new Date()) {
  const id = itemId(courseId, chapterId);
  const state = read();
  const item = state.items.find((existing) => existing.id === id);
  if (!item) return null;
  const last = Math.max(item.clearedAt, item.revisedAt ?? 0);
  if (now.getTime() - last < WATCH_COOLDOWN_DAYS * DAY_MS) return null;
  return advance(state, id, now.getTime(), "watched");
}

/**
 * "Not now" — hide this one for a week. It deliberately does NOT touch step or
 * revisedAt: a snooze recorded as a revision would have the site later claim
 * "Revised 3 weeks ago" about a revision that never happened.
 */
export function snoozeChapter({ courseId, chapterId }, now = new Date()) {
  const id = itemId(courseId, chapterId);
  const state = read();
  if (!state.items.some((item) => item.id === id)) return null;
  const items = state.items.map((item) => (
    item.id === id ? { ...item, snoozedUntil: now.getTime() + SNOOZE_DAYS * DAY_MS } : item
  ));
  write({ ...state, items });
  return items.find((item) => item.id === id) ?? null;
}

/**
 * Stop suggesting anything for the rest of today. Called once the student has
 * dealt with everything on screen, so clearing the row cannot summon another
 * row — the band is a nudge, not a treadmill.
 */
export function pauseRevisionForToday(now = new Date()) {
  const state = read();
  write({ ...state, pausedOn: dayKey(now) });
}

/**
 * Ranking. Pure and exported so it can be tested without touching storage.
 *
 * Earlier rungs first: a chapter finished a week ago is a twenty-minute win and
 * the point at which skipping does the most damage, while a 150-day rung is the
 * weakest advice here. Then longest-overdue. Then, so three Physics cards never
 * fill the row, one chapter per subject before any subject repeats.
 */
export function rankDueChapters(items, now = new Date()) {
  const at = now.getTime();
  const ranked = [...items].sort((a, b) => (
    a.step - b.step
    || (dueAt(a) ?? at) - (dueAt(b) ?? at)
    // Total order, so the row does not reshuffle between reads.
    || a.id.localeCompare(b.id)
  ));

  const out = [];
  const rest = [...ranked];
  while (rest.length) {
    const usedSubjects = new Set();
    for (let i = 0; i < rest.length;) {
      // null subjects share one bucket keyed by the item's own id, so an
      // unknown subject never blocks another unknown subject.
      const bucket = rest[i].subject ?? ` ${rest[i].id}`;
      if (usedSubjects.has(bucket)) { i += 1; continue; }
      usedSubjects.add(bucket);
      out.push(rest[i]);
      rest.splice(i, 1);
    }
  }
  return out;
}

/**
 * How to describe an item's age, in the site's own voice: a measured past fact
 * and nothing more. The verb distinguishes what the student told us ("Revised")
 * from what we merely observed ("Last watched"), so the site never asserts a
 * revision that was only a replay — and never implies it knows what they have
 * forgotten.
 */
export function revisionAge(item, now = new Date()) {
  const from = item.revisedAt ?? item.clearedAt;
  const days = Math.max(0, Math.floor((now.getTime() - from) / DAY_MS));
  const verb = item.revisedAt === null
    ? "Cleared"
    : (item.revisedVia === "watched" ? "Last watched" : "Revised");
  return { verb, days, at: from };
}

/**
 * What is worth suggesting right now. A PURE READ — it never writes, so simply
 * looking at the homepage cannot change a student's schedule.
 */
export function dueForRevision(limit = 3, now = new Date()) {
  const state = read();
  if (state.pausedOn === dayKey(now)) return [];
  const at = now.getTime();
  const due = state.items.filter((item) => {
    if (item.graduated) return false;
    if (item.snoozedUntil !== null && item.snoozedUntil > at) return false;
    const when = dueAt(item);
    if (when === null || when > at) return false;
    // Too far gone to call revision.
    return at - when <= STALE_AFTER_DAYS * DAY_MS;
  });
  return rankDueChapters(due, now).slice(0, Math.max(0, limit));
}

/** Wipe this device's revision queue. Called on sign-out beside clearStreak. */
export function clearRevision() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — nothing to clear */
  }
}
