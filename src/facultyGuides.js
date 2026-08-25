// Source-backed faculty notes for the small GEO content pilot.
//
// These records do not replace the reviewed faculty registry in Postgres.
// They add narrowly sourced public context to selected profile pages while
// keeping identity, aliases, institute links, and course links in the database.
// Every claim below is attributed to the named primary source on the page.

const SOURCE_CHECKED = "2026-08-25";

const COMPETISHUN_HOME = "https://competishun.com/";
const COMPETISHUN_PRAGYAAN = "https://competishun.com/pragyaan-jee-2027/";

export const FACULTY_GUIDES = Object.freeze({
  "amit-bijarnia": Object.freeze({
    metaDescription:
      "Amit Bijarnia (ABJ Sir): Competishun Physics faculty for JEE, listed with a B.Tech from IIT Delhi and 18 years of teaching experience.",
    summary:
      "Amit Bijarnia (ABJ Sir) is listed by Competishun as a Physics faculty member for JEE preparation. Competishun lists a B.Tech from IIT Delhi and 18 years of teaching experience.",
    facts: Object.freeze([
      Object.freeze({ label: "Subject", value: "Physics" }),
      Object.freeze({ label: "Education listed by source", value: "B.Tech, IIT Delhi" }),
      Object.freeze({ label: "Experience listed by source", value: "18 years" }),
    ]),
    sources: Object.freeze([
      Object.freeze({ label: "Competishun faculty overview", href: COMPETISHUN_HOME }),
      Object.freeze({ label: "Competishun Pragyaan JEE 2027 faculty", href: COMPETISHUN_PRAGYAAN }),
    ]),
    sourceChecked: SOURCE_CHECKED,
  }),
  "alok-kumar": Object.freeze({
    metaDescription:
      "Alok Kumar (ALK Sir): Competishun Physical and Inorganic Chemistry faculty, listed as an NIT Allahabad graduate and former ISRO scientist.",
    summary:
      "Alok Kumar (ALK Sir) is listed by Competishun for Physical and Inorganic Chemistry. Competishun lists a B.Tech from NIT Allahabad and 21 years of teaching experience, and identifies him as a former ISRO scientist.",
    facts: Object.freeze([
      Object.freeze({ label: "Subjects", value: "Physical and Inorganic Chemistry" }),
      Object.freeze({ label: "Education listed by source", value: "B.Tech, NIT Allahabad" }),
      Object.freeze({ label: "Experience listed by source", value: "21 years" }),
    ]),
    sources: Object.freeze([
      Object.freeze({ label: "Competishun faculty overview", href: COMPETISHUN_HOME }),
      Object.freeze({ label: "Competishun Pragyaan JEE 2027 faculty", href: COMPETISHUN_PRAGYAAN }),
    ]),
    sourceChecked: SOURCE_CHECKED,
  }),
  "mohit-tyagi": Object.freeze({
    metaDescription:
      "Mohit Tyagi (MT Sir): Competishun Mathematics faculty for JEE, listed with a B.Tech from IIT Delhi and 25 years of teaching experience.",
    summary:
      "Mohit Tyagi (MT Sir) is listed by Competishun as a Mathematics faculty member for JEE preparation. Competishun lists a B.Tech from IIT Delhi and 25 years of teaching experience.",
    facts: Object.freeze([
      Object.freeze({ label: "Subject", value: "Mathematics" }),
      Object.freeze({ label: "Education listed by source", value: "B.Tech, IIT Delhi" }),
      Object.freeze({ label: "Experience listed by source", value: "25 years" }),
    ]),
    sources: Object.freeze([
      Object.freeze({ label: "Competishun faculty overview", href: COMPETISHUN_HOME }),
      Object.freeze({ label: "Competishun Pragyaan JEE 2027 faculty", href: COMPETISHUN_PRAGYAAN }),
      Object.freeze({
        label: "Official Mohit Tyagi YouTube channel",
        href: "https://www.youtube.com/@MohitTyagi",
      }),
    ]),
    sameAs: Object.freeze(["https://www.youtube.com/@MohitTyagi"]),
    sourceChecked: SOURCE_CHECKED,
  }),
  "anoop-vashishtha": Object.freeze({
    metaDescription:
      "Anoop Vashishtha: archived Unacademy Chemistry courses and free classes for NEET UG, with current platform-status context and primary sources.",
    summary:
      "Anoop Vashishtha taught Chemistry courses and free classes for NEET UG on Unacademy. Unacademy currently states that he is no longer associated with the platform, while his courses and quizzes remain accessible there.",
    facts: Object.freeze([
      Object.freeze({ label: "Subject in source archive", value: "Chemistry" }),
      Object.freeze({ label: "Exam context", value: "NEET UG" }),
      Object.freeze({ label: "Platform status", value: "No longer associated with Unacademy" }),
    ]),
    sources: Object.freeze([
      Object.freeze({
        label: "Anoop Vashishtha course archive on Unacademy",
        href: "https://unacademy.com/@anoopvashishtha/special-classes?type=special",
      }),
      Object.freeze({
        label: "Anoop Vashishtha batch archive on Unacademy",
        href: "https://unacademy.com/@anoopvashishtha/batches",
      }),
    ]),
    sameAs: Object.freeze(["https://unacademy.com/@anoopvashishtha"]),
    sourceChecked: SOURCE_CHECKED,
  }),
  "pradeep-singh": Object.freeze({
    metaDescription:
      "Pradeep Singh: source-backed Biology educator profile with M.Sc. and B.Ed. qualifications and NEET UG Biology and Botany course links.",
    summary:
      "Pradeep Singh's official Unacademy profile describes him as a Biology educator with M.Sc. and B.Ed. qualifications and more than a decade of teaching experience. His listed courses include NEET UG Biology and Botany for Classes 11 and 12.",
    facts: Object.freeze([
      Object.freeze({ label: "Subject", value: "Biology" }),
      Object.freeze({ label: "Qualifications listed by source", value: "M.Sc., B.Ed." }),
      Object.freeze({ label: "Experience listed by source", value: "More than a decade" }),
    ]),
    sources: Object.freeze([
      Object.freeze({
        label: "Pradeep Singh profile on Unacademy",
        href: "https://unacademy.com/@pradeeplive/special-classes?type=special",
      }),
      Object.freeze({
        label: "Detailed NEET UG Biology course on Unacademy",
        href: "https://unacademy.com/course/detailed-course-on-biology-84/O2J4V53Z",
      }),
    ]),
    sameAs: Object.freeze(["https://unacademy.com/@pradeeplive"]),
    sourceChecked: SOURCE_CHECKED,
  }),
});

export function getFacultyGuide(slug) {
  return FACULTY_GUIDES[String(slug ?? "").trim().toLowerCase()] ?? null;
}
