import { RELEASE_CAPABILITIES, RELEASE_FEATURES } from "./releaseCapabilities.js";
import { canonicalChapterView } from "./chapterLanding.js";
// Pure data (no React), so this stays safe for the edge middleware, which
// imports this module to compute the same metadata the client will.
import { findTestSection, sectionIsAllFree } from "./testPlatforms.js";
import { buildCourseMetadata } from "./courseMetadata.js";
import {
  findPaperLanding,
  paperYearMeta,
  parsePaperYearPath,
} from "./studyMaterialLandings.js";

export const SITE_NAME = "JEENEETARD";
export const DEFAULT_TITLE = "Free JEE & NEET video lectures, chapter by chapter | JEENEETARD";
export const DEFAULT_DESCRIPTION =
  "Free JEE, NEET and board exam video lectures from top YouTube teachers, organised by class, subject and chapter.";

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

/**
 * The title and description for a single poll, built from the ROW rather than
 * the URL. A slug is a lossy encoding of the question — lowercased,
 * punctuation stripped, cut to a 60-character stem — so a URL-derived title
 * loses every question mark and cuts a long question mid-word.
 *
 * Both callers that have the real question use this: the edge
 * (middleware.js, which already fetched the row to decide the 404) and the
 * client (PageMetadata.jsx, once usePoll resolves). One builder, so the tab
 * title and the share card can never disagree about the same poll — they did,
 * and the tab silently reverted to the slug-derived text after React booted.
 *
 * Returns null when there is no usable question, so callers keep the
 * slug-derived fallback rather than rendering an empty title.
 */
export function pollMetadataForQuestion(question) {
  const text = typeof question === "string" ? question.trim() : "";
  if (!text) return null;
  return {
    title: `${text} | ${SITE_NAME} polls`,
    description: `Vote and see how other JEE and NEET students answered: ${text}`,
  };
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

    // ONE indexable filtered shape: a chapter.
    //
    // Every other query variant still collapses to /browse, for the reason
    // below. But collapsing the CHAPTER view too meant all 249 populated
    // chapters shared one canonical and one title, so the only screen this
    // site has that YouTube does not — every course on Kinematics, side by
    // side — could not be found in a search engine. The site was indexable for
    // "Rectilinear Motion by ABJ Sir", competing with the YouTube video using
    // the video's own title, and not at all for "kinematics lectures for JEE".
    //
    // This is not a hole in the rule below: the shape is exact and bounded —
    // goal + class + subject + chapter (+ board for school) and NOTHING else,
    // so a sort, a page, a tab or a search term still drops out of the index
    // and the faceted space stays finite.
    const chapterView = canonicalChapterView(params, readablePathSegment);
    if (chapterView) {
      return {
        ...base,
        title: `${chapterView.title} | ${SITE_NAME}`,
        description: chapterView.description,
        robots: chapterView.robots,
        canonicalPath: `${path}?${chapterView.query}`,
      };
    }

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

  // A poll is made to be shared, so its link has to preview as something
  // worth tapping. The question itself is not known to this pure function --
  // it lives in the database -- so the slug carries it: poll slugs are the
  // question, slugified, with a trailing id. Stripping that id back off gives
  // a readable title without a round trip, and the client refines it once the
  // poll loads.
  if (path === "/polls" || path === "/polls/new" || /^\/polls\/[a-z0-9-]+$/.test(path)) {
    if (!RELEASE_FEATURES.polls) return comingSoon({ ...base, canonicalPath: "/polls" });
    const isSinglePoll = path !== "/polls" && path !== "/polls/new";
    if (isSinglePoll) {
      const slug = path.slice("/polls/".length).replace(/-\d+$/, "");
      const question = readablePathSegment(slug);
      return {
        ...base,
        title: question ? `${question} | ${SITE_NAME} polls` : `Student poll | ${SITE_NAME}`,
        description:
          "Vote in this student poll, see how everyone else answered, and read the discussion underneath.",
        canonicalPath: path,
        type: "article",
      };
    }
    return {
      ...base,
      title: `Student polls | ${SITE_NAME}`,
      description:
        "Vote on what other JEE and NEET students actually think — study hours, hardest chapters, revision strategy — and argue about it in the comments.",
      canonicalPath: "/polls",
      // Same policy as /browse and /faculty: the feed keeps sort and subject in
      // the query string, so noindex every faceted variant and let only the
      // clean /polls landing (and never /polls/new) into the index.
      robots: path === "/polls/new" || [...params.keys()].length > 0
        ? "noindex, follow"
        : "index, follow",
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

  if (path === "/forum/username") {
    return {
      ...base,
      title: `Forum username | ${SITE_NAME}`,
      description: "Choose the public pseudonym used for JEENEETARD forum posts and answers.",
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

  if (path === "/faculty") {
    const hasFilters = [...params.keys()].length > 0;
    return RELEASE_CAPABILITIES.facultyRegistry
      ? {
          ...base,
          title: `JEE, NEET and board exam faculty | ${SITE_NAME}`,
          description:
            "Find faculty by verified name or alias, exam and subject, then browse their linked free YouTube courses.",
          robots: hasFilters ? "noindex, follow" : "index, follow",
          canonicalPath: "/faculty",
        }
      : comingSoon(base);
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
      description: "Find reviewed formula sheets, full lecture notes and previous-year papers by exam, class, subject and chapter.",
      canonicalPath: "/materials",
      robots: hasFilters ? "noindex, follow" : "index, follow",
    };
  }

  // One landing per registered exam (PAPER_LANDINGS): the registry entry
  // owns the title and description, so an exam's honest coverage wording is
  // stated once and served identically by client and edge.
  const paperLanding = findPaperLanding(path);
  if (paperLanding) {
    if (!RELEASE_CAPABILITIES.studyMaterials) return comingSoon(base);
    return {
      ...base,
      title: paperLanding.meta.title,
      description: paperLanding.meta.description,
      canonicalPath: paperLanding.path,
      robots: "index, follow",
    };
  }

  // One page per exam year, so "jee main 2024 question paper" has somewhere on
  // this site to land. Self-canonical: the year page is not a filtered view of
  // the landing, it is the child the landing links to.
  const paperYear = parsePaperYearPath(path);
  if (paperYear) {
    if (!RELEASE_CAPABILITIES.studyMaterials) return comingSoon(base);
    const yearMeta = paperYearMeta(paperYear.landing, paperYear.year);
    return {
      ...base,
      title: yearMeta.title,
      description: yearMeta.description,
      canonicalPath: path,
      robots: "index, follow",
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
