// examCalendar.js — the exam dates the countdown counts to.
//
// HONESTY RULE, and the whole reason this file has a `status` field.
// A countdown is only as truthful as its date. As of writing, NTA/CBSE had
// announced none of the 2027 dates, so every entry below ships as `expected`:
// a WINDOW derived from the long-standing pattern of previous years, never a
// precise date presented as official. The UI shows an expected exam as
// "about N days" with the authority named and the official link beside it, so
// a student can always check the source themselves.
//
// TO CONFIRM AN EXAM (the only edit this file should normally need):
//   1. Open the official notification (officialUrl below).
//   2. Set status: "announced" and date: "YYYY-MM-DD" (the exam's FIRST day).
//   3. Leave expectedFrom/expectedTo alone — they are only read while expected.
// The countdown then switches from "about N days" to an exact "N days", and
// the "dates not yet announced" line disappears on its own.
//
// Never invent a precise date to make the countdown look better. A student
// planning revision around a fabricated date is the single worst failure this
// site could ship.

/** Exams the countdown knows about, soonest first within a goal. */
export const EXAM_CALENDAR = Object.freeze([
  {
    slug: "jee-main-2027-session-1",
    name: "JEE Main 2027",
    qualifier: "Session 1",
    goal: "jee",
    status: "expected",
    date: null,
    expectedFrom: "2027-01-21",
    expectedTo: "2027-01-31",
    expectedLabel: "late January 2027",
    authority: "NTA",
    officialUrl: "https://jeemain.nta.nic.in/",
  },
  {
    slug: "jee-main-2027-session-2",
    name: "JEE Main 2027",
    qualifier: "Session 2",
    goal: "jee",
    status: "expected",
    date: null,
    expectedFrom: "2027-04-01",
    expectedTo: "2027-04-10",
    expectedLabel: "early April 2027",
    authority: "NTA",
    officialUrl: "https://jeemain.nta.nic.in/",
  },
  {
    slug: "jee-advanced-2027",
    name: "JEE Advanced 2027",
    qualifier: null,
    goal: "jee",
    status: "expected",
    date: null,
    expectedFrom: "2027-05-16",
    expectedTo: "2027-05-26",
    expectedLabel: "late May 2027",
    authority: "IIT (JAB)",
    officialUrl: "https://jeeadv.ac.in/",
  },
  {
    slug: "neet-ug-2027",
    name: "NEET UG 2027",
    qualifier: null,
    goal: "neet",
    status: "expected",
    date: null,
    expectedFrom: "2027-05-02",
    expectedTo: "2027-05-09",
    expectedLabel: "early May 2027",
    authority: "NTA",
    officialUrl: "https://neet.nta.nic.in/",
  },
  {
    slug: "cbse-class-12-2027",
    name: "CBSE Class 12 boards 2027",
    qualifier: null,
    goal: "school",
    status: "expected",
    date: null,
    expectedFrom: "2027-02-15",
    expectedTo: "2027-04-05",
    expectedLabel: "February–April 2027",
    authority: "CBSE",
    officialUrl: "https://www.cbse.gov.in/",
  },
]);

const DAY_MS = 86400000;

/** Midnight UTC for a YYYY-MM-DD string; null if unparseable. */
function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) ? time : null;
}

/** The day a countdown counts to: the announced date, else the window start. */
export function targetDay(exam) {
  if (!exam) return null;
  return exam.status === "announced"
    ? parseDay(exam.date)
    : parseDay(exam.expectedFrom);
}

/**
 * Days from `today` until the exam, and whether that number is approximate.
 * Returns null when there is no usable date, or once the exam has passed —
 * a countdown that has run out must disappear, not show a negative number.
 */
export function examCountdown(exam, today = new Date()) {
  const target = targetDay(exam);
  if (target == null) return null;
  // The student's LOCAL calendar day, not the UTC one. Targets are midnight
  // UTC, so reading "today" in UTC made the countdown one day too high for
  // every Indian student between 00:00 and 05:30 IST. Harmless while every
  // date is hedged with "about", but this file documents flipping status to
  // "announced" as its intended edit — and that turns it into an exact-looking
  // wrong number ("1 day to JEE Main" at 1am on exam morning). Matches the
  // local-day convention dayKey() already uses in streak.js.
  const now = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const days = Math.round((target - now) / DAY_MS);
  if (days < 0) return null;
  return {
    days,
    approximate: exam.status !== "announced",
    // An announced exam states its date; an expected one states its window and
    // says plainly that the authority has not announced yet.
    detail: exam.status === "announced"
      ? `${exam.authority} · exam day ${exam.date}`
      : `Expected ${exam.expectedLabel} — ${exam.authority} has not announced dates yet`,
  };
}

/**
 * The soonest upcoming exam for a goal ("jee" | "neet" | "school"), or the
 * soonest overall when no goal is given. Past exams are skipped.
 */
export function nextExam(goal = null, today = new Date()) {
  const upcoming = EXAM_CALENDAR
    .filter((exam) => (goal ? exam.goal === goal : true))
    .map((exam) => ({ exam, countdown: examCountdown(exam, today) }))
    .filter((entry) => entry.countdown !== null)
    .sort((a, b) => a.countdown.days - b.countdown.days);
  return upcoming[0] ?? null;
}

/** Look one up for the shareable card. */
export function findExam(slug) {
  return EXAM_CALENDAR.find((exam) => exam.slug === slug) ?? null;
}

/** "JEE Main 2027 (Session 1)" — one label for card, band and share text. */
export function examLabel(exam) {
  if (!exam) return "";
  return exam.qualifier ? `${exam.name} (${exam.qualifier})` : exam.name;
}
