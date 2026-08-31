// streak.js — study days, in the browser's localStorage.
//
// WHY A SEPARATE STORE. A streak needs the set of DAYS a student studied, and
// that cannot be reconstructed from progress.js: positions[videoId].at is
// overwritten every time a lesson plays, so re-watching Monday's lesson on
// Friday erases Monday. This keeps a small append-only set of dates instead —
// no lesson ids, no titles, no account, nothing but "there was study on this
// day", capped so it cannot grow without bound.
//
// HONEST BY DEFINITION. `current` is literally the number of consecutive
// calendar days with study, ending today or yesterday — there is no "freeze"
// that quietly counts a missed day as studied, because a 7 next to a week
// where the student skipped Tuesday is a lie the number is not worth telling.
// A streak stays alive through today until a full day is missed, which is how
// a day counter should read at 9am before anyone has studied.
//
// Device-local like notes.js and progress.js, and cleared on sign-out with
// them: ll_streak_v1 is one un-namespaced store shared by whoever uses the
// browser, so a school-lab machine must not hand one student another's streak.

const KEY = "ll_streak_v1";
// A year and a bit: enough for "longest streak" to mean something, small
// enough that the whole store is a couple of kilobytes.
const MAX_DAYS = 400;
const DAY_MS = 86400000;

/** Local calendar day as YYYY-MM-DD — a streak is about the student's day. */
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const isDayKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const days = Array.isArray(raw?.days) ? raw.days.filter(isDayKey) : [];
    const goal = Number(raw?.goal);
    return {
      days: [...new Set(days)].sort(),
      goal: goal === 1 || goal === 2 || goal === 3 ? goal : 2,
    };
  } catch {
    // Corrupt or blocked storage must not break the page; an empty streak is
    // the honest reading of "we cannot tell".
    return { days: [], goal: 2 };
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      days: state.days.slice(-MAX_DAYS),
      goal: state.goal,
    }));
  } catch {
    /* storage blocked — the streak simply does not persist */
  }
}

/**
 * Mark today as studied. Called from progress.js's recordLessonView, which
 * fires only on a genuine YouTube PLAYING event — so a streak can never be
 * earned by opening a page.
 */
export function recordStudyDay(now = new Date()) {
  const state = read();
  const today = dayKey(now);
  if (state.days.includes(today)) return state.days.length;
  state.days = [...state.days, today].sort();
  write(state);
  return state.days.length;
}

/** The student's own daily lesson target (1–3). */
export function getDailyGoal() {
  return read().goal;
}

export function setDailyGoal(goal) {
  const next = Number(goal);
  if (next !== 1 && next !== 2 && next !== 3) return getDailyGoal();
  const state = read();
  state.goal = next;
  write(state);
  return next;
}

/**
 * Streak numbers for the UI.
 *
 * current  — consecutive days ending today or yesterday (0 once a full day
 *            has been missed).
 * longest  — the best run in the stored window.
 * studiedToday — whether today is already counted.
 * thisWeek — days studied in the last 7 calendar days, for the ring's context.
 */
export function streakStats(now = new Date()) {
  const { days } = read();
  const set = new Set(days);
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - DAY_MS));

  let current = 0;
  // Start from today if studied, else yesterday — a streak is not broken until
  // a whole day passes with nothing.
  let cursor = set.has(today) ? new Date(now) : (set.has(yesterday) ? new Date(now.getTime() - DAY_MS) : null);
  while (cursor && set.has(dayKey(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  let longest = 0;
  let run = 0;
  let previous = null;
  for (const day of days) {
    const time = Date.parse(`${day}T00:00:00`);
    run = previous !== null && Math.round((time - previous) / DAY_MS) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = time;
  }

  let thisWeek = 0;
  for (let i = 0; i < 7; i += 1) {
    if (set.has(dayKey(new Date(now.getTime() - i * DAY_MS)))) thisWeek += 1;
  }

  return { current, longest: Math.max(longest, current), studiedToday: set.has(today), thisWeek };
}

/** Wipe this device's streak. Called on sign-out beside clearProgress. */
export function clearStreak() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage blocked — nothing to clear */
  }
}
