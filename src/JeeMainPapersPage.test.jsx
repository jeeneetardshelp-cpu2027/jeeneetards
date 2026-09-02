import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("./AppShell.jsx", () => ({ Page: ({ children }) => <>{children}</> }));

// One fixture per landing, keyed by title prefix exactly as the real hook
// queries (registry titlePattern), so each landing's test sees its own exam.
// Rows carry the paper-metadata columns the hook has mapped since the
// 2026-09-02 flip (paperKind/paperYear/examSession/examShift), so the page
// classifies these fixtures the database-first way it classifies production.
// vi.hoisted, because the vi.mock factory below is hoisted above module code.
const FIXTURES = vi.hoisted(() => ({
  "JEE Advanced%": [
    {
      id: 21,
      title: "JEE Advanced 2013 Paper 1 (English + Hindi)",
      description: "Official question paper.",
      type: "previous_year_paper",
      typeLabel: "Previous-year papers",
      sourceName: "IIT JEE archive",
      sourceUrl: "https://jeeadv.example/2013-p1.pdf",
      fileFormat: "pdf",
      examYear: 2013,
      paperKind: "question_paper",
      paperYear: 2013,
      examSession: null,
      examShift: null,
      scopes: [{ goal: "jee" }],
    },
  ],
  "NEET%": [
    {
      id: 31,
      title: "NEET UG 2024 - Set T1 (English)",
      description: "Official question paper.",
      type: "previous_year_paper",
      typeLabel: "Previous-year papers",
      sourceName: "National Testing Agency (NEET)",
      sourceUrl: "https://nta.example/neet-2024-t1.pdf",
      fileFormat: "pdf",
      examYear: 2024,
      paperKind: "question_paper",
      paperYear: 2024,
      examSession: null,
      examShift: null,
      scopes: [{ goal: "neet" }],
    },
  ],
}));

vi.mock("./useJeeMainPapers.js", () => ({
  useJeeMainPapers: ({ landing } = {}) => {
    const fixture = FIXTURES[landing?.titlePattern];
    if (fixture) {
      return {
        items: fixture,
        total: fixture.length,
        loading: false,
        loadingMore: false,
        error: null,
        loadMoreError: null,
        unavailable: false,
        hasMore: false,
      };
    }
    return {
    items: [
      {
        id: 12,
        title: "JEE Main 2026 Session 1 - 22 January Shift 1",
        description: "Official NTA question paper. No worked solutions are included.",
        type: "previous_year_paper",
        typeLabel: "Previous-year papers",
        sourceName: "National Testing Agency (JEE Main)",
        sourceUrl: "https://nta.example/2026-s1.pdf",
        fileFormat: "pdf",
        examYear: 2026,
        paperKind: "question_paper",
        paperYear: 2026,
        examSession: "Session 1",
        examShift: "Shift 1",
        scopes: [{ goal: "jee-main" }],
      },
      {
        id: 13,
        title: "JEE Main 2026 Session 1 Final Answer Key (Paper 1 B.E./B.Tech)",
        description: "Official NTA final answer key for Paper 1.",
        type: "previous_year_paper",
        typeLabel: "Previous-year papers",
        sourceName: "National Testing Agency (JEE Main)",
        sourceUrl: "https://nta.example/2026-key.pdf",
        fileFormat: "pdf",
        examYear: 2026,
        paperKind: "answer_key",
        paperYear: 2026,
        examSession: "Session 1",
        examShift: null,
        scopes: [{ goal: "jee-main" }],
      },
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
        paperKind: "question_paper",
        paperYear: 2024,
        examSession: "Session 1",
        examShift: "Shift 1",
        scopes: [{ goal: "jee-main" }],
      },
      {
        id: 10,
        title: "JEE Main 2025 Session 1 Final Answer Key",
        description: "Official NTA final answer key for Paper 1 (B.E./B.Tech).",
        type: "previous_year_paper",
        typeLabel: "Previous-year papers",
        sourceName: "National Testing Agency (JEE Main)",
        sourceUrl: "https://nta.example/final-answer-key.pdf",
        fileFormat: "pdf",
        examYear: 2025,
        paperKind: "answer_key",
        paperYear: 2025,
        examSession: "Session 1",
        examShift: null,
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
        paperKind: "paper_with_solutions",
        paperYear: 2023,
        examSession: null,
        examShift: null,
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
        paperKind: "question_paper",
        paperYear: 2022,
        examSession: "Session 2",
        examShift: "Shift 2",
        scopes: [{ goal: "jee-main" }],
      },
    ],
    total: 6,
    loading: false,
    loadingMore: false,
    error: null,
    loadMoreError: null,
    unavailable: false,
    hasMore: false,
    };
  },
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
      name: "JEE Main papers, answer keys and solutions",
    })).toBeTruthy();
    expect(screen.getByText(/official answer keys are listed separately from worked solutions/i)).toBeTruthy();
    expect(screen.getByRole("heading", {
      name: "JEE Main 2024 Session 1 - 27 January Shift 1",
    })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Main question papers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Main official answer keys" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Main 2025 Session 1 Final Answer Key" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Main papers with solutions" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Main 2023 paper with solutions" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse JEE Main resources by year" })
      .getAttribute("href")).toBe("#paper-filters");
    expect(screen.getAllByText("JEE Main", { exact: true })).toHaveLength(6);

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
        "Home", "Study material", "JEE Main papers",
      ]);
      expect(schema.itemListElement[2].item).toBe(
        "https://www.jeeneetard.com/materials/jee-main/previous-year-papers",
      );
    });
  });

  // The landing's outbound signal now goes to its own year pages instead of
  // to files hosted somewhere else. The PDFs are still listed on each year
  // page, which is the level where the PDF really is the resource.
  it("links every year to its own page and lists those pages in the ItemList", async () => {
    render(
      <MemoryRouter initialEntries={["/materials/jee-main/previous-year-papers"]}>
        <JeeMainPapersPage />
      </MemoryRouter>,
    );

    const yearNav = screen.getByRole("navigation", { name: "JEE Main papers by year" });
    expect([...yearNav.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual([
      "/materials/jee-main/previous-year-papers/2026",
      "/materials/jee-main/previous-year-papers/2025",
      "/materials/jee-main/previous-year-papers/2024",
      "/materials/jee-main/previous-year-papers/2023",
      "/materials/jee-main/previous-year-papers/2022",
    ]);

    await waitFor(() => {
      const script = document.head.querySelector(
        'script[type="application/ld+json"][data-schema-key="ItemList"]',
      );
      expect(script).not.toBeNull();
      const schema = JSON.parse(script.textContent);
      expect(schema.itemListElement.map(({ url }) => url)).toEqual([
        "https://www.jeeneetard.com/materials/jee-main/previous-year-papers/2026",
        "https://www.jeeneetard.com/materials/jee-main/previous-year-papers/2025",
        "https://www.jeeneetard.com/materials/jee-main/previous-year-papers/2024",
        "https://www.jeeneetard.com/materials/jee-main/previous-year-papers/2023",
        "https://www.jeeneetard.com/materials/jee-main/previous-year-papers/2022",
      ]);
      expect(script.textContent).not.toContain("nta.example");
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
    expect(screen.getByText("Showing 1 of 6 resources")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.change(screen.getByLabelText("Resource search"), { target: { value: "Shift 2" } });
    expect(screen.getByRole("heading", { name: "JEE Main 2022 Session 2 - 28 July Shift 2" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "JEE Main 2024 Session 1 - 27 January Shift 1" })).toBeNull();
    expect(screen.getByText("Showing 1 of 6 resources")).toBeTruthy();
  });

  // The loaded data holds keys for 2026 and 2025; the question-paper year
  // groups are 2026, 2024 and 2022. Only 2026 may carry the affordance —
  // absent means nothing, never a dead link.
  it("marks a year group with its official answer keys only when one is loaded", () => {
    render(
      <MemoryRouter initialEntries={["/materials/jee-main/previous-year-papers"]}>
        <JeeMainPapersPage />
      </MemoryRouter>,
    );

    const links = screen.queryAllByRole("link", { name: "Official answer keys below" });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("#official-answer-keys");
    // It sits inside the 2026 year group of the question-papers section.
    const questionSection = document.getElementById("question-papers");
    expect(questionSection.contains(links[0])).toBe(true);
  });
});

// The same page file serves every registered landing: the registry entry for
// the current path decides the heading, the intro and the honest coverage
// wording. NEET must say PARTIAL plainly.
describe("sibling paper landings through the registry", () => {
  it("renders the NEET landing with its plain partial-coverage statement", () => {
    render(
      <MemoryRouter initialEntries={["/materials/neet/previous-year-papers"]}>
        <JeeMainPapersPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", {
      level: 1,
      name: "NEET question papers: 2024 and the 2026 re-exam",
    })).toBeTruthy();
    expect(screen.getByText(/this collection is partial/i)).toBeTruthy();
    expect(screen.getByText(/no official answer keys yet/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "NEET UG 2024 - Set T1 (English)" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "NEET question papers" })).toBeTruthy();
    // The empty answer-key section says questions-only, honestly.
    expect(screen.getByText(/question papers only so far/i)).toBeTruthy();
    const yearLink = screen.getByRole("link", { name: "NEET 2024" });
    expect(yearLink.getAttribute("href")).toBe("/materials/neet/previous-year-papers/2024");
  });

  it("renders the JEE Advanced landing with its 2007 to 2026 coverage", () => {
    render(
      <MemoryRouter initialEntries={["/materials/jee-advanced/previous-year-papers"]}>
        <JeeMainPapersPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", {
      level: 1,
      name: "JEE Advanced question papers, 2007 to 2026",
    })).toBeTruthy();
    expect(screen.getByText(/covers 2007 to 2026/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Advanced 2013 Paper 1 (English + Hindi)" })).toBeTruthy();
    const yearLink = screen.getByRole("link", { name: "JEE Advanced 2013" });
    expect(yearLink.getAttribute("href")).toBe("/materials/jee-advanced/previous-year-papers/2013");
  });
});
