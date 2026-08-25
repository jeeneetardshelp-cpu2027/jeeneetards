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
let NEXT_RESULTS = [];
function makeBuilder(rows, count) {
  const rec = {
    table: null, cols: null, eq: {}, range: null, ilike: null, orders: [],
    referencedOrders: {}, referencedRanges: {},
  };
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order(column, options) {
      const value = options?.ascending === false ? `${column} desc` : column;
      if (options?.referencedTable) {
        (rec.referencedOrders[options.referencedTable] ??= []).push(value);
      } else {
        rec.orders.push(value);
      }
      return b;
    },
    range(a, z, options) {
      if (options?.referencedTable) rec.referencedRanges[options.referencedTable] = [a, z];
      else rec.range = [a, z];
      return b;
    },
    eq(k, v) { rec.eq[k] = v; return b; },
    ilike(k, v) { rec.ilike = [k, v]; return b; },
    in(k, v) { rec.in = [k, v]; return b; },
    then(resolve) {
      const result = NEXT_RESULTS.length
        ? NEXT_RESULTS.shift()
        : { data: rows, error: null, count };
      return Promise.resolve(result).then(resolve);
    },
  };
  calls.push(rec);
  return b;
}
let ROWS = [];
let COUNT = 0;
// The catalogue search now resolves matching ids via an RPC before the list
// query. Default to a non-empty match so a search-bearing probe still issues
// its list request; tests that care about the ids set RPC_RESULT themselves.
let RPC_RESULT = { data: [{ id: 1 }], error: null };
const ratingsMock = vi.hoisted(() => ({ available: null }));
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t) => { const b = makeBuilder(ROWS, COUNT); calls[calls.length - 1].table = t; return b; },
    rpc: () => Promise.resolve(RPC_RESULT),
  },
}));
vi.mock("./useRatingsAvailability.js", () => ({
  useRatingsAvailability: () => ratingsMock.available,
}));
const popularityMock = vi.hoisted(() => ({ available: null }));
vi.mock("./usePopularityAvailability.js", () => ({
  usePopularityAvailability: () => popularityMock.available,
}));

import {
  usePlaylistBrowse, PAGE_SIZE, formatDuration, isMissingBrowseStatsColumn,
} from "./usePlaylistBrowse.js";
import PlaylistBrowse, { PlaylistCard } from "./PlaylistBrowse.jsx";
import { ThemeProvider } from "./theme.jsx";

// Drives the hook and reports nothing — we assert on the recorded query.
function Probe(props) {
  usePlaylistBrowse(props);
  return null;
}
function ResultProbe(props) {
  const result = usePlaylistBrowse(props);
  return <span>{result.items[0]?.coverVideoId ?? "none"}</span>;
}
function LogoProbe(props) {
  const result = usePlaylistBrowse(props);
  return <span>{result.items[0]?.instituteLogoUrl ?? "none"}</span>;
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

beforeEach(() => {
  calls.length = 0;
  NEXT_RESULTS = [];
  RPC_RESULT = { data: [{ id: 1 }], error: null };
  ROWS = [];
  COUNT = 0;
  ratingsMock.available = null;
  popularityMock.available = null;
});

describe("playlist card channel navigation", () => {
  it("links the channel credit to all courses from that channel", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <PlaylistCard
            course={{
              id: 11,
              title: "Indefinite Integration",
              subject: "Mathematics",
              instituteId: 5,
              institute: "Mohit Tyagi",
              instituteLogoUrl: "https://yt3.ggpht.com/mohit-tyagi=s88",
              classLevels: [],
            }}
            to="/course/11"
            comparisonEnabled={false}
          />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "View all courses from Mohit Tyagi" })
      .getAttribute("href")).toBe("/browse?channel=5");
    expect(screen.getByRole("link", { name: "View course" })
      .getAttribute("href")).toBe("/course/11");
  });
});

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
  it("maps the channel logo selected with each playlist", async () => {
    ROWS = [row(11, "Indefinite Integration", {
      institutes_channels: {
        id: 5,
        name: "Mohit Tyagi",
        logo_url: "https://yt3.ggpht.com/mohit-tyagi=s88",
      },
    })];
    COUNT = 1;

    render(<MemoryRouter><LogoProbe /></MemoryRouter>);
    expect(await screen.findByText("https://yt3.ggpht.com/mohit-tyagi=s88")).toBeTruthy();
    expect(calls[0].cols).toContain("institutes_channels(id, name, logo_url)");
  });

  it("fetches only the first lesson image as each playlist cover", async () => {
    ROWS = [row(11, "Indefinite Integration", {
      cover: [{ id: 99, position: 1, videos: { youtube_video_id: "CBvaO-uDvs8" } }],
    })];
    COUNT = 1;

    render(<MemoryRouter><ResultProbe /></MemoryRouter>);
    expect(await screen.findByText("CBvaO-uDvs8")).toBeTruthy();

    const q = calls[0];
    expect(q.cols).toContain("cover:playlist_videos");
    expect(q.cols).toContain("videos(youtube_video_id)");
    expect(q.referencedOrders.cover).toEqual(["position", "id"]);
    expect(q.referencedRanges.cover).toEqual([0, 0]);
  });

  it("uses curated curriculum order before popularity and stable tie-breakers", async () => {
    const q = await run({});
    expect(q.cols).toContain("display_order");
    // Default "recommended" sort: curated display_order leads, popularity_score
    // ranks alternatives at the same curriculum position, id is the unique tie-break.
    expect(q.orders).toEqual([
      "display_order",
      "popularity_score desc",
      "title",
      "id",
    ]);
  });

  it("applies the chosen sort, keeping id as the unique tie-breaker", async () => {
    expect((await run({ sort: "most_viewed" })).orders).toEqual(["view_count_total desc", "id"]);
    expect((await run({ sort: "popular" })).orders).toEqual(["popularity_score desc", "id"]);
    expect((await run({ sort: "recent" })).orders).toEqual(["created_at desc", "id"]);
    // an unknown sort falls back to recommended rather than producing no order
    expect((await run({ sort: "bogus" })).orders).toEqual([
      "display_order", "popularity_score desc", "title", "id",
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

  it("retries without optional popularity columns when an older schema lacks them", async () => {
    ROWS = [row(11, "Indefinite Integration")];
    COUNT = 1;
    NEXT_RESULTS.push({
      data: null,
      count: null,
      error: {
        code: "42703",
        message: "column playlists.view_count_total does not exist",
      },
    });

    await run({});

    expect(calls).toHaveLength(2);
    expect(calls[0].cols).toContain("view_count_total");
    expect(calls[0].orders).toEqual([
      "display_order", "popularity_score desc", "title", "id",
    ]);
    expect(calls[1].cols).not.toContain("view_count_total");
    expect(calls[1].cols).not.toContain("stats_fetched_at");
    expect(calls[1].orders).toEqual(["display_order", "title", "id"]);
  });

  it("uses the same compatibility fallback when popularity ordering is absent", async () => {
    NEXT_RESULTS.push({
      data: null,
      count: null,
      error: {
        code: "42703",
        message: "column playlists.popularity_score does not exist",
      },
    });

    await run({ sort: "popular" });

    expect(calls).toHaveLength(2);
    expect(calls[0].orders).toEqual(["popularity_score desc", "id"]);
    expect(calls[1].orders).toEqual(["display_order", "title", "id"]);
  });

  it("does not retry unrelated missing-column errors", async () => {
    const error = { code: "42703", message: "column playlists.teacher does not exist" };
    NEXT_RESULTS.push({ data: null, count: null, error });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await run({});

    expect(calls).toHaveLength(1);
    expect(log).toHaveBeenCalledWith("playlist browse:", error);
    log.mockRestore();
    expect(isMissingBrowseStatsColumn({
      code: "PGRST204",
      message: "Could not find the 'title' column of 'playlists' in the schema cache",
    })).toBe(false);
  });

  it("does not launch a fallback for a stale request generation", async () => {
    let resolveOld;
    NEXT_RESULTS.push(new Promise((resolve) => { resolveOld = resolve; }));
    const view = render(
      <MemoryRouter><Probe search="old" /></MemoryRouter>,
    );
    await waitFor(() => expect(calls).toHaveLength(1));

    view.rerender(<MemoryRouter><Probe search="new" /></MemoryRouter>);
    await waitFor(() => expect(calls).toHaveLength(2));

    resolveOld({
      data: null,
      count: null,
      error: {
        code: "42703",
        message: "column playlists.view_count_total does not exist",
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).toHaveLength(2);
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

describe("rating sort truthfulness", () => {
  it("hides Highest rated when the catalogue confirms zero rated courses", async () => {
    ratingsMock.available = false;
    renderBrowse({ subject: null, chapter: null, search: "" });

    const sort = await screen.findByRole("combobox", { name: "Sort courses" });
    expect([...sort.options].map((option) => option.text)).not.toContain("Highest rated");
  });

  it("removes a stale rating sort URL when no rated courses exist", async () => {
    ratingsMock.available = false;
    renderBrowse(
      { subject: null, chapter: null, search: "" },
      "/browse?sort=rating&page=2",
    );

    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/browse"));
    expect(screen.getByRole("combobox", { name: "Sort courses" }).value).toBe("recommended");
  });

  it("shows Highest rated once genuine ratings exist", async () => {
    ratingsMock.available = true;
    renderBrowse({ subject: null, chapter: null, search: "" });

    const sort = await screen.findByRole("combobox", { name: "Sort courses" });
    expect([...sort.options].map((option) => option.text)).toContain("Highest rated");
  });
});

describe("popularity sort truthfulness", () => {
  const optionTexts = async () => {
    const sort = await screen.findByRole("combobox", { name: "Sort courses" });
    return [...sort.options].map((option) => option.text);
  };

  it("hides Most popular and Most viewed when both columns are empty", async () => {
    popularityMock.available = { popular: false, views: false };
    renderBrowse({ subject: null, chapter: null, search: "" });

    const texts = await optionTexts();
    expect(texts).not.toContain("Most popular");
    expect(texts).not.toContain("Most viewed");
    // The tool the student came for is still there.
    expect(texts).toContain("Recommended");
    expect(texts).toContain("Recently added");
  });

  it("hides each sort independently when only its own column is empty", async () => {
    popularityMock.available = { popular: true, views: false };
    renderBrowse({ subject: null, chapter: null, search: "" });

    const texts = await optionTexts();
    expect(texts).toContain("Most popular");
    expect(texts).not.toContain("Most viewed");
  });

  it("keeps both while the availability check is unknown", async () => {
    popularityMock.available = null;
    renderBrowse({ subject: null, chapter: null, search: "" });

    const texts = await optionTexts();
    expect(texts).toContain("Most popular");
    expect(texts).toContain("Most viewed");
  });

  it("removes a stale most_viewed sort URL when no course has views", async () => {
    popularityMock.available = { popular: false, views: false };
    renderBrowse(
      { subject: null, chapter: null, search: "" },
      "/browse?sort=most_viewed&page=2",
    );

    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/browse"));
    expect(screen.getByRole("combobox", { name: "Sort courses" }).value).toBe("recommended");
  });
});

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

describe("structured data (course ItemList)", () => {
  beforeEach(() => {
    COUNT = 3;
    ROWS = [
      row(11, "Complete Kinematics"),
      row(12, "Newton's Laws"),
      row(13, "Rotational Motion"),
    ];
  });

  function itemList() {
    const el = document.head.querySelector(
      'script[type="application/ld+json"][data-schema-key="ItemList"]',
    );
    return el ? JSON.parse(el.textContent) : null;
  }

  // The schema script is written by an effect that does not necessarily flush
  // by the time the course cards are queryable, so waiting on the cards is not
  // enough — wait on the script itself.
  async function findItemList() {
    let list = null;
    await waitFor(() => {
      list = itemList();
      expect(list).not.toBeNull();
    });
    return list;
  }

  it("numbers the visible course cards from 1 and links to the same href the card uses", async () => {
    renderBrowse({ subject: null, chapter: null, search: "" });
    const list = await findItemList();
    expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(list.itemListElement[0]).toMatchObject({
      name: "Complete Kinematics",
      url: "https://www.jeeneetard.com/course/11",
    });
  });

  it("folds in the real pagination offset — page 3 is numbered 25-27, not 1-3", async () => {
    renderBrowse({ subject: null, chapter: null, search: "" }, "/browse?page=2");
    const list = await findItemList();
    expect(list.itemListElement.map((i) => i.position)).toEqual([
      2 * PAGE_SIZE + 1, 2 * PAGE_SIZE + 2, 2 * PAGE_SIZE + 3,
    ]);
  });

  it("writes nothing while courses are still loading", () => {
    renderBrowse({ subject: null, chapter: null, search: "" });
    // Asserted synchronously, before the faked Supabase promise has resolved —
    // rule 1 forbids describing a catalogue page before it has real results.
    expect(itemList()).toBeNull();
  });
});

describe("honest metadata", () => {
  it("omits duration entirely when unknown", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
    expect(formatDuration(6000)).toBe("1h 40m");
  });
});
