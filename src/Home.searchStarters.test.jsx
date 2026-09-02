// The homepage hero's empty state.
//
// The hero is where most students land, and before this it offered a bare box
// and nothing else. It now draws the SAME component /search draws under its
// own empty field — not a homepage variant of it — so a recent search looks
// and behaves identically wherever a student is standing.
//
// Mocking follows searchOneSurface.test.jsx: everything the landing page
// fetches is stubbed, so what is under test is the hero and nothing else.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const rpcCalls = [];
let RPC_ROWS = [];

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (fn, args) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: RPC_ROWS, error: null });
    },
    from: () => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        ilike: () => builder,
        limit: () => Promise.resolve({ data: [], error: null }),
        in: () => Promise.resolve({ data: [], error: null }),
      };
      return builder;
    },
  },
}));
vi.mock("./usePlaylistBrowse.js", () => ({
  usePlaylistBrowse: () => ({ items: [], total: null, loading: false, error: null }),
}));
vi.mock("./useExplore.js", () => ({
  useLearningGoals: () => ({ goals: [], loading: false, error: null, retry: () => {} }),
}));
vi.mock("./useHomepageChannels.js", () => ({
  useHomepageChannels: () => ({ channels: [], loading: false, error: null }),
}));
vi.mock("./progress.js", () => ({
  getContinueWatching: () => [],
  mergeRemoteEntry: () => {},
  countLessonsStudiedToday: () => 0,
}));

const { default: Home } = await import("./Home.jsx");
const { ThemeProvider } = await import("./theme.jsx");
const { DEBOUNCE_MS } = await import("./useUniversalSearch.js");
const { STARTER_QUERIES, rememberSearch } = await import("./searchHistory.js");

const show = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Home />
      </MemoryRouter>
    </ThemeProvider>,
  );

const settle = async () => {
  await act(async () => { vi.advanceTimersByTime(DEBOUNCE_MS + 20); });
  await act(async () => { await Promise.resolve(); });
};

// The hero's own field. Not by its aria-label: the shell's header carries a
// link to /search with the same accessible name, so "Search the library"
// matches two elements on this page.
const HERO_PLACEHOLDER = "Search chapters, courses, teachers or lectures";
const heroField = () => screen.getByPlaceholderText(HERO_PLACEHOLDER);
const findHeroField = () => screen.findByPlaceholderText(HERO_PLACEHOLDER);

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  rpcCalls.length = 0;
  RPC_ROWS = [];
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("the homepage hero no longer starts cold", () => {
  it("offers the searches this device remembers", async () => {
    rememberSearch("rotational motion", { resultCount: 4 });
    show();
    expect(await screen.findByText("Recent searches")).toBeTruthy();
    expect(screen.getByRole("button", { name: "rotational motion" })).toBeTruthy();
  });

  it("teaches a first-time student with curated prompts instead", async () => {
    show();
    expect(await screen.findByText("Try one of these")).toBeTruthy();
    expect(screen.queryByText("Recent searches")).toBeNull();
    expect(screen.getByRole("button", { name: STARTER_QUERIES[0] })).toBeTruthy();
  });

  it("runs the query when a chip is tapped", async () => {
    rememberSearch("rotational motion", { resultCount: 4 });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "rotational motion" }));

    // The hero's own field now holds it — one query, one box.
    expect(heroField().value).toBe("rotational motion");
    await settle();
    expect(rpcCalls.map((c) => c.fn)).toEqual(["universal_search"]);
    expect(rpcCalls[0].args.p_query).toBe("rotational motion");
  });

  it("puts focus back in the search field the chip just filled", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: STARTER_QUERIES[0] }));
    expect(document.activeElement).toBe(heroField());
  });

  it("gets out of the way once the student is searching", async () => {
    show();
    fireEvent.change(await findHeroField(), {
      target: { value: "rotational motion" },
    });
    await settle();
    expect(screen.queryByText("Try one of these")).toBeNull();
    expect(screen.queryByText("Recent searches")).toBeNull();
  });

  it("shows nothing rather than crashing when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => show()).not.toThrow();
    expect(await findHeroField()).toBeTruthy();
    expect(screen.queryByText("Recent searches")).toBeNull();
    vi.restoreAllMocks();
  });
});
