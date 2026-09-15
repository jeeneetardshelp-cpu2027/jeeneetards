// The way back from a paper-year page to lectures (examLectureLinks.js).
//
// A student working through a JEE or NEET paper finds the chapter they are
// weak in. The page links to that exam's chapter picker, and only links: it
// never lists courses itself.
import { render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("./AppShell.jsx", () => ({ Page: ({ children }) => <>{children}</> }));

// One reviewed paper for whichever exam and year is asked for, so each page
// renders instead of its honest 404.
vi.mock("./useJeeMainPapers.js", () => ({
  useJeeMainPapers: ({ year, landing } = {}) => {
    const items = year && landing
      ? [{
          id: 1,
          title: `${landing.examLabel} ${year} Question Paper`,
          description: "Official question paper.",
          type: "previous_year_paper",
          typeLabel: "Previous-year papers",
          sourceName: "Official source",
          sourceUrl: "https://official.example/paper.pdf",
          fileFormat: "pdf",
          examYear: year,
          paperKind: "question_paper",
          paperYear: year,
          examSession: null,
          examShift: null,
          scopes: [{ goal: landing.id }],
        }]
      : [];
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

describe("a paper-year page links back to lectures", () => {
  it.each([
    ["/materials/jee-main/previous-year-papers/2024", "Find JEE lectures by chapter", "/explore/jee"],
    ["/materials/jee-advanced/previous-year-papers/2013", "Find JEE lectures by chapter", "/explore/jee"],
    ["/materials/neet/previous-year-papers/2025", "Find NEET lectures by chapter", "/explore/neet"],
  ])("%s links to its chapter picker", (pathname, name, href) => {
    const { container } = renderAt(pathname);
    const link = within(container).getByRole("link", { name });
    expect(link.getAttribute("href")).toBe(href);
    expect(link.closest("p").textContent).toContain("Lost marks in a chapter?");
  });
});
