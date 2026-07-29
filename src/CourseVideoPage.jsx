import { useEffect, useMemo, useState } from "react";
import {
  useLocation, useNavigate, useParams, useSearchParams,
} from "react-router";
import { VideoView } from "./MinimalUI.jsx";
import { useTheme } from "./theme.jsx";
import { usePlaylistVideos } from "./usePlaylistVideos.js";
import { getCourseProgress, getWatchedVideoIds, recordLessonView } from "./progress.js";
import { readReturnUrl, rememberReturn, resolveBack } from "./returnTo.js";
import CourseRating from "./CourseRating.jsx";
import VideoReport from "./VideoReport.jsx";
import CourseOverview from "./CourseOverview.jsx";
import { applyPageMetadata, useCourseMetadata } from "./PageMetadata.jsx";
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
    const next = new URLSearchParams(searchParams);
    next.set("v", lesson.videoId);
    setSearchParams(next, { replace: true });
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
      activeLessonId={activeLesson.id}
      watchedIds={watchedIds}
      onSelectLesson={selectLesson}
      onLessonPlay={recordActiveLessonPlayback}
      onBack={backToHub}
      overview={
        <CourseOverview
          course={displayedCourse}
          lessons={lessons}
          watchedIds={watchedIds}
          continueLesson={continueLesson}
          onStart={startCourse}
        />
      }
      ratingPanel={
        <CourseRating
          playlistId={playlistId}
          initialAverage={Number(course.averageRating ?? 0)}
          initialCount={course.ratingsCount ?? 0}
        />
      }
      reportSlot={<VideoReport videoId={activeLesson.id} videoTitle={activeLesson.title} />}
    />
  );
}
