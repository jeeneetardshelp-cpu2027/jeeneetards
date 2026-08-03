// The homepage must never state a measurement it does not have.
//
// Audit finding (docs/audit_2026-07-31.md): Home passed <Statistics> a literal
// four-element array, so the component's own `if (!stats?.length) return null`
// guard could never fire. When the catalogue query failed, the page announced
// "0 — Courses in the library" and "0 — Exam tracks live" as confident
// statistics, while the hero rail directly above (guarded on courseCount > 0)
// correctly hid itself. That is a "nothing is invented" violation on the most
// visible surface the site has.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("./useUniversalSearch.js", () => ({
  useUniversalSearch: () => ({
    groups: {}, loading: false, error: null, tooShort: false, retry: () => {},
  }),
  MIN_QUERY: 3,
}));
vi.mock("./progress.js", () => ({ getContinueWatching: () => [] }));

const { browseState, goalsState } = vi.hoisted(() => ({
  browseState: { current: null },
  goalsState: { current: null },
}));
vi.mock("./usePlaylistBrowse.js", () => ({
  usePlaylistBrowse: () => browseState.current,
}));
vi.mock("./useExplore.js", () => ({
  useLearningGoals: () => goalsState.current,
}));

import Home from "./Home.jsx";
import { ThemeProvider } from "./theme.jsx";

const show = () => render(
  <ThemeProvider>
    <MemoryRouter initialEntries={["/"]}>
      <Home />
    </MemoryRouter>
  </ThemeProvider>,
);

describe("homepage statistics band", () => {
  it("omits the measured counts when the catalogue query failed", async () => {
    // The exact shape usePlaylistBrowse returns when Supabase is unreachable.
    browseState.current = {
      items: [], total: null, loading: false, error: "Couldn't load courses.",
    };
    goalsState.current = { goals: [], loading: false, error: "network down" };

    show();
    // Wait for the statistics band itself, not the page heading. The heading is
    // queryable before the band has rendered, which would let the two negative
    // assertions below pass for the wrong reason — nothing is on screen yet.
    // These two labels are product constants, not measurements, so they are
    // present whether or not the catalogue query succeeded.
    expect(await screen.findByText("Attributes compared")).toBeTruthy();
    expect(screen.getByText("Languages classified")).toBeTruthy();

    expect(screen.queryByText("Courses in the library")).toBeNull();
    expect(screen.queryByText("Exam tracks live")).toBeNull();
  });

  it("shows the measured counts once they are real", async () => {
    browseState.current = { items: [], total: 292, loading: false, error: null };
    goalsState.current = {
      goals: [{ slug: "jee", count: 167 }, { slug: "neet", count: 102 }],
      loading: false,
      error: null,
    };

    show();
    expect(await screen.findByText("Courses in the library")).toBeTruthy();
    expect(screen.getByText("Exam tracks live")).toBeTruthy();
  });
});
