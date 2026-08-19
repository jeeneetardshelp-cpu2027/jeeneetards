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

  it("keeps every filtered catalogue variant out of the index", () => {
    const filtered = metadataForLocation(
      "/browse",
      "?goal=jee&class=11&subject=physics&chapter=kinematics",
    );
    expect(filtered.robots).toBe("noindex, follow");
    expect(filtered.canonicalPath).toBe("/browse");
    expect(metadataForLocation("/browse").robots).toBe("index, follow");
  });

  it("keeps restricted routes out, and keeps the unreleased forum unindexed", () => {
    expect(metadataForLocation("/admin").robots).toBe("noindex, nofollow");
    expect(metadataForLocation("/admin/").robots).toBe("noindex, nofollow");
    expect(metadataForLocation("/reset").robots).toBe("noindex, nofollow");
    // The sign-in page is an auth surface, kept out of the index like /reset.
    expect(metadataForLocation("/signin").robots).toBe("noindex, nofollow");
    expect(metadataForLocation("/signin").title).toBe("Sign in | JEENEETARD");
    expect(metadataForLocation("/compare").robots).toBe("noindex, follow");

    // RELEASE_FEATURES.forum is false since 2026-08-10, so every forum path
    // collapses to the "coming soon" metadata and is withheld from the index.
    // Indexing it while production forum_mode() returns "off" was asking Google
    // to rank "Discussions are temporarily unavailable", and a canonical
    // /forum/post/42 for a post that cannot be read.
    for (const path of ["/forum", "/forum/submit", "/forum/post/42"]) {
      const page = metadataForLocation(path);
      expect(page.robots, path).toBe("noindex, follow");
      expect(page.canonicalPath, path).toBe("/forum");
      expect(page.title, path).toBe("Feature coming soon | JEENEETARD");
    }
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
    expect(server.description).toBe(client.description);
    expect(server.description).toContain("Rectilinear Motion (Kinematics)");
    expect(server.description.length).toBeLessThanOrEqual(160);
  });
});
