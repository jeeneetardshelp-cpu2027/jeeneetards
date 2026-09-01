// homeSearchLinks.test.js — every search result must land somewhere useful.
//
// The homepage search used to send channel results to a bare /browse (throwing
// away the channel the student clicked) and lecture results to a filter page
// instead of the lesson. These assertions are the contract that stops that
// regressing.

import { describe, expect, it } from "vitest";
import { resultHref } from "./searchDestinations.js";

const row = (id, extra = {}, rest = {}) => ({ id, extra, ...rest });

describe("search result destinations", () => {
  it("sends a chapter to the filtered catalogue", () => {
    expect(resultHref("chapter", row(7, { chapter_id: 7 }))).toBe("/browse?ch=7");
  });

  it("sends a course to its watch page, with chapter context when known", () => {
    expect(resultHref("playlist", row(5, { chapter_id: 1 }))).toBe("/course/5/chapter/1");
  });

  it("still opens a course that has no chapter context, rather than disabling it", () => {
    expect(resultHref("playlist", row(5, {}))).toBe("/course/5");
  });

  it("sends a lecture to the lesson itself when the course is known", () => {
    expect(
      resultHref("lecture", row(42, {
        playlist_id: 5, chapter_id: 1, youtube_video_id: "CBvaO-uDvs8",
      })),
    ).toBe("/course/5/chapter/1?v=CBvaO-uDvs8");
  });

  it("falls back to the chapter filter while the RPC carries no playlist_id", () => {
    expect(resultHref("lecture", row(42, { chapter_id: 1, subject_id: 2 })))
      .toBe("/browse?ch=1");
    expect(resultHref("lecture", row(42, { subject_id: 2 }))).toBe("/browse?sub=2");
  });

  it("carries the channel instead of dumping the student on /browse", () => {
    expect(resultHref("institute", row(3, { institute_id: 3 }))).toBe("/browse?channel=3");
  });

  it("sends faculty to their profile when a slug exists", () => {
    expect(resultHref("faculty", row(9, {}, { slug: "amit-bijarnia" })))
      .toBe("/faculty/amit-bijarnia");
    expect(resultHref("faculty", row(9, {}, { slug: null }))).toBe("/browse");
  });

  // ---- study material (staged migration 20260901160000) ----
  // Every combination asserted here is one /materials actually applies:
  // StudyMaterialsPage.jsx reads goal / class / subject / chapter / type and
  // passes them straight to get_study_materials, which satisfies the four
  // slugs from a SINGLE study_material_scopes row — the same row the RPC took
  // them from. So the destination is guaranteed to list the clicked material.
  it("sends a note to /materials narrowed to its own place in the syllabus", () => {
    expect(resultHref("material", row(1, {
      material_type: "short_notes",
      goal_slug: "jee",
      class_slug: "class-11",
      subject_slug: "physics",
      chapter_slug: "kinematics",
    }))).toBe("/materials?goal=jee&class=class-11&subject=physics&chapter=kinematics&type=short_notes");
  });

  it("widens the filters rather than inventing the parts the RPC did not send", () => {
    expect(resultHref("material", row(2, {
      material_type: "formula_sheet", goal_slug: "jee", subject_slug: "physics",
    }))).toBe("/materials?goal=jee&subject=physics&type=formula_sheet");
    expect(resultHref("material", row(3, {}))).toBe("/materials");
  });

  it("sends a JEE Main paper to the curated papers landing", () => {
    expect(resultHref("paper", row(5, {
      material_type: "previous_year_paper", jee_main_landing: true,
    }))).toBe("/materials/jee-main/previous-year-papers");
  });

  it("sends every other paper to the directory, not to a landing that omits it", () => {
    expect(resultHref("paper", row(7, {
      material_type: "previous_year_paper",
      jee_main_landing: false,
      goal_slug: "school",
      subject_slug: "physics",
    }))).toBe("/materials?goal=school&subject=physics&type=previous_year_paper");
  });

  it("escapes slugs instead of splicing them into the URL", () => {
    expect(resultHref("material", row(1, { subject_slug: "a&b c" })))
      .toBe("/materials?subject=a%26b+c");
  });

  it("never returns an empty destination for an unknown group", () => {
    expect(resultHref("something-new", row(1))).toBe("/browse");
  });

  it("escapes a hostile video id rather than splicing it into the URL", () => {
    const href = resultHref("lecture", row(1, {
      playlist_id: 5, youtube_video_id: "a&b=c d",
    }));
    expect(href).toBe("/course/5?v=a%26b%3Dc%20d");
  });
});
