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
  const teacher = String(course?.teacher ?? "").trim();
  const lessonCount = Number(
    course?.lectures ?? course?.playlist_videos?.[0]?.count ?? 0,
  );
  const lessonFact = lessonCount > 0
    ? `${lessonCount}${subject ? ` ${subject}` : ""} ${lessonCount === 1 ? "lecture" : "lectures"}`
    : subject ? `${subject} course` : "";
  const facts = [lessonFact, teacher ? `by ${teacher}` : ""].filter(Boolean).join(" ");
  const description = shorten(
    [
      `Free course: ${courseTitle}.`,
      facts ? `${facts}.` : "",
      "Watch with YouTube's privacy-enhanced player; ads or recommendations may appear.",
    ].filter(Boolean).join(" "),
    160,
  );

  return {
    title: `${shorten(courseTitle, 48)} | ${SITE_NAME}`,
    description,
    type: "article",
  };
}
