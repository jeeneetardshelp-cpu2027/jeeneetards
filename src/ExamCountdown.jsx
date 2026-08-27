// ExamCountdown — "how long have I got?", on the homepage.
//
// Days-left is the most forwarded thing in any JEE/NEET group, and it is a
// reason to come back that grows more urgent on its own. This band shows the
// soonest exam for the chosen lane, with a share button so the countdown can
// travel into a batch group carrying a link home.
//
// HONESTY. The number is only as good as the date behind it (see
// examCalendar.js). While an exam is `expected`, the band says "about N days",
// names the authority, states plainly that dates are not announced, and links
// the official page so a student can check. It never dresses an estimate up as
// an official date. When the owner confirms a date the wording tightens by
// itself.
//
// No <Reveal> here on purpose: reveal blocks ship at opacity:0 and only appear
// once a useReveal() root observes them, which has shipped a blank section
// twice in this codebase. A countdown that renders invisibly is worse than no
// countdown.
import { useState } from "react";
import { CalendarClock, ExternalLink, Share2 } from "lucide-react";
import { Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { EXAM_CALENDAR, examLabel, nextExam } from "./examCalendar.js";
import { BRAND_TEAL } from "./brandColors.js";

const LANES = [
  { goal: "jee", label: "JEE" },
  { goal: "neet", label: "NEET" },
  { goal: "school", label: "Boards" },
];

/** Share text for a batch group: the number, the exam, and a link home. */
export function shareMessage(exam, countdown, origin = "https://www.jeeneetard.com") {
  const days = countdown.days === 0
    ? "Today"
    : `${countdown.approximate ? "About " : ""}${countdown.days} day${countdown.days === 1 ? "" : "s"}`;
  return `${days} to ${examLabel(exam)}. Free chapter-wise lectures: ${origin}/`;
}

export default function ExamCountdown() {
  const { t } = useTheme();
  // Which lanes actually have an upcoming exam — a lane whose exams have all
  // passed must not offer an empty tab.
  const lanes = LANES.filter((lane) => nextExam(lane.goal));
  const [goal, setGoal] = useState(lanes[0]?.goal ?? null);
  const [shared, setShared] = useState(false);

  if (lanes.length === 0 || EXAM_CALENDAR.length === 0) return null;
  const entry = nextExam(goal) ?? nextExam(lanes[0].goal);
  if (!entry) return null;
  const { exam, countdown } = entry;

  const share = async () => {
    const text = shareMessage(exam, countdown, window.location.origin);
    try {
      if (navigator.share) {
        await navigator.share({ text, url: `${window.location.origin}/` });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // A cancelled share sheet is not an error worth showing a student.
    }
  };

  return (
    <section className="pt-4 pb-8" aria-labelledby="exam-countdown-heading">
      <Container>
        <div className={`rounded-2xl border ${t.border} ${t.card} p-5 sm:p-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" style={{ color: BRAND_TEAL }} aria-hidden="true" />
              <h2 id="exam-countdown-heading" className={`text-sm font-semibold ${t.text}`}>
                Days to go
              </h2>
            </div>
            {lanes.length > 1 && (
              <div role="group" aria-label="Choose exam" className="flex flex-wrap gap-2">
                {lanes.map((lane) => (
                  <button
                    key={lane.goal}
                    type="button"
                    onClick={() => setGoal(lane.goal)}
                    aria-pressed={lane.goal === goal}
                    // No dynamic `hover:${t.text}`: Tailwind's JIT only sees
                    // complete class strings in source, so an interpolated
                    // variant compiles to nothing at all.
                    className={`min-h-11 rounded-full border px-4 text-xs font-medium transition-colors ${
                      lane.goal === goal
                        ? "border-transparent bg-accent text-accent-ink"
                        : `${t.border} ${t.muted} hover:border-accent-line`
                    }`}
                  >
                    {lane.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
            {/* Real spaces between the words, not just margin: innerText (and
                therefore a screen reader) read "about147days" when the gap was
                purely visual. */}
            <p className={`text-4xl font-bold tabular-nums ${t.text}`}>
              {countdown.approximate && (
                <>
                  <span className={`align-middle text-base font-medium ${t.muted}`}>about</span>{" "}
                </>
              )}
              {countdown.days}{" "}
              <span className={`text-base font-medium ${t.muted}`}>
                {countdown.days === 1 ? "day" : "days"}
              </span>
            </p>
            <p className={`text-sm font-medium ${t.text}`}>to {examLabel(exam)}</p>
          </div>

          {/* The provenance line: never let the number stand on its own. */}
          <p className={`mt-2 text-xs ${t.muted}`}>{countdown.detail}</p>

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
              href={exam.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-11 items-center gap-1.5 text-xs font-medium ${t.muted} hover:underline`}
            >
              Official {exam.authority} site
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
