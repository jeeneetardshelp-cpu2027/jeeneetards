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
//
// Verified against production 2026-09-02 (read-only count by title prefix on
// material_type = 'previous_year_paper'): 112 'JEE Main%', 44 'JEE Advanced%',
// 6 'NEET%', 9 'NSEP%'. The first three are registered below. NSEP is NOT:
// its titles carry a season ('NSEP 2024-25 Physics Paper with Solutions'),
// and a four-digit /…/2024 year page would rename that season and promise
// "question papers" a solutions collection does not match. Registering NSEP
// needs season-aware year pages first.
//
// Per-entry fields beyond the original five:
//   scopeGoal          the goal slug stamped on each fetched row's scope, so
//                      StudyMaterialCard's scope line and mock-test pairing
//                      stay honest per exam ("jee-main" → JEE Main tests link,
//                      "jee" → no link, Advanced has no timed source here).
//   sessionGrammar     true only where titles carry Session/Shift wording —
//                      drives the "session by session" copy on year pages.
//   heroIntro          the landing hero's one-line promise.
//   coverageNote       honest scope statement rendered in the hero. NEET's
//                      says PARTIAL plainly instead of implying completeness.
//   emptyAnswerKeysCopy shown when the landing's answer-key section is empty.
// ---------------------------------------------------------------------------
export const PAPER_LANDINGS = Object.freeze([
  Object.freeze({
    id: "jee-main",
    examLabel: "JEE Main",
    path: JEE_MAIN_PAPERS_PATH,
    titlePattern: JEE_MAIN_PAPERS_TITLE_PATTERN,
    crumbLabel: "JEE Main papers",
    listLabel: "JEE Main previous year papers",
    scopeGoal: "jee-main",
    sessionGrammar: true,
    meta: JEE_MAIN_PAPERS_META,
    heroIntro:
      "Browse question papers, official answer keys and reviewed worked solutions by year, session and shift.",
    coverageNote: null,
    emptyAnswerKeysCopy:
      "Only result-stage answer keys published by NTA or CBSE appear here; challenge-stage provisional drafts are excluded.",
  }),
  Object.freeze({
    id: "jee-advanced",
    examLabel: "JEE Advanced",
    path: "/materials/jee-advanced/previous-year-papers",
    titlePattern: "JEE Advanced%",
    crumbLabel: "JEE Advanced papers",
    listLabel: "JEE Advanced previous year papers",
    scopeGoal: "jee",
    sessionGrammar: false,
    meta: Object.freeze({
      title: "JEE Advanced question papers by year, 2007 to 2026 | JEENEETARD",
      description:
        "Browse official JEE Advanced question papers from 2007 to 2026 by year. Each paper opens the recorded source PDF and says exactly what it contains.",
      heading: "JEE Advanced question papers, 2007 to 2026",
    }),
    heroIntro:
      "Browse official JEE Advanced question papers by year, from 2007 to 2026.",
    coverageNote:
      "This collection covers 2007 to 2026. Answer keys and worked solutions appear only when a reviewed copy exists — an empty section below means none is listed yet, not that none exists.",
    emptyAnswerKeysCopy:
      "No official JEE Advanced answer key has been reviewed yet, so none is listed. This section stays empty rather than linking unchecked files.",
  }),
  Object.freeze({
    id: "neet",
    examLabel: "NEET",
    path: "/materials/neet/previous-year-papers",
    titlePattern: "NEET%",
    crumbLabel: "NEET papers",
    listLabel: "NEET previous year papers",
    scopeGoal: "neet",
    sessionGrammar: false,
    meta: Object.freeze({
      title: "NEET question papers: 2024 and the 2026 re-exam | JEENEETARD",
      description:
        "Official NEET UG question papers: 2024 and the 2026 re-examination, question papers only. Coverage is partial — other years and official answer keys are not listed yet.",
      heading: "NEET question papers: 2024 and the 2026 re-exam",
    }),
    heroIntro:
      "Official NEET UG question papers, each opening the recorded source PDF.",
    coverageNote:
      "This collection is partial: only the NEET UG 2024 papers and the 2026 re-examination papers have been reviewed, and they are question papers only — no official answer keys yet. Other years are not listed rather than linked unchecked.",
    emptyAnswerKeysCopy:
      "No official NEET answer key is listed — this collection is question papers only so far. This section stays empty rather than linking unchecked files.",
  }),
]);

/**
 * The landing that lists a paper, from its TITLE — the same prefix test the
 * landing pages query with, so a match is never a dead end. Search results
 * use this to send a NEET or JEE Advanced paper to its curated landing the
 * way JEE Main results always were; null falls back to the flat directory.
 */
export const landingForPaperTitle = (title) =>
  typeof title === "string"
    ? PAPER_LANDINGS.find((l) => title.startsWith(l.titlePattern.replace("%", ""))) ?? null
    : null;
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
 * paper is labelled with what it contains. "Session by session" is claimed
 * only for exams whose titles actually carry sessions (sessionGrammar).
 */
export function paperYearMeta(landing, year) {
  if (!landing.sessionGrammar) {
    return {
      title: `${landing.examLabel} ${year} question papers | JEENEETARD`,
      description:
        `Every reviewed ${landing.examLabel} ${year} paper on JEENEETARD, each labelled ` +
        "with whether it includes the official answer key or worked solutions.",
      heading: `${landing.examLabel} ${year} question papers`,
    };
  }
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

// ---------------------------------------------------------------------------
// The ONE title grammar, shared with the database.
//
// The staged migration supabase/migrations/
// 20260902093000_study_material_paper_metadata.sql backfills paper_kind,
// paper_year, exam_session and exam_shift from titles using EXACTLY these
// rules, and src/paperMetadataSqlRehearsal.test.js executes that SQL and
// asserts it agrees with this function title by title. Change one, change
// both, or that test fails.
//
// FOLLOW-UP — where the flip happens: once the owner has applied that
// migration with `npx supabase db push`, the client should read the four real
// columns (add them to the SELECT in src/useJeeMainPapers.js) and this parser
// becomes the fallback for rows predating the backfill, not the authority.
// Until then the columns DO NOT EXIST in production and selecting them would
// make PostgREST error every papers page.
// ---------------------------------------------------------------------------

/**
 * Deterministic title → { year, session, shift, kind }.
 *
 * kind: 'with Solutions' wins over 'Answer Key' wins over the question-paper
 * default — the same precedence splitJeeMainPapers has always applied.
 * year: the first four-digit 20xx ('NSEP 2017-18…' → 2017), or null.
 * session/shift: 'Session N' / 'Shift N' when the title names one, else null.
 */
export function parsePaperTitle(title) {
  const text = String(title ?? "");
  const kind = /with\s+solutions?/i.test(text)
    ? "paper_with_solutions"
    : /answer\s+keys?/i.test(text)
      ? "answer_key"
      : "question_paper";
  const year = /\b(20\d{2})\b/.exec(text);
  const session = /session\s*(\d+)/i.exec(text);
  const shift = /shift\s*(\d+)/i.exec(text);
  return {
    year: year ? Number(year[1]) : null,
    session: session ? `Session ${session[1]}` : null,
    shift: shift ? `Shift ${shift[1]}` : null,
    kind,
  };
}

/**
 * Pair one year's question papers with that year's official answer keys,
 * grouped the way the exam actually publishes them: papers are per-shift,
 * keys are per-session, so the SESSION is the join.
 *
 * Returns [{ session, papers, answerKeys }] with numbered sessions first in
 * order, then the session-less group (older exams name no session; its keys
 * are the year's session-less keys, so an exam without session grammar still
 * pairs at the year level). A session with no key gets an empty answerKeys
 * array — the caller shows NOTHING for it, never a dead link.
 */
export function groupPapersBySession(papers = [], answerKeys = []) {
  const sessionOf = (material) => parsePaperTitle(material?.title).session;
  const groups = new Map();
  for (const paper of papers) {
    const session = sessionOf(paper);
    const key = session ?? "";
    if (!groups.has(key)) groups.set(key, { session, papers: [], answerKeys: [] });
    groups.get(key).papers.push(paper);
  }
  for (const answerKey of answerKeys) {
    const session = sessionOf(answerKey);
    const group = groups.get(session ?? "");
    // A key whose session has no question paper in the loaded data attaches
    // nowhere here; it still renders in the page's own answer-key section.
    if (group) group.answerKeys.push(answerKey);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.session === null) return 1;
    if (b.session === null) return -1;
    return Number(a.session.slice("Session ".length)) - Number(b.session.slice("Session ".length));
  });
}
