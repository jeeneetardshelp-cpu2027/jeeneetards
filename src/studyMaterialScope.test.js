// studyMaterialScope.test.js — the /materials URL contract.
//
// Two things are being protected here: a scope that carries between /browse
// and /materials, and a query that never receives a value we did not check.

import { describe, expect, it } from "vitest";
import {
  applyMaterialScopeChange,
  canonicalScopeValue,
  normalizeMaterialScopeParams,
  readMaterialScope,
} from "./studyMaterialScope.js";

const params = (query) => new URLSearchParams(query);
const query = (result) => (result ? result.toString() : null);

describe("reading the /materials scope", () => {
  it("reads the same keys /browse uses", () => {
    const scope = readMaterialScope(params(
      "goal=jee&class=class-11&subject=physics&chapter=kinematics&type=short_notes",
    ));

    expect(scope).toMatchObject({
      goal: "jee",
      stage: "class-11",
      subject: "physics",
      chapter: "kinematics",
      type: "short_notes",
      invalid: [],
    });
  });

  it("accepts both spellings of a class, so a scope carries between the pages", () => {
    // /browse emits the short form; a study-material search result emits the
    // database slug. Either has to land on the same shelf.
    expect(readMaterialScope(params("class=11")).stage).toBe("class-11");
    expect(readMaterialScope(params("class=class-11")).stage).toBe("class-11");
    expect(readMaterialScope(params("class=11th")).stage).toBe("class-11");
    expect(readMaterialScope(params("class=dropper")).stage).toBe("dropper");
    expect(readMaterialScope(params("class=9")).stage).toBeNull();
  });

  it("drops a material type it does not know instead of emptying the page", () => {
    // ?type=full-course is a /browse course type. Forwarded, it would return
    // nothing and look like a broken library.
    const scope = readMaterialScope(params("goal=jee&type=full-course"));
    expect(scope.goal).toBe("jee");
    expect(scope.type).toBeNull();
    expect(scope.invalid).toEqual([{ key: "type", value: "full-course" }]);
  });

  it("keeps the watch page's chapterId hand-off, but only as a real id", () => {
    expect(readMaterialScope(params("chapterId=42")).chapterId).toBe("42");
    expect(readMaterialScope(params("chapterId=0")).chapterId).toBeNull();
    expect(readMaterialScope(params("chapterId=7;drop")).chapterId).toBeNull();
    expect(readMaterialScope(params("chapterId=1e3")).chapterId).toBeNull();
  });

  it("refuses anything that is not shaped like a slug", () => {
    const scope = readMaterialScope(params(
      `subject=${encodeURIComponent("physics' or 1=1--")}&chapter=${"x".repeat(80)}`,
    ));
    expect(scope.subject).toBeNull();
    expect(scope.chapter).toBeNull();
    expect(scope.invalid.map(({ key }) => key)).toEqual(["subject", "chapter"]);
  });

  it("is forgiving about case and spacing a student may have typed", () => {
    expect(canonicalScopeValue("subject", " Physics ")).toBe("physics");
    expect(canonicalScopeValue("type", "short-notes")).toBe("short_notes");
  });
});

describe("normalising the address bar", () => {
  it("rewrites nothing when the URL is already canonical", () => {
    expect(normalizeMaterialScopeParams(params("goal=jee&subject=physics"))).toBeNull();
  });

  it("removes what it refused to act on and canonicalises the rest", () => {
    expect(query(normalizeMaterialScopeParams(params("goal=jee&class=11&type=full-course"))))
      .toBe("goal=jee&class=class-11");
  });

  it("leaves keys this page does not own alone", () => {
    expect(query(normalizeMaterialScopeParams(params("goal=JEE&utm_source=whatsapp"))))
      .toBe("goal=jee&utm_source=whatsapp");
  });
});

describe("the curriculum cascade", () => {
  const start = params("goal=jee&class=class-11&subject=physics&chapter=kinematics&chapterId=9&type=short_notes");

  it("clears every level below the one that changed, and nothing above it", () => {
    expect(query(applyMaterialScopeChange(start, "subject", "chemistry")))
      .toBe("goal=jee&class=class-11&subject=chemistry&type=short_notes");
  });

  it("clears only the chapter when the chapter changes", () => {
    expect(query(applyMaterialScopeChange(start, "chapter", "laws-of-motion")))
      .toBe("goal=jee&class=class-11&subject=physics&chapter=laws-of-motion&type=short_notes");
  });

  it("resets the whole curriculum when the exam changes", () => {
    expect(query(applyMaterialScopeChange(start, "goal", "neet")))
      .toBe("goal=neet&type=short_notes");
  });

  it("clears the subject when the class changes, because classes narrow subjects", () => {
    // get_study_material_curriculum lists subjects for the chosen class, so a
    // subject kept from another class filters against a list it is not in.
    expect(query(applyMaterialScopeChange(start, "class", "class-12")))
      .toBe("goal=jee&class=class-12&type=short_notes");
  });

  it("leaves the curriculum alone when only the material type changes", () => {
    expect(query(applyMaterialScopeChange(start, "type", "formula_sheet")))
      .toBe("goal=jee&class=class-11&subject=physics&chapter=kinematics&chapterId=9&type=formula_sheet");
  });

  it("emits one address for one selection, whatever order it was built in", () => {
    // A shareable link that differs by the order the student clicked in is two
    // links for one view.
    const built = applyMaterialScopeChange(
      applyMaterialScopeChange(params("subject=physics&goal=jee"), "class", "class-11"),
      "subject", "physics",
    );
    expect(query(built)).toBe("goal=jee&class=class-11&subject=physics");
  });

  it("keeps keys this page does not own", () => {
    expect(query(applyMaterialScopeChange(params("utm_source=whatsapp"), "goal", "jee")))
      .toBe("goal=jee&utm_source=whatsapp");
  });

  it("clears the watch page's chapterId with any curriculum change", () => {
    expect(applyMaterialScopeChange(start, "chapter", "").get("chapterId")).toBeNull();
    expect(applyMaterialScopeChange(params("chapterId=9"), "goal", "jee").get("chapterId")).toBeNull();
  });

  it("never writes a value the query would ignore", () => {
    expect(applyMaterialScopeChange(start, "chapter", "Not A Slug").get("chapter")).toBeNull();
    expect(applyMaterialScopeChange(start, "type", "full-course").get("type")).toBeNull();
  });
});
