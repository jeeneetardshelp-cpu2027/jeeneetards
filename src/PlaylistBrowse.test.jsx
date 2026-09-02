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
import PlaylistBrowse from "./PlaylistBrowse.jsx";
import { PlaylistCard } from "./PlaylistCard.jsx";
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
  // 132 courses store the channel name in `teacher`, so the card rendered an
  // initials circle, the channel logo, and the name twice: "C Competishun+ ·
  // Competishun+". One credit, one avatar.
  it("does not print the channel name twice when teacher repeats it", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <PlaylistCard
            course={{
              id: 167,
              title: "Hydrogen I Class - XI Chemistry",
              subject: "Chemistry",
              teacher: "Competishun+",
              instituteId: 9,
              institute: "Competishun+",
              classLevels: [],
            }}
            to="/course/167"
            comparisonEnabled={false}
          />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Competishun+")).toHaveLength(1);
    // The initials circle belongs to the teacher credit that is no longer shown.
    expect(screen.queryByText("C")).toBeNull();
  });
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
    // The embed also carries duration_seconds now, so match the join itself
    // rather than an exact column list: the point is that chapter filtering is
    // an inner join in the DATABASE, not a client-side id list.
    expect(q.cols).toContain("pv:playlist_videos!inner(videos!inner(chapter_id");
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

  it("honours a caller's page size, so one request can hold a whole chapter", async () => {
    // The watch page raises this: "Revise in one sitting" and "Other institutes
    // teaching…" both partition the same chapter's courses, and each used to
    // run its own query. Sharing one request only works if that request can
    // hold the chapter whole — the busiest has 22 courses and 18 of 249
    // populated chapters exceed the default 12, so the default would truncate.
    const q = await run({ pageSize: 32 });
    expect(q.range).toEqual([0, 31]);
  });

  it("offsets by the caller's page size, not the default", async () => {
    const q = await run({ page: 2, pageSize: 32 });
    expect(q.range).toEqual([64, 95]);
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

// While a term is active the default sort IS the server's relevance ranking
// (search_playlist_ids returns its ids ranked), so the word has to say so. No
// new option appears and no new ?sort= value exists — a sort id that only means
// something while you are typing would go stale in every shared URL, which is
// the exact problem the replace-effect above already has to clean up.
describe("the courses sort control during a search", () => {
  const optionTexts = async () => {
    const sort = await screen.findByRole("combobox", { name: "Sort courses" });
    return [...sort.options].map((option) => option.text);
  };

  it("names the default sort for what it does during a search", async () => {
    renderBrowse({ subject: null, chapter: null, search: "kinematics" }, "/browse?q=kinematics");

    const sort = await screen.findByRole("combobox", { name: "Sort courses" });
    expect([...sort.options].map((o) => o.text)[0]).toBe("Best match");
    expect([...sort.options].map((o) => o.value)).toEqual(
      ["recommended", "popular", "most_viewed", "rating", "recent"],
    );
    expect(sort.value).toBe("recommended");
    // The URL is untouched: "Best match" is a word, not a preference.
    expect(screen.getByTestId("loc").textContent).not.toContain("sort=");
  });

  it("goes back to Recommended when the search box is empty", async () => {
    renderBrowse({ subject: null, chapter: null, search: "   " });
    expect((await optionTexts())[0]).toBe("Recommended");
  });

  it("does not resurrect a sort the catalogue cannot honour", async () => {
    popularityMock.available = { popular: false, views: false };
    renderBrowse({ subject: null, chapter: null, search: "kinematics" });

    const texts = await optionTexts();
    expect(texts[0]).toBe("Best match");
    expect(texts).not.toContain("Most popular");
    expect(texts).not.toContain("Most viewed");
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

// A chapter card must count the chapter, not the whole course.
//
// Measured against production on 2026-08-26: 73% of the 1,345 possible
// (chapter, course) cards overstated their lecture count, median 9x, because
// `playlist_videos(count)` is the whole-playlist total while the chapter filter
// constrains a SEPARATE aliased embed. A card read "30 lectures" and then opened
// a 2-lesson list, since CourseVideoPage scopes correctly and the card did not.
describe("chapter cards count the chapter, not the whole course", () => {
  // Reports "title:lectures" per card, in render order.
  function CardsProbe(props) {
    const { items } = usePlaylistBrowse(props);
    return <span data-testid="cards">{items.map((i) => `${i.title}:${i.lectures}`).join("|")}</span>;
  }
  const cards = async (props) => {
    render(<MemoryRouter><CardsProbe {...props} /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("cards").textContent).not.toBe(""));
    return screen.getByTestId("cards").textContent;
  };
  // `pv` is what the inner join returns: only this chapter's rows.
  const lesson = (seconds = 600) => ({ videos: { chapter_id: 42, duration_seconds: seconds } });

  it("uses the chapter-scoped row count, not playlist_videos(count)", async () => {
    ROWS = [row(1, "One Shot Series", { playlist_videos: [{ count: 30 }], pv: [lesson(), lesson()] })];
    COUNT = 1;
    // The card must say 2 (what it teaches on this chapter), never 30.
    expect(await cards({ chapterId: 42 })).toBe("One Shot Series:2");
  });

  it("ranks by real chapter depth, not alphabetically", async () => {
    // Alphabetically "Aakash" leads; by chapter depth "Zenith" does. Production
    // sort collapses to title because 472/477 rows share display_order and every
    // popularity_score is 0, which floated thin one-shot series to the top.
    ROWS = [
      row(1, "Aakash One Shot", { playlist_videos: [{ count: 49 }], pv: [lesson()] }),
      row(2, "Zenith Chapter Deep Dive", { playlist_videos: [{ count: 9 }], pv: [lesson(), lesson(), lesson()] }),
    ];
    COUNT = 2;
    expect(await cards({ chapterId: 42 })).toBe("Zenith Chapter Deep Dive:3|Aakash One Shot:1");
  });

  it("leaves an explicitly chosen sort alone", async () => {
    ROWS = [
      row(1, "Aakash One Shot", { playlist_videos: [{ count: 49 }], pv: [lesson()] }),
      row(2, "Zenith Chapter Deep Dive", { playlist_videos: [{ count: 9 }], pv: [lesson(), lesson(), lesson()] }),
    ];
    COUNT = 2;
    // Only the DEFAULT ordering is re-ranked; "recent" is the student's choice.
    expect(await cards({ chapterId: 42, sort: "recent" })).toBe("Aakash One Shot:1|Zenith Chapter Deep Dive:3");
  });

  it("still shows the whole-course count when NOT scoped to a chapter", async () => {
    ROWS = [row(1, "One Shot Series", { playlist_videos: [{ count: 30 }] })];
    COUNT = 1;
    expect(await cards({})).toBe("One Shot Series:30");
  });

  it("totals a real duration from the chapter's own lessons", async () => {
    function DurProbe(props) {
      const { items } = usePlaylistBrowse(props);
      return <span data-testid="dur">{String(items[0]?.durationSeconds ?? "none")}</span>;
    }
    ROWS = [row(1, "Deep Dive", { pv: [lesson(600), lesson(900)] })];
    COUNT = 1;
    render(<MemoryRouter><DurProbe chapterId={42} /></MemoryRouter>);
    // Whole-course duration is still unavailable, but the chapter's is not.
    await waitFor(() => expect(screen.getByTestId("dur").textContent).toBe("1500"));
  });

  it("labels the number so it cannot be read as a course total", () => {
    render(
      <MemoryRouter><ThemeProvider>
        <PlaylistCard course={{ id: 1, title: "X", classLevels: [], lectures: 2, chapterScoped: true }} to="/course/1" comparisonEnabled={false} />
      </ThemeProvider></MemoryRouter>,
    );
    expect(screen.getByText("2 lectures on this chapter")).toBeTruthy();
  });
});

// The Individual Lectures tab's sort control (?lsort=). Its vocabulary is the
// honest subset the videos table can answer — duration and recency — so no
// option here can ever be decorative.
describe("lectures-tab sort control", () => {
  const renderLectures = (url = "/browse?tab=lectures", search = "") =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/browse" element={
            <>
              <LocationProbe />
              <PlaylistBrowse tab="lectures" onTabChange={() => {}}
                filters={{ search }} lectureView={<div />} />
            </>
          } />
        </Routes>
      </MemoryRouter>
    );

  it("offers only sorts the videos table can back", async () => {
    renderLectures();
    const sort = await screen.findByRole("combobox", { name: "Sort lessons" });
    expect([...sort.options].map((o) => o.text)).toEqual([
      "Recommended", "Shortest first", "Longest first", "Recently added",
    ]);
    // the playlists-tab control (and its rating/popularity sorts) is not here
    expect(screen.queryByRole("combobox", { name: "Sort courses" })).toBeNull();
  });

  it("writes the sort to the URL and resets the page", async () => {
    renderLectures("/browse?tab=lectures&page=3");
    const sort = await screen.findByRole("combobox", { name: "Sort lessons" });
    fireEvent.change(sort, { target: { value: "shortest" } });
    await waitFor(() => {
      const loc = screen.getByTestId("loc").textContent;
      expect(loc).toContain("lsort=shortest");
      expect(loc).not.toContain("page=");
    });
  });

  it("restores the sort from a shared URL, and drops the param at the default", async () => {
    renderLectures("/browse?tab=lectures&lsort=longest");
    const sort = await screen.findByRole("combobox", { name: "Sort lessons" });
    expect(sort.value).toBe("longest");
    fireEvent.change(sort, { target: { value: "recommended" } });
    await waitFor(() =>
      expect(screen.getByTestId("loc").textContent).not.toContain("lsort"));
  });

  it("shows a junk ?lsort= as the default rather than an unlabelled state", async () => {
    renderLectures("/browse?tab=lectures&lsort=wizards");
    const sort = await screen.findByRole("combobox", { name: "Sort lessons" });
    expect(sort.value).toBe("recommended");
  });

  // While a term is active the default sort IS the server's relevance ranking,
  // so the word has to say so. No new option appears and no new ?lsort= value
  // exists — a sort id that only means something while you are typing would go
  // stale in every shared URL.
  it("names the default sort for what it does during a search", async () => {
    renderLectures("/browse?tab=lectures&q=friction", "friction problems");
    const sort = await screen.findByRole("combobox", { name: "Sort lessons" });
    expect([...sort.options].map((o) => o.text)).toEqual([
      "Best match", "Shortest first", "Longest first", "Recently added",
    ]);
    expect([...sort.options].map((o) => o.value)).toEqual([
      "recommended", "shortest", "longest", "recent",
    ]);
    expect(sort.value).toBe("recommended");
  });

  it("goes back to Recommended when the search box is empty", async () => {
    renderLectures("/browse?tab=lectures", "   ");
    const sort = await screen.findByRole("combobox", { name: "Sort lessons" });
    expect([...sort.options].map((o) => o.text)[0]).toBe("Recommended");
  });
});
