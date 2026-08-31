// Chapter completion — "have I finished this chapter?", computed entirely from
// what the student has actually watched.
//
// There is no server call and no new table here on purpose: progress.js already
// knows which lessons crossed 95% watched, and the course payload already
// carries each lesson's chapter. Intersecting the two is the whole feature.
//
// ID SPACE. `completedIds` holds YOUTUBE video ids — progress.js keys its
// positions map by videoId — while a lesson also carries a database `id`.
// Matching on `lesson.id` would never match anything and the card would simply
// never appear, which is the kind of bug that ships silently. Match on
// `lesson.videoId`, and only that.

/**
 * How much of one chapter the student has finished.
 *
 * @param lessons       the WHOLE course's lessons, not a chapter slice — the
 *                      slice is what the student sees, not what the chapter is.
 * @param completedIds  YouTube video ids finished past the 95% mark.
 * @param chapterId     the chapter to measure.
 * @returns null when the chapter is unknown or holds no lessons, else
 *          { chapter, total, done, cleared }.
 */
export function chapterCompletion(lessons, completedIds, chapterId) {
  if (chapterId === null || chapterId === undefined || chapterId === "") return null;
  const key = String(chapterId);
  const inChapter = (lessons ?? []).filter(
    (lesson) => lesson?.chapter?.id !== undefined
      && lesson?.chapter?.id !== null
      && String(lesson.chapter.id) === key,
  );
  if (inChapter.length === 0) return null;

  const finished = new Set(completedIds ?? []);
  const done = inChapter.filter((lesson) => finished.has(lesson.videoId)).length;
  return {
    chapter: inChapter[0].chapter,
    total: inChapter.length,
    done,
    cleared: done === inChapter.length,
  };
}

/**
 * The message that travels into a batch group. It states the count it actually
 * measured, names the teacher only when one is known, and always carries the
 * deep link home — that link is what makes the share worth anything.
 *
 * The /course/:id/chapter/:id URL already renders a rich preview card via
 * /api/og (middleware's course matcher covers the chapter form), so no separate
 * image work is needed for this to look right in WhatsApp.
 */
export function chapterShareMessage({ chapterName, total, byline, url }) {
  const name = chapterName || "this chapter";
  const lectures = `${total} lecture${total === 1 ? "" : "s"}`;
  const taught = byline ? `, taught by ${byline}` : "";
  return `Cleared ${name} — all ${lectures}${taught}. Free chapter-wise lectures: ${url}`;
}

/** "Ashish Arora — Physics Wallah", skipping whichever half is missing. */
export function courseByline(teacher, institute) {
  return [teacher, institute].filter(Boolean).join(" — ") || null;
}
