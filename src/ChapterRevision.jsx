// ChapterRevision — "revise this chapter in one sitting", on the watch page.
//
// WHY THIS EXISTS. The catalogue already holds 69 courses tagged `revision` or
// `one-shot`, covering 189 of 263 chapters, and until now nothing on the site
// pointed at them: they were mixed into the same lists as 60-lecture full
// courses, where a student looking for a full course does not want them and a
// student wanting to revise never finds them. Several catalogue reviews
// explicitly deferred adding more of this material "until the product has a
// distinct revision surface". This is that surface.
//
// It is also the other half of the homepage revision band. Telling a student
// "you finished Rotational Motion 24 days ago" and then handing them the same
// fourteen lectures is not revision advice; a 47-minute one-shot by a different
// teacher is.
//
// Data path: the same chapter-scoped browse query ChapterTeachers uses, with a
// content_type filter — no new query, no new table. Chapter-scoped rows carry a
// real summed duration, so "47m" is measured rather than guessed; when it is
// missing the card omits it instead of inventing one.
//
// Renders nothing when the chapter has no revision material (74 of 263
// chapters), rather than an empty panel.
import { Link } from "react-router";
import { ArrowRight, Zap } from "lucide-react";
import { useTheme } from "./theme.jsx";
import { BRAND_TEAL } from "./brandColors.js";
import { usePlaylistBrowse, formatDuration } from "./usePlaylistBrowse.js";
import { ratingDisplay } from "./ratingConfidence.js";

// One-shots and revision series only. Deliberately NOT pyq or practice: those
// are worth their own surface and are a different study action.
export const REVISION_CONTENT_TYPES = ["one-shot", "revision"];

const MAX_SHOWN = 4;

/**
 * Pure, exported for tests: the revision courses worth offering for a chapter,
 * best first. The course being watched is excluded — offering a student the
 * page they are already on is noise.
 */
export function pickRevisionCourses(items, currentCourseId) {
  return (items ?? [])
    .filter((course) => (
      course.id !== currentCourseId
      && REVISION_CONTENT_TYPES.includes(course.contentType)
    ))
    .sort((a, b) => score(b) - score(a))
    .slice(0, MAX_SHOWN);
}

// A confident rating first, then the shorter sitting — the point of a one-shot
// is that it fits in an evening. Courses with no confident rating still appear;
// they simply sort below ones that have earned a number.
function score(course) {
  const shown = ratingDisplay(course.rating, course.ratingCount);
  const rating = shown && shown.kind === "scored" ? shown.score : 0;
  const seconds = Number(course.durationSeconds ?? 0);
  const brevity = seconds > 0 ? Math.max(0, 600 - Math.min(seconds / 60, 600)) : 0;
  return rating * 1000 + brevity;
}

export default function ChapterRevision({ chapterId, chapterName, currentCourseId }) {
  const { t } = useTheme();
  const enabled = Number.isInteger(chapterId) && chapterId > 0;
  const { items, loading } = usePlaylistBrowse({
    chapterId, contentType: REVISION_CONTENT_TYPES, enabled,
  });

  if (!enabled || loading) return null;
  const courses = pickRevisionCourses(items, currentCourseId);
  if (courses.length === 0) return null;

  return (
    <section
      aria-label={`Revise ${chapterName ?? "this chapter"} in one sitting`}
      className={`mt-4 rounded-2xl border ${t.border} ${t.card} p-4 sm:p-5`}
    >
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4" style={{ color: BRAND_TEAL }} aria-hidden="true" />
        <h2 className={`text-sm font-semibold ${t.text}`}>
          Revise in one sitting{" "}
          {chapterName ? <span className={t.muted}>{chapterName}</span> : null}
        </h2>
      </div>
      <p className={`mt-1 text-xs ${t.muted}`}>
        One-shot and revision courses covering this chapter.
      </p>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {courses.map((course) => {
          const shown = ratingDisplay(course.rating, course.ratingCount);
          const score2 = shown && shown.kind === "scored" ? shown.score : null;
          // Chapter-scoped, so this is the time for THIS chapter, not the
          // whole course. Null when the rows carried no duration.
          const length = formatDuration(course.durationSeconds);
          return (
            <li key={course.id}>
              <Link
                to={`/course/${course.id}/chapter/${chapterId}`}
                className={`group flex min-h-11 items-center gap-3 rounded-xl border ${t.border} p-3 transition-colors hover:border-accent-line`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${t.text}`}>
                    {course.title}
                  </span>
                  <span className={`block truncate text-xs ${t.muted}`}>
                    {[
                      course.teacher || course.institute,
                      length,
                      score2 != null ? `${score2.toFixed(1)}/5` : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <ArrowRight
                  className={`h-4 w-4 shrink-0 ${t.faint} transition-transform group-hover:translate-x-0.5`}
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
