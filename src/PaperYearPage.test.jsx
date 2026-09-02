import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("./AppShell.jsx", () => ({ Page: ({ children }) => <>{children}</> }));

const paper = (id, title, examYear, sourceUrl, goal = "jee-main") => ({
  id,
  title,
  description: "Official question paper or key.",
  type: "previous_year_paper",
  typeLabel: "Previous-year papers",
  sourceName: "National Testing Agency (JEE Main)",
  sourceUrl,
  fileFormat: "pdf",
  examYear,
  scopes: [{ goal }],
});

const papersFor = (year, landing) => {
  if (landing?.id === "jee-advanced") {
    return year === 2013
      ? [
          paper(41, "JEE Advanced 2013 Paper 1 (English + Hindi)", 2013, "https://jeeadv.example/p1.pdf", "jee"),
          paper(42, "JEE Advanced 2013 Paper 2 (English + Hindi)", 2013, "https://jeeadv.example/p2.pdf", "jee"),
        ]
      : [];
  }
  return year === 2024
    ? [
        paper(7, "JEE Main 2024 Session 1 - 27 January Shift 1", 2024, "https://nta.example/paper.pdf"),
        paper(8, "JEE Main 2024 Session 2 - 4 April Shift 1", 2024, "https://nta.example/s2-paper.pdf"),
        paper(11, "JEE Main 2024 Session 1 Final Answer Key", 2024, "https://nta.example/key.pdf"),
      ]
    : [];
};

const requestedYears = [];
vi.mock("./useJeeMainPapers.js", () => ({
  useJeeMainPapers: ({ year, landing } = {}) => {
    requestedYears.push(year);
    const items = papersFor(year, landing);
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

  // Papers are per-shift, official keys per-session, so the session is the
  // join: Session 1's group carries its key, Session 2's group — whose key is
  // not in the loaded data — carries NOTHING, never a dead link.
  it("pairs each session group with its official answer key when one is loaded", () => {
    renderAt("/materials/jee-main/previous-year-papers/2024");

    expect(screen.getByRole("heading", { level: 3, name: "Session 1" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Session 2" })).toBeTruthy();
    const keyLinks = screen.queryAllByRole("link", {
      name: "Official answer key: JEE Main 2024 Session 1 Final Answer Key",
    });
    expect(keyLinks).toHaveLength(1);
    expect(keyLinks[0].getAttribute("href")).toBe("https://nta.example/key.pdf");
    // Exactly one session-level affordance in the whole question section:
    // Session 2 shows nothing for its missing key.
    expect(screen.queryAllByRole("link", { name: /^Official answer key: / })).toHaveLength(1);
  });

  // An exam whose titles name no session (JEE Advanced, NEET) keeps the flat
  // grid — no invented "Session not listed" heading.
  it("keeps session-less exams flat and skips the session-by-session claim", () => {
    renderAt("/materials/jee-advanced/previous-year-papers/2013");

    expect(screen.getByRole("heading", {
      level: 1,
      name: "JEE Advanced 2013 question papers",
    })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "JEE Advanced 2013 Paper 1 (English + Hindi)" })).toBeTruthy();
    expect(screen.queryByText(/session by session/i)).toBeNull();
    expect(screen.queryByText("Session not listed")).toBeNull();
    expect(screen.getByRole("link", { name: "All JEE Advanced papers by year" })
      .getAttribute("href")).toBe("/materials/jee-advanced/previous-year-papers");
  });

  // A year the catalogue has nothing in is not a page. The edge gives that URL
  // a real HTTP 404; the client must not disagree by showing an empty year.
  it("renders the honest 404 for a year with no reviewed paper", () => {
    renderAt("/materials/jee-main/previous-year-papers/1999");

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
    expect(screen.queryByText(/JEE Main 1999 papers, session by session/)).toBeNull();
  });

  it("renders the honest 404 for a NEET year outside the reviewed partial coverage", () => {
    renderAt("/materials/neet/previous-year-papers/2019");

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
  });
});
