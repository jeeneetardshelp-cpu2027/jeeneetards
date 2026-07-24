// Tests for the one-address rule.
//
// The product failure these guard against: the guided journey and the
// catalogue were two independent result systems, so the same chapter could
// show different courses depending on how you got there.

import { describe, it, expect } from "vitest";
import {
  canonicalBrowseUrl, parseCanonical, sameSelection,
  toClassSlug, classSlugToStage, classSlugToLabel,
} from "./canonicalUrl.js";

const P = (qs) => new URLSearchParams(qs);

describe("the canonical address", () => {
  it("is exactly the shape the product specifies", () => {
    expect(canonicalBrowseUrl({
      goal: "jee", cls: "class-11", subject: "physics", chapter: "kinematics",
    })).toBe("/browse?goal=jee&class=11&subject=physics&chapter=kinematics");
  });

  it("emits parts in a stable order, so the same selection is the same URL", () => {
    const a = canonicalBrowseUrl({ goal: "jee", cls: "11", subject: "physics" });
    const b = canonicalBrowseUrl({ subject: "physics", goal: "jee", cls: "class-11" });
    expect(a).toBe(b);
  });

  it("omits parts that were not chosen", () => {
    expect(canonicalBrowseUrl({ goal: "jee" })).toBe("/browse?goal=jee");
    expect(canonicalBrowseUrl({})).toBe("/browse");
  });

  it("carries the board for school content", () => {
    expect(canonicalBrowseUrl({ goal: "school", board: "cbse", cls: "class-10" }))
      .toBe("/browse?goal=school&class=10&board=cbse");
  });
});

describe("class slugs", () => {
  it("normalises every form the app uses to the short one", () => {
    for (const v of ["class-11", "11", "11th", "Class 11"]) expect(toClassSlug(v)).toBe("11");
    expect(toClassSlug("dropper")).toBe("dropper");
  });

  it("round-trips back to the stage id and the stored label", () => {
    expect(classSlugToStage("11")).toBe("class-11");
    expect(classSlugToLabel("11")).toBe("11th");
    expect(classSlugToLabel("dropper")).toBe("Dropper");
  });

  it("rejects a class that does not exist", () => {
    expect(toClassSlug("9")).toBeNull();
    expect(classSlugToStage("9")).toBeNull();
  });
});

describe("guided selection and a Browse URL produce identical results", () => {
  // The guided journey ends by building this URL; a student may also type or
  // share it. Both must describe the same selection.
  const guided = canonicalBrowseUrl({
    goal: "jee", cls: "class-11", subject: "physics", chapter: "kinematics",
  });
  const typed = "/browse?goal=jee&class=11&subject=physics&chapter=kinematics";

  it("produces byte-identical URLs", () => {
    expect(guided).toBe(typed);
  });

  it("parses to the same selection", () => {
    const g = parseCanonical(P(guided.split("?")[1]));
    const t = parseCanonical(P(typed.split("?")[1]));
    expect(g).toEqual(t);
    expect(g.goal.slug).toBe("jee");
    expect(g.subject.slug).toBe("physics");
    expect(g.chapter.slug).toBe("kinematics");
    expect(g.stage).toBe("class-11");
  });

  it("treats a differently-ordered URL as the same selection", () => {
    expect(sameSelection(typed, "/browse?chapter=kinematics&subject=physics&class=11&goal=jee"))
      .toBe(true);
  });

  it("does NOT treat a different chapter as the same selection", () => {
    expect(sameSelection(typed, "/browse?goal=jee&class=11&subject=physics&chapter=laws-of-motion"))
      .toBe(false);
  });
});

describe("legacy id links keep working", () => {
  it("accepts the old id-based keys", () => {
    const c = parseCanonical(P("goal=3&sub=5&ch=7"));
    expect(c.goal.id).toBe(3);
    expect(c.subject.id).toBe(5);
    expect(c.chapter.id).toBe(7);
    expect(c.subject.slug).toBeNull();
  });

  it("distinguishes an id from a slug so the resolver knows what to look up", () => {
    const c = parseCanonical(P("subject=physics&chapter=7"));
    expect(c.subject.slug).toBe("physics");
    expect(c.subject.id).toBeNull();
    expect(c.chapter.id).toBe(7);
    expect(c.chapter.slug).toBeNull();
  });

  it("prefers the canonical key when both are present", () => {
    expect(parseCanonical(P("subject=physics&sub=5")).subject.slug).toBe("physics");
  });

  it("ignores junk instead of half-applying it", () => {
    const c = parseCanonical(P("goal=&subject=&class=hogwarts"));
    expect(c.goal.raw).toBeNull();
    expect(c.classSlug).toBeNull();
    expect(c.stage).toBeNull();
  });
});
