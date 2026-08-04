import { describe, expect, it } from "vitest";
import { buildCourseMetadata } from "./courseMetadata.js";

describe("course metadata", () => {
  it("keeps course identity in otherwise identical snippets", () => {
    const facts = { subject: "Physics", teacher: "ABJ Sir", lectures: 10 };
    const first = buildCourseMetadata({ ...facts, title: "Kinematics" });
    const second = buildCourseMetadata({ ...facts, title: "Laws of Motion" });

    expect(first.description).not.toBe(second.description);
    expect(first.description).toContain("Kinematics");
    expect(second.description).toContain("Laws of Motion");
  });

  it("accepts the edge PostgREST relation shape", () => {
    const metadata = buildCourseMetadata({
      title: "Kinematics",
      subjects: { name: "Physics" },
      playlist_videos: [{ count: 1 }],
    });

    expect(metadata.description).toContain("1 Physics lecture");
    expect(metadata.type).toBe("article");
  });

  it("declines incomplete rows and bounds snippet length", () => {
    expect(buildCourseMetadata(null)).toBeNull();
    const metadata = buildCourseMetadata({ title: "A".repeat(220), lectures: 3 });
    expect(metadata.description.length).toBeLessThanOrEqual(160);
  });
});
