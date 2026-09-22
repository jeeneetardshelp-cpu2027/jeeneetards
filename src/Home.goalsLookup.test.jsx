// Home.goalsLookup.test.jsx — what the homepage says when the goals lookup
// (get_browse_curriculum) or the catalogue total does not answer.
//
// Since supabaseClient.js puts a deadline on every request, a slow lookup now
// ENDS, and postgrest resolves it with the ABORTED shape below. Measured on the
// real page with the goals lookup aborted and the catalogue answering, the
// hero rail read "493 Free courses · 0 Exam tracks" — a zero nobody counted —
// and every exam card read "Soon · Course guide unavailable", labelling live
// exams as coming soon, with no Retry anywhere on the page.
//
// The per-goal counts below are production's on 15 Sep 2026 (read-only
// measurement): 268 + 282 + 13 + 27 = 590, against 493 distinct courses,
// because 97 courses carry more than one goal. A sum of them is not a course
// total, so it must never be printed as one.
//
// Real useLearningGoals (its retry is under test); the catalogue hook is
// stubbed so its total can be set directly.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const net = vi.hoisted(() => ({
  HANG: Symbol("never settles"),
  goals: null,
  goalCalls: 0,
}));
const catalogue = vi.hoisted(() => ({ current: null }));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (fn) => {
      if (fn !== "get_browse_curriculum") return Promise.resolve({ data: [], error: null });
      net.goalCalls += 1;
      return net.goals === net.HANG ? new Promise(() => {}) : Promise.resolve(net.goals);
    },
    from: () => {
      const chain = {
        select: () => chain, eq: () => chain, ilike: () => chain, order: () => chain,
        in: () => chain, limit: () => chain, range: () => chain,
        then: (resolve, reject) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
      };
      return chain;
    },
  },
}));
vi.mock("./usePlaylistBrowse.js", () => ({
  usePlaylistBrowse: () => catalogue.current,
}));
vi.mock("./useHomepageChannels.js", () => ({
  useHomepageChannels: () => ({ channels: [], loading: false, error: null }),
}));
vi.mock("./progress.js", () => ({
  getContinueWatching: () => [],
  mergeRemoteEntry: () => {},
  countLessonsStudiedToday: () => 0,
}));
vi.mock("./PollOfTheDay.jsx", () => ({ default: () => null }));

import Home from "./Home.jsx";
import { ThemeProvider } from "./theme.jsx";

const ok = (data) => ({ data, error: null, count: null, status: 200, statusText: "OK" });

// What postgrest-js resolves with when the request deadline aborts a request
// (dist/index.cjs, the AbortError branch of its fetch catch).
const ABORTED = {
  success: false,
  data: null,
  error: {
    message: "AbortError: Request timeout: the server did not answer in time.",
    details: "AbortError: Request timeout: the server did not answer in time.",
    hint: "Request was aborted (timeout or manual cancellation)",
    code: "",
  },
  count: null,
  status: 0,
  statusText: "",
};

const GOALS = ok([
  { level: "goal", entity_id: 1, slug: "jee", name: "JEE", display_order: 1, course_count: 268 },
  { level: "goal", entity_id: 2, slug: "neet", name: "NEET", display_order: 2, course_count: 282 },
  { level: "goal", entity_id: 3, slug: "school", name: "School Boards", display_order: 3, course_count: 27 },
  { level: "goal", entity_id: 4, slug: "olympiad", name: "Olympiad", display_order: 4, course_count: 13 },
]);

const COUNTED = { items: [], total: 493, loading: false, error: null };

const show = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Home />
      </MemoryRouter>
    </ThemeProvider>,
  );

// The hero rail is the one grid holding Stat figures; find it through one.
const railOf = (link) => link.closest(".grid");

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  net.goals = GOALS;
  net.goalCalls = 0;
  catalogue.current = COUNTED;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the homepage when the goals lookup fails", () => {
  it("prints no exam-track figure, because nothing was counted", async () => {
    net.goals = ABORTED;
    show();

    expect(await screen.findAllByText("Course guide unavailable")).toHaveLength(4);
    // The figure that WAS counted still stands.
    const courses = screen.getByRole("link", { name: /^493 Free courses/ });
    expect(screen.queryByText("Exam tracks")).toBeNull();
    // Two figures, so the rail tracks two columns rather than leaving a dead
    // third cell. Class names only: jsdom lays nothing out.
    expect(railOf(courses).className).toContain("sm:grid-cols-2");
  });

  it("calls no exam Soon, or Live, while its status is unknown", async () => {
    net.goals = ABORTED;
    show();

    await screen.findAllByText("Course guide unavailable");
    expect(screen.queryByText("Soon")).toBeNull();
    expect(screen.queryByText("Live")).toBeNull();
  });

  it("offers a Try again that asks again and restores the exam grid", async () => {
    net.goals = ABORTED;
    show();

    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(net.goalCalls).toBe(1);

    net.goals = GOALS;
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getAllByText("Live")).toHaveLength(4));
    expect(net.goalCalls).toBe(2);
    expect(screen.queryByText("Course guide unavailable")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("link", { name: /Exam tracks/ }).getAttribute("aria-label"))
      .toBe("4 Exam tracks. JEE, NEET, Boards, Olympiad");
  });
});

describe("the homepage while the goals lookup is in flight", () => {
  it("says it is checking, and claims neither Soon nor a track count", async () => {
    net.goals = net.HANG;
    show();

    expect(await screen.findAllByText("Checking availability…")).toHaveLength(4);
    expect(screen.getByRole("link", { name: /^493 Free courses/ })).toBeTruthy();
    expect(screen.queryByText("Soon")).toBeNull();
    expect(screen.queryByText("Exam tracks")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

describe("the homepage without the catalogue's own total", () => {
  it.each([
    ["failed", { items: [], total: null, loading: false, error: "Couldn't load courses." }],
    ["still in flight", { items: [], total: null, loading: true, error: null }],
  ])("prints no course figure summed from per-goal counts when the total %s", async (_label, state) => {
    catalogue.current = state;
    show();

    await waitFor(() => expect(screen.getAllByText("Live")).toHaveLength(4));
    expect(screen.queryByText("Free courses")).toBeNull();
    expect(document.body.textContent).not.toContain("590");
    // The exam-track figure was counted, so it stays.
    expect(screen.getByRole("link", { name: /^4 Exam tracks/ })).toBeTruthy();
  });
});

describe("the homepage when both lookups answer", () => {
  it("prints both counted figures", async () => {
    show();

    const tracks = await screen.findByRole("link", { name: /^4 Exam tracks/ });
    expect(screen.getByRole("link", { name: /^493 Free courses/ })).toBeTruthy();
    expect(railOf(tracks).className).toContain("sm:grid-cols-3");
    expect(screen.getAllByText("Live")).toHaveLength(4);
  });
});
