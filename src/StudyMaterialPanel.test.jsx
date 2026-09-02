import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { PAPER_LANDINGS } from "./studyMaterialLandings.js";
import { paperLandingsForGoals, StudyMaterialPanelView } from "./StudyMaterialPanel.jsx";

const MATERIAL = {
  id: 8,
  title: "Rectilinear motion short notes",
  type: "short_notes",
  sourceName: "Reviewed source",
  sourceUrl: "https://example.edu/notes",
  fileFormat: "web",
  scopes: [{ chapter: { name: "Rectilinear Motion" } }],
};

describe("StudyMaterialPanelView", () => {
  it("places chapter-specific material beside the lecture journey", () => {
    render(
      <MemoryRouter>
        <StudyMaterialPanelView
          chapterId={42}
          chapterName="Rectilinear Motion"
          items={[MATERIAL]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Study material for Rectilinear Motion" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: MATERIAL.title })).toBeTruthy();
    expect(screen.getByRole("link", { name: /View all/ }).getAttribute("href")).toBe("/materials?chapterId=42");
  });

  it("explains when a chapter has no reviewed material", () => {
    render(
      <MemoryRouter>
        <StudyMaterialPanelView chapterName="Rectilinear Motion" items={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/No reviewed material is linked to this chapter yet/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// The exam-level papers link.
//
// No previous-year paper in production carries a chapter scope (verified
// 2026-09-02: 460 chapter-scoped study_material_scopes rows, zero of them on a
// previous_year_paper), so the panel's chapter query can never return one.
// These tests pin the honest stand-in: a link to the whole exam's papers that
// says so, only for a goal with a registered landing, and never a guess.
// ---------------------------------------------------------------------------
const landingPath = (id) => PAPER_LANDINGS.find((landing) => landing.id === id).path;

const showPanel = (goals) => render(
  <MemoryRouter>
    <StudyMaterialPanelView
      chapterId={42}
      chapterName="Rectilinear Motion"
      goals={goals}
      items={[MATERIAL]}
    />
  </MemoryRouter>,
);

const papersLinks = () => screen.queryAllByRole("link", { name: /Previous-year papers/ });

describe("the watch page's exam-level papers link", () => {
  it("offers JEE Main papers on a JEE Main course, at the registry's own path", () => {
    showPanel("jee-main");
    const link = screen.getByRole("link", { name: "Previous-year papers for JEE Main" });
    expect(link.getAttribute("href")).toBe(landingPath("jee-main"));
    expect(papersLinks()).toHaveLength(1);
  });

  it("offers NEET papers on a NEET course, taking the goal by its display name", () => {
    showPanel(["NEET"]);
    const link = screen.getByRole("link", { name: "Previous-year papers for NEET" });
    expect(link.getAttribute("href")).toBe(landingPath("neet"));
    expect(papersLinks()).toHaveLength(1);
  });

  it("names both JEE exams rather than guessing one for the ambiguous JEE goal", () => {
    // The catalogue has ONE "JEE" learning goal and the registry has two JEE
    // landings. Picking one would tell a JEE Main student their practice is
    // JEE Advanced, or the reverse; both are named instead.
    showPanel(["JEE"]);
    expect(screen.getByRole("link", { name: "Previous-year papers for JEE Main" })
      .getAttribute("href")).toBe(landingPath("jee-main"));
    expect(screen.getByRole("link", { name: "Previous-year papers for JEE Advanced" })
      .getAttribute("href")).toBe(landingPath("jee-advanced"));
  });

  it("renders nothing for a goal that has no registered landing", () => {
    showPanel(["School Boards"]);
    expect(papersLinks()).toEqual([]);
    expect(screen.queryByText(/whole exam/i)).toBeNull();
    // The chapter's own material is untouched.
    expect(screen.getByRole("heading", { name: MATERIAL.title })).toBeTruthy();
  });

  it("renders nothing when the goal is unknown, missing or empty", () => {
    for (const goals of [undefined, null, [], "", ["Olympiad"], ["not-a-goal"]]) {
      const { unmount } = showPanel(goals);
      expect(papersLinks(), `goals=${JSON.stringify(goals)}`).toEqual([]);
      unmount();
    }
    expect(paperLandingsForGoals(["school", "olympiad", "physics"])).toEqual([]);
  });

  it("never words the link or its lead-in as this chapter's questions", () => {
    showPanel("jee-main");
    const link = screen.getByRole("link", { name: /Previous-year papers/ });
    expect(link.textContent).not.toMatch(/Rectilinear Motion/);
    expect(link.textContent).not.toMatch(/chapter/i);
    // The lead-in states the scope outright, and says why.
    expect(screen.getByText(/whole exam/i).textContent)
      .toMatch(/aren’t tagged chapter by chapter/);
    // And it must say WHY, because the reason is permanent: a paper covers
    // every subject, so chapter-scoping one would be false rather than merely
    // missing. Copy that implied tagging was coming would promise the wrong
    // thing (the honest chapter-scoped unit is a question, not a paper).
    expect(screen.getByText(/whole exam/i).textContent)
      .toMatch(/covering every subject/i);
    expect(screen.getByText(/whole exam/i).textContent).not.toMatch(/yet/i);
    expect(screen.queryByText(/from this chapter/i)).toBeNull();
    expect(screen.queryByText(/for this chapter/i)).toBeNull();
  });
});
