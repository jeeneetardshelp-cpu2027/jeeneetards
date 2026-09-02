// Component tests for universal search.
//
// The RPC is mocked, but the mock RECORDS its arguments — several of these
// tests are really assertions about what the client asks the server for
// (paging, type filter, one request per settled query), because "never load
// the catalogue into the browser" is a claim about the request, not the render.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";

let RPC_ROWS = [];
let RPC_ERROR = null;
let CHANNEL_LOGOS = [];
const rpcCalls = [];
let rpcDelay = 0;

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (fn, args) => {
      rpcCalls.push({ fn, args });
      const payload = { data: RPC_ERROR ? null : RPC_ROWS, error: RPC_ERROR };
      return rpcDelay
        ? new Promise((r) => setTimeout(() => r(payload), rpcDelay))
        : Promise.resolve(payload);
    },
    from: () => {
      const builder = {
        select: () => builder,
        in: () => Promise.resolve({ data: CHANNEL_LOGOS, error: null }),
      };
      return builder;
    },
  },
}));

const { default: UniversalSearch, highlightParts } = await import("./UniversalSearch.jsx");
const { DEBOUNCE_MS, MIN_QUERY, groupRows, appendGroupRows } = await import("./useUniversalSearch.js");

const row = (over = {}) => ({
  group_key: "faculty", entity_id: 1, title: "Amit Bijarnia",
  subtitle: "Competishun · Physics · JEE", aka: "ABJ Sir, ABJ", slug: "amit-bijarnia",
  match_type: "exact-alias", match_rank: 1, matched_on: "ABJ Sir",
  is_ambiguous: false, group_total: 1, extra: {}, ...over,
});

function Probe() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
}

const renderSearch = (url = "/search") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
      <Routes>
        <Route path="/search" element={<UniversalSearch />} />
        <Route path="*" element={<div data-testid="landed" />} />
      </Routes>
    </MemoryRouter>
  );

const type = (value) =>
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });

/** Let the debounce elapse and the mocked promise settle. */
const settle = async () => {
  await act(async () => { vi.advanceTimersByTime(DEBOUNCE_MS + 20); });
  await act(async () => { await Promise.resolve(); });
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  RPC_ROWS = []; RPC_ERROR = null; rpcDelay = 0; rpcCalls.length = 0;
  CHANNEL_LOGOS = [];
});
afterEach(() => { vi.useRealTimers(); });

// ---------------------------------------------------------------- grouping
describe("grouped results (the five groups)", () => {
  it("renders each group under its own heading", async () => {
    RPC_ROWS = [
      row(),
      row({ group_key: "chapter", entity_id: 5, title: "Kinematics", subtitle: "Physics", aka: null }),
      row({ group_key: "playlist", entity_id: 7, title: "Complete Kinematics", aka: null }),
      row({ group_key: "lecture", entity_id: 9, title: "Relative motion", aka: null }),
      row({ group_key: "institute", entity_id: 3, title: "Competishun", aka: null }),
    ];
    renderSearch();
    type("kinematics");
    await settle();

    for (const label of ["Faculty", "Chapters", "Playlists", "Lectures", "Institutes"])
      expect(await screen.findByRole("heading", { name: new RegExp(label, "i") })).toBeTruthy();
  });

  it("shows the faculty card in the asked-for shape", async () => {
    RPC_ROWS = [row()];
    renderSearch();
    type("abj");
    await settle();

    const opt = await screen.findByRole("option");
    // Exactly the shape the phase asked for:
    //   Amit Bijarnia / Also known as: ABJ Sir / Competishun · Physics · JEE
    expect(opt.textContent).toContain("Amit Bijarnia");
    expect(opt.textContent).toContain("Also known as: ABJ Sir");
    expect(opt.textContent).toContain("Competishun · Physics · JEE");
  });

  it("shows a YouTube thumbnail beside lecture results", async () => {
    RPC_ROWS = [row({
      group_key: "lecture",
      entity_id: 9,
      title: "Relative motion",
      aka: null,
      extra: { playlist_id: 7, youtube_video_id: "CBvaO-uDvs8" },
    })];
    const { container } = renderSearch();
    type("relative motion");
    await settle();
    await screen.findByText("Relative motion");

    const image = container.querySelector("img");
    expect(image?.getAttribute("src"))
      .toBe("https://img.youtube.com/vi/CBvaO-uDvs8/mqdefault.jpg");
    expect(image?.getAttribute("loading")).toBe("lazy");
  });

  it("shows the authoritative avatar beside channel results", async () => {
    RPC_ROWS = [row({
      group_key: "institute", entity_id: 3, title: "Competishun", aka: null,
      extra: { institute_id: 3 },
    })];
    CHANNEL_LOGOS = [{ id: 3, logo_url: "https://yt3.ggpht.com/competishun=s88" }];
    const { container } = renderSearch();
    type("competishun");
    await settle();
    await screen.findByText("Competishun");

    expect(container.querySelector("img")?.getAttribute("src"))
      .toBe("https://yt3.ggpht.com/competishun=s88");
  });

  it("omits a group entirely rather than drawing an empty one", async () => {
    RPC_ROWS = [row({ group_key: "chapter", aka: null })];
    renderSearch();
    type("kinematics");
    await settle();
    await screen.findByRole("heading", { name: /Chapters/i });
    expect(screen.queryByRole("heading", { name: /^Faculty$/i })).toBeNull();
  });
});

// ---------------------------------------------------------------- identity
describe("ambiguous identity is never auto-selected (requirement 2)", () => {
  const two = [
    row({ entity_id: 1, title: "Amit Bijarnia", subtitle: "Competishun · Physics · JEE",
          is_ambiguous: true, group_total: 2 }),
    row({ entity_id: 2, title: "Amit Bijarnia", subtitle: "Allen · Chemistry · NEET",
          slug: "amit-bijarnia-2", is_ambiguous: true, group_total: 2 }),
  ];

  it("lists both, each with its own institute / subject / exam context", async () => {
    RPC_ROWS = two;
    renderSearch();
    type("amit");
    await settle();
    // The name is split across <mark> and <span> by highlighting, so match on
    // the rendered option text rather than a single text node.
    const opts = await screen.findAllByRole("option");
    expect(opts).toHaveLength(2);
    opts.forEach((o) => expect(o.textContent).toContain("Amit Bijarnia"));
    expect(screen.getByText("Competishun · Physics · JEE")).toBeTruthy();
    expect(screen.getByText("Allen · Chemistry · NEET")).toBeTruthy();
  });

  it("marks them as ambiguous instead of ranking one above the other", async () => {
    RPC_ROWS = two;
    renderSearch();
    type("amit");
    await settle();
    expect(await screen.findAllByText(/More than one match/i)).toHaveLength(2);
  });

  it("nothing is preselected, so Enter on the query opens nobody", async () => {
    RPC_ROWS = two;
    renderSearch();
    type("amit");
    await settle();
    const opts = await screen.findAllByRole("option");
    opts.forEach((o) => expect(o.getAttribute("aria-selected")).toBe("false"));
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(screen.queryByTestId("landed")).toBeNull();   // did not navigate
  });
});

// ---------------------------------------------------------------- keyboard
describe("keyboard navigation (requirement 8)", () => {
  beforeEach(() => {
    RPC_ROWS = [
      row({ entity_id: 1, title: "Amit Bijarnia" }),
      row({ group_key: "chapter", entity_id: 5, title: "Kinematics", aka: null }),
    ];
  });

  it("arrows move through groups as one continuous list", async () => {
    renderSearch();
    type("am");
    type("ami");
    await settle();
    const input = screen.getByRole("combobox");
    await screen.findAllByRole("option");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true"));
    // crossing the Faculty -> Chapters boundary needs no extra keystroke
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true"));
  });

  it("Enter opens the row the student highlighted", async () => {
    renderSearch();
    type("amit");
    await settle();
    const input = screen.getByRole("combobox");
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/faculty/amit-bijarnia"));
  });

  it("does not run off either end of the list", async () => {
    renderSearch();
    type("amit");
    await settle();
    const input = screen.getByRole("combobox");
    await screen.findAllByRole("option");
    for (let i = 0; i < 6; i++) fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true"));
    for (let i = 0; i < 6; i++) fireEvent.keyDown(input, { key: "ArrowUp" });
    // back to "nothing selected", not wrapped around to the bottom
    screen.getAllByRole("option").forEach((o) =>
      expect(o.getAttribute("aria-selected")).toBe("false"));
  });

  it("Escape clears the query", async () => {
    renderSearch();
    type("amit");
    await settle();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.getByRole("combobox").value).toBe("");
  });

  it("exposes the active option to screen readers", async () => {
    renderSearch();
    type("amit");
    await settle();
    const input = screen.getByRole("combobox");
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() =>
      expect(input.getAttribute("aria-activedescendant")).toBe("usr-opt-0"));
  });
});

// ---------------------------------------------------------------- highlight
describe("highlighted matches (requirement 8)", () => {
  it("marks the matching span", async () => {
    RPC_ROWS = [row({ title: "Amit Bijarnia", aka: null, subtitle: null })];
    renderSearch();
    type("amit");
    await settle();
    const mark = await waitFor(() => document.querySelector("mark"));
    expect(mark.textContent).toBe("Amit");
  });

  it("never alters the text it decorates", () => {
    const src = "Motion in a Straight Line";
    expect(highlightParts(src, "straight").map((p) => p.text).join("")).toBe(src);
    expect(highlightParts(src, "STRAIGHT").find((p) => p.hit).text).toBe("Straight");
  });

  it("degrades to no highlight rather than a wrong one", () => {
    // punctuation differs, so no literal offset exists; the row is still shown
    const parts = highlightParts("ABJ Sir", "abj-sir");
    expect(parts).toHaveLength(1);
    expect(parts[0].hit).toBe(false);
    expect(parts[0].text).toBe("ABJ Sir");
  });

  it("does not highlight below the minimum query length", () => {
    expect(highlightParts("Amit", "a")).toEqual([{ text: "Amit", hit: false }]);
  });
});

// ---------------------------------------------------------------- requests
describe("server-ranked, paginated, debounced (requirements 4, 5, 7)", () => {
  it("sends ONE request for a word typed quickly", async () => {
    renderSearch();
    for (const s of ["k", "ki", "kin", "kine", "kinem"]) type(s);
    await settle();
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].args.p_query).toBe("kinem");
  });

  // The catalogue is written in English but the audience is not. Measured on
  // production 2026-09-02: rasayan, bhautiki, jeev vigyan and pw all returned
  // ZERO rows, while their English equivalents returned 27, 27, 21 and 2.
  it("sends the English equivalent when a student types the Hindi word", async () => {
    renderSearch();
    type("rasayan");
    await settle();
    expect(rpcCalls[0].args.p_query).toBe("chemistry");
  });

  it("sends anything that is not an alias exactly as typed", async () => {
    // The risk in a rewrite is not failing to help, it is changing a query
    // that already worked.
    renderSearch();
    type("organic chemistry one shot");
    await settle();
    expect(rpcCalls[0].args.p_query).toBe("organic chemistry one shot");
  });
  it("asks the database for a page, not the catalogue", async () => {
    renderSearch();
    type("kinematics");
    await settle();
    expect(rpcCalls[0].fn).toBe("universal_search");
    expect(rpcCalls[0].args.p_limit).toBe(5);
    expect(rpcCalls[0].args.p_offset).toBe(0);
  });

  it("preserves the server's order instead of re-sorting", async () => {
    // deliberately NOT alphabetical, and rank 4 before rank 1
    RPC_ROWS = [
      row({ group_key: "chapter", entity_id: 1, title: "Zebra chapter", match_rank: 1, aka: null }),
      row({ group_key: "chapter", entity_id: 2, title: "Alpha chapter", match_rank: 4, aka: null }),
    ];
    renderSearch();
    type("chapter");
    await settle();
    const opts = await screen.findAllByRole("option");
    expect(opts[0].textContent).toContain("Zebra");
    expect(opts[1].textContent).toContain("Alpha");
  });

  it("discards a slow response that a newer query has superseded", async () => {
    // first query is slow and returns the WRONG answer for the final input
    rpcDelay = 400;
    RPC_ROWS = [row({ entity_id: 1, title: "STALE RESULT", aka: null })];
    renderSearch();
    type("kine");
    await act(async () => { vi.advanceTimersByTime(DEBOUNCE_MS + 10); });

    // student keeps typing; the new query resolves immediately
    rpcDelay = 0;
    RPC_ROWS = [row({ entity_id: 2, title: "FRESH RESULT", aka: null })];
    type("kinematics");
    await settle();

    // let the stale one land
    await act(async () => { vi.advanceTimersByTime(500); });
    await act(async () => { await Promise.resolve(); });

    expect(screen.queryByText("STALE RESULT")).toBeNull();
    expect(screen.getByText("FRESH RESULT")).toBeTruthy();
  });

  it("groupRows keeps the per-group total for paging", () => {
    const g = groupRows([row({ group_total: 43 })]);
    expect(g.faculty.total).toBe(43);
    expect(g.faculty.rows).toHaveLength(1);
  });

  it("appendGroupRows keeps earlier pages and drops a server-repeated row", () => {
    const first = groupRows([
      row({ entity_id: 1, group_total: 3 }),
      row({ entity_id: 2, group_total: 3 }),
    ]);
    // The result set can shift underneath paging; row 2 arrives again.
    const merged = appendGroupRows(first, [
      row({ entity_id: 2, group_total: 3 }),
      row({ entity_id: 3, group_total: 3 }),
    ]);
    expect(merged.faculty.rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(merged.faculty.total).toBe(3);
  });
});

// ---------------------------------------------------------------- show more
describe("Show more paging in the single-type view", () => {
  // "See all 43" used to be a dead end: it narrowed to one group and then
  // stopped at 20 rows with no way to reach the other 23.
  const chapterPage = (start, count, total) =>
    Array.from({ length: count }, (_, i) =>
      row({
        group_key: "chapter", entity_id: start + i, title: `Chapter ${start + i}`,
        aka: null, subtitle: null, group_total: total,
      }));

  it("appends the next page below the rows already shown", async () => {
    RPC_ROWS = chapterPage(1, 20, 43);
    renderSearch("/search?q=kinematics&type=chapter");
    await settle();
    expect(await screen.findAllByRole("option")).toHaveLength(20);

    RPC_ROWS = chapterPage(21, 20, 43);
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    await settle();

    const opts = await screen.findAllByRole("option");
    expect(opts).toHaveLength(40);
    // the first page is still on screen, in place, and page two follows it
    expect(opts[0].textContent).toContain("Chapter 1");
    expect(opts[20].textContent).toContain("Chapter 21");
    // the request asked for the NEXT page, not the catalogue
    expect(rpcCalls.at(-1).args.p_offset).toBe(20);
    expect(rpcCalls.at(-1).args.p_limit).toBe(20);
  });

  it("appended rows join the same keyboard-navigable list", async () => {
    RPC_ROWS = chapterPage(1, 20, 25);
    renderSearch("/search?q=kinematics&type=chapter");
    await settle();
    RPC_ROWS = chapterPage(21, 5, 25);
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    await settle();
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(25));

    const input = screen.getByRole("combobox");
    for (let i = 0; i < 21; i++) fireEvent.keyDown(input, { key: "ArrowDown" });
    // the cursor crossed into the appended page without a seam
    await waitFor(() =>
      expect(input.getAttribute("aria-activedescendant")).toBe("usr-opt-20"));
    expect(screen.getAllByRole("option")[20].getAttribute("aria-selected")).toBe("true");
  });

  it("shows a loading state on the button and keeps existing rows visible", async () => {
    RPC_ROWS = chapterPage(1, 20, 43);
    renderSearch("/search?q=kinematics&type=chapter");
    await settle();

    rpcDelay = 400;
    RPC_ROWS = chapterPage(21, 20, 43);
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    await act(async () => { vi.advanceTimersByTime(DEBOUNCE_MS + 10); });

    const busy = screen.getByRole("button", { name: /Loading/ });
    expect(busy.disabled).toBe(true);
    expect(screen.getAllByRole("option")).toHaveLength(20);   // nothing vanished

    await act(async () => { vi.advanceTimersByTime(500); });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(40));
  });

  it("says when the end is reached instead of silently dropping the button", async () => {
    RPC_ROWS = chapterPage(1, 20, 25);
    renderSearch("/search?q=kinematics&type=chapter");
    await settle();
    RPC_ROWS = chapterPage(21, 5, 25);
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    await settle();

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(25));
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
    expect(screen.getByText(/All 25 results shown/)).toBeTruthy();
  });

  it("offers no Show more when everything already fits on one page", async () => {
    RPC_ROWS = chapterPage(1, 12, 12);
    renderSearch("/search?q=kinematics&type=chapter");
    await settle();
    await screen.findAllByRole("option");
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
    expect(screen.queryByText(/results shown/)).toBeNull();
  });

  it("offers no Show more in the mixed all-groups view", async () => {
    // Paging a 5-row preview would fight with "See all"; the preview keeps
    // its header link and paging lives only behind a chosen type.
    RPC_ROWS = chapterPage(1, 5, 43);
    renderSearch();
    type("kinematics");
    await settle();
    await screen.findAllByRole("option");
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
    expect(screen.getByRole("button", { name: /See all 43/ })).toBeTruthy();
  });
});

// ---------------------------------------------------------------- states
describe("short query, loading, error and empty (requirements 6, 8)", () => {
  // Asserted against MIN_QUERY, not a literal. The floor rose from 2 to 3 on
  // 2026-09-02 because a two-character query times out in the RPC rather than
  // returning nothing, and a test naming the old number would have had to be
  // edited rather than simply passing.
  it("refuses a query below the floor without asking the server", async () => {
    renderSearch();
    type("a".repeat(MIN_QUERY - 1));
    await settle();
    expect(screen.getByText(new RegExp(`Type at least ${MIN_QUERY} characters`, "i"))).toBeTruthy();
    expect(rpcCalls).toHaveLength(0);
  });

  it("shows a loading state while the request is in flight", async () => {
    rpcDelay = 500;
    renderSearch();
    type("kinematics");
    await act(async () => { vi.advanceTimersByTime(DEBOUNCE_MS + 10); });
    expect(screen.getByText(/Searching…/)).toBeTruthy();
  });

  it("reports a failed search as an error, not as 'no results'", async () => {
    RPC_ERROR = { message: "boom", code: "500" };
    renderSearch();
    type("kinematics");
    await settle();
    expect(await screen.findByText(/Search is unavailable/i)).toBeTruthy();
    expect(screen.queryByText(/Nothing matches/i)).toBeNull();
  });

  it("offers a retry that actually re-queries", async () => {
    RPC_ERROR = { message: "boom", code: "500" };
    renderSearch();
    type("kinematics");
    await settle();
    const before = rpcCalls.length;
    RPC_ERROR = null;
    RPC_ROWS = [row({ title: "Recovered", aka: null })];
    fireEvent.click(await screen.findByRole("button", { name: /Try again/i }));
    await settle();
    expect(rpcCalls.length).toBeGreaterThan(before);
    expect(await screen.findByText("Recovered")).toBeTruthy();
  });

  it("says nothing matched, and says so distinctly from an error", async () => {
    RPC_ROWS = [];
    renderSearch();
    type("zzzzzz");
    await settle();
    expect(await screen.findByText(/Nothing matches/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------- url
describe("query and type persist in the URL (requirement 9)", () => {
  it("restores both from a shared link", async () => {
    RPC_ROWS = [row({ group_key: "chapter", title: "Kinematics", aka: null })];
    renderSearch("/search?q=kinematics&type=chapter");
    expect(screen.getByRole("combobox").value).toBe("kinematics");
    await settle();
    expect(rpcCalls[0].args.p_types).toEqual(["chapter"]);
  });

  it("writes the query into the URL as the student types", async () => {
    renderSearch();
    type("kinematics");
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(screen.getByTestId("loc").textContent).toContain("q=kinematics");
  });

  it("writes the chosen type into the URL and narrows the query", async () => {
    RPC_ROWS = [row({ group_key: "chapter", title: "Kinematics", aka: null, group_total: 12 })];
    renderSearch();
    type("kinematics");
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: /^Chapters/ }));
    await settle();
    expect(screen.getByTestId("loc").textContent).toContain("type=chapter");
    expect(rpcCalls.at(-1).args.p_types).toEqual(["chapter"]);
  });

  it("ignores an unknown type in the URL instead of searching nothing", async () => {
    renderSearch("/search?q=kinematics&type=wizards");
    await settle();
    expect(rpcCalls[0].args.p_types).toBeNull();
  });
});

// ------------------------------------------------------- Devanagari (lang.js)
// Every row here is catalogue text — a teacher, a chapter, a course, a lesson —
// rendered under a document that declares lang="en". See lang.js.
describe("Devanagari result rows are tagged for a screen reader", () => {
  it("tags the title, the alias and the context line, and only those", async () => {
    RPC_ROWS = [row({
      title: "अमित बिजारणिया",
      aka: "एबीजे सर",
      subtitle: "Competishun · भौतिकी · JEE",
    })];
    renderSearch();
    type("amit");
    await settle();

    const option = (await screen.findAllByRole("option"))[0];
    const tagged = [...option.querySelectorAll("[lang='hi']")].map((el) => el.textContent);
    expect(tagged).toContain("अमित बिजारणिया");
    expect(tagged).toContain("एबीजे सर");
    expect(tagged).toContain("Competishun · भौतिकी · JEE");
    // "Also known as:" is interface English and stays outside the Hindi element.
    expect(option.textContent).toContain("Also known as:");
    expect(screen.getByText(/Also known as:/).getAttribute("lang")).toBeNull();
  });

  it("adds no lang and no wrapper to a Latin row", async () => {
    RPC_ROWS = [row()];
    renderSearch();
    type("amit");
    await settle();
    const option = (await screen.findAllByRole("option"))[0];
    expect(option.querySelector("[lang]")).toBeNull();
    expect(screen.getByText("Competishun · Physics · JEE").getAttribute("lang")).toBeNull();
  });
});
