// SearchStarters.test.jsx — the search box before anything is typed.
//
// /search used to render literally nothing under an empty field, so a student
// who came back every day started from a blank box every day. These tests pin
// the whole loop end to end through the REAL hook: a search that returns rows
// is remembered, one that returns none is not, the chip re-runs the query the
// student actually clicked, and a browser that blocks storage still renders a
// working search page.
//
// jsdom applies no CSS, so "44px targets" is asserted as the class that
// produces it (min-h-11 = 2.75rem), not as a measured height.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

let RPC_ROWS = [];
const rpcCalls = [];

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (fn, args) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: RPC_ROWS, error: null });
    },
    from: () => {
      const builder = { select: () => builder, in: () => Promise.resolve({ data: [], error: null }) };
      return builder;
    },
  },
}));

const { default: UniversalSearch } = await import("./UniversalSearch.jsx");
const { default: SearchStarters } = await import("./SearchStarters.jsx");
const { ThemeProvider } = await import("./theme.jsx");
const { DEBOUNCE_MS } = await import("./useUniversalSearch.js");
const {
  HISTORY_SETTLE_MS, STARTER_QUERIES, getRecentSearches, rememberSearch,
} = await import("./searchHistory.js");

const row = (over = {}) => ({
  group_key: "chapter", entity_id: 7, title: "Rotational Motion",
  subtitle: "Physics", aka: null, slug: "rotational-motion",
  match_type: "exact", match_rank: 1, matched_on: "Rotational Motion",
  is_ambiguous: false, group_total: 1, extra: { chapter_id: 7 }, ...over,
});

const renderSearch = (url = "/search") =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/search" element={<UniversalSearch />} />
          <Route path="*" element={<div data-testid="landed" />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

const type = (value) =>
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });

/** Let the request debounce elapse and the mocked promise settle. */
const settle = async () => {
  await act(async () => { vi.advanceTimersByTime(DEBOUNCE_MS + 20); });
  await act(async () => { await Promise.resolve(); });
};

/** …and then let the "this query is worth remembering" delay elapse too. */
const settleAndRemember = async () => {
  await settle();
  await act(async () => { vi.advanceTimersByTime(HISTORY_SETTLE_MS + 20); });
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.restoreAllMocks();
  localStorage.clear();
  RPC_ROWS = [row()];
  rpcCalls.length = 0;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

// ------------------------------------------------- remembering the right ones
describe("the search box remembers what worked and nothing else", () => {
  it("remembers a settled query that returned at least one row", async () => {
    renderSearch();
    type("rotational motion");
    await settleAndRemember();
    expect(getRecentSearches()).toEqual(["rotational motion"]);
  });

  it("never remembers a query that returned nothing", async () => {
    RPC_ROWS = [];
    renderSearch();
    type("zzqqxx no such topic");
    await settleAndRemember();
    expect(getRecentSearches()).toEqual([]);
  });

  it("does not remember the prefixes typed on the way to the real query", async () => {
    renderSearch();
    type("rot");
    await settle();                       // a settled search, with rows
    type("rotational motion");
    await settleAndRemember();
    expect(getRecentSearches()).toEqual(["rotational motion"]);
  });
});

// ------------------------------------------------------------- what is shown
describe("what an empty search box shows", () => {
  it("offers the remembered searches before anything is typed", () => {
    rememberSearch("rotational motion", { resultCount: 4 });
    rememberSearch("goc", { resultCount: 2 });
    renderSearch();

    expect(screen.getByText("Recent searches")).toBeTruthy();
    // Most recent first.
    expect(screen.getByRole("button", { name: "goc" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "rotational motion" })).toBeTruthy();
  });

  it("shows the curated starters only while there is no history yet", () => {
    renderSearch();
    expect(screen.getByText("Try one of these")).toBeTruthy();
    expect(screen.queryByText("Recent searches")).toBeNull();
    for (const query of STARTER_QUERIES) {
      expect(screen.getByRole("button", { name: query })).toBeTruthy();
    }
  });

  it("drops the starters the moment the student has a history of their own", () => {
    rememberSearch("rotational motion", { resultCount: 4 });
    renderSearch();

    expect(screen.getByText("Recent searches")).toBeTruthy();
    // A starter that is not also a remembered query must be gone.
    expect(screen.queryByRole("button", { name: "gravitation class 11" })).toBeNull();
  });

  it("hides both once a query is being typed", async () => {
    renderSearch();
    expect(screen.getByText("Try one of these")).toBeTruthy();
    type("rotational motion");
    await settle();
    expect(screen.queryByText("Try one of these")).toBeNull();
    expect(screen.queryByText("Recent searches")).toBeNull();
  });

  it("gives every chip a 44px tap target", () => {
    rememberSearch("rotational motion", { resultCount: 4 });
    renderSearch();
    const targets = [
      screen.getByRole("button", { name: "rotational motion" }),
      screen.getByRole("button", { name: /Clear recent searches/i }),
    ];
    for (const el of targets) expect(el.className).toContain("min-h-11");
  });
});

// ------------------------------------------------------------ using the chips
describe("a chip re-runs that search", () => {
  it("puts the query in the field and asks the server for it", async () => {
    rememberSearch("rotational motion", { resultCount: 4 });
    renderSearch();

    fireEvent.click(screen.getByRole("button", { name: "rotational motion" }));
    expect(screen.getByRole("combobox").value).toBe("rotational motion");

    await settle();
    expect(rpcCalls.map((c) => c.fn)).toEqual(["universal_search"]);
    expect(rpcCalls[0].args.p_query).toBe("rotational motion");
    expect(await screen.findByText("Rotational Motion")).toBeTruthy();
  });

  it("runs a curated starter the same way", async () => {
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: STARTER_QUERIES[0] }));
    await settle();
    expect(rpcCalls[0].args.p_query).toBe(STARTER_QUERIES[0]);
  });

  it("leaves focus in the field the student is now searching from", () => {
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: STARTER_QUERIES[0] }));
    expect(document.activeElement).toBe(screen.getByRole("combobox"));
  });

  it("clears the remembered searches on request, and says so by showing none", () => {
    rememberSearch("rotational motion", { resultCount: 4 });
    rememberSearch("goc", { resultCount: 2 });
    renderSearch();

    fireEvent.click(screen.getByRole("button", { name: /Clear recent searches/i }));

    expect(getRecentSearches()).toEqual([]);
    expect(screen.queryByText("Recent searches")).toBeNull();
    expect(screen.queryByRole("button", { name: "rotational motion" })).toBeNull();
    // With nothing remembered, the box is back to teaching a new student.
    expect(screen.getByText("Try one of these")).toBeTruthy();
  });
});

// --------------------------------------------------------------- blocked store
describe("a browser that blocks storage still gets a working search box", () => {
  it("renders the search page instead of crashing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => renderSearch()).not.toThrow();
    expect(screen.getByRole("combobox")).toBeTruthy();
    // No history can be read, so no history is claimed.
    expect(screen.queryByText("Recent searches")).toBeNull();
  });

  it("survives a search whose result cannot be written down", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    renderSearch();
    type("rotational motion");
    await settleAndRemember();
    expect(await screen.findByText("Rotational Motion")).toBeTruthy();
  });
});

// ------------------------------------------------------------------ the chips
describe("the chip list stands on its own", () => {
  it("marks a remembered Devanagari query as Hindi, and leaves Latin alone", () => {
    rememberSearch("कारतूस", { resultCount: 2 });
    rememberSearch("goc", { resultCount: 2 });
    render(
      <ThemeProvider>
        <SearchStarters onPick={() => {}} />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: "कारतूस" }).getAttribute("lang")).toBe("hi");
    expect(screen.getByRole("button", { name: "goc" }).getAttribute("lang")).toBeNull();
  });

  it("hands the host the query that was clicked", () => {
    const picked = [];
    render(
      <ThemeProvider>
        <SearchStarters onPick={(q) => picked.push(q)} />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: STARTER_QUERIES[1] }));
    expect(picked).toEqual([STARTER_QUERIES[1]]);
  });
});
