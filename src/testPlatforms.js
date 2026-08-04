// =====================================================================
//  testPlatforms.js — the mock-test directory.
//
//  JEENEETARD does not run tests. This is a curated set of OUTBOUND links
//  to the places that do, grouped by exam so a student can find the right
//  one without hunting. Same principle as the course library: point at
//  good material, host none of it, rank nobody for money.
//
//  TO ADD A PLATFORM: put an entry in the matching section's `resources`
//  array. Nothing else needs changing — the page, the section counts, the
//  crawler-readable HTML and the empty states all derive from this file.
//
//  Every entry must be:
//    - a URL that has been opened and checked, not guessed
//    - honestly attributed to whoever really runs it
//    - labelled with what it actually costs (see `access` below)
//
//  ON COST: the course library is free-only, and this directory started
//  that way. It no longer is — a paid series can be the better preparation
//  and students deserve to know it exists. The rule is therefore NOT
//  "free only", it is "never let a student discover the price after they
//  arrive". `access` is mandatory and is rendered as a visible badge, so a
//  paid entry cannot pass as free by omission.
//
//  `official: true` is reserved for the body that conducts the exam itself
//  (NTA for JEE/NEET, a board, an olympiad organiser). It is a factual
//  claim shown as a badge — never apply it to a coaching or private site.
// =====================================================================

/**
 * How much a student has to give up to reach the questions.
 *   free    — open it and start; no payment, no account
 *   account — free to take, but a sign-up is required first
 *   paid    — costs money
 */
export const ACCESS = Object.freeze({
  free: { label: "Free", detail: "No payment or account needed" },
  account: { label: "Free · sign-up", detail: "Free, but requires an account" },
  paid: { label: "Paid", detail: "This is a paid product" },
});

/**
 * @typedef {Object} TestResource
 * @property {string} name        What the student is clicking through to.
 * @property {string} url         Absolute https URL, verified working.
 * @property {string} provider    Who runs it, spelled out.
 * @property {keyof ACCESS} access What it costs. Mandatory.
 * @property {boolean} [official] True only for the exam-conducting body.
 * @property {string} description One plain sentence: what they'll get.
 * @property {string} [findIt]   Where to click AFTER the link opens.
 */

// ON `findIt`: some platforms have no public deep link to the actual paper —
// the URL lands on a generic dashboard and the student has to navigate. A
// link that technically works but strands someone on an explore screen is
// barely better than no link, so those entries carry the exact click path
// (tab → sub-tab → course name) as it appears on the destination. Use the
// platform's OWN wording, capitalisation included, so it can be matched by
// eye; leave it off when the URL already lands on the test.

/** @type {{id: string, label: string, blurb: string, resources: TestResource[]}[]} */
export const TEST_SECTIONS = [
  {
    id: "jee-main",
    label: "JEE Main",
    blurb:
      "Previous-year papers and full-length mocks in the same computer-based format as the real exam.",
    resources: [
      {
        name: "NTA official quiz and previous year papers",
        url: "https://www.nta.ac.in/Quiz",
        provider: "National Testing Agency (NTA)",
        official: true,
        access: "free",
        description:
          "The exam conductor's own practice portal, with past JEE Main papers in the actual test interface students will face on exam day.",
      },
      {
        name: "Mockers JEE Main 2027 mock test",
        url: "https://www.mockers.in/online/jee-main-2027-mock-test",
        provider: "Mockers",
        access: "free",
        description:
          "Full-length 75-question, 300-mark papers on a 180-minute timer, with the paper openable straight from the page.",
      },
      {
        name: "Competishun previous year papers",
        url: "https://i.competishun.com/home/explore",
        provider: "Competishun",
        // Labelled `account`, not `free`, on purpose: this is the student
        // app's explore route, which asks you to sign in before the papers
        // open. The tests themselves cost nothing. Understating openness is
        // the safe error here — overstating it strands a student at a wall.
        access: "account",
        // Deliberately does NOT claim "JEE Main previous-year papers". The
        // only Competishun free-test listing actually seen is the JEE
        // ADVANCED PYQs course under the IIT-JEE tab, so this entry says what
        // is verifiable — the app's free JEE tests live behind that tab — and
        // points the student at it rather than promising a paper nobody has
        // confirmed exists.
        description:
          "Competishun's free timed tests for JEE inside its student app, listed under the IIT-JEE tab once you have signed in.",
        findIt: "IIT-JEE tab → 11th / 12th / 12th+ → any course priced ₹0",
      },
      {
        name: "Quizrr test series",
        url: "https://quizrr.in",
        provider: "Quizrr, by MathonGo",
        access: "paid",
        description:
          "A paid JEE test series built on a real-exam interface, with a detailed per-test analysis report and mistake tracking.",
      },
    ],
  },
  {
    id: "jee-advanced",
    label: "JEE Advanced",
    blurb:
      "Full-length papers for the IIT entrance, where the question style differs sharply from JEE Main.",
    resources: [
      {
        name: "Competishun JEE Advanced PYQs 2025–2019 (Paper 1 & 2)",
        // NOT linked straight to competishun.digital.schoollog.in/all-exams,
        // where the papers actually live: opened without a session that URL
        // serves a bare Schoollog login form with no Competishun branding,
        // which is a worse landing than the app's own explore screen. The
        // portal is named in `findIt` instead, so the hand-off is expected
        // rather than alarming.
        url: "https://i.competishun.com/home/explore",
        provider: "Competishun",
        access: "account",
        description:
          "Paper 1 and Paper 2 from all seven JEE Advanced sittings since 2019 — 14 papers listed, 180 marks and 180 minutes each, priced ₹0.",
        findIt:
          'IIT-JEE tab → 12th+ → "JEE ADVANCED PYQs 2025-2019" (₹0). Papers open in Competishun\'s Schoollog test portal after sign-in.',
      },
      {
        name: "Quizrr test series",
        url: "https://quizrr.in",
        provider: "Quizrr, by MathonGo",
        access: "paid",
        description:
          "A paid JEE Advanced test series on the same platform, covering the two-paper format the exam actually uses.",
      },
    ],
  },
  {
    id: "neet",
    label: "NEET",
    blurb:
      "Previous-year papers and chapter-wise practice for the medical entrance test.",
    resources: [
      {
        // NTA conducts NEET as well as JEE, so the same portal is correctly
        // listed under both exams. The per-section dedup rule allows this;
        // only a repeat inside ONE section is a bug.
        name: "NTA official quiz and previous year papers",
        url: "https://www.nta.ac.in/Quiz",
        provider: "National Testing Agency (NTA)",
        official: true,
        access: "free",
        description:
          "The exam conductor's own practice portal, with past NEET papers in the actual test interface students will face on exam day.",
      },
      {
        name: "ScienceLesson chapter-wise NEET mock tests",
        url: "https://sciencelesson.in/NEET-Mock-Test/",
        provider: "ScienceLesson.in",
        access: "free",
        description:
          "Over 1,500 chapter-wise tests across Biology, Physics and Chemistry, with unlimited attempts and no sign-up asked for.",
      },
    ],
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

/** The section behind /tests/:examId, or null so the caller can 404 it. */
export const findTestSection = (id) =>
  TEST_SECTIONS.find((s) => s.id === id) ?? null;

/** Free to take = the student reaches the questions without paying. */
export const isFreeToTake = (resource) => resource.access !== "paid";

/**
 * True only when EVERY listed source is free to take. Gates the word "Free"
 * in a page title: an exam whose only option is a paid series must not be
 * advertised as free, and one where everything is free should say so, since
 * that is exactly what students search for.
 */
export const sectionIsAllFree = (section) =>
  section.resources.length > 0 && section.resources.every(isFreeToTake);

/** Total number of listed test sources — used for honest page copy. */
export const totalTestResources = () =>
  TEST_SECTIONS.reduce((sum, s) => sum + s.resources.length, 0);

/** How many listed sources cost nothing to take. Drives the page's summary. */
export const freeTestResources = () =>
  TEST_SECTIONS.reduce(
    (sum, s) => sum + s.resources.filter((r) => r.access !== "paid").length,
    0,
  );

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
