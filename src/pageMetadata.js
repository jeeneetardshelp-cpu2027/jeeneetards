import { RELEASE_CAPABILITIES, RELEASE_FEATURES } from "./releaseCapabilities.js";
// Pure data (no React), so this stays safe for the edge middleware, which
// imports this module to compute the same metadata the client will.
import { findTestSection, sectionIsAllFree } from "./testPlatforms.js";
import { buildCourseMetadata } from "./courseMetadata.js";

export const SITE_NAME = "JEENEETARD";
export const DEFAULT_TITLE = "JEENEETARD - Free course finder";
export const DEFAULT_DESCRIPTION =
  "Browse free educational YouTube courses by exam, class, subject and chapter.";

// A capability-gated page still under review keeps a neutral, noindex title.
const comingSoon = (base) => ({
  ...base,
  title: `Feature coming soon | ${SITE_NAME}`,
  description:
    "This catalogue feature is still under review and is not available in the current release.",
  robots: "noindex, follow",
});

const ACRONYMS = new Map([
  ["jee", "JEE"],
  ["neet", "NEET"],
  ["cbse", "CBSE"],
  ["icse", "ICSE"],
  ["iit", "IIT"],
]);

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

function readableFacultySlug(value) {
  return String(value ?? "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
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
    const hasQuery = [...params.keys()].length > 0;
    return {
      ...base,
      title: `${isLectureView ? "Browse free lectures" : "Browse free courses"} | ${SITE_NAME}`,
      description: isLectureView
        ? "Browse free educational YouTube lectures by exam, class, subject and chapter."
        : "Browse the complete JEENEETARD catalogue of free YouTube courses and filter by exam, class, subject, chapter and faculty.",
      // Every query variant canonicalizes to the stable catalogue landing.
      // Keep filters, pagination, tabs and personal searches out of the index
      // so crawlers cannot manufacture an unbounded faceted URL space.
      robots: hasQuery ? "noindex, follow" : "index, follow",
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
        : "Choose JEE, NEET, Olympiad or School Boards, then narrow by class, subject and chapter to find free educational YouTube courses.",
    };
  }

  if (path.startsWith("/chapter/")) {
    // Legacy compatibility redirect to /browse?ch= — a supported URL that is
    // never a destination. Without this branch it would fall through to the
    // "Page not found" fallback below and briefly mislabel a working link.
    return { ...base, robots: "noindex, follow" };
  }

  if (path.startsWith("/course/")) {
    return {
      ...base,
      title: `Free course | ${SITE_NAME}`,
      description:
        "Browse the lesson sequence and watch this free course through YouTube's privacy-enhanced player.",
      type: "article",
      // Chapter sub-URLs canonicalize to the course root — the same URL the
      // sitemap and the edge middleware emit for this course.
      canonicalPath: path.match(/^\/course\/\d+/)?.[0] ?? path,
    };
  }

  if (path.startsWith("/tests/")) {
    const section = findTestSection(path.slice("/tests/".length));
    // An unknown exam id is a real 404, not a soft one — fall through to the
    // not-found branch at the bottom rather than inventing a page for it.
    if (section) {
      const allFree = sectionIsAllFree(section);
      const free = allFree ? "Free " : "";
      return {
        ...base,
        title: `${free}${section.label} mock tests and previous year papers | ${SITE_NAME}`,
        description: section.resources.length
          ? `${section.resources.length === 1 ? "A" : section.resources.length} ${allFree ? "free " : ""}${section.label} mock test ${section.resources.length === 1 ? "source" : "sources"}: ${section.resources
              .map((r) => r.provider)
              .join(", ")}. Each link opens the platform that runs the test.`
          : `${section.label} mock tests and previous-year papers. No source is listed yet — nothing is added here until its link has been checked.`,
        // A page with nothing on it is thin content. Keep the URL stable and
        // followable, but do not ask Google to index an empty list.
        robots: section.resources.length ? "index, follow" : "noindex, follow",
      };
    }
  }

  if (path === "/tests") {
    return {
      ...base,
      // Not "Free mock tests …": the directory now lists a paid series too,
      // and a title that promises free throughout would be a claim the page
      // does not keep. The free options are named in the description instead.
      title: `Mock tests and previous year papers | ${SITE_NAME}`,
      description:
        "Free mock tests and previous-year papers for JEE Main, JEE Advanced, NEET, Olympiads and the Class 10 and 12 boards, plus paid test series — each labelled with what it costs, linked to the platform that runs it.",
    };
  }

  if (path === "/forum" || path === "/forum/submit" || /^\/forum\/post\/\d+$/.test(path)) {
    if (!RELEASE_FEATURES.forum) return comingSoon({ ...base, canonicalPath: "/forum" });
    const isSearch = path === "/forum" && params.has("q");
    return {
      ...base,
      title: `Student preparation forum | ${SITE_NAME}`,
      description: "Discuss JEE and NEET preparation questions with other students.",
      canonicalPath: path === "/forum" ? "/forum" : path,
      robots: isSearch || path === "/forum/submit" ? "noindex, follow" : "index, follow",
      type: path.startsWith("/forum/post/") ? "article" : "website",
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

  if (path === "/methodology") {
    return {
      ...base,
      title: `How courses are curated | ${SITE_NAME}`,
      description:
        "How JEENEETARD classifies, checks and orders free YouTube courses, what verified means, and how to request a correction.",
    };
  }

  if (path === "/reset") {
    return {
      ...base,
      title: `Password reset | ${SITE_NAME}`,
      description: "Request a password-reset link or choose a new account password.",
      robots: "noindex, nofollow",
    };
  }

  if (path === "/signin") {
    return {
      ...base,
      title: `Sign in | ${SITE_NAME}`,
      description: "Sign in to carry your watch progress across devices and rate courses. Browsing needs no account.",
      robots: "noindex, nofollow",
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

  if (path.startsWith("/faculty/")) {
    const slug = path.split("/")[2] ?? "";
    const name = readableFacultySlug(slug);
    return {
      ...base,
      title: `${name ? `${name} faculty profile` : "Faculty profile"} | ${SITE_NAME}`,
      description: name
        ? `Browse verified aliases and free courses taught by ${name}.`
        : "Browse verified faculty aliases and free courses.",
      type: "profile",
    };
  }

  if (path === "/search") {
    return RELEASE_CAPABILITIES.universalSearch
      ? {
          ...base,
          title: `Search the library | ${SITE_NAME}`,
          description: "Search across chapters, courses, lectures and faculty.",
          robots: "noindex, follow",
        }
      : comingSoon(base);
  }

  if (path === "/materials") {
    if (!RELEASE_CAPABILITIES.studyMaterials) return comingSoon(base);
    const hasFilters = [...params.keys()].length > 0;
    return {
      ...base,
      title: `Free study material by exam and chapter | ${SITE_NAME}`,
      description: "Find reviewed short notes, formula sheets, full lecture notes and previous-year papers by exam, class, subject and chapter.",
      canonicalPath: "/materials",
      robots: hasFilters ? "noindex, follow" : "index, follow",
    };
  }

  if (path === "/compare") {
    return RELEASE_CAPABILITIES.comparison
      ? {
          ...base,
          title: `Compare courses | ${SITE_NAME}`,
          description: "Compare courses that teach the same chapter, side by side.",
          robots: "noindex, follow",
        }
      : comingSoon(base);
  }

  // Unmatched URLs render the NotFound page. Say so honestly instead of
  // claiming the homepage as this URL's canonical — that combination is what
  // made every bad link a soft-404.
  return {
    ...base,
    title: `Page not found | ${SITE_NAME}`,
    description:
      "This page does not exist. Browse free courses by exam, class, subject and chapter instead.",
    robots: "noindex, nofollow",
  };
}

export function metadataForCourse(course) {
  return buildCourseMetadata(course);
}
