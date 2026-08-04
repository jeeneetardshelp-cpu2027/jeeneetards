import {
  AlertTriangle, BookOpen, Clock, Layers, Play, Star,
} from "lucide-react";
import { useTheme } from "./theme.jsx";
import {
  CONTENT_TYPE_LABELS, DIFFICULTY_LABELS, LANGUAGE_LABELS, formatDuration,
} from "./metadata.js";
import { ratingDisplay } from "./ratingConfidence.js";
import { BRAND_TEAL, BRAND_SERIF, subjectColor } from "./brandColors.js";
import ChannelAvatar from "./ChannelAvatar.jsx";

const TEAL = BRAND_TEAL;

const formatCheckedDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  }).format(date);
};

export default function CourseOverview({
  course, lessons, watchedIds = [], continueLesson = null, onStart, signedIn = false,
}) {
  const { t } = useTheme();
  const color = subjectColor(course.subject);
  const initials = (course.teacher || "")
    .split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const watchedCount = lessons.filter((lesson) => watchedIds.includes(lesson.videoId)).length;
  const lectureCount = Number.isFinite(course.lectures) ? course.lectures : lessons.length;
  const rating = ratingDisplay(course.averageRating, course.ratingsCount);
  const duration = formatDuration(course.totalDurationSeconds);
  const checked = formatCheckedDate(course.lastVerifiedAt);
  const facts = [
    { icon: Layers, text: `${lectureCount} lesson${lectureCount === 1 ? "" : "s"}` },
    duration && { icon: Clock, text: duration },
    course.language && { text: LANGUAGE_LABELS[course.language] ?? course.language },
    course.contentType && { text: CONTENT_TYPE_LABELS[course.contentType] ?? course.contentType },
    course.difficulty && { text: DIFFICULTY_LABELS[course.difficulty] ?? course.difficulty },
  ].filter(Boolean);

  const cta = watchedCount === lessons.length && lessons.length > 0
    ? "Review course"
    : continueLesson
      ? `Continue at lesson ${continueLesson.position}`
      : "Start course";

  return (
    <section className={`overflow-hidden rounded-2xl border ${t.border} ${t.card}`} aria-labelledby="course-title">
      <span className="block h-1 w-full" style={{ background: color }} />
      <div className="p-5 sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {course.subject && (
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ color, background: `${color}17` }}>
                {course.subject}
              </span>
            )}
            {[...(course.learningGoals ?? []), ...(course.classLevels ?? [])].map((label) => (
              <span key={label} className={`rounded-full px-2.5 py-1 text-xs ${t.chip}`}>{label}</span>
            ))}
          </div>
          {/* h2, not h1: the overview card renders below the player now, and
              the page's h1 (sr-only, in VideoView) must stay first in
              reading order. */}
          <h2 id="course-title" className={`mt-3 text-2xl font-semibold tracking-tight sm:text-3xl ${t.text}`}
            style={{ fontFamily: BRAND_SERIF }}>
            {course.title}
          </h2>
          {(course.teacher || course.institute) && (
            <div className={`mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm ${t.muted}`}>
              {course.teacher && (
                <span className="inline-flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full text-[0.6rem] font-bold text-white"
                    style={{ background: color }} aria-hidden="true">{initials || "?"}</span>
                  {course.teacher}
                </span>
              )}
              {course.institute && (
                <span className="inline-flex items-center gap-1.5">
                  <ChannelAvatar
                    url={course.instituteLogoUrl}
                    name={course.institute}
                    className="h-6 w-6"
                  />
                  {course.institute}
                </span>
              )}
            </div>
          )}
          <div className={`mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm ${t.muted}`}>
            {facts.map((fact, index) => (
              <span key={index} className="inline-flex items-center gap-1.5">
                {fact.icon && <fact.icon className="h-4 w-4" />}{fact.text}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {rating?.kind === "scored" && (
              <span className={`inline-flex items-center gap-1 font-medium ${t.text}`}>
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {rating.score.toFixed(1)} <span className={t.faint}>({rating.count})</span>
              </span>
            )}
            {rating?.kind === "low" && <span className={t.muted}>{rating.text}</span>}
            {checked && <span className={t.faint}>Checked {checked}</span>}
          </div>
        </div>

        <div className="w-full shrink-0 lg:w-64">
          {watchedCount > 0 && (
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className={t.muted}>{watchedCount} of {lessons.length} watched</span>
              <span className={t.faint}>{Math.round((watchedCount / lessons.length) * 100)}%</span>
            </div>
          )}
          <button
            onClick={onStart}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: TEAL }}
          >
            <Play className="h-4 w-4" fill="white" /> {cta}
          </button>
          <p className={`mt-2 text-center text-xs ${t.faint}`}>
            Free on YouTube · {signedIn ? "progress syncs to your account" : "progress stays on this device"}
          </p>
        </div>
      </div>

      {course.blockedLessons > 0 && (
        <div className="mt-6 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {course.blockedLessons} lesson{course.blockedLessons === 1 ? " is" : "s are"} marked as unavailable in the embedded player. You can still open {course.blockedLessons === 1 ? "it" : "them"} on YouTube.
          </span>
        </div>
      )}

      {course.syllabus?.length > 0 && (
        <div className={`mt-6 border-t ${t.divider} pt-5`}>
          <h2 className={`flex items-center gap-2 text-sm font-semibold ${t.text}`}>
            <BookOpen className="h-4 w-4" /> Syllabus scope
          </h2>
          <p className={`mt-1 text-xs ${t.faint}`}>
            Chapters represented by the lessons in this course—not a claim of complete syllabus coverage.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {course.syllabus.map((chapter) => (
              <span key={chapter.id} className={`rounded-lg border ${t.border} px-3 py-1.5 text-xs ${t.muted}`}>
                {chapter.name}{chapter.subject && chapter.subject !== course.subject ? ` · ${chapter.subject}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
