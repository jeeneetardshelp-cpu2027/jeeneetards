// =====================================================================
//  MinimalUI.jsx  —  the watch screen (player + lesson sequence)
//
//  Contains:
//    • PlayerArea  -> the embedded YouTube player, resume/autoplay/rate
//                     props passed straight through
//    • LessonList  -> searchable, filterable, paged lesson sequence
//    • VideoView   -> the watch page: player first on mobile, player plus a
//                     sticky lesson rail on desktop, with an up-next overlay
//                     when a lesson ends
//
//  THEMING: theme.jsx owns the light/dark palettes (re-exported below for
//  compatibility). Components read colours from useTheme().t — never
//  Tailwind's `dark:` variant. Brand accents are applied via inline style.
// =====================================================================

import { GlobalHeader, Container } from "./AppShell.jsx";
import {
  AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, ExternalLink, Search, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTubePlayer from "./YouTubePlayer.jsx";
import { useTheme } from "./theme.jsx";
import { formatDuration } from "./metadata.js";
import { BRAND_TEAL, BRAND_SERIF } from "./brandColors.js";
import YouTubeThumbnail from "./YouTubeThumbnail.jsx";
export { ThemeProvider, ThemeContext, useTheme } from "./theme.jsx";

// Accent colours stay the same in both themes (used via inline style).
const ACCENT = { teal: BRAND_TEAL };

// =====================================================================
//  3a.  PLAYER AREA
//       The placeholder is gone — this is the real YouTube player now.
//       YouTubePlayer handles the "embedding disabled by creator" case
//       and falls back to a direct link, so we just hand it an ID.
// =====================================================================
function PlayerArea({
  videoId, title, onPlay, onPlaying, onEnded, onProgress,
  startSeconds, autoplay, playbackRate, onPlaybackRateChange, playSignal, seekTo,
}) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-neutral-900">
      <YouTubePlayer
        videoId={videoId}
        title={title}
        onPlay={onPlay}
        onPlaying={onPlaying}
        onEnded={onEnded}
        onProgress={onProgress}
        startSeconds={startSeconds}
        autoplay={autoplay}
        playbackRate={playbackRate}
        onPlaybackRateChange={onPlaybackRateChange}
        playSignal={playSignal}
        seekTo={seekTo}
      />
    </div>
  );
}

// Shared chrome for the end-of-lesson overlays. Fully covering the ended
// player also hides YouTube's own suggestion wall — this site is meant to
// keep students inside the course sequence, not hand them to the algorithm.
// An alertdialog, not a live region: the countdown re-renders every second,
// and an atomic status region would re-announce the whole overlay each tick.
// The caller moves focus in (so keyboard users can reach Cancel in time) and
// announces the event once through its own sr-only status line.
function PlayerOverlay({ label, children }) {
  const { t } = useTheme();
  return (
    <div
      role="alertdialog"
      aria-label={label}
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-2xl ${t.card} p-6 text-center`}
    >
      {children}
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
          <h2 id="course-lessons-heading" className={`text-lg font-semibold ${t.text}`} style={{ fontFamily: BRAND_SERIF }}>
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
                  background: active ? `${ACCENT.teal}12` : undefined,
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
                <YouTubeThumbnail
                  videoId={lesson.videoId}
                  className="aspect-video w-20 shrink-0 rounded-md border border-hairline sm:w-24"
                />
                <span className={`min-w-0 flex-1 ${active ? `font-semibold ${t.text}` : t.muted}`}>
                  <span className="block">{lesson.title}</span>
                  <span className={`mt-1 flex flex-wrap items-center gap-2 text-xs font-normal ${t.faint}`}>
                    {lesson.durationSeconds > 0 && <span>{formatDuration(lesson.durationSeconds)}</span>}
                    {lesson.embeddingStatus === "blocked" && (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <ExternalLink className="h-3 w-3" /> YouTube only
                      </span>
                    )}
                    {lesson.embeddingStatus === "unavailable" && (
                      <span className="inline-flex items-center gap-1 text-rose-600">
                        <AlertCircle className="h-3 w-3" /> Unavailable
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

// Seconds the up-next overlay counts down before auto-advancing.
export const UP_NEXT_SECONDS = 5;

export function VideoView({
  course,
  chapter,
  crumbs: crumbsProp,
  videoId,
  videoTitle = "Lesson",
  lessons = [],
  // The full course sequence, when `lessons` is only a chapter's slice of it.
  // Defaults to `lessons`, so the unscoped /course/:id route is unchanged.
  courseLessons = null,
  activeLessonId = null,
  watchedIds = [],
  ratingPanel = null,
  reportSlot = null,
  materialsPanel = null,
  // The student's own device-local notes for this lesson.
  notesPanel = null,
  // "Who else teaches this chapter" — a strip directly under the player nav.
  moreTeachers = null,
  overview = null,
  onSelectLesson = () => {},
  onLessonPlay = () => {},
  onBack,
  startSeconds = 0,
  autoplay = false,
  playbackRate = null,
  onPlaybackRateChange = null,
  onEnded = null,
  onProgress = null,
  playSignal = 0,
  // { seconds, nonce } — forwarded to the player so a clicked note timestamp
  // seeks the video.
  seekTo = null,
}) {
  const { t } = useTheme();
  const crumbs = crumbsProp ?? [
    // onBack knows whether history is trustworthy; a bare to:"/browse" would
    // drop the goal/class/subject/chapter the student had applied.
    onBack ? { label: "Browse courses", onClick: onBack } : { label: "Browse courses", to: "/browse" },
    { label: chapter || "Course" },
    { label: videoTitle },
  ];
  // `lessons` is what the student SEES in the list. On /course/:id/chapter/:id
  // that is one chapter's slice, which is the point of that route. `sequence` is
  // the whole course, and it is what "next" must walk.
  //
  // Keeping these separate is the fix for a real defect: 672 of 1,217
  // (course, chapter) pairs hold exactly one lesson — 55.2%, median 1 — so
  // deriving `nextLesson` from the slice meant that on the majority of watch
  // pages the first video ended with "Course complete", "You watched 1 of 1
  // lesson in this course", and the prev/next nav hidden entirely. A student one
  // video into a 68-lesson course was congratulated and given nowhere to go.
  const sequence = courseLessons?.length ? courseLessons : lessons;
  const scoped = sequence !== lessons;

  const seqIndex = sequence.findIndex((lesson) => lesson.id === activeLessonId);
  const previousLesson = seqIndex > 0 ? sequence[seqIndex - 1] : null;
  const nextLesson = seqIndex >= 0 && seqIndex < sequence.length - 1
    ? sequence[seqIndex + 1]
    : null;

  // End-of-lesson overlay: "next" counts down to the next lesson, "complete"
  // marks the end of the COURSE — never merely the end of the visible slice.
  const [overlay, setOverlay] = useState(null);
  const [countdown, setCountdown] = useState(UP_NEXT_SECONDS);
  // The overlay auto-navigates on a timer, so keyboard users must land ON its
  // cancel control the moment it appears — their focus is otherwise trapped
  // inside YouTube's iframe with no realistic path to Cancel in 5 seconds.
  const overlayFocusRef = useRef(null);

  // Any lesson change (auto-advance, list click, prev/next) clears the
  // overlay and re-arms the countdown, so a stale overlay can never linger
  // over — or navigate away from — a lesson it does not belong to.
  useEffect(() => {
    setOverlay(null);
    setCountdown(UP_NEXT_SECONDS);
  }, [activeLessonId]);

  useEffect(() => {
    if (overlay) overlayFocusRef.current?.focus();
  }, [overlay]);

  // Focus must have somewhere real to go when the overlay unmounts —
  // dropping it to <body> strands keyboard and screen-reader users.
  const focusPlayerAnchor = () => {
    document.getElementById("course-player")?.focus({ preventScroll: true });
  };

  // The interval lives and dies with the overlay: Cancel, advancing, a lesson
  // change or unmount all clear it via this effect's cleanup.
  useEffect(() => {
    if (overlay !== "next") return undefined;
    const timer = setInterval(
      () => setCountdown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [overlay]);

  const advanceToNext = useCallback(() => {
    setOverlay(null);
    focusPlayerAnchor();
    if (nextLesson) onSelectLesson(nextLesson, { scrollToPlayer: false });
  }, [nextLesson, onSelectLesson]);

  const dismissOverlay = () => {
    setOverlay(null);
    focusPlayerAnchor();
  };

  // Advancing happens in an effect — not inside the interval callback — so a
  // Cancel that lands in the same tick always wins over the countdown.
  useEffect(() => {
    if (overlay === "next" && countdown === 0) advanceToNext();
  }, [advanceToNext, countdown, overlay]);

  const handleLessonEnded = (payload) => {
    // An old player's ENDED can arrive during a lesson switch; only the
    // CURRENT lesson's end may raise the overlay. The page-level handler
    // does its own payload routing.
    onEnded?.(payload);
    if (payload?.videoId && payload.videoId !== videoId) return;
    setCountdown(UP_NEXT_SECONDS);
    setOverlay(nextLesson ? "next" : "complete");
  };

  // Replaying the ended lesson (YouTube's own controls still work under the
  // overlay for pointer users, and Space/k for keyboard users focused there)
  // must get the overlay out of the way instead of counting down over live
  // audio and then yanking the replay away.
  const handlePlaying = (payload) => {
    if (payload?.videoId && payload.videoId !== videoId) return;
    setOverlay(null);
  };

  // Over the whole course, because the completion overlay claims the course.
  // There is deliberately no chapter-slice count here any more: the slice count
  // is what produced "You watched 1 of 1 lesson in this course."
  const courseWatchedCount = sequence.filter((lesson) => watchedIds.includes(lesson.videoId)).length;

  return (
    <div className={`min-h-screen ${t.page}`}>
      {/* top bar */}
      <GlobalHeader crumbs={crumbs} />

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
       {/* Watch layout. Mobile: the player is the first thing under the header
           and back link — the overview used to sit above it and pushed the
           video below the fold. Desktop (xl+): a main column beside a sticky
           lesson rail, so the sequence stays reachable while watching. The
           split waits for xl because at lg a fixed rail would shrink the
           video below its portrait-tablet size. */}
       <Container>
        {/* The document's h1 stays first in reading order even though the
            course overview card (which shows the title visually) now renders
            below the player. */}
        <h1 className="sr-only">{course.title}</h1>
        <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
          <div
            id="course-player"
            tabIndex={-1}
            className="min-w-0 scroll-mt-44 focus:outline-none sm:scroll-mt-32 xl:col-start-1 xl:row-start-1"
          >
            <div className="relative">
              <PlayerArea
                videoId={videoId}
                title={videoTitle}
                onPlay={onLessonPlay}
                onPlaying={handlePlaying}
                onEnded={handleLessonEnded}
                onProgress={onProgress}
                startSeconds={startSeconds}
                autoplay={autoplay}
                playbackRate={playbackRate}
                onPlaybackRateChange={onPlaybackRateChange}
                playSignal={playSignal}
                seekTo={seekTo}
              />
              {/* One-shot announcement: the overlay itself is NOT a live
                  region, so the per-second countdown never re-announces. */}
              {overlay && (
                <p role="status" className="sr-only">
                  {overlay === "next" && nextLesson
                    ? `Lesson complete. Up next: lesson ${nextLesson.position}, ${nextLesson.title}. Plays automatically in ${UP_NEXT_SECONDS} seconds. Cancel to stay here.`
                    : "Course complete."}
                </p>
              )}
              {overlay === "next" && nextLesson && (
                <PlayerOverlay label="Up next">
                  <div>
                    <p className={`text-base font-semibold ${t.text}`} style={{ fontFamily: BRAND_SERIF }}>
                      Lesson complete
                    </p>
                    <p className={`mt-2 text-sm ${t.muted}`}>
                      Up next: Lesson {nextLesson.position} · {nextLesson.title}
                    </p>
                    <p className={`mt-1 text-xs ${t.faint}`}>Playing in {countdown}s</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={advanceToNext}
                      className="min-h-11 rounded-xl px-5 text-sm font-semibold text-white"
                      style={{ backgroundColor: ACCENT.teal }}
                    >
                      Play now
                    </button>
                    <button
                      type="button"
                      ref={overlayFocusRef}
                      onClick={dismissOverlay}
                      className={`min-h-11 rounded-xl border ${t.border} px-5 text-sm font-medium ${t.text}`}
                    >
                      Cancel
                    </button>
                  </div>
                </PlayerOverlay>
              )}
              {overlay === "complete" && (
                <PlayerOverlay label="Course complete">
                  <div>
                    <p className={`text-base font-semibold ${t.text}`} style={{ fontFamily: BRAND_SERIF }}>
                      Course complete
                    </p>
                    {/* Counted over the whole course, because that is what this
                        overlay claims. Counting the visible chapter slice is how
                        "You watched 1 of 1 lesson in this course" reached a
                        student sitting on lesson 1 of 68. This overlay is now
                        only reachable when the course really has no next
                        lesson. */}
                    {sequence.length > 0 && (
                      <p className={`mt-2 text-sm ${t.muted}`}>
                        You watched {courseWatchedCount} of {sequence.length} lesson{sequence.length === 1 ? "" : "s"} in this course.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {onBack && (
                      <button
                        type="button"
                        onClick={onBack}
                        className="min-h-11 rounded-xl px-5 text-sm font-semibold text-white"
                        style={{ backgroundColor: ACCENT.teal }}
                      >
                        Back to results
                      </button>
                    )}
                    <button
                      type="button"
                      ref={overlayFocusRef}
                      onClick={dismissOverlay}
                      className={`min-h-11 rounded-xl border ${t.border} px-5 text-sm font-medium ${t.text}`}
                    >
                      Dismiss
                    </button>
                  </div>
                </PlayerOverlay>
              )}
            </div>
            <h2 className={`mt-5 text-2xl font-semibold leading-snug ${t.text}`} style={{ fontFamily: BRAND_SERIF }}>{videoTitle}</h2>
            <p className={`mt-1 text-sm ${t.muted}`}>
              {/* On a chapter-scoped page the slice position alone reads as
                  "Lesson 1 of 1" on 55% of pages, which looks like a
                  one-lesson course. Name the chapter it counts within, and give
                  the course position alongside it. */}
              {lessons.length > 0
                ? scoped
                  ? `Lesson ${
                      lessons.find((l) => l.id === activeLessonId)?.position ?? 1
                    } of ${lessons.length} in this chapter · ${
                      seqIndex >= 0 ? seqIndex + 1 : 1
                    } of ${sequence.length} in the course`
                  : `Lesson ${
                      lessons.find((l) => l.id === activeLessonId)?.position ?? 1
                    } of ${lessons.length}`
                : `Lesson 1 of ${course.lectures}`}
            </p>

            {sequence.length > 1 && (
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

            {/* Other institutes teaching this chapter — the site's one real
                advantage over YouTube, placed where a student decides they want
                a different teacher. Hides itself when there is no other one. */}
            {moreTeachers}

            {materialsPanel}
            {notesPanel}
            {reportSlot}
          </div>

          {/* On desktop the rail is sticky below the header and scrolls its
              own contents; on mobile it stacks directly under the player
              block so the sequence is one swipe away, not below the fold.
              The aside carries no aria-label: LessonList's own labelled
              section is the named landmark, and naming both identically
              made landmark navigation announce "Course lessons" twice. */}
          <aside className="min-w-0 xl:sticky xl:top-32 xl:col-start-2 xl:row-start-1 xl:row-span-2 xl:max-h-[calc(100vh-9rem)] xl:overflow-y-auto">
            <LessonList
              lessons={lessons}
              activeLessonId={activeLessonId}
              watchedIds={watchedIds}
              onSelectLesson={onSelectLesson}
            />
          </aside>

          {(overview || ratingPanel) && (
            <div className="min-w-0 xl:col-start-1 xl:row-start-2">
              {overview}
              {ratingPanel}
            </div>
          )}
        </div>
      </Container>
      </main>
    </div>
  );
}
