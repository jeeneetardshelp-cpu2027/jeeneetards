import { describe, expect, it } from "vitest";
import { scopedChapterUrl } from "./Explore.jsx";

describe("guided search chapter handoff", () => {
  it("emits the complete canonical context instead of reading component-local variables", () => {
    expect(scopedChapterUrl(
      { slug: "kinematics", subjectSlug: "physics" },
      { goal: "jee", cls: "class-11", subject: "physics" },
    )).toBe("/browse?goal=jee&class=11&subject=physics&chapter=kinematics");
  });

  it("uses the chapter result's subject when the search result supplies one", () => {
    expect(scopedChapterUrl(
      { slug: "cell-cycle", subjectSlug: "biology" },
      { goal: "neet", cls: "class-12", subject: null },
    )).toBe("/browse?goal=neet&class=12&subject=biology&chapter=cell-cycle");
  });
});
