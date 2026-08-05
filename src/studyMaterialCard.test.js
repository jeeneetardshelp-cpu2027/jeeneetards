import { describe, expect, it } from "vitest";
import { studyMaterialScopeLabel } from "./StudyMaterialCard.jsx";

const scope = (chapter, overrides = {}) => ({
  goal: "school",
  board: "cbse",
  class: "class-10",
  subject: { slug: "hindi-a", name: "Hindi A" },
  chapter: { slug: chapter.toLowerCase().replaceAll(" ", "-"), name: chapter },
  ...overrides,
});

describe("studyMaterialScopeLabel", () => {
  it("shows both chapters for a shared resource in one curriculum family", () => {
    const label = studyMaterialScopeLabel({
      scopes: [scope("उत्साह"), scope("अट नहीं रही है")],
    });

    expect(label).toContain("उत्साह + अट नहीं रही है");
  });

  it("does not mix chapter names from a different subject family", () => {
    const label = studyMaterialScopeLabel({
      scopes: [
        scope("उत्साह"),
        scope("Motion", {
          subject: { slug: "physics", name: "Physics" },
        }),
      ],
    });

    expect(label).toContain("Hindi A");
    expect(label).toContain("उत्साह");
    expect(label).not.toContain("Motion");
  });

  it("caps long multi-chapter labels", () => {
    const label = studyMaterialScopeLabel({
      scopes: [scope("One"), scope("Two"), scope("Three"), scope("Four")],
    });

    expect(label).toContain("One + Two + 2 more");
    expect(label).not.toContain("Three");
  });
});
