// ONE search surface — proven at the source AND at the request.
//
// Until 2026-09-01 a student could "find a lecture" four different ways that
// behaved differently:
//
//   1. the homepage hero, drawn by a private SearchResults inside Home.jsx;
//   2. /search, a second UI over the SAME universal_search RPC;
//   3. /explore's context box, a THIRD renderer on a raw-ilike hook
//      (useScopedSearch) with no typo tolerance, no Devanagari/Hinglish bridge
//      and none of universal_search's filler-token work — so "projctile motin"
//      worked on the homepage and silently failed mid-journey;
//   4. /browse's SearchBar, which is a filter over the catalogue and stays.
//
// Doors 1–3 are now the same component over the same RPC. This file pins that
// down two ways, because either alone can rot:
//
//   * At the SOURCE, so a future page cannot quietly grow a fourth renderer.
//   * At the REQUEST and the resulting href, so "same component" also means
//     the same query, the same server ranking and the same destination.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)));
const read = (file) => readFileSync(resolve(SRC, file), "utf8");

// ---------------------------------------------------------------- the source
describe("there is exactly one search-result renderer", () => {
  const sources = readdirSync(SRC)
    .filter((f) => /\.jsx?$/.test(f) && !/\.test\.jsx?$/.test(f));

  it("the retired search hooks are gone from disk", () => {
    for (const f of ["useScopedSearch.js", "useSearch.js"])
      expect([f, existsSync(resolve(SRC, f))]).toEqual([f, false]);
  });

  it("nothing imports them any more", () => {
    const importers = sources.filter((f) =>
      /from\s+["']\.\/(useScopedSearch|useSearch)(\.jsx?)?["']/.test(read(f)));
    expect(importers).toEqual([]);
  });

  it("only UniversalSearch.jsx calls the search hook", () => {
    // useUniversalSearch.js itself is where the hook is declared, not a caller.
    const callers = sources
      .filter((f) => f !== "useUniversalSearch.js")
      .filter((f) => /\buseUniversalSearch\s*\(/.test(read(f)));
    expect(callers).toEqual(["UniversalSearch.jsx"]);
  });

  it("only UniversalSearch.jsx decides where a result lands", () => {
    // searchDestinations.js owns the policy; a page that reached for it
    // directly would be building rows of its own again.
    const users = sources.filter((f) =>
      f !== "searchDestinations.js" &&
      /from\s+["']\.\/searchDestinations(\.js)?["']/.test(read(f)));
    expect(users).toEqual(["UniversalSearch.jsx"]);
  });

  it("every search box renders that one component", () => {
    for (const page of ["Home.jsx", "Explore.jsx", "SearchPage.jsx"]) {
      expect([page, /from\s+["']\.\/UniversalSearch\.jsx["']/.test(read(page))])
        .toEqual([page, true]);
      expect([page, /<UniversalSearch\b/.test(read(page))]).toEqual([page, true]);
    }
  });

  it("/search stays a thin deep-linkable wrapper", () => {
    const page = read("SearchPage.jsx");
    // No hook, no rows, no destination logic — a header and the component.
    expect(page).not.toMatch(/useUniversalSearch|resultHref|group_key/);
    expect(read("App.jsx")).toMatch(/path="\/search"/);
  });
});

// ---------------------------------------------------------------- behaviour
let RPC_ROWS = [];
const rpcCalls = [];
const tableCalls = [];

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (fn, args) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: RPC_ROWS, error: null });
    },
    from: (table) => {
      tableCalls.push(table);
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

// Explore and Home both read the curriculum through useExplore; one stub
// serves both so the two pages are compared under identical conditions.
vi.mock("./useExplore.js", () => ({
  useLearningGoals: () => ({
    goals: [{ id: 1, slug: "jee", name: "JEE", count: 10 }],
    loading: false, error: null, retry: () => {},
  }),
  useClassLevels: () => ({
    classLevels: [{ id: 2, slug: "class-11", name: "Class 11" }],
  }),
  useBoards: () => ({ boards: [], loading: false, error: null, unavailable: false }),
  usePopulatedClasses: () => ({
    classSlugs: ["class-11"], loading: false, error: null, ready: true, retry: () => {},
  }),
  useGoalCatalog: () => ({
    subjects: [{ id: 11, slug: "physics", name: "Physics", count: 16 }],
    chaptersBySubject: { 11: [{ id: 101, slug: "kinematics", name: "Kinematics", count: 4 }] },
    loading: false, error: null, ready: true, retry: () => {},
  }),
}));

vi.mock("./usePlaylistBrowse.js", () => ({
  usePlaylistBrowse: () => ({ items: [], total: null, loading: false, error: null }),
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
const { default: Explore } = await import("./Explore.jsx");
const { ThemeProvider } = await import("./theme.jsx");
const { DEBOUNCE_MS } = await import("./useUniversalSearch.js");

// One lesson, carrying exactly what the deployed universal_search sends for a
// lecture: the course it sits in, the chapter, and the YouTube id.
const LECTURE = {
  group_key: "lecture", entity_id: 9, title: "Relative motion",
  subtitle: "Kinematics · Physics", aka: null, slug: null,
  match_type: "exact", match_rank: 1, matched_on: "Relative motion",
  is_ambiguous: false, group_total: 1,
  extra: { playlist_id: 5, chapter_id: 7, subject_id: 11, youtube_video_id: "CBvaO-uDvs8" },
};

const WATCH_PAGE = "/course/5/chapter/7?v=CBvaO-uDvs8";

const settle = async () => {
  await act(async () => { vi.advanceTimersByTime(DEBOUNCE_MS + 20); });
  await act(async () => { await Promise.resolve(); });
};

const lectureRow = () =>
  [...document.querySelectorAll("a")]
    .find((a) => a.textContent.includes("Relative motion"));

const renderHome = (url) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Home />
      </MemoryRouter>
    </ThemeProvider>,
  );

const renderExplore = (url) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/explore/:goal/:s1/:s2" element={<Explore />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  RPC_ROWS = [LECTURE];
  rpcCalls.length = 0;
  tableCalls.length = 0;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("the homepage hero and Explore run the same engine", () => {
  it("the hero asks universal_search, not a renderer of its own", async () => {
    renderHome("/?q=relative motion");
    await settle();
    expect(rpcCalls.map((c) => c.fn)).toEqual(["universal_search"]);
    expect(rpcCalls[0].args.p_query).toBe("relative motion");
  });

  it("Explore's box asks the same RPC instead of an ilike on videos", async () => {
    renderExplore("/explore/jee/class-11/physics");
    fireEvent.change(await screen.findByPlaceholderText("Search the library"), {
      target: { value: "relative motion" },
    });
    await settle();

    expect(rpcCalls.map((c) => c.fn)).toEqual(["universal_search"]);
    expect(rpcCalls[0].args.p_query).toBe("relative motion");
    // The deleted hook read these two tables directly. Nothing may again.
    expect(tableCalls).not.toContain("videos");
    expect(tableCalls).not.toContain("chapters");
  });

  it("a typo-tolerant query is asked verbatim from Explore too", async () => {
    // "projctile motin" only finds anything because universal_search does the
    // fuzzy work server-side. The old scoped hook returned nothing for it.
    renderExplore("/explore/jee/class-11/physics");
    fireEvent.change(await screen.findByPlaceholderText("Search the library"), {
      target: { value: "projctile motin" },
    });
    await settle();
    expect(rpcCalls.at(-1).args.p_query).toBe("projctile motin");
  });
});

describe("one destination policy, whichever box the student typed in", () => {
  it("a lecture opens the lesson from the homepage hero", async () => {
    renderHome("/?q=relative motion");
    await settle();
    await waitFor(() => expect(lectureRow()).toBeTruthy());
    expect(lectureRow().getAttribute("href")).toBe(WATCH_PAGE);
  });

  it("...and the identical link from inside Explore", async () => {
    // The drift this replaces: Explore sent lecture rows to /browse?sub=…&ch=…,
    // a filtered catalogue the student then had to hunt through for the very
    // lesson they had already found.
    renderExplore("/explore/jee/class-11/physics");
    fireEvent.change(await screen.findByPlaceholderText("Search the library"), {
      target: { value: "relative motion" },
    });
    await settle();
    await waitFor(() => expect(lectureRow()).toBeTruthy());
    expect(lectureRow().getAttribute("href")).toBe(WATCH_PAGE);
    expect(lectureRow().getAttribute("href")).not.toContain("/browse");
  });
});

describe("Explore no longer claims a scope it cannot enforce", () => {
  it("says the search is library-wide, and names what it is NOT limited to", async () => {
    renderExplore("/explore/jee/class-11/physics");
    fireEvent.change(await screen.findByPlaceholderText("Search the library"), {
      target: { value: "relative motion" },
    });
    await settle();

    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).toContain("Searching the whole library");
    expect(heading.textContent).toContain("JEE › Class 11 › Physics");
  });

  it("does not send a scope argument universal_search has no parameter for", async () => {
    renderExplore("/explore/jee/class-11/physics");
    fireEvent.change(await screen.findByPlaceholderText("Search the library"), {
      target: { value: "relative motion" },
    });
    await settle();
    // The deployed signature is (p_query, p_types, p_limit, p_offset). Sending
    // an invented p_goal would fail the call outright.
    expect(Object.keys(rpcCalls[0].args).sort())
      .toEqual(["p_limit", "p_offset", "p_query", "p_types"]);
  });
});
