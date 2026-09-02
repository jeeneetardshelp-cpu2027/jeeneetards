import { describe, expect, it } from "vitest";
import {
  JEE_MAIN_PAPERS_PATH,
  PAPER_LANDINGS,
  findPaperLanding,
  groupPapersBySession,
  paperIncludesAnswerKey,
  paperIncludesSolutions,
  paperMetadata,
  paperYearMeta,
  paperYearPath,
  paperYears,
  parsePaperTitle,
  parsePaperYearPath,
  splitJeeMainPapers,
} from "./studyMaterialLandings.js";

// Since the 2026-09-02 metadata flip the rows below — no paper_kind column —
// are the FALLBACK path: an old cached edge response, or a fixture predating
// the flip, still classifies through the title grammar exactly as before.
describe("JEE Main paper grouping (title-grammar fallback)", () => {
  it("still classifies a column-less row via its title and description", () => {
    // The explicit fallback proof: nothing but title text to go on.
    expect(paperIncludesAnswerKey({
      title: "JEE Main 2025 Session 1 Final Answer Key",
    })).toBe(true);
    expect(paperIncludesSolutions({
      title: "NSEP 2024-25 Physics Paper with Solutions",
    })).toBe(true);
    const groups = splitJeeMainPapers([
      { id: 1, title: "JEE Main 2024 Session 1 - 27 January Shift 1" },
    ]);
    expect(groups.questionOnly.map(({ id }) => id)).toEqual([1]);
  });

  it("does not mistake an explicit no-solutions statement for a solved paper", () => {
    expect(paperIncludesSolutions({
      title: "JEE Main 2026 paper",
      description: "Questions only; no answer key or worked solutions are included.",
    })).toBe(false);
  });

  it("requires an explicit statement that worked solutions are included", () => {
    expect(paperIncludesSolutions({
      title: "JEE Main 2024 paper with solutions",
      description: "The question paper and worked solutions are included.",
    })).toBe(true);

    const groups = splitJeeMainPapers([
      { id: 1, description: "No solutions are included." },
      { id: 2, description: "Worked solutions are included." },
      { id: 3, title: "JEE Main 2025 Session 1 final answer key" },
    ]);
    expect(groups.questionOnly.map(({ id }) => id)).toEqual([1]);
    expect(groups.answerKeys.map(({ id }) => id)).toEqual([3]);
    expect(groups.withSolutions.map(({ id }) => id)).toEqual([2]);
  });

  it("does not mistake a no-answer-key statement for an answer key", () => {
    expect(paperIncludesAnswerKey({
      description: "Questions only; no answer key or solutions are included.",
    })).toBe(false);
    expect(paperIncludesAnswerKey({
      title: "JEE Main 2026 Session 2 final answer key",
    })).toBe(true);
  });
});

// FLIPPED 2026-09-02: a row carrying paper_kind (every production paper row
// since the metadata migration was applied) is classified by the database
// columns, and the columns WIN over whatever the title says — that is the
// whole point of the flip. Both row shapes reach these helpers: the client's
// camelCase mapped rows and the edge middleware's raw snake_case rows.
describe("database-first paper classification", () => {
  it("reads paperMetadata from the columns and falls back to the title without them", () => {
    expect(paperMetadata({
      title: "JEE Main 2024 Session 1 - 27 January Shift 1",
      paperKind: "question_paper",
      paperYear: 2024,
      examSession: "Session 1",
      examShift: "Shift 1",
    })).toEqual({ year: 2024, session: "Session 1", shift: "Shift 1", kind: "question_paper" });
    // The edge's raw snake_case shape classifies identically.
    expect(paperMetadata({
      title: "JEE Main 2021 Session 4 Final Answer Key (Paper 1 B.E./B.Tech)",
      paper_kind: "answer_key",
      paper_year: 2021,
      exam_session: "Session 4",
      exam_shift: null,
    })).toEqual({ year: 2021, session: "Session 4", shift: null, kind: "answer_key" });
    // No columns: the shared title grammar answers, exactly as before.
    expect(paperMetadata({ title: "JEE Main 2021 Session 4 Final Answer Key" }))
      .toEqual({ year: 2021, session: "Session 4", shift: null, kind: "answer_key" });
  });

  it("trusts paper_kind over a conflicting title when splitting the landing", () => {
    const groups = splitJeeMainPapers([
      // Title says "with solutions", database says answer key: database wins.
      { id: 1, title: "JEE Main 2024 paper with solutions", paperKind: "answer_key" },
      // Snake_case edge row: kind question_paper despite key-ish wording.
      { id: 2, title: "JEE Main 2024 answer key discussion", paper_kind: "question_paper" },
      { id: 3, title: "NSEP 2024-25 Physics Paper with Solutions", paperKind: "paper_with_solutions" },
    ]);
    expect(groups.answerKeys.map(({ id }) => id)).toEqual([1]);
    expect(groups.questionOnly.map(({ id }) => id)).toEqual([2]);
    expect(groups.withSolutions.map(({ id }) => id)).toEqual([3]);
  });

  it("trusts a backfilled row's NULL exam_session as genuinely session-less", () => {
    const groups = groupPapersBySession([
      // The title names a session but the backfilled column says none:
      // the column is the authority for a row that carries paper_kind.
      {
        id: 1,
        title: "JEE Main 2015 Session 1 - Offline Set A",
        paperKind: "question_paper",
        examSession: null,
      },
      {
        id: 2,
        title: "JEE Main 2024 Session 2 - 4 April Shift 1",
        paperKind: "question_paper",
        examSession: "Session 2",
      },
    ], []);
    expect(groups.map((group) => group.session)).toEqual(["Session 2", null]);
    expect(groups[1].papers.map(({ id }) => id)).toEqual([1]);
  });

  it("prefers the paper_year column for year lists, keeping the old fallbacks", () => {
    expect(paperYears([
      { paperYear: 2026, examYear: 2025 },   // column wins over examYear
      { paper_year: 2024 },                   // edge snake_case shape
      { examYear: 2022 },                     // pre-flip row: examYear fallback
      { exam_year: 2021 },                    // pre-flip edge row
      { paperYear: null, exam_year: 2020 },  // null column falls through
      { exam_year: null },
    ])).toEqual([2026, 2024, 2022, 2021, 2020]);
  });
});

// The registry is what makes a sibling exam (NEET UG, JEE Advanced) a data
// change rather than a code change. An exam is registered ONLY once its papers
// are confirmed present in production — a seed file in docs/sql is history,
// not evidence, and registering on the strength of one ships an empty page.
describe("paper landings and their year pages", () => {
  it("registers only exams whose papers this site actually holds", () => {
    // Verified against production 2026-09-02 by title-prefix count on
    // material_type='previous_year_paper': 112 JEE Main, 44 JEE Advanced,
    // 6 NEET, 9 NSEP. NSEP stays unregistered: its season titles
    // ('NSEP 2024-25 …') do not fit a four-digit year page honestly.
    expect(PAPER_LANDINGS.map((landing) => landing.id))
      .toEqual(["jee-main", "jee-advanced", "neet"]);
    expect(findPaperLanding(JEE_MAIN_PAPERS_PATH)).toMatchObject({
      examLabel: "JEE Main",
      titlePattern: "JEE Main%",
      scopeGoal: "jee-main",
      sessionGrammar: true,
    });
    expect(findPaperLanding("/materials/jee-advanced/previous-year-papers")).toMatchObject({
      examLabel: "JEE Advanced",
      titlePattern: "JEE Advanced%",
      scopeGoal: "jee",
      sessionGrammar: false,
    });
    expect(findPaperLanding("/materials/neet/previous-year-papers")).toMatchObject({
      examLabel: "NEET",
      titlePattern: "NEET%",
      scopeGoal: "neet",
      sessionGrammar: false,
    });
    expect(findPaperLanding("/materials/nsep/previous-year-papers")).toBeNull();
  });

  it("says plainly that the NEET collection is partial with no answer keys", () => {
    const neet = findPaperLanding("/materials/neet/previous-year-papers");
    expect(neet.meta.description).toMatch(/partial/i);
    expect(neet.coverageNote).toMatch(/partial/i);
    expect(neet.coverageNote).toMatch(/2024/);
    expect(neet.coverageNote).toMatch(/2026 re-examination/i);
    expect(neet.coverageNote).toMatch(/no official answer keys/i);
  });

  it("keeps the honest JEE Advanced coverage claim to 2007-2026", () => {
    const advanced = findPaperLanding("/materials/jee-advanced/previous-year-papers");
    expect(advanced.meta.title).toContain("2007 to 2026");
    expect(advanced.coverageNote).toContain("2007 to 2026");
  });

  it("claims session-by-session wording only for exams whose titles have sessions", () => {
    const jeeMain = findPaperLanding(JEE_MAIN_PAPERS_PATH);
    const neet = findPaperLanding("/materials/neet/previous-year-papers");
    expect(paperYearMeta(jeeMain, 2024).heading)
      .toBe("JEE Main 2024 papers, session by session");
    expect(paperYearMeta(neet, 2024).heading).toBe("NEET 2024 question papers");
    expect(paperYearMeta(neet, 2024).description).not.toMatch(/session/i);
  });

  it("addresses one exam year as a child of its landing", () => {
    const landing = findPaperLanding(JEE_MAIN_PAPERS_PATH);
    expect(paperYearPath(landing, 2024))
      .toBe("/materials/jee-main/previous-year-papers/2024");
    expect(parsePaperYearPath("/materials/jee-main/previous-year-papers/2024"))
      .toEqual({ landing, year: 2024 });
    expect(parsePaperYearPath("/materials/jee-advanced/previous-year-papers/2013"))
      .toEqual({
        landing: findPaperLanding("/materials/jee-advanced/previous-year-papers"),
        year: 2013,
      });
    expect(parsePaperYearPath("/materials/neet/previous-year-papers/2024"))
      .toEqual({
        landing: findPaperLanding("/materials/neet/previous-year-papers"),
        year: 2024,
      });
  });

  it("refuses a year segment that is not a year, or a landing it does not have", () => {
    for (const path of [
      "/materials/jee-main/previous-year-papers",
      "/materials/jee-main/previous-year-papers/latest",
      "/materials/jee-main/previous-year-papers/20244",
      "/materials/jee-main/previous-year-papers/1899",
      "/materials/nsep/previous-year-papers/2024",
      "/materials/neet-pg/previous-year-papers/2024",
      "",
    ]) {
      expect([path, parsePaperYearPath(path)]).toEqual([path, null]);
    }
  });

  it("lists the years present, newest first, ignoring papers with no year", () => {
    expect(paperYears([
      { exam_year: 2022 },
      { examYear: 2024 },
      { exam_year: 2024 },
      { exam_year: null },
      { exam_year: "not a year" },
    ])).toEqual([2024, 2022]);
  });
});

// The ONE title grammar. The staged migration
// supabase/migrations/20260902093000_study_material_paper_metadata.sql
// backfills paper_kind/paper_year/exam_session/exam_shift with the same
// rules; src/paperMetadataSqlRehearsal.test.js executes that SQL and asserts
// it agrees with this function on the same titles.
describe("parsePaperTitle", () => {
  it("classifies the live-verified production title shapes", () => {
    expect(parsePaperTitle("JEE Main 2024 Session 2 - 4 April Shift 1 (English & Hindi)"))
      .toEqual({ year: 2024, session: "Session 2", shift: "Shift 1", kind: "question_paper" });
    expect(parsePaperTitle("JEE Main 2021 Session 4 Final Answer Key (Paper 1 B.E./B.Tech)"))
      .toEqual({ year: 2021, session: "Session 4", shift: null, kind: "answer_key" });
    expect(parsePaperTitle("JEE Main 2022 Session 1 Provisional Final Answer Key (Paper 1 B.E./B.Tech)"))
      .toEqual({ year: 2022, session: "Session 1", shift: null, kind: "answer_key" });
    expect(parsePaperTitle("JEE Main 2015 - 4 April Offline Set A (English and Hindi)"))
      .toEqual({ year: 2015, session: null, shift: null, kind: "question_paper" });
    expect(parsePaperTitle("JEE Advanced 2013 Paper 1 (English + Hindi)"))
      .toEqual({ year: 2013, session: null, shift: null, kind: "question_paper" });
    expect(parsePaperTitle("NEET UG 2026 Re-Examination - Set 50 (English)"))
      .toEqual({ year: 2026, session: null, shift: null, kind: "question_paper" });
    // NSEP names a season; the first four-digit year is the season's start.
    expect(parsePaperTitle("NSEP 2024-25 Physics Paper with Solutions"))
      .toEqual({ year: 2024, session: null, shift: null, kind: "paper_with_solutions" });
  });

  it("returns nulls rather than guessing when the grammar is absent", () => {
    expect(parsePaperTitle("Physics formula sheet"))
      .toEqual({ year: null, session: null, shift: null, kind: "question_paper" });
    expect(parsePaperTitle(null))
      .toEqual({ year: null, session: null, shift: null, kind: "question_paper" });
  });
});

// Papers are per-shift, official keys per-session, so the session is the
// join. A session with no key gets an EMPTY answerKeys array — the page
// shows nothing for it, never a dead link.
describe("groupPapersBySession", () => {
  const paper = (id, title) => ({ id, title });

  it("pairs each session's papers with that session's answer key", () => {
    const groups = groupPapersBySession(
      [
        paper(1, "JEE Main 2024 Session 2 - 4 April Shift 1 (English & Hindi)"),
        paper(2, "JEE Main 2024 Session 1 - 27 January Shift 1 (English & Hindi)"),
        paper(3, "JEE Main 2024 Session 1 - 27 January Shift 2 (English & Hindi)"),
      ],
      [
        paper(9, "JEE Main 2024 Session 1 Final Answer Key (Paper 1 B.E./B.Tech)"),
      ],
    );
    expect(groups.map((group) => group.session)).toEqual(["Session 1", "Session 2"]);
    expect(groups[0].papers.map(({ id }) => id)).toEqual([2, 3]);
    expect(groups[0].answerKeys.map(({ id }) => id)).toEqual([9]);
    // Session 2 has no key in the loaded data: nothing, not a dead link.
    expect(groups[1].answerKeys).toEqual([]);
  });

  it("keeps session-less exams as one year-level group", () => {
    const groups = groupPapersBySession(
      [
        paper(1, "JEE Advanced 2013 Paper 1 (English + Hindi)"),
        paper(2, "JEE Advanced 2013 Paper 2 (English + Hindi)"),
      ],
      [],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].session).toBeNull();
    expect(groups[0].papers.map(({ id }) => id)).toEqual([1, 2]);
    expect(groups[0].answerKeys).toEqual([]);
  });

  it("orders numbered sessions first and the session-less group last", () => {
    const groups = groupPapersBySession(
      [
        paper(1, "JEE Main 2021 - 24 February Shift 1"),
        paper(2, "JEE Main 2021 Session 4 - 26 August Shift 1"),
        paper(3, "JEE Main 2021 Session 1 - 24 February Shift 2"),
      ],
      [],
    );
    expect(groups.map((group) => group.session))
      .toEqual(["Session 1", "Session 4", null]);
  });
});
