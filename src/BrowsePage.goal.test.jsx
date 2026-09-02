// ROUTE-LEVEL test: does ?goal=1 actually reach the playlist query?
//
// The original defect — usePlaylistBrowse accepting a goalId that no caller
// ever supplied — survived a full suite of hook tests, because every one of
// them passed goalId in by hand. Testing the hook in isolation could only ever
// prove the hook works when wired; it could not prove anything was wiring it.
//
// This starts where a student starts: a URL. It renders the real BrowsePage at
// /browse?goal=1 and asserts the goal reaches the database query.
//
// Run: npm test
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

// Record every query the page issues.
const calls = [];
const rpcCalls = [];
function builder(table) {
  const rec = { table, cols: null, eq: {}, range: null, orders: [] };
  calls.push(rec);
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order(column, options) {
      // A referencedTable order sorts an embedded resource (the lecture query
      // bounds its course embed that way), not the page itself. Only the
      // page's own ordering belongs in `orders`.
      if (options?.referencedTable) return b;
      rec.orders.push(
        column
          + (options?.ascending === false ? " desc" : "")
          + (options?.nullsFirst === false ? " nullslast" : ""),
      );
      return b;
    },
    limit() { return b; },
    range(a, z) { rec.range = [a, z]; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    ilike() { return b; },
    in() { return b; },
    // The legacy-chapter label lookup (useChapterName) resolves nothing here;
    // BrowsePage.legacyChapterChip.test.jsx covers the labelled path.
    // A board slug DOES resolve here: useCanonicalFilters stays un-ready until
    // every slug in the URL becomes an id, so without this row a board view
    // could never reach the facet-count request the test below asserts.
    maybeSingle() {
      if (rec.table === "boards" && rec.eq.slug === "cbse") {
        return Promise.resolve({ data: { id: 1, slug: "cbse", name: "CBSE" }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve) { return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve); },
  };
  return b;
}
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t) => builder(t),
    rpc: (name) => {
      rpcCalls.push(name);
      return Promise.resolve({ data: [], error: null });
    },
  },
}));

import BrowsePage from "./BrowsePage.jsx";

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/browse" element={<BrowsePage />} /></Routes>
    </MemoryRouter>
  );

const playlistQuery = () =>
  calls.filter((c) => c.table === "playlists" && c.range != null).at(-1);

beforeEach(() => {
  calls.length = 0;
  rpcCalls.length = 0;
});

describe("BrowsePage route → playlist query", () => {
  it("carries ?goal=1 from the URL into the playlist query", async () => {
    renderAt("/browse?goal=1");
    await screen.findByText("Playlists");
    const q = playlistQuery();
    expect(q, "no paged playlists query was issued").toBeTruthy();
    // THE assertion the hook-only tests could not make
    expect(q.eq["playlist_learning_goals.learning_goal_id"]).toBe("1");
    expect(q.cols).toContain("playlist_learning_goals!inner");
  });

  it("carries a different goal — JEE and NEET are not interchangeable", async () => {
    renderAt("/browse?goal=2");
    await screen.findByText("Playlists");
    expect(playlistQuery().eq["playlist_learning_goals.learning_goal_id"]).toBe("2");
  });

  it("applies no goal filter when the URL has none", async () => {
    renderAt("/browse");
    await screen.findByText("Playlists");
    const q = playlistQuery();
    expect(q.eq["playlist_learning_goals.learning_goal_id"]).toBeUndefined();
    expect(q.cols).not.toContain("playlist_learning_goals");
  });

  it("loads scoped faculty facets from the public browse page", async () => {
    renderAt("/browse");
    await screen.findByText("Playlists");
    await waitFor(() => expect(rpcCalls).toContain("get_faculty_facets"));
  });

  // The count RPC has no board argument, so the old gate switched counts off
  // on any board view - and with them the only signal that school Class 11 and
  // Class 12 hold nothing. Counts are now fetched there too, as an upper bound
  // that prunes dead ends but is never displayed.
  // get_faculty_facets used to fire twice per load: once with every id null,
  // while useCanonicalFilters was still turning the URL slugs into ids, and
  // again when they arrived. The hook has always taken an `enabled` flag; the
  // call site passed none. Slugs never resolve in this harness, so a page that
  // waits correctly asks nothing at all here — and one that does not, asks.
  it("does not ask for faculty facets before the URL slugs have resolved", async () => {
    renderAt("/browse?goal=jee&subject=physics");
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 120));
    expect(rpcCalls.filter((n) => n === "get_faculty_facets")).toHaveLength(0);
  });
  it("still asks for facet counts on a board view", async () => {
    renderAt("/browse?goal=4&board=cbse&class=10");
    await waitFor(() => expect(rpcCalls).toContain("browse_facet_counts"));
  });

  it("still asks for facet counts on a faculty view", async () => {
    renderAt("/browse?goal=1&teacher=7");
    await waitFor(() => expect(rpcCalls).toContain("browse_facet_counts"));
  });

  it("carries subject and chapter from the URL too", async () => {
    renderAt("/browse?goal=1&sub=3&ch=7");
    await screen.findByText("Playlists");
    // A chapter URL waits for the optional v13 canonical-scope lookup before
    // enabling results, including legacy id-based links.
    await waitFor(() => expect(playlistQuery()).toBeTruthy());
    const q = playlistQuery();
    expect(q.eq["subject_id"]).toBe("3");
    expect(q.eq["pv.videos.chapter_id"]).toBe("7");
    // The embed also carries duration_seconds now, so match the join itself
    // rather than an exact column list: the point is that chapter filtering is
    // an inner join in the DATABASE, not a client-side id list.
    expect(q.cols).toContain("pv:playlist_videos!inner(videos!inner(chapter_id");
  });

  it("keeps the page offset from the URL", async () => {
    renderAt("/browse?page=3");
    await screen.findByText("Playlists");
    const q = playlistQuery();
    expect(q.range[0]).toBe(36);      // page 3 * PAGE_SIZE 12
    expect(q.range[1]).toBe(47);
  });

  it("defaults to the Playlists tab, not the video dump", async () => {
    renderAt("/browse");
    const playlists = await screen.findByText("Playlists");
    expect(playlists.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Individual lectures").getAttribute("aria-current")).toBeNull();
    expect(screen.getByPlaceholderText("Search courses and lessons…")).toBeTruthy();
    expect(calls.filter((c) => c.table === "videos" && c.range != null)).toHaveLength(0);
  });

  it("keeps a URL search visible, counted, and resettable on mobile", async () => {
    renderAt("/browse?q=kinematics");

    expect(await screen.findByRole("heading", {
      name: "Search results for “kinematics”",
    })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Filters (1)" }));
    const mobileSearch = screen.getByRole("textbox", { name: "Search catalogue" });
    expect(mobileSearch.value).toBe("kinematics");

    const reset = screen.getByRole("button", { name: "Reset" });
    expect(reset.disabled).toBe(false);
    fireEvent.click(reset);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "All courses" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
      expect(screen.getByRole("textbox", { name: "Search catalogue" }).value).toBe("");
    });

    // The old bug re-added q when the stale debounced field fired.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByRole("heading", { name: "All courses" })).toBeTruthy();
  });

  it("queries only a lecture page when the lectures tab is active", async () => {
    renderAt("/browse?tab=lectures&page=7&goal=1");
    const lectures = await screen.findByText("Individual lectures");
    expect(lectures.getAttribute("aria-current")).toBe("page");
    expect(calls.filter((c) => c.table === "playlists" && c.range != null)).toHaveLength(0);
    const q = calls.find((c) => c.table === "videos" && c.range != null);
    expect(q.range).toEqual([168, 191]);
    expect(q.eq["video_learning_goals.learning_goal_id"]).toBe("1");
  });

  it("carries ?lsort= from the URL into the lecture query's ordering", async () => {
    renderAt("/browse?tab=lectures&lsort=shortest");
    await screen.findByText("Individual lectures");
    await waitFor(() =>
      expect(calls.find((c) => c.table === "videos" && c.range != null)).toBeTruthy());
    const q = calls.find((c) => c.table === "videos" && c.range != null);
    // unknown durations last, id as the deterministic tie-break
    expect(q.orders).toEqual(["duration_seconds nullslast", "id"]);
    expect(screen.getByRole("combobox", { name: "Sort lessons" }).value).toBe("shortest");
  });
});
