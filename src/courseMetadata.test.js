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
      teacher: "ABJ Sir",
      subjects: { name: "Physics" },
      institutes_channels: { name: "Mohit Tyagi" },
      playlist_videos: [{ count: 1 }],
    });

    expect(metadata.title).toBe("Kinematics by ABJ Sir | JEENEETARD");
    expect(metadata.description).toContain("1 Physics lecture");
    expect(metadata.description).toContain("by ABJ Sir from Mohit Tyagi");
    expect(metadata.type).toBe("article");
  });

  it("distinguishes same-topic courses by teacher or institute", () => {
    const first = buildCourseMetadata({
      title: "Friction", teacher: "ABJ Sir", institute: "Mohit Tyagi",
    });
    const second = buildCourseMetadata({
      title: "Friction", teacher: "Mahendra Singh", institute: "Unacademy NEET",
    });
    const teacherMissing = buildCourseMetadata({
      title: "Friction", institute: "Aakash NEET",
    });

    expect(first.title).toBe("Friction by ABJ Sir | JEENEETARD");
    expect(second.title).toBe("Friction by Mahendra Singh | JEENEETARD");
    expect(teacherMissing.title).toBe("Friction by Aakash NEET | JEENEETARD");
    expect(new Set([first.title, second.title, teacherMissing.title])).toHaveLength(3);
    expect(teacherMissing.description).toContain("from Aakash NEET");
  });

  it("declines incomplete rows and bounds snippet length", () => {
    expect(buildCourseMetadata(null)).toBeNull();
    const metadata = buildCourseMetadata({ title: "A".repeat(220), lectures: 3 });
    expect(metadata.description.length).toBeLessThanOrEqual(160);
  });
});
