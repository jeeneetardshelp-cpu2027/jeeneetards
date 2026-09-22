import { courseCredit } from "./courseCredit.js";

const SITE_NAME = "JEENEETARD";

const shorten = (value, limit) => {
  const text = String(value ?? "").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
};

// "Free" must not read as "ad-free": playback is YouTube's, and YouTube may
// show ads or recommendations. Every description that calls a course free
// carries this sentence — the course snippet below and the chapter share text
// in ogInject.js — so it is written once.
export const PLAYER_DISCLOSURE =
  "Watch with YouTube's privacy-enhanced player; ads or recommendations may appear.";

const nameKey = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
  .trim();

/**
 * Whether two catalogue names say the same thing, ignoring case, spacing and
 * punctuation. One-chapter courses are often named after their chapter, so a
 * share line built as "<chapter> — <course>" read "Friction — Friction": 85
 * of 1,376 course-chapter pages on production (22 Sep 2026). Callers use this
 * to name such a chapter once. A title that merely STARTS with the chapter's
 * name ("Kinematics| Irodov solutions") is not a match — it says more.
 */
export function namesMatch(a, b) {
  const key = nameKey(a);
  return key !== "" && key === nameKey(b);
}

/** Normalize the server PostgREST row and hydrated course model into one snippet. */
export function buildCourseMetadata(course) {
  const courseTitle = String(course?.title ?? "").trim();
  if (!courseTitle) return null;

  const subject = String(course?.subject ?? course?.subjects?.name ?? "").trim();
  // 132 courses store the channel's own name in `teacher`, so the raw pair
  // renders "by Competishun+ from Competishun+". courseCredit drops the
  // duplicate and keeps the linked institute.
  const credit = courseCredit({
    teacher: course?.teacher,
    institute: course?.institute ?? course?.institutes_channels?.name,
  });
  const teacher = String(credit.teacher ?? "").trim();
  const institute = String(credit.institute ?? "").trim();
  // Topic-only titles collide whenever different teachers cover the same
  // chapter (for example, two distinct "Friction" courses). Keep the topic
  // first for search intent, but reserve enough title space for the teacher
  // or, when the teacher is missing, the institute that distinguishes it.
  const provider = teacher || institute;
  const shortProvider = provider ? shorten(provider, 18) : "";
  const providerSuffix = shortProvider ? ` by ${shortProvider}` : "";
  const titleCore = providerSuffix
    ? `${shorten(courseTitle, Math.max(24, 48 - providerSuffix.length))}${providerSuffix}`
    : shorten(courseTitle, 48);
  const lessonCount = Number(
    course?.lectures ?? course?.playlist_videos?.[0]?.count ?? 0,
  );
  const lessonFact = lessonCount > 0
    ? `${lessonCount}${subject ? ` ${subject}` : ""} ${lessonCount === 1 ? "lecture" : "lectures"}`
    : subject ? `${subject} course` : "";
  const attribution = teacher
    ? `by ${teacher}${institute ? ` from ${institute}` : ""}`
    : institute ? `from ${institute}` : "";
  const facts = [lessonFact, attribution].filter(Boolean).join(" ");
  const description = shorten(
    [
      `Free course: ${courseTitle}.`,
      facts ? `${facts}.` : "",
      PLAYER_DISCLOSURE,
    ].filter(Boolean).join(" "),
    160,
  );

  return {
    title: `${titleCore} | ${SITE_NAME}`,
    description,
    type: "article",
  };
}
