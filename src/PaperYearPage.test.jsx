import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("./AppShell.jsx", () => ({ Page: ({ children }) => <>{children}</> }));

const papersFor = (year) => year === 2024
  ? [
      {
        id: 7,
        title: "JEE Main 2024 Session 1 - 27 January Shift 1",
        description: "Official NTA question paper. No worked solutions are included.",
        type: "previous_year_paper",
        typeLabel: "Previous-year papers",
        sourceName: "National Testing Agency (JEE Main)",
        sourceUrl: "https://nta.example/paper.pdf",
        fileFormat: "pdf",
        examYear: 2024,
        scopes: [{ goal: "jee-main" }],
      },
      {
        id: 11,
        title: "JEE Main 2024 Session 1 Final Answer Key",
        description: "Official NTA final answer key for Paper 1.",
        type: "previous_year_paper",
        typeLabel: "Previous-year papers",
        sourceName: "National Testing Agency (JEE Main)",
        sourceUrl: "https://nta.example/key.pdf",
        fileFormat: "pdf",
        examYear: 2024,
        scopes: [{ goal: "jee-main" }],
      },
    ]
  : [];

const requestedYears = [];
vi.mock("./useJeeMainPapers.js", () => ({
  useJeeMainPapers: ({ year } = {}) => {
    requestedYears.push(year);
    const items = papersFor(year);
    return {
      items,
      total: items.length,
      loading: false,
      loadingMore: false,
      error: null,
      loadMoreError: null,
      unavailable: false,
      hasMore: false,
    };
  },
}));

import PaperYearPage from "./PaperYearPage.jsx";

const renderAt = (pathname) => render(
  <MemoryRouter initialEntries={[pathname]}>
    <PaperYearPage />
  </MemoryRouter>,
);

describe("per-year previous-year-paper page", () => {
  it("asks for only that year and labels what each paper contains", async () => {
    renderAt("/materials/jee-main/previous-year-papers/2024");

    expect(requestedYears).toContain(2024);
    expect(screen.getByRole("heading", {
      level: 1,
      name: "JEE Main 2024 papers, session by session",
    })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Main 2024 question papers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Main 2024 official answer keys" })).toBeTruthy();
    expect(screen.getByRole("heading", {
      name: "JEE Main 2024 Session 1 Final Answer Key",
    })).toBeTruthy();
    // Nothing to claim here, so the page says so rather than leaving a
    // heading a student would read as "these exist".
    expect(screen.getByText(/no reviewed paper with worked solutions is listed/i)).toBeTruthy();
    // The one interactive way back up the tier.
    expect(screen.getByRole("link", { name: "All JEE Main papers by year" })
      .getAttribute("href")).toBe("/materials/jee-main/previous-year-papers");

    await waitFor(() => {
      const script = document.head.querySelector(
        'script[type="application/ld+json"][data-schema-key="BreadcrumbList"]',
      );
      expect(script).not.toBeNull();
      expect(JSON.parse(script.textContent).itemListElement.map(({ name }) => name))
        .toEqual(["Home", "Study material", "JEE Main papers", "2024"]);
    });
  });

  // A year the catalogue has nothing in is not a page. The edge gives that URL
  // a real HTTP 404; the client must not disagree by showing an empty year.
  it("renders the honest 404 for a year with no reviewed paper", () => {
    renderAt("/materials/jee-main/previous-year-papers/1999");

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
    expect(screen.queryByText(/JEE Main 1999 papers, session by session/)).toBeNull();
  });
});
