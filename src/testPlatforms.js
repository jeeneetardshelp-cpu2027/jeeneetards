// =====================================================================
//  testPlatforms.js — the mock-test directory.
//
//  JEENEETARD does not run tests. This is a curated set of OUTBOUND links
//  to the places that do, grouped by exam so a student can find the right
//  one without hunting. Same principle as the course library: point at
//  good free material, host none of it, rank nobody for money.
//
//  TO ADD A PLATFORM: put an entry in the matching section's `resources`
//  array. Nothing else needs changing — the page, the section counts and
//  the empty states are all derived from this file.
//
//  Every entry must be:
//    - free to actually take (no paywall between the student and the
//      questions; "free trial then pay" does not qualify)
//    - a URL that has been opened and checked, not guessed
//    - honestly attributed to whoever really runs it
//
//  `official: true` is reserved for the body that conducts the exam
//  itself (NTA for JEE/NEET, a board, an olympiad organiser). It is a
//  factual claim shown as a badge — never apply it to a coaching site.
// =====================================================================

/**
 * @typedef {Object} TestResource
 * @property {string} name        What the student is clicking through to.
 * @property {string} url         Absolute https URL, verified working.
 * @property {string} provider    Who runs it, spelled out.
 * @property {boolean} [official] True only for the exam-conducting body.
 * @property {string} description One plain sentence: what they'll get.
 */

/** @type {{id: string, label: string, blurb: string, resources: TestResource[]}[]} */
export const TEST_SECTIONS = [
  {
    id: "jee-main",
    label: "JEE Main",
    blurb:
      "Previous-year papers and mock tests in the same computer-based format as the real exam.",
    resources: [
      {
        name: "NTA official quiz and previous year papers",
        url: "https://www.nta.ac.in/Quiz",
        provider: "National Testing Agency (NTA)",
        official: true,
        description:
          "The exam conductor's own practice portal, with past JEE Main papers in the actual test interface students will face on exam day.",
      },
    ],
  },
  {
    id: "jee-advanced",
    label: "JEE Advanced",
    blurb:
      "Full-length papers for the IIT entrance, where the question style differs sharply from JEE Main.",
    resources: [],
  },
  {
    id: "neet",
    label: "NEET",
    blurb: "Practice papers for the medical entrance test.",
    resources: [],
  },
  {
    id: "olympiad",
    label: "Olympiad",
    blurb:
      "Problem sets for science and mathematics olympiads, which reward depth over speed.",
    resources: [],
  },
  {
    id: "class-10",
    label: "Class 10 Boards",
    blurb: "Sample papers and past papers for the Class 10 board exams.",
    resources: [],
  },
  {
    id: "class-12",
    label: "Class 12 Boards",
    blurb: "Sample papers and past papers for the Class 12 board exams.",
    resources: [],
  },
];

/** Total number of listed test sources — used for honest page copy. */
export const totalTestResources = () =>
  TEST_SECTIONS.reduce((sum, s) => sum + s.resources.length, 0);

/**
 * The bare host shown on a link chip ("nta.ac.in"), so a student can see
 * where a link goes BEFORE clicking it. Falls back to the raw string if a
 * malformed URL ever slips in — a bad entry must not blank the page.
 */
export const linkHost = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return String(url ?? "");
  }
};
