// The homepage must never state a measurement it does not have, and must not
// creep back into the marketing bloat that was cut from it.
//
// History. The original offender was a <Statistics> band: Home passed it a
// literal four-element array, so its `if (!stats?.length) return null` guard
// could never fire, and a failed catalogue query announced "0 — Courses in the
// library" as a confident statistic (docs/audit_2026-07-31.md).
//
// On 2026-08-10 the landing page was trimmed from eleven sections to six. The
// Statistics band went with that cut — along with Pricing, the before/after
// "Benefits", the "Process" explainer and the Final CTA — so the honesty rule
// now lives on the hero stat rail, which is the only place a live count is
// rendered. This file guards two things: the rail still hides an absent count,
// and the deleted sections stay deleted.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("./useUniversalSearch.js", () => ({
  useUniversalSearch: () => ({
    groups: {}, loading: false, error: null, tooShort: false, retry: () => {},
  }),
  MIN_QUERY: 3,
}));
// countLessonsStudiedToday feeds the PrepToday band, also on the homepage;
// zero keeps it hidden so it cannot disturb these assertions.
vi.mock("./progress.js", () => ({
  getContinueWatching: () => [],
  countLessonsStudiedToday: () => 0,
}));

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

describe("homepage never states a measurement it does not have", () => {
  it("hides the hero stat rail entirely when no course count is known", async () => {
    // The exact shape usePlaylistBrowse returns when Supabase is unreachable:
    // total null, and no per-goal counts to fall back on. The rail is guarded on
    // courseCount > 0, so it must not render a "0 Free courses" figure.
    browseState.current = {
      items: [], total: null, loading: false, error: "Couldn't load courses.",
    };
    goalsState.current = { goals: [], loading: false, error: "network down" };

    show();
    // The page's own heading proves it rendered; the rail's labels must not be
    // on screen with it.
    expect(await screen.findByRole("heading", { name: /Find the right lecture/i })).toBeTruthy();
    expect(screen.queryByText("Free courses")).toBeNull();
    expect(screen.queryByText("Exam tracks")).toBeNull();
  });

  it("shows the hero stat rail once a real course count exists", async () => {
    browseState.current = { items: [], total: 292, loading: false, error: null };
    goalsState.current = {
      goals: [{ slug: "jee", count: 167 }, { slug: "neet", count: 102 }],
      loading: false,
      error: null,
    };

    show();
    expect(await screen.findByText("Free courses")).toBeTruthy();
    expect(screen.getByText("Exam tracks")).toBeTruthy();
  });
});

describe("the trimmed landing page stays trimmed", () => {
  it("renders none of the cut marketing sections", async () => {
    browseState.current = { items: [], total: 292, loading: false, error: null };
    goalsState.current = { goals: [{ slug: "jee", count: 167 }], loading: false, error: null };

    show();
    await screen.findByRole("heading", { name: /Find the right lecture/i });

    // The Statistics band, Pricing, Benefits, Process and Final CTA are gone —
    // by their headings and their tell-tale copy. If any is re-added, this fails.
    for (const gone of [
      "Attributes compared",        // Statistics band
      "Languages classified",       // Statistics band
      "It is free. That is the whole model.", // Pricing
      "Why students stay",          // Benefits eyebrow
      "Three steps, about ninety seconds.",   // Process
      "Your next lecture is two taps away",   // Final CTA
    ]) {
      expect(screen.queryByText(gone), gone).toBeNull();
    }
  });

  it("no longer claims a false attribute count anywhere on the page", async () => {
    browseState.current = { items: [], total: 292, loading: false, error: null };
    goalsState.current = { goals: [{ slug: "jee", count: 167 }], loading: false, error: null };

    show();
    await screen.findByRole("heading", { name: /Find the right lecture/i });
    // "seventeen attributes" (and "17 attributes") was false: pacing,
    // theory-focus and prerequisites are null on every course.
    expect(document.body.textContent).not.toMatch(/seventeen attributes/i);
    expect(document.body.textContent).not.toMatch(/17 attributes/i);
  });

  it("keeps the tool and the honest explainer", async () => {
    browseState.current = { items: [], total: 292, loading: false, error: null };
    goalsState.current = { goals: [{ slug: "jee", count: 167 }], loading: false, error: null };

    show();
    // The exam grid (the actual product) and the FAQ both survive the cut.
    expect(await screen.findByText(/Built for one decision/i)).toBeTruthy();
    expect(screen.getByText("Everything students ask first.")).toBeTruthy();
  });
});
