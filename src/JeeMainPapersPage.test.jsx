import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("./AppShell.jsx", () => ({ Page: ({ children }) => <>{children}</> }));
vi.mock("./useJeeMainPapers.js", () => ({
  useJeeMainPapers: () => ({
    items: [
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
        id: 8,
        title: "JEE Main 2023 paper with solutions",
        description: "The official question paper and reviewed worked solutions are included.",
        type: "previous_year_paper",
        typeLabel: "Previous-year papers",
        sourceName: "Reviewed solution source",
        sourceUrl: "https://example.edu/solved-paper.pdf",
        fileFormat: "pdf",
        examYear: 2023,
        scopes: [{ goal: "jee-main" }],
      },
      {
        id: 9,
        title: "JEE Main 2022 Session 2 - 28 July Shift 2",
        description: "Official NTA question paper. No worked solutions are included.",
        type: "previous_year_paper",
        typeLabel: "Previous-year papers",
        sourceName: "National Testing Agency (JEE Main)",
        sourceUrl: "https://nta.example/older-paper.pdf",
        fileFormat: "pdf",
        examYear: 2022,
        scopes: [{ goal: "jee-main" }],
      },
    ],
    total: 3,
    loading: false,
    loadingMore: false,
    error: null,
    loadMoreError: null,
    unavailable: false,
    hasMore: false,
  }),
}));

import JeeMainPapersPage from "./JeeMainPapersPage.jsx";

describe("JEE Main previous-year-paper landing", () => {
  it("gives students a truthful dedicated collection and canonical breadcrumb data", async () => {
    render(
      <MemoryRouter initialEntries={["/materials/jee-main/previous-year-papers"]}>
        <JeeMainPapersPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", {
      name: "Official JEE Main previous year question papers",
    })).toBeTruthy();
    expect(screen.getByText(/question papers\. An answer key or solution/i)).toBeTruthy();
    expect(screen.getByRole("heading", {
      name: "JEE Main 2024 Session 1 - 27 January Shift 1",
    })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Main question papers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Main papers with solutions" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Main 2023 paper with solutions" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse JEE Main papers by year" })
      .getAttribute("href")).toBe("#paper-filters");
    expect(screen.getAllByText("JEE Main", { exact: true })).toHaveLength(3);

    const newestQuestionYear = screen.getByRole("heading", { name: "2024" });
    const olderQuestionYear = screen.getByRole("heading", { name: "2022" });
    expect(newestQuestionYear.compareDocumentPosition(olderQuestionYear) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(screen.getByRole("heading", { name: "2023" })).toBeTruthy();

    await waitFor(() => {
      const script = document.head.querySelector(
        'script[type="application/ld+json"][data-schema-key="BreadcrumbList"]',
      );
      expect(script).not.toBeNull();
      const schema = JSON.parse(script.textContent);
      expect(schema.itemListElement.map(({ name }) => name)).toEqual([
        "Home", "Study material", "JEE Main previous year papers",
      ]);
      expect(schema.itemListElement[2].item).toBe(
        "https://www.jeeneetard.com/materials/jee-main/previous-year-papers",
      );
    });
  });

  it("filters the directory by year and session or shift text", () => {
    render(
      <MemoryRouter initialEntries={["/materials/jee-main/previous-year-papers"]}>
        <JeeMainPapersPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Year"), { target: { value: "2024" } });
    expect(screen.getByRole("heading", { name: "JEE Main 2024 Session 1 - 27 January Shift 1" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "JEE Main 2022 Session 2 - 28 July Shift 2" })).toBeNull();
    expect(screen.getByText("Showing 1 of 3 papers")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.change(screen.getByLabelText("Paper search"), { target: { value: "Shift 2" } });
    expect(screen.getByRole("heading", { name: "JEE Main 2022 Session 2 - 28 July Shift 2" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "JEE Main 2024 Session 1 - 27 January Shift 1" })).toBeNull();
    expect(screen.getByText("Showing 1 of 3 papers")).toBeTruthy();
  });
});
