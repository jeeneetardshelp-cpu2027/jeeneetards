// ChapterTeachers — "who else teaches this chapter", on the watch page.
//
// The one thing this site can do that YouTube cannot is show every institute
// that teaches a given chapter, side by side. Until now that view existed only
// on the browse/compare pages — the moment a student decides they dislike the
// teacher they are watching, which is exactly when a second option matters most,
// the watch page offered no way to reach one. CourseOverview rendered the
// chapter as a non-clickable label, and the only lateral links were "Back to
// results" and the SAME institute's other courses.
//
// This is a thin strip under the player: "N other institutes teach {chapter}",
// then a link per institute straight into that institute's course, scoped to the
// same chapter. It reuses the chapter-scoped browse query the site already runs
// (usePlaylistBrowse with a chapterId), so it introduces no new data path.
//
// Honesty rule, same as everywhere else: if there is no OTHER institute for this
// chapter, the strip renders nothing at all rather than an empty panel. 38 of
// 263 chapters have a single institute, and on those a "0 other teachers" box
// would be worse than silence.
import { Link } from "react-router";
import { ArrowRight, Users } from "lucide-react";
import { useTheme } from "./theme.jsx";
import { usePlaylistBrowse } from "./usePlaylistBrowse.js";
import { ratingDisplay } from "./ratingConfidence.js";
import ChannelAvatar from "./ChannelAvatar.jsx";
import { BRAND_TEAL } from "./brandColors.js";

// Pure, exported for tests: given the chapter's courses and the one being
// watched, choose which OTHER-institute courses to surface and in what order.
//
//   * the course currently being watched is removed
//   * courses whose institute is the one being watched are removed — "another
//     teacher" means another INSTITUTE, not the same institute's next course,
//     and the site already counts institutes, not channels, everywhere else
//   * one course per institute: the best entry point, ranked by rating (only
//     when it clears the confidence floor), then lecture count, then title
//   * result capped, newest-institute-agnostic, deterministic
export function pickOtherTeachers(courses, currentCourseId, currentInstituteId, limit = 4) {
  const best = new Map(); // instituteId -> chosen course
  for (const course of courses ?? []) {
    if (course.id === currentCourseId) continue;
    const instituteId = course.instituteId ?? `name:${course.institute ?? ""}`;
    if (currentInstituteId != null && course.instituteId === currentInstituteId) continue;
    if (!course.institute) continue; // an unnamed institute is not a credible "other teacher"
    const held = best.get(instituteId);
    if (!held || rankCourse(course) > rankCourse(held)) best.set(instituteId, course);
  }
  return [...best.values()]
    .sort((a, b) => rankCourse(b) - rankCourse(a) || (a.institute || "").localeCompare(b.institute || ""))
    .slice(0, limit);
}

// A single comparable score. Rating dominates but only once it is trustworthy:
// ratingDisplay returns { kind: "scored", score } only above
// RATING_CONFIDENCE_MIN, and { kind: "low" } / null otherwise. A low or absent
// rating contributes nothing, then the fuller course wins. Kept integer-ish so
// ties break on title.
function rankCourse(course) {
  const shown = ratingDisplay(course.rating, course.ratingCount);
  const rating = shown && shown.kind === "scored" ? shown.score : 0;
  const lectures = Number(course.lectures ?? 0);
  return rating * 1000 + Math.min(lectures, 999);
}

export default function ChapterTeachers({
  chapterId, chapterName, currentCourseId, currentInstituteId,
}) {
  const { t } = useTheme();
  const enabled = Number.isInteger(chapterId) && chapterId > 0;
  // The same query the browse page runs, filtered to this chapter. No goal or
  // board scope: a student watching the chapter should see every institute that
  // teaches it, not only those inside the exam lane they arrived through.
  const { items, loading } = usePlaylistBrowse({ chapterId, enabled });

  if (!enabled || loading) return null;
  const others = pickOtherTeachers(items, currentCourseId, currentInstituteId);
  if (others.length === 0) return null;

  const noun = others.length === 1 ? "institute" : "institutes";
  return (
    <section
      aria-label={`Other institutes teaching ${chapterName ?? "this chapter"}`}
      className={`mt-4 rounded-2xl border ${t.border} ${t.card} p-4 sm:p-5`}
    >
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4" style={{ color: BRAND_TEAL }} aria-hidden="true" />
        <h2 className={`text-sm font-semibold ${t.text}`}>
          {others.length} other {noun} teach{others.length === 1 ? "es" : ""}{" "}
          {chapterName ? <span className={t.muted}>{chapterName}</span> : "this chapter"}
        </h2>
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {others.map((course) => {
          const shown = ratingDisplay(course.rating, course.ratingCount);
          const score = shown && shown.kind === "scored" ? shown.score : null;
          return (
            <li key={course.id}>
              <Link
                to={`/course/${course.id}/chapter/${chapterId}`}
                className={`group flex items-center gap-3 rounded-xl border ${t.border} p-3 transition-colors hover:border-teal-500`}
              >
                <ChannelAvatar
                  url={course.instituteLogoUrl}
                  name={course.institute}
                  className="h-9 w-9 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${t.text}`}>
                    {course.institute}
                  </span>
                  <span className={`block truncate text-xs ${t.muted}`}>
                    {course.lectures != null && `${course.lectures} lecture${course.lectures === 1 ? "" : "s"}`}
                    {course.lectures != null && score != null && " · "}
                    {score != null && `★ ${score.toFixed(1)}`}
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
