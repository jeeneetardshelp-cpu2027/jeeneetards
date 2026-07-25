export const SITE_NAME = "JEENEETARD";
export const DEFAULT_TITLE = "JEENEETARD - Free course finder";
export const DEFAULT_DESCRIPTION =
  "Browse free educational YouTube courses by exam, class, subject and chapter.";

const ACRONYMS = new Map([
  ["jee", "JEE"],
  ["neet", "NEET"],
  ["cbse", "CBSE"],
  ["icse", "ICSE"],
  ["iit", "IIT"],
]);

const shorten = (value, limit) => {
  const text = String(value ?? "").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
};

export function readablePathSegment(value) {
  const raw = String(value ?? "");
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // A malformed shared URL must not break the page's metadata effect.
  }
  decoded = decoded.trim().toLowerCase();
  if (!decoded) return "";
  if (ACRONYMS.has(decoded)) return ACRONYMS.get(decoded);

  return decoded
    .split("-")
    .filter(Boolean)
    .map((part, index) => {
      if (ACRONYMS.has(part)) return ACRONYMS.get(part);
      if (/^\d+$/.test(part)) return part;
      if (part === "class") return "Class";
      return index === 0
        ? part.charAt(0).toUpperCase() + part.slice(1)
        : part;
    })
    .join(" ");
}

export function metadataForLocation(pathname = "/", search = "") {
  const rawPath = pathname || "/";
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;
  const params = new URLSearchParams(search);
  const base = {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    robots: "index, follow",
    canonicalPath: path,
    type: "website",
  };

  if (path === "/") return { ...base, canonicalPath: "/" };

  if (path === "/browse") {
    const isLectureView = params.get("tab") === "lectures";
    const hasSearch = Boolean(params.get("q")?.trim());
    return {
      ...base,
      title: `${isLectureView ? "Browse free lectures" : "Browse free courses"} | ${SITE_NAME}`,
      description: isLectureView
        ? "Browse free educational YouTube lectures by exam, class, subject and chapter."
        : DEFAULT_DESCRIPTION,
      // Search terms can be personal or low-quality crawl targets. Structured
      // filters also canonicalize to the stable catalogue landing page.
      robots: hasSearch ? "noindex, follow" : "index, follow",
      canonicalPath: "/browse",
    };
  }

  if (path === "/explore" || path.startsWith("/explore/")) {
    const labels = path
      .split("/")
      .slice(2)
      .map(readablePathSegment)
      .filter(Boolean);
    const scope = labels.join(" ");
    return {
      ...base,
      title: `${scope ? `Explore ${scope} courses` : "Explore free courses"} | ${SITE_NAME}`,
      description: scope
        ? `Browse free educational YouTube courses for ${scope} by subject and chapter.`
        : DEFAULT_DESCRIPTION,
    };
  }

  if (path.startsWith("/course/")) {
    return {
      ...base,
      title: `Free course | ${SITE_NAME}`,
      description:
        "Browse the lesson sequence and watch this free course through YouTube's privacy-enhanced player.",
      type: "article",
    };
  }

  if (path === "/terms") {
    return {
      ...base,
      title: `Terms and disclaimer | ${SITE_NAME}`,
      description: `Read the terms, educational disclaimer and content policy for ${SITE_NAME}.`,
    };
  }

  if (path === "/privacy") {
    return {
      ...base,
      title: `Privacy policy | ${SITE_NAME}`,
      description: `Learn how ${SITE_NAME} handles local progress, embedded YouTube videos and privacy.`,
    };
  }

  if (path === "/admin") {
    return {
      ...base,
      title: `Administration | ${SITE_NAME}`,
      description: "Restricted catalogue administration.",
      robots: "noindex, nofollow",
    };
  }

  if (
    path === "/search" ||
    path === "/compare" ||
    path.startsWith("/faculty/")
  ) {
    return {
      ...base,
      title: `Feature coming soon | ${SITE_NAME}`,
      description:
        "This catalogue feature is still being verified and is not available in the current release.",
      robots: "noindex, follow",
    };
  }

  return { ...base, canonicalPath: "/" };
}

export function metadataForCourse(course) {
  if (!course?.title) return null;
  const lessonCount = Number(course.lectures ?? 0);
  const subject = String(course.subject ?? "").trim();
  const lessonText = lessonCount > 0
    ? `${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}`
    : "its lesson sequence";
  const subjectText = subject ? `${subject} ` : "";

  return {
    title: `${shorten(course.title, 48)} | ${SITE_NAME}`,
    description: shorten(
      `Browse this free ${subjectText}course with ${lessonText} and watch through YouTube's privacy-enhanced player.`,
      155,
    ),
    type: "article",
  };
}
