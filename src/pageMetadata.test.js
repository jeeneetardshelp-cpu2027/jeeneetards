import { describe, expect, it } from "vitest";
import { courseMeta } from "../ogInject.js";
import {
  DEFAULT_DESCRIPTION,
  metadataForCourse,
  metadataForLocation,
  readablePathSegment,
} from "./pageMetadata.js";

describe("public page metadata", () => {
  it("describes the browse-only release without promising disabled features", () => {
    const home = metadataForLocation("/");
    expect(home.description).toBe(DEFAULT_DESCRIPTION);
    expect(home.description.toLowerCase()).not.toContain("compare");
    expect(home.description.toLowerCase()).not.toContain("faculty");
  });

  it("gives the three indexable discovery landings distinct descriptions", () => {
    const home = metadataForLocation("/").description;
    const browse = metadataForLocation("/browse").description;
    const explore = metadataForLocation("/explore").description;

    expect(new Set([home, browse, explore])).toHaveLength(3);
    expect(browse).toContain("catalogue");
    expect(explore).toContain("JEE, NEET, Olympiad or School Boards");
  });

  it("publishes indexable metadata for the curation methodology", () => {
    const page = metadataForLocation("/methodology");
    expect(page.title).toBe("How courses are curated | JEENEETARD");
    expect(page.description).toContain("what verified means");
    expect(page.robots).toBe("index, follow");
    expect(page.canonicalPath).toBe("/methodology");
  });

  it("creates readable, route-specific explore metadata", () => {
    expect(readablePathSegment("jee")).toBe("JEE");
    expect(readablePathSegment("class-12")).toBe("Class 12");

    const page = metadataForLocation("/explore/jee/class-12/physics");
    expect(page.title).toBe(
      "Explore JEE Class 12 Physics courses | JEENEETARD",
    );
    expect(page.canonicalPath).toBe("/explore/jee/class-12/physics");
    expect(page.robots).toBe("index, follow");
  });

  it("keeps catalogue searches out of the index and off the canonical URL", () => {
    const page = metadataForLocation("/browse", "?q=kinematics");
    expect(page.robots).toBe("noindex, follow");
    expect(page.canonicalPath).toBe("/browse");
    expect(page.title).toBe("Browse free courses | JEENEETARD");
  });

  // The chapter view is the ONE filtered shape that earns its own identity.
  // Collapsing it too meant all 249 populated chapters shared a single
  // canonical and a single title, so the only screen this site has that YouTube
  // does not — every course on a chapter, side by side — could not be found in
  // a search engine.
  it("gives the canonical chapter view its own title and canonical", () => {
    // The third argument is the catalogue confirming this chapter exists. A
    // URL cannot prove that, so without it the page is never indexable — see
    // the fabricated-slug case below.
    const chapter = metadataForLocation(
      "/browse",
      "?goal=jee&class=11&subject=physics&chapter=kinematics",
      { chapterName: "Kinematics", courseCount: 13 },
    );
    expect(chapter.robots).toBe("index, follow");
    expect(chapter.canonicalPath)
      .toBe("/browse?goal=jee&class=11&subject=physics&chapter=kinematics");
    // The count is the differentiator, and it is only sayable because the
    // caller confirmed it. Every indexed chapter URL shipped the count-less
    // form until the edge started passing the row it had already fetched.
    expect(chapter.title)
      .toBe("Kinematics — 13 free courses for JEE Class 11 Physics | JEENEETARD");
  });

  it("refuses to index a chapter nobody has confirmed exists", () => {
    // Anyone could otherwise mint unlimited indexable soft-404s by inventing a
    // slug — measured live on production before this fix.
    const fabricated = metadataForLocation(
      "/browse", "?goal=banana&class=11&subject=physics&chapter=not-a-real-chapter-xyz");
    expect(fabricated.robots).toBe("noindex, follow");
  });

  it("keeps every OTHER filtered catalogue variant out of the index", () => {
    // The exception above is exact, which is what keeps the faceted URL space
    // finite: a chapter plus anything else is a facet, and facets are endless.
    for (const query of [
      "?goal=jee&class=11&subject=physics",
      "?goal=jee&class=11&subject=physics&chapter=kinematics&page=2",
      "?goal=jee&class=11&subject=physics&chapter=kinematics&sort=rating",
      "?goal=jee&class=11&subject=physics&chapter=kinematics&tab=lectures",
      "?chapter=kinematics",
      "?q=friction",
    ]) {
      const filtered = metadataForLocation("/browse", query);
      expect(filtered.robots, query).toBe("noindex, follow");
      expect(filtered.canonicalPath, query).toBe("/browse");
    }
    expect(metadataForLocation("/browse").robots).toBe("index, follow");
  });

  it("gives the JEE Main paper collection its own indexable search result", () => {
    const page = metadataForLocation("/materials/jee-main/previous-year-papers");
    expect(page.title).toBe(
      "JEE Main papers, official answer keys and solutions | JEENEETARD",
    );
    expect(page.description).toContain("official answer keys");
    expect(page.canonicalPath).toBe("/materials/jee-main/previous-year-papers");
    expect(page.robots).toBe("index, follow");
  });

  // The sibling landings read the same registry, with honest coverage
  // wording: NEET says PARTIAL rather than implying completeness.
  it("gives the JEE Advanced and NEET paper collections registry-driven results", () => {
    const advanced = metadataForLocation("/materials/jee-advanced/previous-year-papers");
    expect(advanced.title).toBe(
      "JEE Advanced question papers by year, 2007 to 2026 | JEENEETARD",
    );
    expect(advanced.canonicalPath).toBe("/materials/jee-advanced/previous-year-papers");
    expect(advanced.robots).toBe("index, follow");

    const neet = metadataForLocation("/materials/neet/previous-year-papers");
    expect(neet.title).toBe(
      "NEET question papers: 2024 and the 2026 re-exam | JEENEETARD",
    );
    expect(neet.description).toMatch(/partial/i);
    expect(neet.canonicalPath).toBe("/materials/neet/previous-year-papers");
    expect(neet.robots).toBe("index, follow");
  });

  it("gives each exam year its own self-canonical search result", () => {
    const page = metadataForLocation("/materials/jee-main/previous-year-papers/2024");
    expect(page.title).toBe(
      "JEE Main 2024 question papers, session by session | JEENEETARD",
    );
    expect(page.description).toContain("JEE Main 2024");
    expect(page.canonicalPath).toBe("/materials/jee-main/previous-year-papers/2024");
    expect(page.robots).toBe("index, follow");

    // No "session by session" claim for exams whose titles have no sessions.
    const neetYear = metadataForLocation("/materials/neet/previous-year-papers/2024");
    expect(neetYear.title).toBe("NEET 2024 question papers | JEENEETARD");
    expect(neetYear.description).not.toMatch(/session/i);
    expect(neetYear.canonicalPath).toBe("/materials/neet/previous-year-papers/2024");
  });

  it.each([
    // Not a four-digit year.
    "/materials/jee-main/previous-year-papers/20244",
    "/materials/jee-main/previous-year-papers/latest",
    // No landing is registered for these exams, so there is no such page.
    "/materials/neet-pg/previous-year-papers/2024",
    "/materials/nsep/previous-year-papers/2024",
  ])("treats the invented paper URL %s as a 404, not a year page", (path) => {
    const page = metadataForLocation(path);
    expect(page.title).toBe("Page not found | JEENEETARD");
    expect(page.robots).toBe("noindex, nofollow");
  });

  it("keeps restricted routes out and publishes only readable forum routes", () => {
    expect(metadataForLocation("/admin").robots).toBe("noindex, nofollow");
    expect(metadataForLocation("/admin/").robots).toBe("noindex, nofollow");
    expect(metadataForLocation("/reset").robots).toBe("noindex, nofollow");
    // The sign-in page is an auth surface, kept out of the index like /reset.
    expect(metadataForLocation("/signin").robots).toBe("noindex, nofollow");
    expect(metadataForLocation("/signin").title).toBe("Sign in | JEENEETARD");
    expect(metadataForLocation("/forum/username").robots).toBe("noindex, nofollow");
    expect(metadataForLocation("/forum/username").title).toBe("Forum username | JEENEETARD");
    expect(metadataForLocation("/compare").robots).toBe("noindex, follow");

    expect(metadataForLocation("/forum")).toMatchObject({
      robots: "index, follow",
      canonicalPath: "/forum",
      title: "Student preparation forum | JEENEETARD",
    });
    expect(metadataForLocation("/forum/post/42")).toMatchObject({
      robots: "index, follow",
      canonicalPath: "/forum/post/42",
      type: "article",
    });
    expect(metadataForLocation("/forum/submit").robots).toBe("noindex, follow");
    expect(metadataForLocation("/forum", "?q=kinematics").robots).toBe("noindex, follow");
  });

  it("treats the legacy /chapter redirect as supported, not as a 404", () => {
    const page = metadataForLocation("/chapter/123");
    expect(page.robots).toBe("noindex, follow");
    expect(page.title).not.toContain("not found");
  });

  it("keeps unknown URLs out of the index instead of claiming the homepage", () => {
    const page = metadataForLocation("/no-such-page");
    expect(page.title).toBe("Page not found | JEENEETARD");
    expect(page.robots).toBe("noindex, nofollow");
    // Self-referential, NOT "/" — a bad URL claiming the homepage as its
    // canonical is exactly the soft-404 signal this exists to remove.
    expect(page.canonicalPath).toBe("/no-such-page");
  });

  it("publishes route-specific metadata for enabled faculty profiles", () => {
    const page = metadataForLocation("/faculty/amit-bijarnia");
    expect(page.title).toBe(
      "Amit Bijarnia faculty profile | JEENEETARD",
    );
    expect(page.description).toContain("courses taught by Amit Bijarnia");
    expect(page.robots).toBe("index, follow");
    expect(page.type).toBe("profile");
  });

  it("publishes the faculty directory but keeps filtered variants out of the index", () => {
    const directory = metadataForLocation("/faculty");
    expect(directory.title).toBe("JEE, NEET and board exam faculty | JEENEETARD");
    expect(directory.description).toContain("verified name or alias");
    expect(directory.robots).toBe("index, follow");
    expect(directory.canonicalPath).toBe("/faculty");

    const filtered = metadataForLocation("/faculty", "?goal=jee&subject=physics");
    expect(filtered.robots).toBe("noindex, follow");
    expect(filtered.canonicalPath).toBe("/faculty");
  });

  it("uses loaded course data when a course finishes loading", () => {
    const page = metadataForCourse({
      title: "Rectilinear Motion (Kinematics)",
      subject: "Physics",
      lectures: 12,
    });
    expect(page.title).toBe(
      "Rectilinear Motion (Kinematics) | JEENEETARD",
    );
    expect(page.description).toContain("12 Physics lectures");
    expect(page.type).toBe("article");
  });

  it("keeps server and hydrated course snippets identical and title-specific", () => {
    const server = courseMeta({
      title: "Rectilinear Motion (Kinematics)",
      teacher: "ABJ Sir",
      subjects: { name: "Physics" },
      playlist_videos: [{ count: 12 }],
    }, 5);
    const client = metadataForCourse({
      title: "Rectilinear Motion (Kinematics)",
      teacher: "ABJ Sir",
      subject: "Physics",
      lectures: 12,
    });

    expect(server.title).toBe(client.title);
    expect(server.title).toBe(
      "Rectilinear Motion (Kinematics) by ABJ Sir | JEENEETARD",
    );
    expect(server.description).toBe(client.description);
    expect(server.description).toContain("Rectilinear Motion (Kinematics)");
    expect(server.description.length).toBeLessThanOrEqual(160);
  });
});
