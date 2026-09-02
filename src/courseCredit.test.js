// courseCredit: say who taught a course once, not twice.
//
// 132 of 484 courses (production, 2026-09-02) store the YouTube channel's own
// name in `playlists.teacher`, so every surface that shows both said it twice.
// The live meta description for /course/167 read, verbatim:
//
//     "2 Chemistry lectures by Competishun+ from Competishun+."
//
// The danger in a de-duplicating rule is that it deletes a real name. Most of
// what follows is about the pairs it must LEAVE ALONE.
import { describe, expect, it } from "vitest";
import { courseCredit } from "./courseCredit.js";
import { buildCourseMetadata } from "./courseMetadata.js";

describe("an exact duplicate is said once", () => {
  it("drops the teacher and keeps the linked institute", () => {
    // The institute is kept, not the teacher: it has an id, a logo and a
    // /browse?channel= destination, so keeping it preserves the link.
    expect(courseCredit({ teacher: "Competishun+", institute: "Competishun+" }))
      .toEqual({ teacher: null, institute: "Competishun+", duplicated: true });
  });

  it.each([
    ["different case", "COMPETISHUN+", "competishun+"],
    ["padding", "  Magnet Brains  ", "Magnet Brains"],
    ["collapsed whitespace", "Mohit  Tyagi", "Mohit Tyagi"],
  ])("matches despite %s", (_label, teacher, institute) => {
    expect(courseCredit({ teacher, institute }).duplicated).toBe(true);
  });

  it("covers the person-named channels too, not just institutes", () => {
    // 39 of the 132 are a person whose channel carries their own name. The
    // data is right there; it is only the repetition that is wrong.
    for (const name of ["Mohit Tyagi", "Digraj Singh Rajput", "Shobhit Nirwan"]) {
      expect(courseCredit({ teacher: name, institute: name }).teacher).toBeNull();
    }
  });
});

describe("a real pair is never collapsed", () => {
  it("keeps both when the names differ", () => {
    expect(courseCredit({ teacher: "Mohit Tyagi", institute: "Competishun+" }))
      .toEqual({ teacher: "Mohit Tyagi", institute: "Competishun+", duplicated: false });
  });

  it.each([
    ["Alakh Pandey", "Alakh Pandey - Class 9th & 10th"],
    ["Chaitanya Rastogi", "DexterChem - Chemistry by Chaitanya Rastogi"],
    ["ExpHub", "Exphub 9th &10th"],
    ["Neha Agrawal", "Neha Agrawal Mathematically Inclined"],
  ])("keeps a near-duplicate: %s beside %s", (teacher, institute) => {
    // 25 courses look like this. One name contains the other but each carries
    // something the other does not, so collapsing them would delete a real
    // name — worse than repeating one.
    const credit = courseCredit({ teacher, institute });
    expect(credit.duplicated).toBe(false);
    expect(credit.teacher).toBe(teacher);
    expect(credit.institute).toBe(institute);
  });

  it("keeps a lone teacher and a lone institute", () => {
    expect(courseCredit({ teacher: "Mohit Tyagi" }).teacher).toBe("Mohit Tyagi");
    expect(courseCredit({ institute: "Competishun+" }).institute).toBe("Competishun+");
  });

  it.each([
    ["nothing at all", {}],
    ["empty strings", { teacher: "", institute: "" }],
    ["whitespace", { teacher: "   ", institute: "  " }],
    ["nulls", { teacher: null, institute: null }],
    ["non-strings", { teacher: 7, institute: {} }],
  ])("returns no credit for %s, and does not call it a duplicate", (_label, input) => {
    expect(courseCredit(input)).toEqual({ teacher: null, institute: null, duplicated: false });
  });

  it("survives being called with no argument", () => {
    expect(courseCredit()).toEqual({ teacher: null, institute: null, duplicated: false });
  });
});

describe("the meta description Google actually shows", () => {
  const course = (over) => ({
    title: "Hydrogen I Class - XI Chemistry",
    subjects: { name: "Chemistry" },
    playlist_videos: [{ count: 2 }],
    ...over,
  });

  it("stops saying the institute twice", () => {
    const { description } = buildCourseMetadata(
      course({ teacher: "Competishun+", institutes_channels: { name: "Competishun+" } }),
    );
    // The exact string that was live on 2026-09-02.
    expect(description).not.toContain("by Competishun+ from Competishun+");
    expect(description).toContain("from Competishun+");
  });

  it("still credits a real teacher AND their institute", () => {
    const { description } = buildCourseMetadata(
      course({ teacher: "Mohit Tyagi", institutes_channels: { name: "Competishun+" } }),
    );
    expect(description).toContain("by Mohit Tyagi from Competishun+");
  });

  it("reads the hydrated shape as well as the PostgREST row", () => {
    // Cards pass { institute }, the edge passes { institutes_channels: { name } }.
    const { description } = buildCourseMetadata(
      course({ teacher: "Magnet Brains", institute: "Magnet Brains" }),
    );
    expect(description).not.toContain("by Magnet Brains from Magnet Brains");
  });
});
