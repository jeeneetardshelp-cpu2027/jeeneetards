// Reporting a problem must stay available on every lesson.
//
// Audit finding (docs/audit_2026-07-31.md): VideoReport was mounted at an
// invariant tree position with no `key`. Switching lessons only rewrites the
// `?v=` query string, so App.jsx's `key={pathname}` does not change and React
// re-renders rather than remounts — preserving VideoReport's hooks state.
// After one successful report, its terminal "Thanks" state stuck for the whole
// course: every OTHER lesson showed a confirmation it never earned, and the
// "Report an issue" button disappeared entirely until a full page reload. On a
// site used by minors, losing the ability to flag inappropriate content after
// a single report is a safety dead end. A half-typed note also survived the
// switch and would have been filed against the wrong lesson.
//
// This asserts the fix at the seam that actually caused it: the element handed
// to VideoView must carry a per-lesson key, so React remounts it.
import { describe, expect, it } from "vitest";
import { isValidElement } from "react";

// A minimal stand-in for what CourseVideoPage builds for `reportSlot`, so the
// assertion is about the prop contract rather than a full page render (which
// would need the whole Supabase/router/player stack mocked).
function reportSlotFor(lesson) {
  return (
    <MockVideoReport key={lesson.id} videoId={lesson.id} videoTitle={lesson.title} />
  );
}
function MockVideoReport() { return null; }

describe("the report control is scoped to one lesson", () => {
  it("gives each lesson's report slot a distinct React key", () => {
    const a = reportSlotFor({ id: 101, title: "Lesson 3" });
    const b = reportSlotFor({ id: 102, title: "Lesson 4" });
    expect(isValidElement(a)).toBe(true);
    expect(a.key).not.toBe(b.key);
    expect(a.key).toBe("101");
    expect(b.key).toBe("102");
  });

  it("keys on the lesson id, not on its title (two lessons can share a title)", () => {
    const a = reportSlotFor({ id: 101, title: "Revision" });
    const b = reportSlotFor({ id: 205, title: "Revision" });
    expect(a.key).not.toBe(b.key);
  });
});

describe("CourseVideoPage wires the report slot with a key", () => {
  it("passes key={activeLesson.id} to VideoReport", async () => {
    // Source-level assertion: the defect was invisible at runtime in every
    // existing test because they all mock VideoReport away entirely
    // (watchPage.test.jsx:90 renders it as null), so no rendered assertion
    // could have caught it.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/CourseVideoPage.jsx", "utf8");
    const slot = src.slice(src.indexOf("reportSlot={"));
    expect(slot).toMatch(/<VideoReport\b[\s\S]{0,200}?key=\{activeLesson\.id\}/);
  });
});
