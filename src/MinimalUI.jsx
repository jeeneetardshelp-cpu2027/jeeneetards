// =====================================================================
//  MinimalUI.jsx  —  three screens for the student-facing app
//
//  Contains:
//    • ThemeProvider / useTheme  -> shared student-page colours
//    • VideoView                 -> real player, progress and lesson sequence
//
//  THEMING: instead of Tailwind's `dark:` variant (which needs config),
//  we keep two small palettes of class names and swap them with a toggle.
//  Every component reads its colours from useTheme().t — that's it.
// =====================================================================

import { GlobalHeader, Container } from "./AppShell.jsx";
import {
  ArrowLeft, Check, ChevronLeft, ChevronRight, ExternalLink, Search, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import YouTubePlayer from "./YouTubePlayer.jsx";
import { useTheme } from "./theme.jsx";
import { formatDuration } from "./metadata.js";
import { BRAND_TEAL } from "./brandColors.js";
export { ThemeProvider, ThemeContext, useTheme } from "./theme.jsx";

// Accent colours stay the same in both themes (used via inline style).
const ACCENT = { teal: BRAND_TEAL };

// =====================================================================
//  3a.  PLAYER AREA
//       The placeholder is gone — this is the real YouTube player now.
//       YouTubePlayer handles the "embedding disabled by creator" case
//       and falls back to a direct link, so we just hand it an ID.
// =====================================================================
function PlayerArea({ videoId, title, onPlay }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-neutral-900">
      <YouTubePlayer videoId={videoId} title={title} onPlay={onPlay} />
    </div>
  );
}

// =====================================================================
//  3.  VIDEO VIEW  (player left/top, tabbed panel right/bottom)
// =====================================================================
// The course's lessons, in playlist order. Selecting one changes the player;
// a watched tick appears only after YouTube reports actual playback.
export const LESSONS_PER_VIEW = 50;

export function LessonList({ lessons, activeLessonId, onSelectLesson, watchedIds = [] }) {
  const { t } = useTheme();
  const [query, setQuery] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [unwatchedOnly, setUnwatchedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const watched = useMemo(() => new Set(watchedIds), [watchedIds]);
  const chapters = useMemo(() => {
    const found = new Map();
    lessons.forEach((lesson) => {
      if (lesson.chapter?.id && !found.has(String(lesson.chapter.id))) {
        found.set(String(lesson.chapter.id), lesson.chapter.name);
      }
    });
    return [...found.entries()].map(([id, name]) => ({ id, name }));
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return lessons.filter((lesson) => {
      if (chapterId && String(lesson.chapter?.id ?? "") !== chapterId) return false;
      if (unwatchedOnly && watched.has(lesson.videoId)) return false;
      if (!needle) return true;
      const searchable = `${lesson.position ?? ""} ${lesson.title ?? ""} ${lesson.chapter?.name ?? ""}`
        .toLocaleLowerCase();
      return searchable.includes(needle);
    });
  }, [chapterId, lessons, query, unwatchedOnly, watched]);

  const pageCount = Math.max(1, Math.ceil(filteredLessons.length / LESSONS_PER_VIEW));
  useEffect(() => {
    const activeIndex = filteredLessons.findIndex((lesson) => lesson.id === activeLessonId);
    setPage(activeIndex >= 0 ? Math.floor(activeIndex / LESSONS_PER_VIEW) + 1 : 1);
  }, [activeLessonId, chapterId, query, unwatchedOnly, filteredLessons]);

  if (!lessons.length) return null;

  const watchedCount = lessons.filter((lesson) => watched.has(lesson.videoId)).length;
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * LESSONS_PER_VIEW;
  const visibleLessons = filteredLessons.slice(start, start + LESSONS_PER_VIEW);
  const hasFilters = Boolean(query || chapterId || unwatchedOnly);
  const activeVisible = filteredLessons.some((lesson) => lesson.id === activeLessonId);
  const clearFilters = () => {
    setQuery("");
    setChapterId("");
    setUnwatchedOnly(false);
  };

  return (
    <section className="mt-8" aria-labelledby="course-lessons-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="course-lessons-heading" className={`text-base font-semibold ${t.text}`}>
            Course lessons
          </h2>
          <p className={`mt-0.5 text-sm ${t.faint}`}>
            {watchedCount > 0 ? `${watchedCount} of ${lessons.length} watched` : `${lessons.length} lessons`}
          </p>
        </div>
        {filteredLessons.length > 0 && (
          <p className={`text-xs ${t.faint}`} aria-live="polite">
            Showing {start + 1}–{Math.min(start + LESSONS_PER_VIEW, filteredLessons.length)} of {filteredLessons.length}
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="relative sm:col-span-2">
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.faint}`} />
          <input
            type="search"
            aria-label="Search lessons in this course"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lessons in this course"
            className={`min-h-11 w-full rounded-xl border ${t.border} ${t.card} ${t.text} pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-teal-500`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear lesson search"
              className={`absolute right-0 top-0 flex min-h-11 min-w-11 items-center justify-center ${t.faint}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {chapters.length > 1 && (
          <label>
            <span className="sr-only">Filter lessons by chapter</span>
            <select
              value={chapterId}
              onChange={(event) => setChapterId(event.target.value)}
              className={`min-h-11 w-full rounded-xl border ${t.border} ${t.card} ${t.text} px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500`}
            >
              <option value="">All chapters</option>
              {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}
            </select>
          </label>
        )}
        <button
          type="button"
          aria-pressed={unwatchedOnly}
          onClick={() => setUnwatchedOnly((value) => !value)}
          className={`min-h-11 rounded-xl border px-3 text-sm font-medium ${
            unwatchedOnly ? "border-teal-600 bg-teal-700 text-white" : `${t.border} ${t.card} ${t.muted}`
          }`}
        >
          Unwatched only
        </button>
      </div>

      {hasFilters && !activeVisible && (
        <div className={`mt-3 flex flex-col gap-2 rounded-xl border border-amber-500/60 ${t.card} p-3 sm:flex-row sm:items-center sm:justify-between`} role="status">
          <p className={`text-sm ${t.text}`}>The lesson playing now is hidden by your lesson filters.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-teal-600"
          >
            Show current lesson
          </button>
        </div>
      )}

      {visibleLessons.length === 0 ? (
        <div className={`mt-3 rounded-xl border ${t.border} p-6 text-center`}>
          <p className={`text-sm font-medium ${t.text}`}>No lessons match these filters.</p>
          <button type="button" onClick={clearFilters} className="mt-2 min-h-11 px-3 text-sm font-semibold text-teal-700">
            Clear filters
          </button>
        </div>
      ) : (
      <ol className={`mt-3 overflow-hidden rounded-xl border ${t.border}`}>
        {visibleLessons.map((lesson, index) => {
          const active = lesson.id === activeLessonId;
          const isWatched = watched.has(lesson.videoId);
          const previous = visibleLessons[index - 1];
          const startsChapter = lesson.chapter?.id && lesson.chapter.id !== previous?.chapter?.id;
          return (
            <li key={lesson.id} className={`border-b last:border-b-0 ${t.divider}`}>
              {startsChapter && (
                <p className={`border-b ${t.divider} px-4 py-2 text-xs font-semibold uppercase tracking-wide ${t.faint}`}>
                  {lesson.chapter.name}
                </p>
              )}
              <button
                onClick={() => onSelectLesson(lesson)}
                aria-current={active ? "step" : undefined}
                className={`flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left text-sm transition ${t.hover}`}
                style={{
                  borderLeft: `3px solid ${active ? ACCENT.teal : "transparent"}`,
                }}
              >
                <span className="flex w-4 shrink-0 items-center justify-center">
                  {isWatched && !active ? (
                    <Check className="h-4 w-4" style={{ color: ACCENT.teal }} />
                  ) : (
                    <span
                      className={`text-xs ${active ? "font-semibold" : t.faint}`}
                      style={active ? { color: ACCENT.teal } : undefined}
                    >
                      {lesson.position}
                    </span>
                  )}
                </span>
                <span className={active ? `font-semibold ${t.text}` : t.muted}>
                  <span className="block">{lesson.title}</span>
                  <span className={`mt-1 flex flex-wrap items-center gap-2 text-xs font-normal ${t.faint}`}>
                    {lesson.durationSeconds > 0 && <span>{formatDuration(lesson.durationSeconds)}</span>}
                    {lesson.embeddingStatus === "blocked" && (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <ExternalLink className="h-3 w-3" /> YouTube only
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      )}

      {pageCount > 1 && (
        <nav className="mt-3 flex items-center justify-between gap-3" aria-label="Lesson pages">
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className={`inline-flex min-h-11 items-center gap-1 rounded-xl border ${t.border} px-3 text-sm font-medium ${t.text} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className={`text-xs ${t.faint}`}>Page {safePage} of {pageCount}</span>
          <button
            type="button"
            disabled={safePage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            className={`inline-flex min-h-11 items-center gap-1 rounded-xl border ${t.border} px-3 text-sm font-medium ${t.text} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </section>
  );
}

export function VideoView({
  course,
  chapter,
  crumbs: crumbsProp,
  videoId,
  videoTitle = "Lesson",
  lessons = [],
  activeLessonId = null,
  watchedIds = [],
  ratingPanel = null,
  reportSlot = null,
  overview = null,
  onSelectLesson = () => {},
  onLessonPlay = () => {},
  onBack,
}) {
  const { t } = useTheme();
  const crumbs = crumbsProp ?? [
    // onBack knows whether history is trustworthy; a bare to:"/browse" would
    // drop the goal/class/subject/chapter the student had applied.
    onBack ? { label: "Browse courses", onClick: onBack } : { label: "Browse courses", to: "/browse" },
    { label: chapter || "Course" },
    { label: videoTitle },
  ];
  const activeIndex = lessons.findIndex((lesson) => lesson.id === activeLessonId);
  const previousLesson = activeIndex > 0 ? lessons[activeIndex - 1] : null;
  const nextLesson = activeIndex >= 0 && activeIndex < lessons.length - 1
    ? lessons[activeIndex + 1]
    : null;

  return (
    <div className={`min-h-screen ${t.page}`}>
      {/* top bar */}
      <GlobalHeader crumbs={crumbs} />

      {/* split layout: stacks on mobile, side-by-side on large screens */}
      <main className="py-6 sm:py-8">
       {/* An explicit way back to the results. `onBack` was previously accepted
           as a prop and never rendered, so the course page had no return
           affordance at all beyond the breadcrumb. */}
       {onBack && (
         <Container className="pb-4">
           <button
             onClick={onBack}
             className={`flex min-h-11 items-center gap-1 text-sm ${t.faint} ${t.hover}`}
           >
             <ArrowLeft className="h-4 w-4" /> Back to results
           </button>
         </Container>
       )}
       {overview && <Container className="pb-7">{overview}</Container>}
       <Container width="reading">
        <div id="course-player" tabIndex={-1} className="scroll-mt-44 focus:outline-none sm:scroll-mt-28">
          <PlayerArea videoId={videoId} title={videoTitle} onPlay={onLessonPlay} />
          <h2 className={`mt-5 text-xl font-semibold ${t.text}`}>{videoTitle}</h2>
          <p className={`mt-1 text-sm ${t.muted}`}>
            {lessons.length > 0
              ? `Lesson ${
                  lessons.find((l) => l.id === activeLessonId)?.position ?? 1
                } of ${lessons.length}`
              : `Lesson 1 of ${course.lectures}`}
          </p>

          {lessons.length > 1 && (
            <nav className="mt-4 flex gap-2" aria-label="Lesson navigation">
              <button
                type="button"
                disabled={!previousLesson}
                onClick={() => previousLesson && onSelectLesson(previousLesson)}
                className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border ${t.border} px-3 text-sm font-medium ${t.text} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <ChevronLeft className="h-4 w-4" /> Previous lesson
              </button>
              <button
                type="button"
                disabled={!nextLesson}
                onClick={() => nextLesson && onSelectLesson(nextLesson)}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-teal-700 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next lesson <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}

          {reportSlot}

          <LessonList
            lessons={lessons}
            activeLessonId={activeLessonId}
            watchedIds={watchedIds}
            onSelectLesson={onSelectLesson}
          />

          {ratingPanel}
        </div>
      </Container>
      </main>
    </div>
  );
}
