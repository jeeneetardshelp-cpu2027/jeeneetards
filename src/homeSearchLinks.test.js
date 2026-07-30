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
