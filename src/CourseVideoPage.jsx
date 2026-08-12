import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation, useNavigate, useParams, useSearchParams,
} from "react-router";
import { VideoView } from "./MinimalUI.jsx";
import { useTheme } from "./theme.jsx";
import { usePlaylistVideos } from "./usePlaylistVideos.js";
import {
  getCourseProgress, getLessonPosition, getPlayerPrefs, getWatchedVideoIds,
  mergeRemoteEntry, recordLessonPosition, recordLessonView, savePlayerPrefs,
} from "./progress.js";
import { pullServerProgress, queueProgressSync } from "./progressSync.js";
import { useSession } from "./useSession.js";
import { readReturnUrl, rememberReturn, resolveBack } from "./returnTo.js";
import CourseRating from "./CourseRating.jsx";
import VideoReport from "./VideoReport.jsx";
import CourseOverview from "./CourseOverview.jsx";
import StudyMaterialPanel from "./StudyMaterialPanel.jsx";
import { applyPageMetadata, useCourseMetadata, useStructuredData } from "./PageMetadata.jsx";
import { breadcrumbListSchema, courseSchema, videoObjectSchema } from "./structuredData.js";
import { metadataForCourse } from "./pageMetadata.js";
import { BRAND_TEAL } from "./brandColors.js";

const TEAL = BRAND_TEAL;

export function scopeCourseLessons(lessons, chapterId) {
  if (chapterId == null || chapterId === "") {
    return { lessons, chapter: null, requested: false, valid: true };
  }
  const id = Number(chapterId);
  if (!Number.isInteger(id) || id <= 0) {
    return { lessons: [], chapter: null, requested: true, valid: false };
  }
  const scoped = lessons
    .filter((lesson) => Number(lesson.chapter?.id) === id)
    .map((lesson, index) => ({
      ...lesson,
      coursePosition: lesson.position,
      position: index + 1,
    }));
  return {
    lessons: scoped,
    chapter: scoped[0]?.chapter ?? null,
    requested: true,
    valid: scoped.length > 0,
  };
}

export function scopeCourseMetadata(course, lessons, chapter) {
  if (!course || !chapter) return course;
  const durations = lessons.map((lesson) => Number(lesson.durationSeconds));
  const hasCompleteDuration = lessons.length > 0 &&
    durations.every((duration) => Number.isFinite(duration) && duration > 0);
  return {
    ...course,
    lectures: lessons.length,
    totalDurationSeconds: hasCompleteDuration
      ? durations.reduce((sum, duration) => sum + duration, 0)
      : null,
    syllabus: [{ ...chapter, subject: lessons[0]?.subject ?? course.subject ?? null }],
    blockedLessons: lessons.filter(
      (lesson) => lesson.embeddingStatus === "blocked",
    ).length,
  };
}

function CenteredNotice({ title, detail, onBack, onRetry }) {
  const { t } = useTheme();
  return (
    <div className={`flex min-h-screen items-center justify-center ${t.page} p-6`}>
      <div className="text-center">
        <p className={`text-sm font-semibold ${t.text}`}>{title}</p>
        {detail && <p className={`mt-1 text-sm ${t.muted}`}>{detail}</p>}
        {onRetry && (
          <button onClick={onRetry} className="mt-4 min-h-11 rounded-xl px-4 text-sm font-semibold text-white" style={{ backgroundColor: TEAL }}>
            Try again
          </button>
        )}
        {onBack && (
          <button onClick={onBack} className="mt-4 min-h-11 text-sm font-medium" style={{ color: TEAL }}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

export default function CourseVideoPage() {
  const { playlistId, chapterId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { course, lessons: allLessons, loading, error, forPlaylistId, reload } =
    usePlaylistVideos(playlistId);
  const scope = useMemo(
    () => scopeCourseLessons(allLessons, chapterId),
    [allLessons, chapterId],
  );
  const lessons = scope.lessons;
  const displayedCourse = useMemo(
    () => scopeCourseMetadata(course, lessons, scope.chapter),
    [course, lessons, scope.chapter],
  );
  const provenInvalidChapter = !loading && !error && Boolean(course) &&
    scope.requested && !scope.valid;
  // A deleted or never-existing course id must not stay indexable: the
  // route-level "Free course" metadata is index,follow, so without this a
  // removed course is a soft-404 served at HTTP 200. Gated on forPlaylistId
  // so another course's resolved emptiness (state survives param-only
  // navigations) is never read as THIS course being missing.
  const provenNotFound =
    !loading && !error && !course && forPlaylistId === playlistId;
  useCourseMetadata(scope.valid ? displayedCourse : null);
  useEffect(() => {
    if (!provenInvalidChapter) return;
    applyPageMetadata({
      title: "Chapter not found | JEENEETARD",
      description: "This course does not contain the requested chapter.",
      robots: "noindex, nofollow",
      canonicalPath: `/course/${playlistId}`,
    });
  }, [location.search, playlistId, provenInvalidChapter]);
  useEffect(() => {
    if (!provenNotFound) return;
    applyPageMetadata({
      title: "Course not found | JEENEETARD",
      description: "This course may have been removed or the link is incorrect.",
      robots: "noindex, nofollow",
      canonicalPath: `/course/${playlistId}`,
    });
  }, [location.search, playlistId, provenNotFound]);

  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  const [savedProgress, setSavedProgress] = useState(null);
  useEffect(() => {
    setSavedProgress(getCourseProgress(playlistId));
  }, [playlistId]);

  const resumeVideoId = searchParams.get("v");
  const activeLesson =
    (resumeVideoId ? lessons.find((lesson) => lesson.videoId === resumeVideoId) : null) ??
    (savedProgress?.lastVideoId
      ? lessons.find((lesson) => lesson.videoId === savedProgress.lastVideoId)
      : null) ??
    lessons[0] ?? null;

  // Never show one lesson while leaving a different (invalid) lesson in the
  // shareable URL. Once the sequence is known, replace only the bad `v` value
  // and preserve every other query parameter.
  useEffect(() => {
    if (loading || error || !resumeVideoId || !activeLesson) return;
    if (lessons.some((lesson) => lesson.videoId === resumeVideoId)) return;
    const next = new URLSearchParams(searchParams);
    next.set("v", activeLesson.videoId);
    setSearchParams(next, { replace: true });
  }, [activeLesson, error, lessons, loading, resumeVideoId, searchParams, setSearchParams]);

  const [watchedIds, setWatchedIds] = useState([]);
  useEffect(() => {
    setWatchedIds(getWatchedVideoIds(playlistId));
  }, [playlistId]);

  // Signed-in students may have progress from another device. Pulled once
  // per course-page visit (cheap, and idempotent — mergeRemoteEntry only
  // ever moves a video's position forward) and folded into localStorage so
  // this page's resume point and watched ticks reflect it immediately.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    pullServerProgress(userId).then((rows) => {
      if (!active || !rows.length) return;
      rows.forEach((row) => mergeRemoteEntry(row));
      setSavedProgress(getCourseProgress(playlistId));
      setWatchedIds(getWatchedVideoIds(playlistId));
    });
    return () => {
      active = false;
    };
  }, [userId, playlistId]);

  // Autoplay only follows an in-page lesson selection. A fresh page load or
  // deep link must never start playback on its own.
  const [autoplayNext, setAutoplayNext] = useState(false);
  // Bumped to play the CURRENT video without a rebuild — the overview's
  // Continue button usually targets the lesson that is already active, so a
  // URL write alone would do nothing.
  const [playSignal, setPlaySignal] = useState(0);
  // A history jump can land on another course while this instance survives;
  // the new course must behave like a fresh load, not inherit "may autoplay".
  useEffect(() => {
    setAutoplayNext(false);
    setPlaySignal(0);
  }, [playlistId]);
  // Saved playback rate is read once per mount; rate changes made in the
  // player persist and carry into the next lesson's player build.
  const [playbackRate, setPlaybackRate] = useState(() => getPlayerPrefs().rate);
  // Duration from the player's most recent progress report; the fallback when
  // a lesson ends before its first report is the catalogue metadata.
  const lastProgressRef = useRef({ videoId: null, duration: 0 });

  const activeVideoId = activeLesson?.videoId ?? null;
  // The resume point recomputes only when the lesson changes: positions
  // written DURING playback must not move the player's startSeconds prop.
  const startSeconds = useMemo(
    () => (activeVideoId ? getLessonPosition(playlistId, activeVideoId) : 0),
    [playlistId, activeVideoId],
  );

  const recordActiveLessonPlayback = () => {
    if (!course || !activeLesson) return;
    const entry = recordLessonView({
      playlistId,
      chapterId: activeLesson.chapter?.id ?? chapterId,
      courseTitle: course.title,
      videoId: activeLesson.videoId,
      videoTitle: activeLesson.title,
      position: activeLesson.coursePosition ?? activeLesson.position,
      totalLessons: allLessons.length,
    });
    if (entry) {
      setWatchedIds(entry.watched);
      setSavedProgress(entry);
    }
    // Lesson-start is the "mark watched" event — synced immediately, not
    // throttled. Position carries the resume point rather than 0 so a
    // returning student's server row never regresses to the beginning.
    queueProgressSync(userId, {
      playlistId,
      videoDbId: activeLesson.id,
      chapterId: activeLesson.chapter?.id ?? null,
      position: getLessonPosition(playlistId, activeLesson.videoId),
      duration: null,
      watched: true,
    }, { force: true });
  };

  // Player reports carry the videoId THEY were measured against: an old
  // player's final flush can land after the active lesson (or, on a history
  // jump, the whole course) has changed. A report for a lesson of THIS course
  // is recorded against that lesson; anything else is another course's tail
  // and is dropped rather than written under the wrong ids.
  const reportedLesson = (videoId) =>
    allLessons.find((lesson) => lesson.videoId === videoId) ?? null;

  const recordLessonProgressReport = ({ videoId, seconds, duration }) => {
    const lesson = reportedLesson(videoId);
    if (!lesson) return;
    if (Number.isFinite(duration) && duration > 0) {
      lastProgressRef.current = { videoId, duration };
    }
    recordLessonPosition({ playlistId, videoId, seconds, duration });
    // Throttled (~25s): this fires every 5s while playing, plus once on
    // pause and once on pagehide/lesson-switch (YouTubePlayer's own
    // reportProgress/flushOnPageHide) — the throttle is what turns that
    // into the owner's chosen "periodic + on pause/leave" cadence server-side.
    queueProgressSync(userId, {
      playlistId,
      videoDbId: lesson.id,
      chapterId: lesson.chapter?.id ?? null,
      position: seconds,
      duration,
      // Report the REAL local watched state, never an assumed true. The player
      // now only reports progress once playback has genuinely started, so this
      // is normally true anyway — but a hard-coded true meant any future path
      // that emitted a progress report would silently fabricate a watch.
      // Deliberately not `false` either: this upsert overwrites the whole row,
      // so a false here would erase a genuine watch recorded earlier.
      watched: getWatchedVideoIds(playlistId).includes(videoId),
    });
  };

  // A finished lesson is stored at seconds=duration, which getLessonPosition
  // reads as "finished — restart from 0 next time".
  const recordLessonFinished = ({ videoId } = {}) => {
    const lesson = reportedLesson(videoId);
    if (!lesson) return;
    const last = lastProgressRef.current;
    const metaDuration = Number(lesson.durationSeconds);
    const duration = last.videoId === videoId && last.duration > 0
      ? last.duration
      : Number.isFinite(metaDuration) && metaDuration > 0 ? metaDuration : 0;
    recordLessonPosition({ playlistId, videoId, seconds: duration, duration });
    queueProgressSync(userId, {
      playlistId,
      videoDbId: lesson.id,
      chapterId: lesson.chapter?.id ?? null,
      position: duration,
      duration,
      watched: true,
    }, { force: true });
  };

  const persistPlaybackRate = (rate) => {
    savePlayerPrefs({ rate });
    setPlaybackRate(rate);
  };

  const coursePath = location.pathname;
  const back = resolveBack({
    state: location.state,
    coursePath,
    chapterId: provenInvalidChapter ? undefined : chapterId,
  });
  useEffect(() => {
    const url = readReturnUrl(location.state);
    if (url) rememberReturn(coursePath, url);
  }, [coursePath, location.state]);
  const backToHub = () => back.mode === "back" ? navigate(-1) : navigate(back.url);

  // Rule 1 (never fabricate): only mark up a course once it has actually
  // resolved to something real — not while loading, not on a failed fetch,
  // not for a chapter/course that doesn't exist, and not before there is a
  // lesson to point a VideoObject at. Matches the guards the early returns
  // below use, computed here (unconditionally, before any of them) because
  // hooks cannot follow those returns.
  const canDescribeCourse =
    !loading && !error && Boolean(course) && scope.valid && Boolean(activeLesson);

  // The SAME three levels VideoView's own crumbsProp fallback renders
  // (MinimalUI.jsx) — course title or chapter name in the middle, current
  // lesson last — read directly from what's already resolved here rather
  // than re-derived inside MinimalUI, so markup can never drift from what
  // the student sees. Converted to the {label,url} shape breadcrumbListSchema
  // expects.
  // The visible "Browse courses" crumb calls onBack (== backToHub below), not
  // a fixed URL — when there IS a concrete return address (arriving from a
  // filtered Explore/Browse view) that address, not a bare "/browse", is
  // where the student actually lands, and JSON-LD must not name a URL the
  // real breadcrumb doesn't go to. Pure history-back (back.mode==="back") has
  // no static URL to report; /browse is still an honest hierarchy parent.
  const browseCrumbUrl = back.mode === "back" ? "/browse" : back.url;
  const structuredDataCrumbs = canDescribeCourse
    ? [
        { label: "Browse courses", url: browseCrumbUrl },
        // A chapter sub-URL canonicalizes to the bare course URL (see
        // useCourseMetadata above) — that IS this crumb's real, indexable
        // address, whichever label (chapter or course title) it shows.
        { label: scope.chapter?.name ?? course.title, url: `/course/${playlistId}` },
        // Terminal crumb: the page the student is already on. Matches every
        // other breadcrumb on this site — the current page carries no
        // separate url of its own.
        { label: activeLesson.title, url: null },
      ]
    : [];

  useStructuredData(
    canDescribeCourse
      ? [
          courseSchema({
            title: course.title,
            // No description column exists on playlists; rather than ship
            // Course markup permanently missing Google's required
            // `description` property, reuse the exact real-data sentence
            // (subject + lesson count) already shown to Google in this same
            // page's <meta name="description"> via useCourseMetadata/
            // metadataForCourse — same facts, one source, never fabricated.
            description: metadataForCourse(displayedCourse)?.description,
            institute: course.institute,
            teacher: course.teacher,
            averageRating: course.averageRating,
            ratingsCount: course.ratingsCount,
            url: `/course/${playlistId}`,
          }),
          // Whichever lesson is ACTUALLY active right now — never "the whole
          // course" as one video (rule 5). Recomputes whenever activeLesson
          // changes, via the deps array below.
          videoObjectSchema({
            title: activeLesson.title,
            description: activeLesson.description,
            youtubeVideoId: activeLesson.videoId,
            durationSeconds: activeLesson.durationSeconds,
          }),
          breadcrumbListSchema(structuredDataCrumbs),
        ]
      : [],
    // displayedCourse (Course.description) and back (the breadcrumb's real
    // return URL) are both read inside this effect now — both belong here.
    [canDescribeCourse, playlistId, course, displayedCourse, scope.chapter, activeLesson, back],
  );

  if (loading) return <CenteredNotice title="Loading course…" />;
  if (error) return <CenteredNotice title="Couldn't load course" detail={error} onRetry={reload} onBack={backToHub} />;
  if (!course) {
    return (
      <CenteredNotice
        title="Course not found"
        detail="This course may have been removed or the link is incorrect."
        onBack={backToHub}
      />
    );
  }
  if (!scope.valid) {
    return (
      <CenteredNotice
        title="Chapter not found in this course"
        detail="This course does not contain lessons for the requested chapter."
        onBack={backToHub}
      />
    );
  }
  if (!activeLesson) return <CenteredNotice title="No lessons yet" detail="This course exists, but its lesson sequence is still empty." onBack={backToHub} />;

  const selectLesson = (lesson, { scrollToPlayer = true } = {}) => {
    // The student is already on the page and chose to move — from here on,
    // lesson changes (including auto-advance) may start playback.
    setAutoplayNext(true);

    // "Next lesson" now walks the whole course, so it can land on a lesson in a
    // different chapter than the one this URL is scoped to. Writing only `?v=`
    // would be silently undone: the effect above resets an out-of-scope `v` back
    // to the in-scope active lesson, so the student would press Next and go
    // nowhere. Move the scope with them instead.
    const targetChapterId = lesson.chapter?.id ?? null;
    const leavingScope = scope.requested && targetChapterId != null &&
      Number(targetChapterId) !== Number(chapterId);
    if (leavingScope) {
      const next = new URLSearchParams(searchParams);
      next.set("v", lesson.videoId);
      // A push, not a replace: crossing into another chapter is a real step, and
      // Back should return to the chapter they came from.
      navigate(`/course/${playlistId}/chapter/${targetChapterId}?${next}`);
      if (scrollToPlayer) {
        requestAnimationFrame(() => {
          const player = document.getElementById("course-player");
          player?.scrollIntoView?.({ behavior: "smooth", block: "start" });
          player?.focus({ preventScroll: true });
        });
      }
      return;
    }

    if (lesson.videoId === activeLesson.videoId) {
      // Selecting the lesson that is already loaded (the overview's Continue
      // button on a revisit is the common case): a URL write would change
      // nothing and the iframe never rebuilds, so ask the player to play.
      setPlaySignal((signal) => signal + 1);
    } else {
      const next = new URLSearchParams(searchParams);
      next.set("v", lesson.videoId);
      setSearchParams(next, { replace: true });
    }
    if (scrollToPlayer) {
      requestAnimationFrame(() => {
        const player = document.getElementById("course-player");
        player?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        player?.focus({ preventScroll: true });
      });
    }
  };

  const continueLesson = savedProgress?.lastVideoId
    ? lessons.find((lesson) => lesson.videoId === savedProgress.lastVideoId) ?? null
    : null;
  const startCourse = () => {
    selectLesson(continueLesson ?? activeLesson);
  };

  return (
    <VideoView
      course={displayedCourse}
      chapter={scope.chapter?.name ?? course.title}
      videoId={activeLesson.videoId}
      videoTitle={activeLesson.title}
      lessons={lessons}
      // The visible list stays chapter-scoped; prev/next and the completion
      // overlay need the whole course so a one-lesson chapter is not mistaken
      // for a one-lesson course.
      courseLessons={allLessons}
      activeLessonId={activeLesson.id}
      watchedIds={watchedIds}
      onSelectLesson={selectLesson}
      onLessonPlay={recordActiveLessonPlayback}
      onBack={backToHub}
      startSeconds={startSeconds}
      autoplay={autoplayNext}
      playSignal={playSignal}
      playbackRate={playbackRate}
      onPlaybackRateChange={persistPlaybackRate}
      onProgress={recordLessonProgressReport}
      onEnded={recordLessonFinished}
      overview={
        <CourseOverview
          course={displayedCourse}
          lessons={lessons}
          watchedIds={watchedIds}
          continueLesson={continueLesson}
          onStart={startCourse}
          signedIn={Boolean(userId)}
        />
      }
      ratingPanel={
        <CourseRating
          playlistId={playlistId}
          initialAverage={Number(course.averageRating ?? 0)}
          initialCount={course.ratingsCount ?? 0}
        />
      }
      materialsPanel={
        <StudyMaterialPanel
          chapterId={activeLesson.chapter?.id ?? scope.chapter?.id}
          chapterName={activeLesson.chapter?.name ?? scope.chapter?.name}
          videoId={activeLesson.id}
        />
      }
      reportSlot={
        // Keyed on the lesson: without this, VideoReport sits at an invariant
        // tree position and React preserves its hooks state across a lesson
        // change (switching lessons only rewrites ?v=, so App.jsx's route key
        // never changes). The consequences were real: after one successful
        // report the terminal "Thanks" state stuck, so every OTHER lesson in
        // the course showed a confirmation it never earned and offered no
        // "Report an issue" button at all — losing the ability to flag
        // inappropriate content for the rest of the session. A half-typed note
        // also carried over and would have been submitted against the wrong
        // lesson.
        <VideoReport
          key={activeLesson.id}
          videoId={activeLesson.id}
          videoTitle={activeLesson.title}
        />
      }
    />
  );
}
