// chapterLanding.js — what a chapter page says about itself.
//
// WHY THIS EXISTS. /explore/:goal/:class/:subject/:chapter used to 308-redirect
// into /browse?…&chapter=…, which carries `noindex` and canonicalises to the
// bare /browse. So all 249 populated chapters shared one canonical and one
// title, and the one screen this site has that YouTube does not — thirteen
// courses on Kinematics, side by side — could not be found in a search engine.
// Course pages were indexable, which meant competing for "Rectilinear Motion by
// ABJ Sir" using the video's own title, rather than for "best kinematics
// lectures for JEE", the question only this site can answer.
//
// The copy and the indexing rule live here, in one pure module, because three
// callers must agree: the middleware (which renders the crawler-readable page),
// the React view students actually use, and the sitemap builder. When they
// drift, the canonical URL says one thing and the sitemap another.

// A chapter needs a real comparison on it to deserve its own page. Below this,
// the page still WORKS — a student following a link sees the courses — it is
// simply not offered to search engines, because "two courses on Kinematics" is
// a thin page and a thin page competing against itself is worse than no page.
// Measured against production: 249 chapters hold courses, and 150 of them have
// three or more.
export const MIN_INDEXABLE_COURSES = 3;

/** Whether this chapter page is worth offering to a search engine. */
export function isIndexableChapter(courseCount) {
  return Number(courseCount ?? 0) >= MIN_INDEXABLE_COURSES;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * The title, description and robots directive for one chapter page.
 *
 * The title leads with the chapter because that is the search term; the count
 * is the differentiator ("13 courses compared" is a reason to click that a
 * YouTube result cannot match). Every part is a fact already measured — no
 * superlatives, and no claim about quality the site cannot support.
 *
 * @param scope { chapterName, subjectName, className, goalName, courseCount }
 */
export function chapterLandingMeta(scope) {
  const chapterName = String(scope?.chapterName ?? "").trim();
  const count = Number(scope?.courseCount ?? 0);
  if (!chapterName) return null;

  // "JEE Class 11 Physics" — each part omitted when unknown rather than
  // guessed, so a chapter with no class still gets an honest title.
  const lane = [scope?.goalName, scope?.className, scope?.subjectName]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  const title = count > 0
    ? `${chapterName} — ${plural(count, "free course")}${lane ? ` for ${lane}` : ""}`
    : `${chapterName}${lane ? ` — ${lane}` : ""}`;

  const description = count > 0
    ? `Compare ${plural(count, "free YouTube course")} covering ${chapterName}`
      + `${lane ? ` for ${lane}` : ""}, chapter by chapter. Lecture counts and`
      + " teachers side by side, so you can pick one and start."
    : `Free YouTube lectures covering ${chapterName}${lane ? ` for ${lane}` : ""},`
      + " organised chapter by chapter.";

  return {
    title,
    description,
    indexable: isIndexableChapter(count),
    // A thin chapter stays crawlable so its links still pass — it is only kept
    // out of the index itself.
    robots: isIndexableChapter(count) ? "index, follow" : "noindex, follow",
  };
}

/** The canonical browse query for a chapter view, in a fixed key order. */
export const CHAPTER_QUERY_KEYS = ["goal", "board", "class", "subject", "chapter"];

/**
 * Is this /browse query EXACTLY the canonical chapter shape, and nothing more?
 *
 * Exactness is the whole point: it is what keeps one useful page indexable
 * without opening the door to an unbounded faceted URL space. A sort, a page,
 * a tab or a search term makes this return null.
 */
export function canonicalChapterView(params, readable = (v) => v) {
  const keys = [...params.keys()];
  if (keys.some((key) => !CHAPTER_QUERY_KEYS.includes(key))) return null;
  for (const required of ["goal", "class", "subject", "chapter"]) {
    if (!params.get(required)) return null;
  }
  const chapterName = readable(params.get("chapter"));
  const meta = chapterLandingMeta({
    chapterName,
    subjectName: readable(params.get("subject")),
    className: params.get("class") === "dropper" ? "Dropper" : `Class ${params.get("class")}`,
    // For school the BOARD is the meaningful label — "CBSE Class 10 Science"
    // reads like the thing a student searches for; "SCHOOL Class 10" does not.
    goalName: readable(params.get("board") || params.get("goal")),
    // The count is not knowable from a URL. chapterLandingMeta degrades to an
    // honest title without one, and the SITEMAP is what decides which chapter
    // URLs are offered at all, using the real count.
    courseCount: 0,
  });
  if (!meta) return null;
  const query = CHAPTER_QUERY_KEYS
    .filter((key) => params.get(key))
    .map((key) => `${key}=${encodeURIComponent(params.get(key))}`)
    .join("&");
  return { ...meta, robots: "index, follow", query };
}

/** The canonical path for a chapter page. School carries a board segment. */
export function chapterLandingPath({ goal, board, cls, subject, chapter }) {
  const parts = [goal, board, cls, subject, chapter]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  return `/explore/${parts.join("/")}`;
}
