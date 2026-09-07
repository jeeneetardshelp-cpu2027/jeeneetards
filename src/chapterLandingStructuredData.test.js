// Structured data for the chapter landings.
//
// These are 204 of the 879 URLs in the sitemap and the only surface this site
// has that YouTube does not: every free course covering one chapter, side by
// side. Measured on 2026-09-07, every one of them served ZERO JSON-LD, while
// course pages served six types — so a crawler saw an ordinary page at a URL
// that reads "/browse?goal=jee&class=11&subject=physics&chapter=kinematics".
// Google prints that raw query string in the result unless a BreadcrumbList
// tells it the hierarchy.
//
// The rule these tests exist to hold: every claim comes from the CONFIRMED
// chapter row the title was written from, never from the URL, and the page
// never asserts a list it does not have.

import { describe, expect, it } from "vitest";
import { chapterLandingSchemas } from "../ogInject.js";

const SCOPE = { goal: "jee", board: null, cls: "11", subject: "physics", chapter: "kinematics" };
const CHAPTER = { name: "Kinematics", courseCount: 13 };
const META = {
  title: "Kinematics — 13 free courses for JEE Class 11 Physics | JEENEETARD",
  description: "Compare 13 free YouTube courses covering Kinematics for JEE Class 11 Physics.",
};
const PATH = "/browse?goal=jee&class=11&subject=physics&chapter=kinematics";

const build = (over = {}) => chapterLandingSchemas({
  scope: SCOPE, chapter: CHAPTER, meta: META, canonicalPath: PATH, ...over,
});
const byKey = (out, key) => out.find((s) => s.key === key)?.schema;

describe("what a crawler is told about a chapter page", () => {
  it("emits a breadcrumb and a collection page", () => {
    expect(build().map((s) => s.key)).toEqual(["BreadcrumbList", "CollectionPage"]);
  });

  it("names the hierarchy Google would otherwise print as a query string", () => {
    const crumbs = byKey(build(), "BreadcrumbList").itemListElement;
    expect(crumbs.map((c) => c.name))
      .toEqual(["Home", "Explore", "JEE", "Class 11", "Physics", "Kinematics"]);
    expect(crumbs.map((c) => c.position)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("points every crumb at a real page, absolutised", () => {
    const crumbs = byKey(build(), "BreadcrumbList").itemListElement;
    expect(crumbs.map((c) => c.item)).toEqual([
      "https://www.jeeneetard.com/",
      "https://www.jeeneetard.com/explore",
      "https://www.jeeneetard.com/explore/jee",
      "https://www.jeeneetard.com/explore/jee/class-11",
      "https://www.jeeneetard.com/explore/jee/class-11/physics",
      "https://www.jeeneetard.com" + PATH,
    ]);
  });

  it("describes the page with the same words the page's own title uses", () => {
    // The schema and the <title> disagreeing is how a page starts claiming two
    // different things to two different readers.
    const page = byKey(build(), "CollectionPage");
    expect(page.name).toBe(META.title);
    expect(page.description).toBe(META.description);
    expect(page.url).toBe("https://www.jeeneetard.com" + PATH);
    expect(page.about).toEqual({ "@type": "Thing", name: "Kinematics" });
  });
});

describe("it says how many, and never which", () => {
  it("carries the confirmed count and no item list", () => {
    const page = byKey(build(), "CollectionPage");
    expect(page.mainEntity).toEqual({ "@type": "ItemList", numberOfItems: 13 });
    // The edge does not hold the course titles: the directory fetch runs only
    // for a bare /browse. A chapter-only join is NOT the page's filter --
    // measured, chapter "kinematics" joins 22 distinct courses while this page
    // says 13 -- so an itemListElement here would contradict the title.
    expect(page.mainEntity.itemListElement).toBeUndefined();
    expect(JSON.stringify(build())).not.toContain("itemListElement\":[{\"@type\":\"ListItem\",\"position\":1,\"name\":\"Complete");
  });

  it("omits the count rather than claiming zero when it is unknown", () => {
    const page = byKey(build({ chapter: { name: "Kinematics", courseCount: 0 } }), "CollectionPage");
    expect(page.mainEntity).toBeUndefined();
    expect(page.name).toBe(META.title);
  });
});

describe("the trail stops where the taxonomy actually stops", () => {
  it("goes only as deep as the goal for a board-addressed school chapter", () => {
    // /explore/school/class-10/science 308-redirects back to /explore/school:
    // school is addressed by BOARD, so the deeper path does not exist. A
    // breadcrumb pointing at a redirect misrepresents the hierarchy.
    const crumbs = byKey(build({
      scope: { goal: "school", board: "cbse", cls: "10", subject: "science", chapter: "acids" },
      chapter: { name: "Acids, Bases and Salts", courseCount: 4 },
    }), "BreadcrumbList").itemListElement;
    expect(crumbs.map((c) => c.name))
      .toEqual(["Home", "Explore", "CBSE", "Acids, Bases and Salts"]);
    expect(crumbs.map((c) => c.item)).not.toContain(
      "https://www.jeeneetard.com/explore/school/class-10/science");
  });

  it("uses the board as the label when there is one, as the title does", () => {
    const crumbs = byKey(build({
      scope: { goal: "school", board: "cbse", cls: "10", subject: "science", chapter: "acids" },
      chapter: { name: "Acids", courseCount: 4 },
    }), "BreadcrumbList").itemListElement;
    // "CBSE Class 10 Science" is what a student searches; "School" is not.
    expect(crumbs[2].name).toBe("CBSE");
  });

  it("labels the dropper stage without inventing a class number", () => {
    const crumbs = byKey(build({
      scope: { ...SCOPE, cls: "dropper" },
    }), "BreadcrumbList").itemListElement;
    expect(crumbs.map((c) => c.name))
      .toEqual(["Home", "Explore", "JEE", "Dropper", "Physics", "Kinematics"]);
    expect(crumbs[3].item).toBe("https://www.jeeneetard.com/explore/jee/dropper");
  });
});

describe("it renders nothing rather than something untrue", () => {
  it.each([
    ["no confirmed chapter name", { chapter: { name: "", courseCount: 13 } }],
    ["no chapter at all", { chapter: null }],
    ["no scope", { scope: null }],
    ["no goal", { scope: { ...SCOPE, goal: null } }],
    ["no canonical path", { canonicalPath: null }],
  ])("emits nothing when there is %s", (_label, over) => {
    expect(build(over)).toEqual([]);
  });

  it("never takes the chapter name from the URL slug", () => {
    // The slug is "kinematics"; the confirmed row says "Kinematics". Anything
    // that reads the slug would produce the lowercase form, and a fabricated
    // slug would produce a fabricated name — the soft-404 this whole surface
    // was hardened against earlier.
    const out = build({ chapter: { name: "Rotational Motion", courseCount: 8 } });
    const json = JSON.stringify(out);
    expect(json).toContain("Rotational Motion");
    expect(byKey(out, "CollectionPage").about.name).toBe("Rotational Motion");
  });

  it("escapes nothing into the URL that would break the JSON", () => {
    const out = build({
      canonicalPath: "/browse?goal=jee&class=11&subject=physics&chapter=a-b",
    });
    expect(byKey(out, "CollectionPage").url)
      .toBe("https://www.jeeneetard.com/browse?goal=jee&class=11&subject=physics&chapter=a-b");
  });
});
