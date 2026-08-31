// ChapterCleared — the share card for finishing a chapter.
//
// Finishing a chapter is the proudest, most frequent moment on this site, and
// until now it passed in total silence: the player rolled to the next lesson
// and nothing marked that a chapter had been closed out. This band appears at
// exactly that moment, under the player, and offers to send it to a batch group.
//
// WHY HERE AND NOT IN THE END-OF-LESSON OVERLAY. The "up next" overlay
// auto-advances after a few seconds, so a share button living inside it would
// vanish before a student could press it, and hijacking that overlay would mean
// touching autoplay. This sits in the page instead: the student who just
// finished the last lesson sees it immediately, and it is still there a minute
// later when they actually want to send it.
//
// The shared link is /course/:id/chapter/:id, which already renders a rich
// preview card through /api/og — so what lands in WhatsApp is the course card,
// not a bare URL.
//
// No <Reveal>: reveal blocks ship at opacity:0 until a useReveal() root
// observes them, which has shipped a blank section twice in this codebase.
import { useState } from "react";
import { CircleCheckBig, Share2 } from "lucide-react";
import { useTheme } from "./theme.jsx";
import { BRAND_TEAL } from "./brandColors.js";
import { chapterCompletion, chapterShareMessage, courseByline } from "./chapterCompletion.js";

export default function ChapterCleared({
  // The WHOLE course's lessons. A chapter slice would make every one-lesson
  // view look like a cleared chapter.
  lessons = [],
  completedIds = [],
  chapterId = null,
  courseId = null,
  teacher = null,
  institute = null,
}) {
  const { t } = useTheme();
  const [shared, setShared] = useState(false);

  const progress = chapterCompletion(lessons, completedIds, chapterId);
  // Nothing to celebrate yet — and nothing rendered. No progress bar, no
  // "3 of 14 done" nag: this band is the reward, not another tracker.
  if (!progress?.cleared) return null;

  const chapterName = progress.chapter?.name ?? null;
  const byline = courseByline(teacher, institute);
  const path = courseId ? `/course/${courseId}/chapter/${chapterId}` : "/";

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    const text = chapterShareMessage({
      chapterName, total: progress.total, byline, url,
    });
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
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
    <section
      aria-label={`${chapterName ?? "Chapter"} cleared`}
      className={`mt-4 rounded-2xl border ${t.border} ${t.card} p-4 sm:p-5`}
    >
      <div className="flex items-center gap-2">
        <CircleCheckBig className="h-4 w-4" style={{ color: BRAND_TEAL }} aria-hidden="true" />
        <h2 className={`text-sm font-semibold ${t.text}`}>Chapter cleared</h2>
      </div>

      {/* Explicit spaces, not just margin: a purely visual gap is read
          run-together by innerText and by screen readers. */}
      <p className={`mt-2 text-lg font-semibold ${t.text}`}>
        {chapterName ?? "This chapter"}{" "}
        <span className={`text-sm font-medium tabular-nums ${t.muted}`}>
          {progress.done}/{progress.total} lectures
        </span>
      </p>
      {byline && <p className={`mt-1 text-xs ${t.muted}`}>Taught by {byline}</p>}

      <button
        type="button"
        onClick={share}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:brightness-110"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {shared ? "Copied" : "Share this"}
      </button>
    </section>
  );
}
