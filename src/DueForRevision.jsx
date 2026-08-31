// DueForRevision — "worth a revision", on the homepage.
//
// Revision is the highest-value study behaviour for these exams and the site
// did nothing to prompt it: a chapter a student finished in July was gone the
// moment they closed the tab. This band brings a few of them back.
//
// WHAT IT MAY AND MAY NOT SAY. There is no quiz here and no recall signal, so
// the site cannot know what a student has forgotten and must never imply that
// it does. It states one measured fact — the day they finished a chapter on
// this device — and makes a suggestion. Nothing in between. No "overdue", no
// "before you forget", no memory percentage, no backlog total, no red.
//
// It is a nudge, not a treadmill: at most three cards, and once the student has
// dealt with what is on screen the band stays quiet for the rest of the day
// rather than refilling (see pauseRevisionForToday in revision.js).
//
// No <Reveal>: reveal blocks ship at opacity:0 until a useReveal() root
// observes them, which has shipped a blank section twice in this codebase.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { RotateCcw } from "lucide-react";
import { Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { BRAND_TEAL } from "./brandColors.js";
import {
  dueForRevision, markChapterRevised, pauseRevisionForToday, revisionAge, snoozeChapter,
} from "./revision.js";

const MAX_CARDS = 3;

/** "Cleared 24 days ago", "Revised 3 weeks ago" — the fact, and only the fact. */
export function ageLabel(item, now = new Date()) {
  const { verb, days } = revisionAge(item, now);
  if (days <= 0) return `${verb} today`;
  if (days === 1) return `${verb} yesterday`;
  return `${verb} ${days} days ago`;
}

export default function DueForRevision() {
  const { t } = useTheme();
  // Read once on mount. dueForRevision is a pure read, so looking at the
  // homepage can never change a student's schedule.
  const [rows, setRows] = useState(() => dueForRevision(MAX_CARDS));
  const [acted, setActed] = useState(false);

  // Stay honest if the student revises something in another tab and comes back
  // to this one — but only ever REMOVE. Re-reading the queue wholesale here
  // topped the row back up to three after the student had dismissed cards, so
  // chapters they had never seen appeared mid-visit and, because the row never
  // reached empty, the day never paused. On a phone that loop is unbounded:
  // dismiss, switch apps, come back, three again. That is precisely the
  // treadmill this band is built not to be.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const stillDue = new Set(dueForRevision(Number.MAX_SAFE_INTEGER).map((row) => row.id));
      setRows((current) => current.filter((row) => stillDue.has(row.id)));
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  // The pause belongs here, not inside the click handler: React batches
  // updates, so three quick dismissals all run against the same `rows` from one
  // render. Deciding "was that the last card?" inside the handler read a stale
  // list, left a card on screen and never paused the day.
  useEffect(() => {
    if (acted && rows.length === 0) pauseRevisionForToday();
  }, [acted, rows]);

  // Nothing due — and nothing rendered. No "all caught up!" band: an empty
  // state here is just noise on a page that was deliberately cut to six
  // sections.
  if (rows.length === 0) return null;

  // Acting on a card removes it. When the last one goes, the effect above
  // stops the band for the day instead of pulling three more chapters up —
  // clearing the row must not summon another row. The updater form is required:
  // see the comment on that effect.
  const act = (item, write) => {
    write({ courseId: item.courseId, chapterId: item.chapterId });
    setActed(true);
    setRows((current) => current.filter((row) => row.id !== item.id));
  };

  return (
    <section className="pt-4 pb-8" aria-labelledby="due-for-revision-heading">
      <Container>
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4" style={{ color: BRAND_TEAL }} aria-hidden="true" />
          <h2 id="due-for-revision-heading" className={`text-sm font-semibold ${t.text}`}>
            Worth a revision
          </h2>
        </div>

        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {rows.map((item) => (
            <li key={item.id} className={`rounded-2xl border ${t.border} ${t.card} p-4 sm:p-5`}>
              <p className={`text-base font-semibold ${t.text}`}>{item.chapterName}</p>

              {/* Explicit spaces, not margin alone: a purely visual gap is read
                  run-together by innerText and by screen readers. */}
              <p className={`mt-1 text-xs tabular-nums ${t.muted}`}>
                {ageLabel(item)}
                {item.totalLessons
                  ? <>{" · "}{item.totalLessons} lecture{item.totalLessons === 1 ? "" : "s"}</>
                  : null}
              </p>
              {/* A course whose title IS the chapter name adds nothing —
                  "Rotational Motion / Physics · Rotational Motion" reads as a
                  bug. Many chapter-sized playlists are titled that way. */}
              {(item.subject || (item.courseTitle && item.courseTitle !== item.chapterName)) && (
                <p className={`mt-0.5 truncate text-xs ${t.muted}`}>
                  {[item.subject, item.courseTitle !== item.chapterName ? item.courseTitle : null]
                    .filter(Boolean).join(" · ")}
                </p>
              )}

              <Link
                to={`/course/${item.courseId}/chapter/${item.chapterId}`}
                aria-label={`Open ${item.chapterName}`}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:brightness-110"
              >
                Open chapter
              </Link>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => act(item, markChapterRevised)}
                  aria-label={`Mark ${item.chapterName} revised`}
                  className={`min-h-11 rounded-lg border px-3 text-xs font-medium ${t.border} ${t.muted} hover:border-accent-line`}
                >
                  Mark revised
                </button>
                <button
                  type="button"
                  onClick={() => act(item, snoozeChapter)}
                  aria-label={`Not now: ${item.chapterName}`}
                  className={`min-h-11 rounded-lg border px-3 text-xs font-medium ${t.border} ${t.muted} hover:border-accent-line`}
                >
                  Not now
                </button>
              </div>
            </li>
          ))}
        </ul>

        {/* Provenance: never let the dates stand on their own. Two separate
            claims, and they are scoped differently on purpose. The DATE comes
            from the watch record, which for a signed-in student can have been
            written on another device — so it must not be described as "finished
            on this device". The LIST is genuinely device-local: it is not
            synced, so a student who cleared chapters on their phone must not
            read an empty laptop as the site losing their work. */}
        <p className={`mt-3 text-xs ${t.muted}`}>
          Based on when you finished each chapter. This list is kept on this
          device only, and is a reminder rather than a test of what you remember.
        </p>
      </Container>
    </section>
  );
}
