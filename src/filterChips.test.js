// Filter-chip dependency rules.
//
// The curriculum is a hierarchy, so a removal has to cascade DOWN and must
// never touch anything above or beside it. Getting this wrong produces URLs
// like ?chapter=kinematics with no subject, which either returns nothing or
// returns a same-named chapter from another subject.

import { describe, it, expect } from "vitest";
import {
  buildChips, removeChip, clearAllChips, CHIP_ORDER, dropParam, emptyStateMessage, scopeLevel, scopeName,
} from "./filterChips.js";

const P = (qs) => new URLSearchParams(qs);
const FULL = "goal=jee&class=11&subject=physics&chapter=kinematics";
const NAMES = {
  goal: { jee: "JEE" }, subject: { physics: "Physics" },
  chapter: { kinematics: "Kinematics" },
};
const keysOf = (p) => CHIP_ORDER.filter((k) => p.get(k));

describe("what the chips say", () => {
  it("renders the row from the phase description, in curriculum order", () => {
    expect(buildChips(P(FULL), NAMES).map((c) => c.label))
      .toEqual(["JEE", "Class 11", "Physics", "Kinematics"]);
  });

  it("shows no chips when nothing is filtered", () => {
    expect(buildChips(P(""), NAMES)).toEqual([]);
  });

  it("labels Dropper and each class correctly", () => {
    expect(buildChips(P("class=dropper")).map((c) => c.label)).toEqual(["Dropper"]);
    expect(buildChips(P("class=12")).map((c) => c.label)).toEqual(["Class 12"]);
    expect(buildChips(P("class=class-11")).map((c) => c.label)).toEqual(["Class 11"]);
    expect(buildChips(P("class=11th")).map((c) => c.label)).toEqual(["Class 11"]);
  });

  it("falls back to the raw value rather than inventing a name", () => {
    // A chip reading "Physics" for a slug we could not resolve would misstate
    // what is being filtered.
    expect(buildChips(P("subject=biology"), NAMES).map((c) => c.label)).toEqual(["biology"]);
  });

  it("renders chips for legacy id-based links too", () => {
    expect(buildChips(P("goal=3&sub=5&ch=7")).map((c) => c.value)).toEqual(["3", "5", "7"]);
  });
});

describe("the dependency cascade", () => {
  it("removing Kinematics keeps Physics", () => {
    const next = removeChip(P(FULL), "chapter");
    expect(keysOf(next)).toEqual(["goal", "class", "subject"]);
    expect(next.get("subject")).toBe("physics");
  });

  it("removing Physics also removes Kinematics", () => {
    const next = removeChip(P(FULL), "subject");
    expect(keysOf(next)).toEqual(["goal", "class"]);
    expect(next.get("chapter")).toBeNull();
  });

  it("removing JEE clears class, subject and chapter", () => {
    const next = removeChip(P(FULL), "goal");
    expect(keysOf(next)).toEqual([]);
  });

  it("removing the class touches nothing else — class is orthogonal", () => {
    const next = removeChip(P(FULL), "class");
    expect(keysOf(next)).toEqual(["goal", "subject", "chapter"]);
  });

  it("removing the board leaves the curriculum intact", () => {
    const next = removeChip(P("goal=school&board=cbse&class=10&subject=physics"), "board");
    expect(next.get("board")).toBeNull();
    expect(next.get("subject")).toBe("physics");
    expect(next.get("goal")).toBe("school");
  });

  it("clears legacy aliases too, or the old key keeps filtering", () => {
    const next = removeChip(P("goal=jee&sub=5&ch=7"), "subject");
    expect(next.get("sub")).toBeNull();
    expect(next.get("ch")).toBeNull();
  });

  it("any removal resets paging", () => {
    expect(removeChip(P(FULL + "&page=4"), "chapter").get("page")).toBeNull();
  });
});

describe("clear all", () => {
  it("removes every curriculum filter and the search term", () => {
    const next = clearAllChips(P(FULL + "&q=motion"));
    expect(keysOf(next)).toEqual([]);
    expect(next.get("q")).toBeNull();
  });

  it("PRESERVES non-filter state that survives without a chapter", () => {
    const next = clearAllChips(P(FULL + "&sort=popular&tab=lectures"));
    expect(next.get("sort")).toBe("popular");
    expect(next.get("tab")).toBe("lectures");
  });

  it("DROPS the comparison, which cannot outlive its chapter", () => {
    // Clear All always removes the chapter, so a surviving tray would point at
    // a chapter no longer in context and Compare would reject its own link.
    const next = clearAllChips(P(FULL + "&compare=1,2"));
    expect(next.get("chapter")).toBeNull();
    expect(next.get("compare")).toBeNull();
  });
});

describe("chips stay URL-backed", () => {
  it("every removal returns URLSearchParams, never mutated state", () => {
    const before = P(FULL);
    const after = removeChip(before, "chapter");
    expect(after).toBeInstanceOf(URLSearchParams);
    expect(before.get("chapter")).toBe("kinematics");   // input untouched
  });

  it("a removal round-trips through buildChips", () => {
    const next = removeChip(P(FULL), "subject");
    expect(buildChips(next, NAMES).map((c) => c.label)).toEqual(["JEE", "Class 11"]);
  });
});

describe("contextual empty state", () => {
  it("names the class AND the chapter", () => {
    expect(emptyStateMessage({ stage: "class-12", chapterName: "Kinematics" }).title)
      .toBe("No Class 12 courses are classified for Kinematics yet.");
  });

  it("says 'classified', not 'none exist' — untagged is a metadata gap", () => {
    const m = emptyStateMessage({ stage: "class-12", chapterName: "Kinematics" });
    expect(m.detail).toMatch(/without a class tag are not shown/i);
    expect(m.title).not.toMatch(/no courses exist|there are no/i);
  });

  it("falls back to the subject when there is no chapter", () => {
    expect(emptyStateMessage({ stage: "dropper", subjectName: "Physics" }).title)
      .toBe("No Dropper courses are classified for Physics yet.");
  });

  it("handles class-only and chapter-only views", () => {
    expect(emptyStateMessage({ stage: "class-11" }).title)
      .toBe("No Class 11 courses are classified yet.");
    expect(emptyStateMessage({ chapterName: "Friction" }).title)
      .toBe("No courses are listed for Friction yet.");
  });

  it("never returns a bare count", () => {
    for (const args of [{}, { stage: "class-12" }, { chapterName: "X" }]) {
      const m = emptyStateMessage(args);
      expect(m.title).not.toMatch(/^0 courses/);
      expect(m.title.length).toBeGreaterThan(10);
      expect(m.detail).toBeTruthy();
    }
  });
});

// Names alone cannot tell "no chapter filter" from "a chapter filter whose name
// has not arrived". Measured on /browse?sub=1&ch=7&type=pyq with the
// chapter-name lookups pending: the box under "Filtered courses" read "No
// courses are listed for Physics yet." while /browse?sub=1&type=pyq listed 6
// courses, and flipped to "...for Friction yet." when the name landed. So the
// caller says which level is active, and the helper names that level or nothing.
describe("the most specific curriculum level names the view, or nothing does", () => {
  it("finds the narrowest level in the URL, legacy keys included", () => {
    expect(scopeLevel(P(FULL))).toBe("chapter");
    expect(scopeLevel(P("sub=1&ch=7&type=pyq"))).toBe("chapter");
    expect(scopeLevel(P("goal=jee&class=11&subject=physics"))).toBe("subject");
    expect(scopeLevel(P("goal=3&sub=5"))).toBe("subject");
    expect(scopeLevel(P("goal=jee&class=11"))).toBe("class");
    expect(scopeLevel(P("goal=jee&stage=12"))).toBe("class");
    expect(scopeLevel(P("goal=school&board=cbse"))).toBe("board");
    expect(scopeLevel(P("goal=jee"))).toBe("goal");
  });

  it("ignores filters that are not a curriculum level", () => {
    expect(scopeLevel(P(""))).toBeNull();
    expect(scopeLevel(P("channel=3&language=hindi&type=full-course&teacher=7&q=torque&sort=rating&tab=lectures"))).toBeNull();
  });

  it("names the active level when its name is known", () => {
    const names = { goalName: "JEE", subjectName: "Physics", chapterName: "Friction" };
    expect(scopeName({ scope: "chapter", ...names })).toBe("Friction");
    expect(scopeName({ scope: "subject", ...names })).toBe("Physics");
    expect(scopeName({ scope: "goal", ...names })).toBe("JEE");
  });

  it("never borrows a wider level's name while the active one is unknown", () => {
    expect(scopeName({ scope: "chapter", goalName: "JEE", subjectName: "Physics" })).toBeNull();
    expect(scopeName({ scope: "subject", goalName: "JEE" })).toBeNull();
    // A class or board narrows the exam: its name must not head the result.
    expect(scopeName({ scope: "class", goalName: "JEE" })).toBeNull();
    expect(scopeName({ scope: "board", goalName: "School" })).toBeNull();
    expect(scopeName({ scope: null, goalName: "JEE" })).toBeNull();
  });
});

describe("the empty state obeys the same scope", () => {
  it("does not name the subject over a chapter whose name is unknown", () => {
    const m = emptyStateMessage({ scope: "chapter", subjectName: "Physics" });
    expect(m.title).not.toMatch(/Physics/);
    expect(m.title).toBe("No courses match this view.");
  });

  it("names the chapter once its name is known", () => {
    expect(emptyStateMessage({ scope: "chapter", subjectName: "Physics", chapterName: "Friction" }).title)
      .toBe("No courses are listed for Friction yet.");
  });

  it("keeps the class wording but names nothing when the chapter is unknown", () => {
    const m = emptyStateMessage({ scope: "chapter", stage: "class-11", subjectName: "Physics" });
    expect(m.title).toBe("No Class 11 courses match this view.");
    // Not "No Class 11 courses are classified yet.": that is a claim about the
    // whole class, wider than one chapter's results.
    expect(m.title).not.toMatch(/classified yet/);
    expect(m.detail).toMatch(/without a class tag are not shown/i);
  });

  it("the same for a subject whose name is unknown", () => {
    expect(emptyStateMessage({ scope: "subject", stage: "class-11" }).title)
      .toBe("No Class 11 courses match this view.");
    expect(emptyStateMessage({ scope: "subject" }).title).toBe("No courses match this view.");
  });

  // The existing "falls back to the subject when there is no chapter" case, with
  // the caller saying so: no chapter filter is active, the subject is the view.
  it("still names the subject when the subject is the active level", () => {
    expect(emptyStateMessage({ scope: "subject", stage: "dropper", subjectName: "Physics" }).title)
      .toBe("No Dropper courses are classified for Physics yet.");
    expect(emptyStateMessage({ scope: "subject", subjectName: "Physics" }).title)
      .toBe("No courses are listed for Physics yet.");
  });

  it("a class that is the active level keeps its own sentence", () => {
    expect(emptyStateMessage({ scope: "class", stage: "class-11" }).title)
      .toBe("No Class 11 courses are classified yet.");
  });

  it("never names the exam", () => {
    expect(emptyStateMessage({ scope: "goal" }).title).toBe("No courses match this view.");
  });
});

describe("empty-state escape hatches widen one axis only", () => {
  it("'View all classes' drops the class but keeps the chapter", () => {
    const next = dropParam(P("goal=jee&class=12&subject=physics&chapter=kinematics"), ["class", "stage"]);
    expect(next.get("class")).toBeNull();
    expect(next.get("chapter")).toBe("kinematics");
    expect(next.get("subject")).toBe("physics");
  });

  it("'Choose another chapter' drops the chapter but keeps the class", () => {
    const next = dropParam(P("goal=jee&class=12&subject=physics&chapter=kinematics"), ["chapter", "ch"]);
    expect(next.get("chapter")).toBeNull();
    expect(next.get("class")).toBe("12");
  });

  it("resets paging so the widened view starts at page 1", () => {
    expect(dropParam(P("class=12&page=3"), ["class"]).get("page")).toBeNull();
  });
});
