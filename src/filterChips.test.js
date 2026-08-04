// Filter-chip dependency rules.
//
// The curriculum is a hierarchy, so a removal has to cascade DOWN and must
// never touch anything above or beside it. Getting this wrong produces URLs
// like ?chapter=kinematics with no subject, which either returns nothing or
// returns a same-named chapter from another subject.

import { describe, it, expect } from "vitest";
import { buildChips, removeChip, clearAllChips, CHIP_ORDER, dropParam, emptyStateMessage } from "./filterChips.js";

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

  it("shows a channel name instead of its internal database id", () => {
    expect(buildChips(P("channel=136"), {
      channel: { 136: "Aakash NEET" },
    }).map((c) => c.label)).toEqual(["Aakash NEET"]);
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
