// examLectureLinks.js — the way back from a mock test or a past paper to the
// lectures for a chapter.
//
// /tests/:examId and the paper-year pages send students OUT: to NTA, to mock
// platforms, to PDFs. A student who has just marked a paper has just found the
// chapter they lost marks in, and until 15 Sep 2026 neither page linked back to
// a single lecture (ExamTestsPage.jsx and PaperYearPage.jsx had no /browse or
// /explore link at all).
//
// The destination is the guided chapter picker, not a list. /explore/:goal
// only offers branches that hold lectures and hands off to the one canonical
// /browse result system, so these pages LINK and never render courses. The
// guard for that is in noSecondResultSystem.test.js.
//
// ONE MAP for both surfaces. The React pages and the edge-rendered crawler
// bodies in ogInject.js read the same entry, so a crawler and a student are
// never sent to different places.
//
// /tests section ids and paper landing ids share these keys. Only exams with
// an unambiguous goal are mapped; left out on purpose:
//   class-10, class-12  /explore/school asks for a board first, and neither
//                       page knows which board the student sits.
//   olympiad            not part of the approved change. Add it only once
//                       someone decides the Olympiad lane should have it.
// Goal slugs verified against production learning_goals on 15 Sep 2026:
// jee, neet, olympiad, school.

const LECTURE_LINKS = Object.freeze({
  "jee-main": Object.freeze({ path: "/explore/jee", goalLabel: "JEE" }),
  "jee-advanced": Object.freeze({ path: "/explore/jee", goalLabel: "JEE" }),
  neet: Object.freeze({ path: "/explore/neet", goalLabel: "NEET" }),
});

/**
 * Where a student on this exam's test or paper page finds its lectures, or
 * null. hasOwn, not a plain lookup, so "constructor" is not an exam.
 */
export function lectureLinkForExam(examId) {
  const key = typeof examId === "string" ? examId : "";
  return Object.hasOwn(LECTURE_LINKS, key) ? LECTURE_LINKS[key] : null;
}

/** The words both surfaces print, so the edge body and the page cannot drift. */
export const LECTURE_LINK_PROMPT = "Lost marks in a chapter?";

export function lectureLinkText(link) {
  return `Find ${link.goalLabel} lectures by chapter`;
}
