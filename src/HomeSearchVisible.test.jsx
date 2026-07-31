// Homepage search results must be VISIBLE.
//
// Regression guard for a real production defect (audit, 31 July 2026): search
// results were wrapped in <Reveal>, which starts at `opacity: 0` and is only
// revealed when a useReveal() IntersectionObserver root adds `.is-in`. Home's
// <main> has no such root — every one lives on a <section> in HomeSections.jsx
// — so the results painted at zero opacity forever. A student searched, got
// real matches, and saw a blank page. Tests were green throughout, because
// nothing asserted the results could actually be seen.
//
// jsdom has no IntersectionObserver, and useReveal's fallback in that case is
// to reveal everything — which would HIDE this bug rather than catch it. So
// this test does not rely on the observer at all: it asserts structurally that
// no rendered search result sits inside an un-revealed `.reveal`, which is true
// regardless of whether an observer would ever have run.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("./usePlaylistBrowse.js", () => ({
  usePlaylistBrowse: () => ({ items: [], loading: false, error: null }),
}));
vi.mock("./progress.js", () => ({ getContinueWatching: () => [] }));
vi.mock("./useExplore.js", () => ({
  useLearningGoals: () => ({ goals: [], loading: false, error: null }),
}));
vi.mock("./useUniversalSearch.js", () => ({
  useUniversalSearch: () => ({
    // "chapter" (singular) is the real group key HOME_GROUPS filters on.
    groups: {
      chapter: {
        total: 1,
        rows: [{ id: 7, title: "Kinematics", subtitle: "Physics", extra: { chapter_id: 7 } }],
      },
    },
    loading: false,
    error: null,
    tooShort: false,
    retry: () => {},
  }),
  MIN_QUERY: 3,
}));

import Home from "./Home.jsx";
import { ThemeProvider } from "./theme.jsx";

const renderSearch = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/?q=kinematics"]}>
        <Home />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("homepage search results are actually visible", () => {
  it("renders a matching result for the query", async () => {
    renderSearch();
    expect(await screen.findByText("Kinematics")).toBeTruthy();
  });

  it("does not hide any search result inside an unrevealed .reveal wrapper", async () => {
    renderSearch();
    const result = await screen.findByText("Kinematics");

    // Walk up from the result to <body>. If ANY ancestor is a `.reveal` that
    // hasn't been revealed, the student cannot see this row.
    const hidden = [];
    for (let el = result; el && el !== document.body; el = el.parentElement) {
      if (el.classList?.contains("reveal") && !el.classList.contains("is-in")) {
        hidden.push(el.className);
      }
    }
    expect(hidden).toEqual([]);
  });

  it("keeps the escape hatch to the full search page reachable", async () => {
    renderSearch();
    // "All N ->" only renders when total > rows.length; with 1 of 1 it should
    // not appear at all. What must always work is that the result row itself
    // is a real link a student can click.
    const link = (await screen.findByText("Kinematics")).closest("a");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBeTruthy();
  });

  it("never leaves an unrevealed .reveal anywhere in the searching view", async () => {
    const { container } = renderSearch();
    await screen.findByText("Kinematics");
    const stuck = [...container.querySelectorAll(".reveal")]
      .filter((el) => !el.classList.contains("is-in"))
      .map((el) => (el.textContent || "").trim().slice(0, 60));
    expect(stuck).toEqual([]);
  });
});
