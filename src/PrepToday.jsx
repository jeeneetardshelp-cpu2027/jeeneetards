// PrepToday — the returning student's one "where am I?" band, on the homepage.
//
// Continue-watching, the streak and the exam countdown used to be three
// stacked sections; a returning student scrolled past three bands of their
// own status before reaching the exam grid. This merges them into ONE compact
// band: streak + today's goal + days-to-exam as a stat row, with the top
// continue-watching entry as the primary card under it. Each piece keeps its
// old hide-when-empty rule, and the whole band renders NOTHING for a
// brand-new visitor — their homepage goes straight to the exam grid.
//
// The pieces keep their honesty rules too:
//  - The countdown never dresses an estimate up as an official date (see
//    examCalendar.js): while an exam is `expected` it says "about N days",
//    names the authority, states plainly that dates are not announced, and
//    links the official page. The share text carries the same caveat.
//  - The streak stays DELIBERATELY GENTLE, because the users are 14-18: the
//    student's own number and nothing else — no leaderboard, no "you lost
//    your streak!" guilt, no red. A missed day simply starts a new count.
//  - Nothing is invented: every number is read from what the site already
//    stores, and a piece with no data hides itself.
//
// The chosen JEE/NEET/Boards lane persists (ll_exam_lane_v1, examLane.js), so
// the countdown opens on the student's exam and the grid below leads with it.
//
// No <Reveal> here on purpose: reveal blocks ship at opacity:0 and only appear
// once a useReveal() root observes them, which has shipped a blank section
// twice in this codebase.

import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight, CalendarClock, ExternalLink, Flame, MonitorPlay, Share2,
} from "lucide-react";
import { Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { IconTile, Surface } from "./ui.jsx";
import { BRAND_TEAL } from "./brandColors.js";
import { EXAM_CALENDAR, examLabel, nextExam } from "./examCalendar.js";
import { getExamLane, setExamLane } from "./examLane.js";
import { getDailyGoal, setDailyGoal, streakStats } from "./streak.js";
import { countLessonsStudiedToday } from "./progress.js";

const LANES = [
  { goal: "jee", label: "JEE" },
  { goal: "neet", label: "NEET" },
  { goal: "school", label: "Boards" },
];

const GOALS = [1, 2, 3];

/** Share text for a batch group: the number, the exam, and a link home. */
export function shareMessage(exam, countdown, origin = "https://www.jeeneetard.com") {
  const days = countdown.days === 0
    ? "Today"
    : `${countdown.approximate ? "About " : ""}${countdown.days} day${countdown.days === 1 ? "" : "s"}`;
  // Carry the caveat the on-page band prints. Every exam in the calendar is
  // currently an ESTIMATE, so without this 100% of shared countdowns travel as
  // bare numbers into batch groups, stripped of the one fact that makes them
  // honest — the date is not announced yet.
  const caveat = countdown.approximate && exam.expectedLabel
    ? ` ${exam.authority ?? "The exam board"} has not announced dates yet (expected ${exam.expectedLabel}).`
    : "";
  return `${days} to ${examLabel(exam)}.${caveat} Free chapter-wise lectures: ${origin}/`;
}

/**
 * True when today's play data says the student studied but the local streak
 * store has no record of it — the streak is device-local and cleared on
 * sign-out (deliberately, for shared school machines), while progress IS
 * restored from the server on the next sign-in. Asserting "0 days in a row" at
 * a student who demonstrably studied today is simply false, so the band says
 * what it actually knows instead.
 */
export function streakUncounted({ current, studiedToday, studiedTodayCount }) {
  return current === 0 && studiedTodayCount > 0 && !studiedToday;
}

/** The encouraging line under the number — never a reprimand. */
export function streakMessage({ current, studiedToday, done, goal }) {
  if (done) return current === 1 ? "Goal met. First day of a new streak." : "Goal met today.";
  if (studiedToday) return `${goal} lesson${goal === 1 ? "" : "s"} today keeps it going.`;
  if (current > 0) return "Watch one lesson to keep the streak.";
  return "Watch one lesson to start a streak.";
}

export default function PrepToday({ entries = [] }) {
  const { t } = useTheme();

  // Streak and today's count: read once on mount — the homepage does not play
  // lessons, so these cannot change underneath it.
  const [stats] = useState(() => streakStats());
  const [today, setToday] = useState(() => countLessonsStudiedToday());
  const [goal, setGoal] = useState(() => getDailyGoal());

  // Which lanes actually have an upcoming exam — a lane whose exams have all
  // passed must not offer an empty tab.
  const lanes = LANES.filter((lane) => nextExam(lane.goal));
  // The remembered lane wins; the read is lazy and getExamLane swallows a
  // throwing storage. A student with nothing stored gets the first live lane,
  // which is exactly the old default.
  const [lane, setLane] = useState(() => getExamLane());
  const [shared, setShared] = useState(false);

  // Keep the ring honest if the student returns to this tab after watching
  // something in another one.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setToday(countLessonsStudiedToday());
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  const hasWatch = (entries?.length ?? 0) > 0;
  const hasStreak = stats.longest > 0 || today > 0;
  // The band-level rule: a brand-new visitor with no data of their own sees
  // NOTHING personal — not even the countdown, which belongs to "where am I?"
  // and has no answer for someone who has not started.
  if (!hasWatch && !hasStreak) return null;

  // A remembered lane whose exams have all passed must not pin an empty tab.
  const activeLane = lanes.some((row) => row.goal === lane)
    ? lane
    : (lanes[0]?.goal ?? null);
  const entry = EXAM_CALENDAR.length > 0 && activeLane ? nextExam(activeLane) : null;

  const uncounted = streakUncounted({
    current: stats.current, studiedToday: stats.studiedToday, studiedTodayCount: today,
  });
  const done = today >= goal;
  const pct = Math.min(100, Math.round((today / goal) * 100));
  const chooseGoal = (next) => setGoal(setDailyGoal(next));
  const chooseLane = (next) => {
    setLane(next);
    setExamLane(next);
  };

  const share = async () => {
    if (!entry) return;
    const text = shareMessage(entry.exam, entry.countdown, window.location.origin);
    try {
      if (navigator.share) {
        // `text` already ends with the link, so passing `url` as well makes
        // Android paste it twice. The text is the canonical payload here.
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // A cancelled share sheet is not an error worth showing a student.
    }
  };

  const [primary, ...rest] = entries ?? [];
  const resumeHref = (e) => `/course/${e.playlistId}/chapter/${e.chapterId}?v=${e.lastVideoId}`;

  return (
    <section className="pt-4 pb-8" aria-labelledby="prep-today-heading">
      <Container>
        <div className={`rounded-2xl border ${t.border} ${t.card} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="prep-today-heading" className={`text-sm font-semibold ${t.text}`}>
              Your prep today
            </h2>
            {entry && lanes.length > 1 && (
              <div role="group" aria-label="Choose exam" className="flex flex-wrap gap-2">
                {lanes.map((row) => (
                  <button
                    key={row.goal}
                    type="button"
                    onClick={() => chooseLane(row.goal)}
                    aria-pressed={row.goal === activeLane}
                    // No dynamic `hover:${t.text}`: Tailwind's JIT only sees
                    // complete class strings in source, so an interpolated
                    // variant compiles to nothing at all.
                    className={`min-h-11 rounded-full border px-4 text-xs font-medium transition-colors ${
                      row.goal === activeLane
                        ? "border-transparent bg-accent text-accent-ink"
                        : `${t.border} ${t.muted} hover:border-accent-line`
                    }`}
                  >
                    {row.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* The compact stat row: streak · today's goal · days to the exam. */}
          <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-4">
            {hasStreak && (
              <div className="flex items-center gap-3">
                <Flame
                  className="h-6 w-6"
                  style={{ color: stats.current > 0 ? BRAND_TEAL : undefined }}
                  aria-hidden="true"
                />
                <div>
                  {/* Real spaces between the words, not just margin: innerText
                      (and a screen reader) read "3days" when the gap was
                      purely visual. */}
                  <p className={`text-2xl font-bold tabular-nums ${t.text}`}>
                    {uncounted ? (
                      <span className={`text-base font-semibold ${t.text}`}>Today&apos;s progress</span>
                    ) : (
                      <>
                        {stats.current}{" "}
                        <span className={`text-sm font-medium ${t.muted}`}>
                          day{stats.current === 1 ? "" : "s"} in a row
                        </span>
                      </>
                    )}
                  </p>
                  <p className={`mt-0.5 text-xs ${t.muted}`}>
                    {uncounted
                      ? "Your streak is kept on the device you watch on."
                      : streakMessage({ current: stats.current, studiedToday: stats.studiedToday, done, goal })}
                  </p>
                </div>
              </div>
            )}

            {hasStreak && (
              <div className="min-w-[12rem] flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`text-xs font-medium ${t.text}`}>
                    Today: {today} of {goal}
                  </p>
                  <p className={`text-xs ${t.muted}`}>{stats.thisWeek}/7 days this week</p>
                </div>
                {/* Progress, not a scoreboard. aria-valuetext says it in words
                    so a screen reader gets the same meaning as the bar. */}
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={goal}
                  aria-valuenow={Math.min(today, goal)}
                  aria-valuetext={`${today} of ${goal} lessons today`}
                  className={`mt-2 h-2 w-full overflow-hidden rounded-full ${t.input}`}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${pct}%`, backgroundColor: BRAND_TEAL }}
                  />
                </div>
                <div role="group" aria-label="Daily lesson goal" className="mt-3 flex items-center gap-2">
                  <span className={`text-xs ${t.muted}`}>Goal</span>
                  {GOALS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => chooseGoal(value)}
                      aria-pressed={value === goal}
                      aria-label={`${value} lesson${value === 1 ? "" : "s"} a day`}
                      className={`min-h-11 min-w-11 rounded-full border text-xs font-semibold transition-colors ${
                        value === goal
                          ? "border-transparent bg-accent text-accent-ink"
                          : `${t.border} ${t.muted} hover:border-accent-line`
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {entry && (
              <div className="flex items-start gap-3">
                <CalendarClock
                  className="mt-1 h-5 w-5"
                  style={{ color: BRAND_TEAL }}
                  aria-hidden="true"
                />
                <div>
                  <p className={`text-2xl font-bold tabular-nums ${t.text}`}>
                    {entry.countdown.approximate && (
                      <>
                        <span className={`align-middle text-base font-medium ${t.muted}`}>about</span>{" "}
                      </>
                    )}
                    {entry.countdown.days}{" "}
                    <span className={`text-sm font-medium ${t.muted}`}>
                      day{entry.countdown.days === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className={`mt-0.5 text-xs font-medium ${t.text}`}>to {examLabel(entry.exam)}</p>
                  {/* The provenance line: never let the number stand alone. */}
                  <p className={`mt-0.5 text-xs ${t.muted}`}>{entry.countdown.detail}</p>
                </div>
              </div>
            )}
          </div>

          {/* The primary action: back into the lecture they were in. */}
          {hasWatch && (
            <div className={`mt-5 border-t ${t.border} pt-5`}>
              <p className={`text-xs font-semibold ${t.muted}`}>Continue watching</p>
              <Surface
                as={Link}
                to={resumeHref(primary)}
                lift
                glow
                padded={false}
                className="group mt-3 flex items-center gap-4 p-4 sm:p-5"
              >
                <IconTile icon={MonitorPlay} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {primary.lastVideoTitle || primary.courseTitle}
                  </span>
                  <span className="mt-1 block truncate text-xs text-ink-3">
                    {primary.courseTitle}
                    {primary.totalLessons
                      ? ` · lesson ${primary.lastPosition ?? "?"} of ${primary.totalLessons}`
                      : ""}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-ink-3 transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)] group-hover:translate-x-1 group-hover:text-accent"
                />
              </Surface>
              {rest.length > 0 && (
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {rest.map((e) => (
                    <li key={e.playlistId}>
                      <Link
                        to={resumeHref(e)}
                        className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${t.border} ${t.muted} transition-colors hover:border-accent-line`}
                      >
                        <span className="min-w-0 truncate">{e.lastVideoTitle || e.courseTitle}</span>
                        <ArrowRight aria-hidden="true" className="ml-auto h-3.5 w-3.5 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Secondary detail stays behind the compact row, not above it. */}
          {entry && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={share}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:brightness-110"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
                {shared ? "Copied" : "Share countdown"}
              </button>
              <a
                href={entry.exam.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-11 items-center gap-1.5 text-xs font-medium ${t.muted} hover:underline`}
              >
                Official {entry.exam.authority} site
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
