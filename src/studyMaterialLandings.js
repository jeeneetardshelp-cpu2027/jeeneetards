export const JEE_MAIN_PAPERS_PATH = "/materials/jee-main/previous-year-papers";
export const JEE_MAIN_PAPERS_TITLE_PATTERN = "JEE Main%";

export const JEE_MAIN_PAPERS_META = Object.freeze({
  title: "JEE Main papers, official answer keys and solutions | JEENEETARD",
  description:
    "Browse JEE Main question papers, official answer keys and reviewed worked solutions by year, session and shift.",
  heading: "JEE Main papers, answer keys and solutions",
});

// ---------------------------------------------------------------------------
// Paper landings, as data.
//
// Everything below — the React page, the edge renderer, page metadata, the
// structured data and the sitemap — reads this registry rather than the
// JEE Main constants directly, so a sibling exam (NEET UG, JEE Advanced) is a
// new entry here and nothing else.
//
// An exam earns an entry ONLY when its papers have been confirmed present in
// the PRODUCTION study_materials table under a title pattern this narrow — the
// same rule ON_SITE_TEST_RESOURCES below states for test destinations. Seed
// files in docs/sql are history, not evidence: several say "NOT applied to
// production" and are wrong either way. Adding an entry on the strength of a
// seed file is how you ship a landing page with nothing on it.
// ---------------------------------------------------------------------------
export const PAPER_LANDINGS = Object.freeze([
  Object.freeze({
    id: "jee-main",
    examLabel: "JEE Main",
    path: JEE_MAIN_PAPERS_PATH,
    titlePattern: JEE_MAIN_PAPERS_TITLE_PATTERN,
    crumbLabel: "JEE Main papers",
    listLabel: "JEE Main previous year papers",
    meta: JEE_MAIN_PAPERS_META,
  }),
]);

export const findPaperLanding = (pathname) =>
  PAPER_LANDINGS.find((landing) => landing.path === pathname) ?? null;

/** The child page for one exam year: /…/previous-year-papers/2024. */
export const paperYearPath = (landing, year) => `${landing.path}/${year}`;

const YEAR_SEGMENT = /^(?:19|20)\d{2}$/;

/**
 * Read a per-year paper URL. Returns { landing, year } or null — never a year
 * this site has no landing for, and never a non-year segment, so a mistyped
 * URL keeps its honest 404 instead of rendering an empty year.
 */
export function parsePaperYearPath(pathname) {
  const path = String(pathname ?? "");
  const cut = path.lastIndexOf("/");
  if (cut <= 0) return null;
  const yearSegment = path.slice(cut + 1);
  if (!YEAR_SEGMENT.test(yearSegment)) return null;
  const landing = findPaperLanding(path.slice(0, cut));
  return landing ? { landing, year: Number(yearSegment) } : null;
}

/**
 * Title, description and H1 for one exam year.
 *
 * The promise is the LABELLING, not the contents: a year that has no official
 * answer key must not be described as having one, so the wording says every
 * paper is labelled with what it contains.
 */
export function paperYearMeta(landing, year) {
  return {
    title: `${landing.examLabel} ${year} question papers, session by session | JEENEETARD`,
    description:
      `Every reviewed ${landing.examLabel} ${year} paper on JEENEETARD, listed by session ` +
      "and shift, each labelled with whether it includes the official answer key or worked solutions.",
    heading: `${landing.examLabel} ${year} papers, session by session`,
  };
}

/** Descending list of the exam years present in a set of papers. */
export function paperYears(materials = []) {
  const years = new Set();
  for (const material of materials) {
    const year = Number(material?.examYear ?? material?.exam_year);
    if (Number.isInteger(year) && YEAR_SEGMENT.test(String(year))) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

// One optional on-site card per /tests/:examId page, keyed by the exam id
// used in testPlatforms.js. An exam earns an entry ONLY when a curated
// destination on THIS site has been checked to exist and hold content —
// never a guessed /materials filter combination. Today that is just the
// JEE Main paper landing above.
export const ON_SITE_TEST_RESOURCES = Object.freeze({
  "jee-main": Object.freeze({
    name: "JEE Main previous-year papers, by year",
    to: JEE_MAIN_PAPERS_PATH,
    description:
      "Official question papers and final answer keys, organised by year, session and shift on this site's own papers page. PDFs to read — not a timed test.",
  }),
});

const ANSWER_KEY_INCLUDED = /\b(?:final\s+)?answer\s+keys?\b/i;
const ANSWER_KEY_EXCLUDED = /\b(?:no|without)\b[^.]{0,80}\banswer\s+keys?\b/i;
const SOLUTION_INCLUDED = /\bwith\s+(?:worked\s+)?solutions?\b|\b(?:worked\s+)?solutions?\s+(?:are\s+)?included\b/i;
const SOLUTION_EXCLUDED = /\bno\b[^.]{0,120}\bsolutions?\b|\bwithout\s+solutions?\b/i;

export function paperIncludesAnswerKey(material) {
  const text = `${material?.title ?? ""} ${material?.description ?? ""}`;
  return ANSWER_KEY_INCLUDED.test(text) && !ANSWER_KEY_EXCLUDED.test(text);
}

export function paperIncludesSolutions(material) {
  const text = `${material?.title ?? ""} ${material?.description ?? ""}`;
  return SOLUTION_INCLUDED.test(text) && !SOLUTION_EXCLUDED.test(text);
}

export function splitJeeMainPapers(materials = []) {
  return materials.reduce((groups, material) => {
    if (paperIncludesSolutions(material)) groups.withSolutions.push(material);
    else if (paperIncludesAnswerKey(material)) groups.answerKeys.push(material);
    else groups.questionOnly.push(material);
    return groups;
  }, { questionOnly: [], answerKeys: [], withSolutions: [] });
}
