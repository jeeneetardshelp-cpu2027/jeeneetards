// ROUTE-LEVEL test: does ?goal=1 actually reach the playlist query?
//
// The original defect — usePlaylistBrowse accepting a goalId that no caller
// ever supplied — survived a full suite of hook tests, because every one of
// them passed goalId in by hand. Testing the hook in isolation could only ever
// prove the hook works when wired; it could not prove anything was wiring it.
//
// This starts where a student starts: a URL. It renders the real Dashboard at
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
  const rec = { table, cols: null, eq: {}, range: null };
  calls.push(rec);
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order() { return b; },
    limit() { return b; },
    range(a, z) { rec.range = [a, z]; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    ilike() { return b; },
    in() { return b; },
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

import Dashboard from "./Dashboard.jsx";

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/browse" element={<Dashboard />} /></Routes>
    </MemoryRouter>
  );

const playlistQuery = () =>
  calls.filter((c) => c.table === "playlists" && c.range != null).at(-1);

beforeEach(() => {
  calls.length = 0;
  rpcCalls.length = 0;
});

describe("Dashboard route → playlist query", () => {
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

  it("carries subject and chapter from the URL too", async () => {
    renderAt("/browse?goal=1&sub=3&ch=7");
    await screen.findByText("Playlists");
    // A chapter URL waits for the optional v13 canonical-scope lookup before
    // enabling results, including legacy id-based links.
    await waitFor(() => expect(playlistQuery()).toBeTruthy());
    const q = playlistQuery();
    expect(q.eq["subject_id"]).toBe("3");
    expect(q.eq["pv.videos.chapter_id"]).toBe("7");
    expect(q.cols).toContain("videos!inner(chapter_id)");
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
});
