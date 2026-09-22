// What the paper landing claims about an archive it could not reach.
//
// useJeeMainPapers reports a failed load as {items: [], loading: false,
// error: "Couldn't reach the JEE Main paper library."} — which the request
// deadline (supabaseClient.js) now produces instead of an open-ended hang.
// The three collection cards at the top of the landing branch on `loading`
// alone, so on that error they counted the empty array:
//
//   "0 reviewed papers" · "0 official answer keys" · "0 reviewed papers"
//
// "0 official answer keys" is a false statement about the official exam
// archive, made from a request that never answered. The house rule
// (ModerationDigest.jsx) is to show no number rather than one we cannot vouch
// for, and hide the line rather than leave a placeholder.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("./AppShell.jsx", () => ({ Page: ({ children }) => <>{children}</> }));

const PAPERS = vi.hoisted(() => ({ state: null }));
vi.mock("./useJeeMainPapers.js", () => ({ useJeeMainPapers: () => PAPERS.state }));

import JeeMainPapersPage from "./JeeMainPapersPage.jsx";

const BASE = {
  items: [], total: 0, loading: false, loadingMore: false,
  error: null, loadMoreError: null, unavailable: false, hasMore: false,
  loadMore: () => {}, retry: () => {},
};
const paper = (id, over = {}) => ({
  id,
  title: `JEE Main 2025 Session 1 - ${id} January Shift 1`,
  description: "Official NTA question paper. No worked solutions are included.",
  type: "previous_year_paper",
  typeLabel: "Previous-year papers",
  sourceName: "National Testing Agency (JEE Main)",
  sourceUrl: `https://nta.example/${id}.pdf`,
  fileFormat: "pdf",
  examYear: 2025,
  paperKind: "question_paper",
  paperYear: 2025,
  examSession: "Session 1",
  examShift: "Shift 1",
  scopes: [{ goal: "jee-main" }],
  ...over,
});

const renderLanding = () =>
  render(
    <MemoryRouter initialEntries={["/materials/jee-main/previous-year-papers"]}>
      <JeeMainPapersPage />
    </MemoryRouter>,
  );

beforeEach(() => { PAPERS.state = { ...BASE }; });

describe("the collection cards when the paper library could not be reached", () => {
  beforeEach(() => {
    PAPERS.state = { ...BASE, error: "Couldn't reach the JEE Main paper library." };
  });

  it("states no count it never established", () => {
    renderLanding();

    // The failure is still reported, in the directory view below the cards.
    expect(screen.getByRole("alert").textContent)
      .toContain("Couldn't reach the JEE Main paper library.");
    // None of the three cards may put a number on an unanswered request.
    expect(screen.queryAllByText(/0 reviewed papers?/i)).toHaveLength(0);
    expect(screen.queryAllByText(/0 official answer keys?/i)).toHaveLength(0);
    expect(screen.queryAllByText(/^\d+ (reviewed papers?|official answer keys?)$/i))
      .toHaveLength(0);
  });

  it("keeps the three collection links usable", () => {
    renderLanding();

    // Hide the number, not the way in: each card is still a labelled link to
    // its section.
    for (const [name, href] of [
      ["Question papers only", "#question-papers"],
      ["Official answer keys", "#official-answer-keys"],
      ["Papers with solutions", "#papers-with-solutions"],
    ]) {
      const link = screen.getByRole("link", { name: new RegExp(`^${name}`) });
      expect(link.getAttribute("href")).toBe(href);
    }
  });
});

describe("the collection cards on a load that answered", () => {
  it("counts what the archive returned", () => {
    PAPERS.state = {
      ...BASE,
      items: [
        paper(21),
        paper(22),
        paper(23, {
          title: "JEE Main 2025 Session 1 Final Answer Key",
          paperKind: "answer_key",
          examShift: null,
        }),
      ],
      total: 3,
    };
    renderLanding();

    expect(screen.getByText("2 reviewed papers")).toBeTruthy();
    expect(screen.getByText("1 official answer key")).toBeTruthy();
    expect(screen.getByText("0 reviewed papers")).toBeTruthy(); // solutions: a real, counted 0
  });

  it("says it is still checking while the request is in flight", () => {
    PAPERS.state = { ...BASE, loading: true };
    renderLanding();

    expect(screen.getByText("Loading reviewed papers…")).toBeTruthy();
    expect(screen.getByText("Checking official answer keys…")).toBeTruthy();
    expect(screen.getByText("Checking reviewed solutions…")).toBeTruthy();
  });
});
