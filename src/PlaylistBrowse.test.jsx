// Tests for the four blockers in the playlist-first catalogue.
//
// These assert the QUERY the hook builds and the LINKS the UI produces, because
// that is where all four defects lived: a goal filter that was never applied, an
// invented chapter id, a dead comparison route, and chapter filtering done in
// the browser instead of the database.
//
// Run: npm test
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";

// ---- a fake PostgREST builder that records what was asked for ----
const calls = [];
function makeBuilder(rows, count) {
  const rec = { table: null, cols: null, eq: {}, range: null, ilike: null, orders: [] };
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order(column, options) {
      rec.orders.push(options?.ascending === false ? `${column} desc` : column);
      return b;
    },
    range(a, z) { rec.range = [a, z]; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    ilike(k, v) { rec.ilike = [k, v]; return b; },
    in(k, v) { rec.in = [k, v]; return b; },
    then(resolve) { return Promise.resolve({ data: rows, error: null, count }).then(resolve); },
  };
  calls.push(rec);
  return b;
}
let ROWS = [];
let COUNT = 0;
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { from: (t) => { const b = makeBuilder(ROWS, COUNT); calls[calls.length - 1].table = t; return b; } },
}));

import { usePlaylistBrowse, PAGE_SIZE, formatDuration } from "./usePlaylistBrowse.js";
import PlaylistBrowse from "./PlaylistBrowse.jsx";

// Drives the hook and reports nothing — we assert on the recorded query.
function Probe(props) {
  usePlaylistBrowse(props);
  return null;
}
const run = async (props) => {
  render(<MemoryRouter><Probe {...props} /></MemoryRouter>);
  await new Promise((r) => setTimeout(r, 0));
  return calls[calls.length - 1];
};

const row = (id, title, over = {}) => ({
  id, title, teacher: null, average_rating: 0, ratings_count: 0,
  language: null, content_type: null, difficulty: null, class_levels: [],
  institutes_channels: null, subjects: null, playlist_videos: [{ count: 3 }], ...over,
});

beforeEach(() => { calls.length = 0; ROWS = []; COUNT = 0; });

describe("goal isolation", () => {
  it("filters by learning goal in the DATABASE when a goal is selected", async () => {
    const q = await run({ goalId: 1 });
    expect(q.eq["playlist_learning_goals.learning_goal_id"]).toBe(1);
    expect(q.cols).toContain("playlist_learning_goals!inner");
  });

  it("JEE and NEET produce different queries — this is what was broken", async () => {
    const jee = await run({ goalId: 1 });
    calls.length = 0;
    const neet = await run({ goalId: 2 });
    expect(jee.eq["playlist_learning_goals.learning_goal_id"]).toBe(1);
    expect(neet.eq["playlist_learning_goals.learning_goal_id"]).toBe(2);
    expect(jee.eq["playlist_learning_goals.learning_goal_id"])
      .not.toBe(neet.eq["playlist_learning_goals.learning_goal_id"]);
  });

  it("adds NO goal join when no goal is selected, so untagged courses still show", async () => {
    const q = await run({});
    expect(q.cols).not.toContain("playlist_learning_goals");
    expect(q.eq["playlist_learning_goals.learning_goal_id"]).toBeUndefined();
  });
});

describe("chapter filtering happens in the database", () => {
  it("uses an inner join + eq, never a client-side id list", async () => {
    const q = await run({ chapterId: 42 });
    expect(q.cols).toContain("videos!inner(chapter_id)");
    expect(q.eq["pv.videos.chapter_id"]).toBe(42);
    expect(q.in).toBeUndefined();          // the old .in(id, [...]) aggregation
  });

  it("issues ONE query, not a pre-fetch of every playlist_videos row", async () => {
    calls.length = 0;
    await run({ chapterId: 42 });
    expect(calls.filter((c) => c.table === "playlist_videos")).toHaveLength(0);
    expect(calls.filter((c) => c.table === "playlists")).toHaveLength(1);
  });
});

describe("pagination", () => {
  it("uses curated curriculum order before ratings and stable tie-breakers", async () => {
    const q = await run({});
    expect(q.cols).toContain("display_order");
    expect(q.orders).toEqual([
      "display_order",
      "ratings_count desc",
      "title",
      "id",
    ]);
  });

  it("requests only one page, not the whole catalogue", async () => {
    const q = await run({});
    expect(q.range).toEqual([0, PAGE_SIZE - 1]);
    expect(q.opts).toEqual({ count: "exact" });
  });

  it("offsets correctly under a large fixture", async () => {
    COUNT = 500;
    ROWS = Array.from({ length: PAGE_SIZE }, (_, i) => row(i + 1, `Course ${i + 1}`));
    const q = await run({ page: 7 });
    expect(q.range).toEqual([7 * PAGE_SIZE, 8 * PAGE_SIZE - 1]);
    // a 500-row catalogue must never be fetched whole
    expect(q.range[1] - q.range[0] + 1).toBe(PAGE_SIZE);
  });
});

// ---- link behaviour ----
function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

// The probe prints pathname+search; `.search` is named for readability at the
// call site, and `toContain` works the same against the combined string.
const location = () => ({ search: screen.getAllByTestId("loc")[0].textContent });

const renderBrowse = (filters, url = "/browse", props = {}) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/browse" element={
          <>
            <LocationProbe />
            <PlaylistBrowse tab="playlists" onTabChange={() => {}} filters={filters} lectureView={null} {...props} />
          </>
        } />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );

describe("opening a course", () => {
  beforeEach(() => {
    COUNT = 1;
    ROWS = [row(11, "Complete Kinematics")];
  });

  it("links WITHOUT a chapter segment when no chapter is selected", async () => {
    renderBrowse({ subject: null, chapter: null, search: "" });
    const btn = await screen.findByText("View course");
    fireEvent.click(btn);
    // never /chapter/0 — chapter 0 does not exist
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/course/11"));
  });

  it("includes the chapter when one IS selected", async () => {
    renderBrowse({ subject: null, chapter: 5, search: "" });
    const btn = await screen.findByText("View course");
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/course/11/chapter/5"));
  });
});

describe("comparison", () => {
  beforeEach(() => { COUNT = 2; ROWS = [row(11, "A"), row(12, "B")]; });

  // Now that /compare is a real destination the controls are present. The
  // previous two tests here asserted their ABSENCE, which was right only while
  // the journey ended nowhere.
  it("writes the selection into the url so it can be shared", async () => {
    renderBrowse({ subject: null, chapter: null, search: "" });
    await screen.findAllByText("View course");
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    await waitFor(() => expect(location().search).toContain("compare=11"));
  });

  it("restores a selection from ?compare= after a refresh", async () => {
    renderBrowse({ subject: null, chapter: null, search: "" }, "/browse?compare=11,12");
    await screen.findAllByText("View course");
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes[0].checked).toBe(true);
    expect(boxes[1].checked).toBe(true);
  });

  it("shows the tray but withholds Compare until two are chosen", async () => {
    renderBrowse({ subject: null, chapter: 77, search: "" }, "/browse?compare=11");
    await screen.findAllByText("View course");
    expect(screen.getByText(/pick 1 more/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Compare 1$/ }).disabled).toBe(true);
  });

  it("enables the tray at two", async () => {
    renderBrowse({ subject: null, chapter: 77, search: "" }, "/browse?compare=11,12");
    await screen.findAllByText("View course");
    expect(screen.getByRole("button", { name: /^Compare 2$/ }).disabled).toBe(false);
  });

  it("carries chapter and learning-goal ids into comparison", async () => {
    renderBrowse(
      { goal: 9, subject: null, chapter: 77, search: "" },
      "/browse?compare=11,12",
    );
    await screen.findAllByText("View course");
    fireEvent.click(screen.getByRole("button", { name: /^Compare 2$/ }));
    await waitFor(() => expect(screen.getByTestId("loc").textContent)
      .toBe("/compare?chapter=77&ids=11%2C12&goal=9"));
  });

  it("deselects on a second click and drops the param when empty", async () => {
    renderBrowse({ subject: null, chapter: null, search: "" }, "/browse?compare=11");
    await screen.findAllByText("View course");
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    await waitFor(() => expect(location().search).not.toContain("compare"));
  });

  it("refuses a fifth selection rather than silently dropping one", async () => {
    renderBrowse({ subject: null, chapter: null, search: "" }, "/browse?compare=1,2,3,4");
    await screen.findAllByText("View course");
    // 11 and 12 are not among the four already chosen, so both are disabled.
    screen.getAllByRole("checkbox").forEach((b) => expect(b.disabled).toBe(true));
  });

  it("hides the whole journey when production comparison is unavailable", async () => {
    renderBrowse(
      { subject: null, chapter: 77, search: "" },
      "/browse?compare=11,12",
      { comparisonEnabled: false },
    );
    await screen.findAllByText("View course");
    expect(screen.queryByRole("checkbox", { name: "Compare" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Compare 2/ })).toBeNull();
  });
});

describe("mobile filter dialog accessibility", () => {
  it("moves focus into the dialog, closes on Escape, and restores focus", async () => {
    renderBrowse({ subject: null, chapter: null, search: "", sheetContent: <div>Filter choices</div> });
    const trigger = screen.getByRole("button", { name: "Filters" });
    fireEvent.click(trigger);
    const close = screen.getByRole("button", { name: "Close filters" });
    expect(document.activeElement).toBe(close);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("");
  });
});

describe("honest metadata", () => {
  it("omits duration entirely when unknown", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(6000)).toBe("1h 40m");
  });
});
