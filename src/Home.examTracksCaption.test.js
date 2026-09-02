// The "Exam tracks" figure and its caption must agree. The caption was a
// hardcoded "JEE, NEET, Boards" — three names under a number that read 4 once
// Olympiad went live. These pin that the caption is derived from the same
// list as the count, so the two cannot disagree again.
import { describe, expect, it } from "vitest";
import { examTracksCaption } from "./Home.jsx";

const track = (label, available) => ({ id: label.toLowerCase(), label, available });

describe("examTracksCaption", () => {
  it("names every live track, in the site's own order", () => {
    const exams = [
      track("JEE", true), track("NEET", true), track("Boards", true), track("Olympiad", true),
    ];
    expect(examTracksCaption(exams)).toBe("JEE, NEET, Boards, Olympiad");
  });

  it("names only the tracks that are live, so the caption matches the count", () => {
    const exams = [
      track("JEE", true), track("NEET", true), track("Boards", false), track("Olympiad", false),
    ];
    const caption = examTracksCaption(exams);
    expect(caption).toBe("JEE, NEET");
    // The invariant the bug violated: as many names as the figure counts.
    expect(caption.split(", ")).toHaveLength(exams.filter((e) => e.available).length);
  });

  it("is empty when nothing is live — never a stale list under a zero", () => {
    expect(examTracksCaption([track("JEE", false)])).toBe("");
    expect(examTracksCaption([])).toBe("");
    expect(examTracksCaption(undefined)).toBe("");
  });
});
