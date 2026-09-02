import { courseCredit } from "./courseCredit.js";

const SITE_NAME = "JEENEETARD";

const shorten = (value, limit) => {
  const text = String(value ?? "").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
};

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
      "Watch with YouTube's privacy-enhanced player; ads or recommendations may appear.",
    ].filter(Boolean).join(" "),
    160,
  );

  return {
    title: `${titleCore} | ${SITE_NAME}`,
    description,
    type: "article",
  };
}
