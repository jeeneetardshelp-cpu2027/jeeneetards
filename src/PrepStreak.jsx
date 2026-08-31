// PrepStreak — the student's own study streak and today's goal, on the
// homepage beside Continue-watching.
//
// One action feeds both loops: playing a lesson records the day (streak) and
// counts toward today's target (ring). Both read data the site already
// writes, so nothing new is asked of the student and it works signed-out.
//
// DELIBERATELY GENTLE, because the users are 14-18. It shows the student's own
// number and nothing else: no leaderboard, no comparison, no "you lost your
// streak!" guilt, no red. A missed day simply starts a new count. The goal is
// theirs to set (1-3 lessons) and it is never scolded for being small — the
// point is to make studying feel continuous, not to manufacture anxiety in an
// audience that has plenty already.
//
// Renders nothing before the first lesson is ever played: a zero streak and an
// empty ring on a first visit is noise, not motivation.
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { getDailyGoal, setDailyGoal, streakStats } from "./streak.js";
import { countLessonsStudiedToday } from "./progress.js";
import { BRAND_TEAL } from "./brandColors.js";

const GOALS = [1, 2, 3];

/** The encouraging line under the number — never a reprimand. */
export function streakMessage({ current, studiedToday, done, goal }) {
  if (done) return current === 1 ? "Goal met. First day of a new streak." : "Goal met today.";
  if (studiedToday) return `${goal} lesson${goal === 1 ? "" : "s"} today keeps it going.`;
  if (current > 0) return "Watch one lesson to keep the streak.";
  return "Watch one lesson to start a streak.";
}

export default function PrepStreak() {
  const { t } = useTheme();
  // Read once on mount: the homepage does not play lessons, so these cannot
  // change underneath it, and re-reading localStorage on every render would
  // be wasted work.
  const [stats] = useState(() => streakStats());
  const [today, setToday] = useState(() => countLessonsStudiedToday());
  const [goal, setGoal] = useState(() => getDailyGoal());

  // Keep the ring honest if the student returns to this tab after watching
  // something in another one.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setToday(countLessonsStudiedToday());
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  // Nothing to celebrate yet, and nothing to nag about.
  if (stats.longest === 0 && today === 0) return null;

  const done = today >= goal;
  const pct = Math.min(100, Math.round((today / goal) * 100));
  const chooseGoal = (next) => setGoal(setDailyGoal(next));

  return (
    <section className="pt-4 pb-8" aria-labelledby="prep-streak-heading">
      <Container>
        <div className={`flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border ${t.border} ${t.card} p-5 sm:p-6`}>
          <div className="flex items-center gap-3">
            <Flame
              className="h-6 w-6"
              style={{ color: stats.current > 0 ? BRAND_TEAL : undefined }}
              aria-hidden="true"
            />
            <div>
              <h2 id="prep-streak-heading" className={`text-2xl font-bold tabular-nums ${t.text}`}>
                {stats.current}{" "}
                <span className={`text-sm font-medium ${t.muted}`}>
                  day{stats.current === 1 ? "" : "s"} in a row
                </span>
              </h2>
              <p className={`mt-0.5 text-xs ${t.muted}`}>
                {streakMessage({ current: stats.current, studiedToday: stats.studiedToday, done, goal })}
              </p>
            </div>
          </div>

          <div className="min-w-[12rem] flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className={`text-xs font-medium ${t.text}`}>
                Today: {today} of {goal}
              </p>
              <p className={`text-xs ${t.muted}`}>{stats.thisWeek}/7 days this week</p>
            </div>
            {/* Progress, not a scoreboard. aria-valuetext says it in words so a
                screen reader gets the same meaning as the bar. */}
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
          </div>

          <div role="group" aria-label="Daily lesson goal" className="flex items-center gap-2">
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
      </Container>
    </section>
  );
}
