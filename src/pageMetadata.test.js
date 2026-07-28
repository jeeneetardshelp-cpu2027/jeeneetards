import { describe, expect, it } from "vitest";
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

  it("keeps restricted and unavailable routes out of the index", () => {
    expect(metadataForLocation("/admin").robots).toBe("noindex, nofollow");
    expect(metadataForLocation("/admin/").robots).toBe("noindex, nofollow");
    expect(metadataForLocation("/reset").robots).toBe("noindex, nofollow");
    expect(metadataForLocation("/compare").robots).toBe("noindex, follow");
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
    expect(page.description).toContain("Physics course with 12 lessons");
    expect(page.type).toBe("article");
  });
});
