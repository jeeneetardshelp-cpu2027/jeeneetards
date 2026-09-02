// Tests for the one-address rule.
//
// The product failure these guard against: the guided journey and the
// catalogue were two independent result systems, so the same chapter could
// show different courses depending on how you got there.

import { describe, it, expect } from "vitest";
import {
  canonicalBrowseUrl, parseCanonical, sameSelection,
  toClassSlug, classSlugToStage, classSlugToLabel,
  courseSlug, canonicalCoursePath, parseCoursePath,
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

// ---------------------------------------------------------------------------
// A course's own address. The failure these guard against is different from
// the one above: not two systems disagreeing, but a URL that stops working
// because someone renamed a course.
// ---------------------------------------------------------------------------

describe("a course's canonical address", () => {
  it("carries the title as searchable, readable keywords", () => {
    expect(canonicalCoursePath(398, "Rectilinear Motion (Kinematics)"))
      .toBe("/course/398/rectilinear-motion-kinematics");
  });

  it("keeps the id as the only thing that resolves the course", () => {
    // A retitled course: the slug changes, the address still points at 398.
    expect(parseCoursePath("/course/398/rectilinear-motion-kinematics").id).toBe("398");
    expect(parseCoursePath("/course/398/an-old-title-nobody-uses").id).toBe("398");
    expect(parseCoursePath("/course/398").id).toBe("398");
  });

  it("emits only URL-safe ASCII, whatever the title contains", () => {
    for (const title of [
      "Physics — Class 11 (2026) 100% PYQs!",
      "  spaced  out  ",
      "C++ & $199 // tricks",
      "Résumé of Ångström units",
    ]) {
      expect(courseSlug(title)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
    // Accents survive as their base letter rather than vanishing.
    expect(courseSlug("Résumé of Ångström units")).toBe("resume-of-angstrom-units");
  });

  // The deliberate decision, written down: a Devanagari title gets NO slug.
  // Transliterating it would mint a permanent public address from a guess, and
  // percent-encoded Devanagari is more opaque in a WhatsApp message than the
  // bare id it would replace.
  it("falls back to the bare id for a title with no ASCII to slugify", () => {
    expect(courseSlug("कबीर की साखी")).toBe("");
    expect(canonicalCoursePath(212, "कबीर की साखी")).toBe("/course/212");
    expect(canonicalCoursePath(212, null)).toBe("/course/212");
    expect(canonicalCoursePath(212, "   ")).toBe("/course/212");
  });

  it("keeps a mixed-script title's Latin half instead of dropping the course", () => {
    expect(canonicalCoursePath(7, "Class 10 हिंदी")).toBe("/course/7/class-10");
  });

  it("caps the slug and never cuts a word in half", () => {
    const slug = courseSlug(
      "Complete Physics Full Course for JEE Advanced Two Thousand Twenty Six Batch",
    );
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
    // Every retained word is a whole word from the title.
    for (const part of slug.split("-")) {
      expect("complete physics full course for jee advanced two thousand twenty six batch")
        .toContain(part);
    }
  });

  it("refuses a slug that would collide with the chapter sub-route", () => {
    expect(courseSlug("Chapter")).toBe("");
    expect(canonicalCoursePath(5, "Chapter")).toBe("/course/5");
  });

  it("reads every /course shape the site answers", () => {
    expect(parseCoursePath("/course/13")).toEqual({ id: "13", slug: null, chapterId: null });
    expect(parseCoursePath("/course/13/kinematics"))
      .toEqual({ id: "13", slug: "kinematics", chapterId: null });
    expect(parseCoursePath("/course/13/chapter/8"))
      .toEqual({ id: "13", slug: null, chapterId: "8" });
    expect(parseCoursePath("/course/13/kinematics/chapter/8"))
      .toEqual({ id: "13", slug: "kinematics", chapterId: "8" });
    expect(parseCoursePath("/course/13/")).toEqual({ id: "13", slug: null, chapterId: null });
  });

  it("rejects shapes that are not a course at all", () => {
    expect(parseCoursePath("/course/nope")).toBeNull();
    expect(parseCoursePath("/course")).toBeNull();
    expect(parseCoursePath("/course/13/a/b/c")).toBeNull();
    expect(parseCoursePath("/course/13/chapter/nope")).toBeNull();
    // A slug is a stale title, not a payload: cap the accepted space.
    expect(parseCoursePath(`/course/13/${"x".repeat(121)}`)).toBeNull();
  });
});
