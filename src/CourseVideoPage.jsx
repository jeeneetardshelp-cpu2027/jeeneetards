import { useEffect, useState } from "react";
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
import { useCourseMetadata } from "./PageMetadata.jsx";

const TEAL = "#13919B";

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
  const { course, lessons, loading, error, reload } = usePlaylistVideos(playlistId);
  useCourseMetadata(course);

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
      position: activeLesson.position,
      totalLessons: lessons.length,
    });
    if (entry) {
      setWatchedIds(entry.watched);
      setSavedProgress(entry);
    }
  };

  const coursePath = location.pathname;
  const back = resolveBack({ state: location.state, coursePath, chapterId });
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
      course={course}
      chapter={course.title}
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
          course={course}
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
