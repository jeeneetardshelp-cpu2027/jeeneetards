// Unit tests for the canonical filter model.
//
// Weighted toward the rules that have actually broken in this project:
// strict class membership, explicit Dropper semantics, board isolation,
// impossible exam/stage pairs, and page reset.
//
// Run: npm test
import { describe, it, expect } from "vitest";
import {
  parseFilters, applyFilter, clearAll, toChips, KEYS, DEFAULT_SORT,
  playlistMatchesStage, isStageAvailable, isBoardApplicable, likelyCulprit,
  STAGES_BY_EXAM,
} from "./filterModel.js";
import { playlistMatchesClass } from "./classLevels.js";

const P = (qs = "") => new URLSearchParams(qs);
const parse = (qs) => parseFilters(P(qs));

describe("URL is the state", () => {
  it("round-trips every filter through the query string", () => {
    const qs = "exam=jee&stage=class-11&sub=3&ch=7&lang=hindi,hinglish&type=one-shot" +
               "&level=advanced&dur=5to15h&avg=short&updated=1&complete=1&sort=popular&page=2&q=kine";
    const f = parse(qs);
    expect(f.exam).toBe("jee");
    expect(f.stage).toBe("class-11");
    expect(f.subject).toBe(3);
    expect(f.chapter).toBe(7);
    expect(f.language).toEqual(["hindi", "hinglish"]);
    expect(f.courseType).toEqual(["one-shot"]);
    expect(f.difficulty).toEqual(["advanced"]);
    expect(f.totalDuration).toBe("5to15h");
    expect(f.avgLecture).toBe("short");
    expect(f.updated).toBe(true);
    expect(f.completeOnly).toBe(true);
    expect(f.sort).toBe("popular");
    expect(f.page).toBe(2);
    expect(f.q).toBe("kine");
  });

  it("ignores junk instead of throwing or half-applying it", () => {
    const f = parse("exam=hogwarts&stage=year-9&sub=abc&lang=klingon&sort=nonsense&page=-4");
    expect(f.exam).toBeNull();
    expect(f.stage).toBeNull();
    expect(f.subject).toBeNull();
    expect(f.language).toEqual([]);
    expect(f.sort).toBe(DEFAULT_SORT);
    expect(f.page).toBe(0);
  });
});

describe("impossible combinations (rule 4)", () => {
  it("JEE never offers Class 10", () => {
    expect(isStageAvailable("jee", "class-10")).toBe(false);
    expect(STAGES_BY_EXAM.jee).not.toContain("class-10");
  });

  it("school boards never offer Dropper", () => {
    expect(isStageAvailable("school", "dropper")).toBe(false);
  });

  it("drops an impossible stage on parse rather than filtering to nothing", () => {
    expect(parse("exam=jee&stage=class-10").stage).toBeNull();
    expect(parse("exam=school&stage=dropper").stage).toBeNull();
  });

  it("keeps a stage that IS possible", () => {
    expect(parse("exam=jee&stage=dropper").stage).toBe("dropper");
    expect(parse("exam=school&stage=class-10").stage).toBe("class-10");
  });

  it("clears a now-impossible stage when the exam changes", () => {
    const next = applyFilter(P("exam=school&stage=class-10"), "exam", "jee");
    expect(next.get(KEYS.exam)).toBe("jee");
    expect(next.get(KEYS.stage)).toBeNull();
  });
});

describe("board isolation (rule 7)", () => {
  it("a board applies only to school content", () => {
    expect(isBoardApplicable("school")).toBe(true);
    expect(isBoardApplicable("jee")).toBe(false);
  });

  it("ignores a board carried into a non-school exam", () => {
    expect(parse("exam=jee&board=cbse").board).toBeNull();
    expect(parse("exam=school&board=cbse").board).toBe("cbse");
  });

  it("drops the board when leaving school content", () => {
    const next = applyFilter(P("exam=school&board=icse"), "exam", "neet");
    expect(next.get(KEYS.board)).toBeNull();
  });

  it("CBSE and ICSE are never both selected — switching replaces", () => {
    const next = applyFilter(P("exam=school&board=cbse"), "board", "icse");
    expect(next.get(KEYS.board)).toBe("icse");
    expect(parseFilters(next).board).toBe("icse");
  });
});

describe("strict class membership (rule 5)", () => {
  it("an untagged playlist matches NO stage", () => {
    expect(playlistMatchesStage("class-11", [])).toBe(false);
    expect(playlistMatchesStage("class-11", null)).toBe(false);
    expect(playlistMatchesStage("class-11", undefined)).toBe(false);
  });

  it("matches only its own tag", () => {
    expect(playlistMatchesStage("class-11", ["11th"])).toBe(true);
    expect(playlistMatchesStage("class-12", ["11th"])).toBe(false);
  });

  it("no stage selected means no class filtering at all", () => {
    expect(playlistMatchesStage(null, [])).toBe(true);
  });
});

describe("Dropper is a superset of Class 11 and 12", () => {
  // A dropper is revising BOTH years, so 11th and 12th material is exactly
  // what they need. An earlier version of filterModel.js kept its own copy of
  // this rule that made Dropper strictly non-inheriting — the opposite of
  // classLevels.js — and nothing caught the disagreement. These tests now
  // pin the real behaviour.
  it("includes content tagged 11th, 12th or Dropper", () => {
    expect(playlistMatchesStage("dropper", ["11th"])).toBe(true);
    expect(playlistMatchesStage("dropper", ["12th"])).toBe(true);
    expect(playlistMatchesStage("dropper", ["Dropper"])).toBe(true);
    expect(playlistMatchesStage("dropper", ["11th", "12th"])).toBe(true);
  });

  it("excludes unclassified content", () => {
    expect(playlistMatchesStage("dropper", [])).toBe(false);
    expect(playlistMatchesStage("dropper", null)).toBe(false);
    expect(playlistMatchesStage("dropper", undefined)).toBe(false);
  });

  it("excludes content from a class that is not part of the syllabus", () => {
    expect(playlistMatchesStage("dropper", ["10th"])).toBe(false);
  });

  // The inclusion runs one way only. Dropper is a superset of 11 and 12; the
  // reverse would put Class-12 content in front of a Class 11 student.
  it("does not run in reverse: Class 11 excludes Class-12-only content", () => {
    expect(playlistMatchesStage("class-11", ["12th"])).toBe(false);
    expect(playlistMatchesStage("class-11", ["Dropper"])).toBe(false);
    expect(playlistMatchesStage("class-11", ["11th"])).toBe(true);
  });

  it("a course tagged for both classes is found by both", () => {
    const both = ["11th", "12th"];
    expect(playlistMatchesStage("class-11", both)).toBe(true);
    expect(playlistMatchesStage("class-12", both)).toBe(true);
  });

  it("agrees with classLevels.js, which owns the rule", () => {
    for (const levels of [["11th"], ["12th"], ["Dropper"], ["10th"], []])
      expect(playlistMatchesStage("dropper", levels))
        .toBe(playlistMatchesClass("Dropper", levels));
  });
});

describe("curriculum class does not infer teaching audience", () => {
  // CORRECTION: audience_focus is NOT hypothetical — it is a real playlists
  // column, set by the importer (ImportPlaylistForm.jsx, import_playlist_v2+).
  // An earlier test here asserted it "does not exist", which was simply wrong.
  //
  // What is true is narrower: audience_focus is absent from the STUDENT filter
  // model, and the two concepts must never be conflated. "Made for droppers"
  // is a curated claim about who a course was taught for; Dropper-the-class is
  // a statement about syllabus coverage. A course tagged 11th+12th is findable
  // by a dropper WITHOUT being "made for droppers", and vice versa.
  it("has no student-facing audience filter yet", () => {
    expect(KEYS.audienceFocus).toBeUndefined();
  });

  it("class membership is decided by class tags alone", () => {
    // Same class tags, different audience_focus -> identical class matching.
    const madeForDroppers = { class_levels: ["11th"], audience_focus: "dropper" };
    const ordinary        = { class_levels: ["11th"], audience_focus: null };
    for (const stage of ["class-11", "class-12", "dropper"])
      expect(playlistMatchesStage(stage, madeForDroppers.class_levels))
        .toBe(playlistMatchesStage(stage, ordinary.class_levels));
  });

  it("being 'made for droppers' does not by itself make a course Dropper content", () => {
    // audience_focus says nothing about which classes are covered, so an
    // untagged course stays unmatched no matter what it is marketed as.
    expect(playlistMatchesStage("dropper", [])).toBe(false);
  });
});

describe("page reset (rule 8)", () => {
  it.each(["exam", "stage", "subject", "chapter", "language", "courseType",
           "difficulty", "totalDuration", "avgLecture", "completeOnly", "q"])(
    "changing %s resets the page", (key) => {
      const next = applyFilter(P("page=5"), key, key === "completeOnly" ? true : "jee");
      expect(next.get(KEYS.page)).toBeNull();
    });

  it("changing sort does NOT reset the page — it reorders the same results", () => {
    const next = applyFilter(P("page=5"), "sort", "popular");
    expect(next.get(KEYS.page)).toBe("5");
  });
});

describe("multi-select toggling", () => {
  it("adds then removes without disturbing siblings", () => {
    let p = applyFilter(P(), "language", "hindi");
    p = applyFilter(p, "language", "english");
    expect(parseFilters(p).language).toEqual(["hindi", "english"]);
    p = applyFilter(p, "language", "hindi");
    expect(parseFilters(p).language).toEqual(["english"]);
  });

  it("drops the key entirely when the last value is removed", () => {
    const p = applyFilter(applyFilter(P(), "language", "hindi"), "language", "hindi");
    expect(p.get(KEYS.language)).toBeNull();
  });

  it("single-select toggles off on a second click", () => {
    const p = applyFilter(P("exam=jee"), "exam", "jee");
    expect(p.get(KEYS.exam)).toBeNull();
  });
});

describe("chips (rules 2 and 10)", () => {
  it("produces one removable chip per selection", () => {
    const f = parse("exam=jee&stage=class-11&lang=hindi,english&complete=1");
    const chips = toChips(f);
    expect(chips.map((c) => c.label)).toEqual(
      expect.arrayContaining(["JEE", "Class 11", "Hindi", "English", "Metadata complete"])
    );
  });

  it("uses supplied names for id-based filters, and stays honest without them", () => {
    const f = parse("sub=3&teacher=7");
    expect(toChips(f, { subject: { 3: "Physics" } }).map((c) => c.label))
      .toEqual(["Physics", "Teacher #7"]);   // no invented teacher name
  });

  it("removing a chip removes exactly that value", () => {
    const f = parse("lang=hindi,english");
    const chip = toChips(f).find((c) => c.label === "Hindi");
    expect(parseFilters(applyFilter(P("lang=hindi,english"), chip.key, chip.value)).language)
      .toEqual(["english"]);
  });

  it("Clear all removes every result-changing filter but keeps sort and tab", () => {
    const cleared = clearAll(P("exam=jee&stage=class-11&lang=hindi&page=4&sort=popular&tab=lectures"));
    const f = parseFilters(cleared);
    expect(f.exam).toBeNull();
    expect(f.stage).toBeNull();
    expect(f.language).toEqual([]);
    expect(f.page).toBe(0);
    expect(f.sort).toBe("popular");
    expect(f.tab).toBe("lectures");
  });
});

describe("honest empty state (rule 14)", () => {
  it("names the most restrictive active filter", () => {
    expect(likelyCulprit(parse("exam=jee&sub=3&ch=7"))).toBe("chapter");
    expect(likelyCulprit(parse("exam=jee&sub=3"))).toBe("subject");
    expect(likelyCulprit(parse("exam=jee"))).toBe("exam");
  });

  it("returns null when nothing is filtered", () => {
    expect(likelyCulprit(parse(""))).toBeNull();
  });
});
