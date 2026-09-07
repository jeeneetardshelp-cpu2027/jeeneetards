import { describe, expect, it } from "vitest";
import { applyBrowseSearchIntent, parseBrowseSearchIntent } from "./searchIntent.js";
import { buildChips } from "./filterChips.js";

describe("browse natural-language intent parsing", () => {
  it("turns the audit's failing query into removable structured filters", () => {
    const result = applyBrowseSearchIntent(
      new URLSearchParams(),
      "class 11 kinematics hinglish",
    );

    expect(result.remainingQuery).toBe("");
    expect(result.params.toString()).toBe(
      "class=11&language=hinglish&subject=physics&chapter=kinematics",
    );
    expect(buildChips(result.params, {
      subject: { physics: "Physics" },
      chapter: { kinematics: "Kinematics" },
    }).map((chip) => chip.label)).toEqual([
      "Class 11", "Physics", "Kinematics", "Hinglish",
    ]);
  });

  it("keeps unrecognised words as ordinary search text", () => {
    const result = parseBrowseSearchIntent("Class 12 Electrostatics ABJ Sir English");
    expect(result.filters).toEqual({ class: "12", language: "english" });
    expect(result.remainingQuery).toBe("Electrostatics ABJ Sir");
  });

  it("never overrides an explicit conflicting filter", () => {
    const params = new URLSearchParams("class=12&language=hindi&subject=chemistry");
    const result = applyBrowseSearchIntent(params, "class 11 kinematics hinglish");

    expect(result.params.get("class")).toBe("12");
    expect(result.params.get("language")).toBe("hindi");
    expect(result.params.get("subject")).toBe("chemistry");
    expect(result.params.get("chapter")).toBeNull();
    expect(result.remainingQuery).toBe("class 11 kinematics hinglish");
  });

  it("recognises only unique dimension labels supplied by the bounded option lists", () => {
    const options = {
      subject: [{ value: "social-science", label: "Social Science" }],
      channel: [{ value: "81", label: "Competishun+" }],
    };
    const result = applyBrowseSearchIntent(
      new URLSearchParams(),
      "boards social science competishun",
      options,
    );

    expect(result.remainingQuery).toBe("");
    expect(result.params.get("goal")).toBe("school");
    expect(result.params.get("subject")).toBe("social-science");
    expect(result.params.get("channel")).toBe("81");
  });

  it("supports reviewed curriculum aliases without broad substring guesses", () => {
    const optics = applyBrowseSearchIntent(new URLSearchParams(), "class 12 geometrical optics");
    expect(optics.params.get("subject")).toBe("physics");
    expect(optics.params.get("chapter")).toBe("ray-optics");

    const typo = applyBrowseSearchIntent(new URLSearchParams(), "class 11 kinematcs");
    expect(typo.params.get("chapter")).toBe("kinematics");

    const broad = parseBrowseSearchIntent("rotational motion");
    expect(broad.filters.chapter).toBeUndefined();
    expect(broad.remainingQuery).toBe("rotational motion");
  });

  it("preserves a bare chapter query so broad course and lecture matches remain visible", () => {
    const result = applyBrowseSearchIntent(new URLSearchParams(), "kinematics");
    expect(result.params.get("chapter")).toBeNull();
    expect(result.params.get("q")).toBe("kinematics");
  });

  // "JEE Main" and "JEE Advanced" name exams, but DIFFICULTIES is labelled
  // Foundation / Main / Advanced, so both exam names used to be eaten as a
  // difficulty nobody asked for: "jee main physics" silently became
  // difficulty=intermediate. There is no exam-scope column to hold the real
  // meaning, so the honest place for the word is `q`.
  //
  // This arrived red inside rescued work-in-progress and was parked as
  // it.fails. The parser has caught up, so it is a plain it() again.
  it("keeps JEE Main scope honest because the current schema has no exam-scope filter", () => {
    const result = applyBrowseSearchIntent(new URLSearchParams(), "jee main physics");
    expect(result.params.get("goal")).toBe("jee");
    expect(result.params.get("q")).toBe("main physics");
    expect(result.params.get("difficulty")).toBeNull();
  });

  it("does the same for JEE Advanced, which collides with the Advanced difficulty", () => {
    // Not covered by the rescued test, and broken in exactly the same way —
    // found by probing the parser rather than by reading it.
    const result = applyBrowseSearchIntent(new URLSearchParams(), "jee advanced physics");
    expect(result.params.get("goal")).toBe("jee");
    expect(result.params.get("q")).toBe("advanced physics");
    expect(result.params.get("difficulty")).toBeNull();
  });

  it("still filters difficulty inside a JEE query when the word is not an exam name", () => {
    // The narrowing is only about the two exam names. "intermediate" is the id
    // behind the "Main" label, and "Foundation" is nobody's exam, so a student
    // who really means difficulty can still say so.
    const byId = applyBrowseSearchIntent(new URLSearchParams(), "jee intermediate physics");
    expect(byId.params.get("difficulty")).toBe("intermediate");

    const foundation = applyBrowseSearchIntent(new URLSearchParams(), "jee foundation physics");
    expect(foundation.params.get("difficulty")).toBe("beginner");
  });

  it("leaves queries outside JEE alone, because no other exam is called Main or Advanced", () => {
    const neet = applyBrowseSearchIntent(new URLSearchParams(), "neet advanced biology");
    expect(neet.params.get("goal")).toBe("neet");
    expect(neet.params.get("difficulty")).toBe("advanced");

    const bare = applyBrowseSearchIntent(new URLSearchParams(), "advanced kinematics");
    expect(bare.params.get("difficulty")).toBe("advanced");
  });
});
