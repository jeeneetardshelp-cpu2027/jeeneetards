import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { StudyMaterialPanelView } from "./StudyMaterialPanel.jsx";

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
