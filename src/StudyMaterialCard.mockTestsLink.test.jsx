// The quiet "Want a timed attempt?" link on paper cards.
//
// A previous-year-paper PDF and a timed attempt at the same exam are the two
// halves of the same study session, so a paper card may point at its exam's
// /tests page — but ONLY when that page exists and actually lists timed
// tests. The mapping is checked against testPlatforms.js rather than guessed
// from the goal slug: "jee" is ambiguous between Main and Advanced, and the
// olympiad/school tests pages list untimed PDF papers.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import StudyMaterialCard, { mockTestsPathForMaterial } from "./StudyMaterialCard.jsx";
import { findTestSection } from "./testPlatforms.js";

const paper = (overrides = {}) => ({
  id: 1,
  title: "JEE Main 2024 Session 1 - 27 January Shift 1",
  description: "Official NTA question paper. No worked solutions are included.",
  type: "previous_year_paper",
  typeLabel: "Previous-year papers",
  sourceName: "National Testing Agency (JEE Main)",
  sourceUrl: "https://nta.example/paper.pdf",
  fileFormat: "pdf",
  examYear: 2024,
  scopes: [{ goal: "jee-main" }],
  ...overrides,
});

describe("mockTestsPathForMaterial", () => {
  it("maps a previous-year paper to its exam's verified tests page", () => {
    expect(mockTestsPathForMaterial(paper())).toBe("/tests/jee-main");
    expect(mockTestsPathForMaterial(paper({ scopes: [{ goal: "neet" }] })))
      .toBe("/tests/neet");
    // The link can only exist when the route does.
    expect(findTestSection("jee-main")).not.toBeNull();
    expect(findTestSection("neet")).not.toBeNull();
  });

  it("stays silent for other material types and unmapped goals", () => {
    expect(mockTestsPathForMaterial(paper({ type: "formula_sheet" }))).toBeNull();
    // Ambiguous or untimed destinations are deliberately unmapped.
    expect(mockTestsPathForMaterial(paper({ scopes: [{ goal: "jee" }] }))).toBeNull();
    expect(mockTestsPathForMaterial(paper({ scopes: [{ goal: "school" }] }))).toBeNull();
    expect(mockTestsPathForMaterial(paper({ scopes: [] }))).toBeNull();
    expect(mockTestsPathForMaterial(null)).toBeNull();
  });
});

describe("StudyMaterialCard timed-attempt link", () => {
  it("offers the quiet mock-tests link on a JEE Main paper", () => {
    render(
      <MemoryRouter>
        <StudyMaterialCard material={paper()} />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /Want a timed attempt\? Mock tests/ });
    expect(link.getAttribute("href")).toBe("/tests/jee-main");
    // The recorded source stays the card's primary action, untouched.
    expect(screen.getByRole("link", { name: /Open PDF/i }).getAttribute("href"))
      .toBe("https://nta.example/paper.pdf");
  });

  it("shows no mock-tests link on material without a verified timed-tests page", () => {
    render(
      <MemoryRouter>
        <StudyMaterialCard
          material={paper({ type: "formula_sheet", typeLabel: "Formula sheets" })}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /Mock tests/ })).toBeNull();
  });
});
