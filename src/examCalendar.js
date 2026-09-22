// examCalendar.js — the exam dates the countdown counts to.
//
// HONESTY RULE, and the whole reason this file has a `status` field.
// A countdown is only as truthful as its date. Every entry is one of:
//   expected   a WINDOW derived from the long-standing pattern of previous
//              years, because the authority has published nothing yet.
//   tentative  the authority has published proposed dates but calls them
//              tentative and not a notification, as NTA's Examination Calendar
//              of 16 Sep 2026 does. expectedFrom/expectedTo/expectedLabel hold
//              THOSE dates, and officialUrl is where they were published.
//   announced  the official notification gives the date.
// Nothing short of `announced` is presented as official: the UI shows it as
// "about N days" with the authority named and the official link beside it, so
// a student can always check the source themselves.
//
// TO CONFIRM AN EXAM (the only edit this file should normally need):
//   1. Open the official notification (officialUrl below).
//   2. Set status: "announced" and date: "YYYY-MM-DD" (the exam's FIRST day).
//   3. Leave expectedFrom/expectedTo alone — they are only read until then.
//   4. Set checkedOn to the day you looked.
// The countdown then switches from "about N days" to an exact "N days", and
// the "dates not yet announced" line disappears on its own.
//
// TO RECORD A TENTATIVE CALENDAR (dates published, but marked tentative):
//   1. Set status: "tentative" and leave date: null.
//   2. Set expectedFrom to the first proposed day, expectedTo to the last, and
//      expectedLabel to the dates as published.
//   3. Point officialUrl at the page that publishes them. Set checkedOn.
// The countdown stays "about N days", counts to the first proposed day, and
// names whose tentative calendar the dates come from. Its line promises an
// information bulletin, which is how NTA and JAB confirm an exam; reword it
// before marking a CBSE entry tentative.
//
// TO RE-CHECK AN EXAM that is still not announced: open officialUrl, and if
// nothing has changed, set checkedOn to today. Nothing else. For an NTA exam,
// read nta.ac.in's notices and Exam Calendar as well as the exam portal: the
// 16 Sep 2026 calendar appeared there and not on jeemain or neet.
//
// Never invent a precise date to make the countdown look better. A student
// planning revision around a fabricated date is the single worst failure this
// site could ship.
//
// LAST CHECKED, and why a countdown expires.
// "NTA has not announced dates yet" is true on the day someone looks and false
// on the day the information bulletin appears. NTA published the JEE Main 2026
// bulletin on 31 Oct 2025 and the 2025 one on 28 Oct 2024. Nothing in this file
// changes when that happens, so the sentence would go on being shown after it
// stopped being true. An announced date can be moved too.
//
// So every entry records `checkedOn`: the day a person last read the official
// source and found the entry still accurate. examCountdown() returns null once
// that check is more than CHECK_EXPIRES_AFTER_DAYS old, and the countdown
// disappears instead of repeating something nobody has verified. An entry with
// no checkedOn counts as never checked and is not shown, and so does one dated
// more than a day ahead of the student's calendar, which can only be a typo.
//
// Recorded checks:
//   21 Sep 2026  jeeadv.ac.in and cbse.gov.in read in a browser. jeeadv.ac.in
//                was still the JEE (Advanced) 2026 site, and its newest notice
//                (16 Jul 2026, JoSAA round 5) said nothing about 2027. The
//                newest cbse.gov.in notice was the circular on the List of
//                Candidates for the 2027 exams (dated 17 Sep, posted 21 Sep);
//                its signed pages give no exam dates, only "February–March"
//                for Class X's first exam. Applies to JEE Advanced and CBSE,
//                which disappear from 6 Nov 2026 unless re-checked.
//   21 Sep 2026  nta.ac.in read directly. NTA's Examination Calendar, with a
//                public notice dated 16 Sep 2026, proposes JEE (Main) Session 1
//                for 22–24 and 28–30 Jan 2027 (buffer 31 Jan). It calls the
//                dates tentative, and the notice says the calendar "does not
//                constitute a notification for any particular examination".
//                jeemain.nta.nic.in still showed only 2026 notices. So Session
//                1 is `tentative`, and disappears from 6 Nov 2026 unless
//                re-checked. The calendar stops at March 2027, so it says
//                nothing yet about Session 2 or NEET UG.
//   15 Sep 2026  jeemain.nta.nic.in and neet.nta.nic.in read directly. The
//                newest notices on both were for the 2026 exams, with nothing
//                for 2027. Applies to JEE Main Session 2 and NEET UG (Session 1
//                was re-checked on 21 Sep), which disappear from 31 Oct 2026
//                unless re-checked.
//   27 Aug 2026  jeeadv.ac.in and cbse.gov.in served no readable text to the
//                15 Sep check, so JEE Advanced and CBSE kept the day their
//                windows were written (commit 69fcfdb). Stamping 15 Sep on them
//                would have recorded a check that did not happen. Replaced by
//                the 21 Sep check.

/**
 * How many days a check stays good. Long enough that a re-check fits easily
 * between releases, short enough that a stale "not announced yet" cannot
 * outlive a bulletin season.
 */
export const CHECK_EXPIRES_AFTER_DAYS = 45;

/** Exams the countdown knows about, soonest first within a goal. */
export const EXAM_CALENDAR = Object.freeze([
  {
    slug: "jee-main-2027-session-1",
    name: "JEE Main 2027",
    qualifier: "Session 1",
    goal: "jee",
    status: "tentative",
    date: null,
    expectedFrom: "2027-01-22",
    expectedTo: "2027-01-30",
    expectedLabel: "22–24 and 28–30 Jan 2027",
    authority: "NTA",
    officialUrl: "https://nta.ac.in/",
    checkedOn: "2026-09-21",
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
    checkedOn: "2026-09-15",
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
    checkedOn: "2026-09-21",
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
    checkedOn: "2026-09-15",
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
    checkedOn: "2026-09-21",
  },
]);

const DAY_MS = 86400000;

/**
 * Midnight UTC for a YYYY-MM-DD string; null if unparseable, or if no such day
 * exists. Date.parse rolls an impossible day forward instead of rejecting it:
 * "2027-02-29" read as 1 Mar 2027, so a typo in a confirmed exam counted to the
 * wrong day as an exact number, with the typo shown beside it as the exam day.
 */
function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time)) return null;
  // A real day reads back as itself; a rolled-forward one does not.
  return new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

/** The day a countdown counts to: the announced date, else the window start. */
export function targetDay(exam) {
  if (!exam) return null;
  return exam.status === "announced"
    ? parseDay(exam.date)
    : parseDay(exam.expectedFrom);
}

/**
 * Whether the entry's last check is recent enough to show it. `day` is the
 * student's calendar day as a midnight-UTC timestamp, the same unit targetDay
 * returns. A missing or malformed checkedOn is never recent.
 *
 * Nor is one dated more than a day after `day`: nobody can check the day after
 * tomorrow, so that is a typo. Its age came out negative and passed the window,
 * so "2026-12-15" typed for "2026-09-15" would have kept "not announced yet" up
 * to 29 Jan 2027, or the exam if sooner, instead of 30 Oct 2026. One day of
 * slack stays, for a student west of India whose calendar is still on the
 * previous day when a check stamped in IST ships.
 */
function recentlyChecked(exam, day) {
  const checked = parseDay(exam.checkedOn);
  if (checked == null) return false;
  const age = Math.round((day - checked) / DAY_MS);
  return age >= -1 && age <= CHECK_EXPIRES_AFTER_DAYS;
}

/**
 * Days from `today` until the exam, and whether that number is approximate.
 * Returns null when there is no usable date, once the exam has passed (a
 * countdown that has run out must disappear, not show a negative number), and
 * once nobody has checked the entry for CHECK_EXPIRES_AFTER_DAYS.
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
  // See LAST CHECKED above. Past this point the sentence below is no longer
  // something the site knows to be true, so it is not said at all.
  if (!recentlyChecked(exam, now)) return null;
  return {
    days,
    approximate: exam.status !== "announced",
    // An announced exam states its date. A tentative one says whose calendar
    // its dates come from and that they are not final. An expected one states
    // its window and says plainly that the authority has not announced yet.
    detail: exam.status === "announced"
      ? `${exam.authority} · exam day ${exam.date}`
      : exam.status === "tentative"
        ? `${exam.authority}'s tentative calendar: ${exam.expectedLabel} · final dates come with the information bulletin`
        : `Expected ${exam.expectedLabel} — ${exam.authority} has not announced dates yet`,
  };
}

/**
 * The soonest upcoming exam for a goal ("jee" | "neet" | "school"), or the
 * soonest overall when no goal is given. Past exams, and entries whose check
 * has expired, are skipped. `calendar` exists so tests can supply entries
 * checked relative to their own dates.
 */
export function nextExam(goal = null, today = new Date(), calendar = EXAM_CALENDAR) {
  const upcoming = calendar
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
