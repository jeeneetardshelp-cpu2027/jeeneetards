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

/**
 * Which class scope of a chapter is offered to a search engine.
 *
 * "dropper" is, by construction, the union of class-11 and class-12
 * (classSlugsForStage). Measured against production on 2026-09-02: of the 177
 * Dropper chapter URLs in the sitemap, 171 rendered exactly the same courses
 * as a Class 11 or Class 12 page of the same chapter, and none held a course
 * that no class page held. So a Dropper chapter page is almost always a
 * second address for a class page, and 380 chapter URLs stood for 143
 * chapters — twins competing with each other for the same search.
 *
 * The class page is the canonical one: its title is what students search
 * ("class 11 physics kinematics"), and it carries the same courses. A Dropper
 * chapter page still WORKS for anyone who reaches it from Explore or a link;
 * it is simply not offered to search engines and asks not to be indexed. This
 * is a scope rule, separate from the count rule (isIndexableChapter), and it
 * accepts either spelling of the class — the URL's "dropper" and the stage
 * id "dropper" are the same string.
 */
export function isIndexableChapterScope(classSlug) {
  return String(classSlug ?? "") !== "dropper";
}

/** The canonical browse query for a chapter view, in a fixed key order. */
export const CHAPTER_QUERY_KEYS = ["goal", "board", "class", "subject", "chapter"];

/**
 * Is this /browse query EXACTLY the canonical chapter shape, and nothing more?
 *
 * Exactness is the whole point: it is what keeps one useful page indexable
 * without opening the door to an unbounded faceted URL space. A sort, a page,
 * a tab or a search term makes this return null.
 *
 * A URL IS NOT EVIDENCE THAT A CHAPTER EXISTS. That is why indexing is opt-in
 * here: the shape check bounds the query KEYS, and for a while that was
 * mistaken for bounding the whole space — so
 * ?goal=banana&class=11&subject=physics&chapter=not-a-real-chapter came back
 * `index, follow` under the title "Not a real chapter — Banana Class 11
 * Physics". Anyone could mint unlimited indexable soft-404s, which is the
 * precise failure the boundedness rule exists to prevent.
 *
 * So a caller that has CONFIRMED the chapter against the catalogue passes
 * `verified`, and only then can the page be indexed. Two callers can:
 * middleware.js, from the curriculum row it already fetches, and BrowsePage,
 * once its filters resolve. Both must agree — the edge writes the head and the
 * client rewrites it on hydration, and Google's rendered pass believes the
 * client. Without `verified` the page still renders and its links still count;
 * it simply asks not to be indexed.
 *
 * @param verified { chapterName, courseCount } — from the catalogue, not the URL.
 */
export function canonicalChapterView(params, readable = (v) => v, verified = null) {
  const keys = [...params.keys()];
  if (keys.some((key) => !CHAPTER_QUERY_KEYS.includes(key))) return null;
  for (const required of ["goal", "class", "subject", "chapter"]) {
    if (!params.get(required)) return null;
  }
  // The real name when a caller has it — "Rotational Motion", not the URL's
  // "rotational-motion" prettified — and the real count, which no URL knows.
  const courseCount = Number(verified?.courseCount ?? 0);
  const meta = chapterLandingMeta({
    chapterName: String(verified?.chapterName ?? "").trim() || readable(params.get("chapter")),
    subjectName: readable(params.get("subject")),
    className: params.get("class") === "dropper" ? "Dropper" : `Class ${params.get("class")}`,
    // For school the BOARD is the meaningful label — "CBSE Class 10 Science"
    // reads like the thing a student searches for; "SCHOOL Class 10" does not.
    goalName: readable(params.get("board") || params.get("goal")),
    courseCount,
  });
  if (!meta) return null;
  const query = CHAPTER_QUERY_KEYS
    .filter((key) => params.get(key))
    .map((key) => `${key}=${encodeURIComponent(params.get(key))}`)
    .join("&");
  // All three rules, in one place, so the edge, the client and the sitemap
  // cannot disagree about the same URL:
  //   1. the chapter is confirmed to exist        (verified)
  //   2. its scope is the canonical one           (not Dropper — a twin page)
  //   3. it holds a real comparison               (meta.indexable, >= 3 courses)
  const indexable = Boolean(verified)
    && isIndexableChapterScope(params.get("class"))
    && meta.indexable;
  return { ...meta, robots: indexable ? "index, follow" : "noindex, follow", query };
}

