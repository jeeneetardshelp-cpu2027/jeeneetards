// /browse — the <h1> must never say "All courses" over results the URL narrowed.
//
// THE DEFECT, demonstrated on /browse?ch=7 with ONLY the chapter-name lookup
// aborted by the request deadline: the chip read "Remove filter 7", the course
// query carried pv.videos.chapter_id=eq.7 — and the heading read "All courses".
// The heading was built as
//
//     chapterName ?? subjectName ?? goalName ?? "All courses"
//
// so a name that had not arrived (pending) or never would (failed) fell straight
// through to a claim about the whole catalogue. Two neighbours of that claim:
//
//   * a BROADER name borrowed in its place — ?sub=3&ch=7 with the chapter name
//     missing headed one chapter's courses "Physics"
//   * scopes the heading never names at all — ?class=11, ?teacher=7,
//     ?channel=3 — headed their narrowed results "All courses" even on success
//
// /browse?ch=<id> is where universal-search chapter results land
// (searchDestinations.js), where /chapter/:id redirects, and what Compare and
// returnTo restore, so this is not a rare URL.
//
// THE LINE THIS FILE DRAWS, the same one browseGateHeldBack.test.jsx draws for
// skeletons: a name that FAILED ends in something true with a way to ask again;
// a name still PENDING looks pending, and never flashes an error.
//
// Run: npx vitest run --project app src/BrowsePage.scopeHeading.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

// The envelope a tripped deadline REALLY produces (supabaseClient.js wrapper,
// measured against postgrest-js): it RESOLVES, status 0, an empty code, and the
// abort reason inside the message. Not a rejection, not a made-up 500.
const ABORT_TEXT = "AbortError: Request timeout: the server did not answer in time.";
const ABORTED = {
  message: ABORT_TEXT, details: ABORT_TEXT,
  hint: "Request was aborted (timeout or manual cancellation)", code: "",
};
const aborted = () =>
  Promise.resolve({ data: null, error: ABORTED, count: null, status: 0, statusText: "" });
const hang = () => new Promise(() => {});
const ok = (data) => () => Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : null, status: 200 });

// Per-test answers. Each queue is consumed one request at a time; the last entry
// repeats, so [aborted, ok(row)] means "fail once, then answer".
let CHAPTER_NAME;     // chapters?id=eq.<id> (useChapterName's maybeSingle)
let SCOPE_LEVELS;     // chapter_class_levels (useCanonicalFilters, legacy ?ch=)
let DIMENSIONS;       // "ok" | "abort" — the filter panel's four lookup lists
let CHAPTER_OPTIONS;  // chapters?subject_id=eq.<id> (the subject's chapter list)
const calls = [];

const next = (queue) => (queue.length > 1 ? queue.shift() : queue[0])();

const DIMENSION_ROWS = {
  learning_goals: [{ id: 1, slug: "jee", name: "JEE" }],
  class_levels: [{ id: 11, slug: "class-11", name: "Class 11" }],
  subjects: [{ id: 3, slug: "physics", name: "Physics" }],
  institutes_channels: [{ id: 3, name: "Competishun", logo_url: null }],
};

function builder(table) {
  const rec = { table, eq: {} };
  calls.push(rec);
  const b = {
    select: () => b, order: () => b, limit: () => b, range: () => b,
    in: () => b, ilike: () => b, or: () => b, not: () => b, is: () => b,
    gt: () => b, gte: () => b, lt: () => b, lte: () => b,
    contains: () => b, overlaps: () => b, filter: () => b,
    eq(k, v) { rec.eq[k] = v; return b; },
    maybeSingle() {
      rec.single = true;
      if (table === "chapters") return next(CHAPTER_NAME);
      return Promise.resolve({ data: null, error: null });
    },
    then(resolve, reject) {
      let answer;
      if (table === "chapter_class_levels") answer = next(SCOPE_LEVELS);
      else if (table in DIMENSION_ROWS) {
        answer = DIMENSIONS === "abort" ? aborted() : ok(DIMENSION_ROWS[table])();
      } else if (table === "chapters") answer = Promise.resolve({ data: CHAPTER_OPTIONS, error: null });
      else answer = Promise.resolve({ data: [], error: null, count: 0 });
      return answer.then(resolve, reject);
    },
  };
  return b;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t) => builder(t),
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}));

import BrowsePage from "./BrowsePage.jsx";
import { useChapterName } from "./useChapterName.js";

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/browse" element={<BrowsePage />} /></Routes>
    </MemoryRouter>,
  );

const heading = () => document.querySelector("main h1")?.textContent;
// Let every other in-flight lookup land, so an assertion is about the settled
// page and not about the order the mocks resolved in.
const settle = () => new Promise((r) => setTimeout(r, 60));
const nameFailure = () => screen.queryByText(/load this chapter.s name/);
const ROTATIONAL = { id: 7, name: "Rotational Motion" };

beforeEach(() => {
  calls.length = 0;
  CHAPTER_NAME = [ok(ROTATIONAL)];
  SCOPE_LEVELS = [ok([])];
  DIMENSIONS = "ok";
  CHAPTER_OPTIONS = [];
});

describe("a chapter filter whose name is unknown does not head the page 'All courses'", () => {
  it("FAILED: the chapter name aborted, the results are one chapter, the heading does not claim all", async () => {
    CHAPTER_NAME = [aborted];
    renderAt("/browse?ch=7");

    expect(await screen.findByRole("button", { name: "Remove filter 7" })).toBeTruthy();
    // The results really are narrowed: the course query carries the chapter.
    await waitFor(() => expect(
      calls.some((c) => c.table === "playlists" && String(c.eq["pv.videos.chapter_id"]) === "7"),
    ).toBe(true));
    await settle();

    expect(heading(), "the heading claims the whole catalogue over one chapter").not.toBe("All courses");
    expect(heading()).toBe("Filtered courses");
  });

  it("FAILED on the lectures tab: not 'All lessons' either", async () => {
    CHAPTER_NAME = [aborted];
    renderAt("/browse?tab=lectures&ch=7");

    await screen.findByRole("button", { name: "Remove filter 7" });
    await settle();

    expect(heading()).not.toBe("All lessons");
    expect(heading()).toBe("Filtered lessons");
  });

  it("PENDING: the same honest heading, and no error while the name is on its way", async () => {
    CHAPTER_NAME = [hang];
    renderAt("/browse?ch=7");

    await screen.findByRole("button", { name: "Remove filter 7" });
    await settle();

    expect(heading()).toBe("Filtered courses");
    expect(nameFailure(), "a pending lookup was rendered as a failure").toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("offers a working Try again for the failed name, which then names the page", async () => {
    CHAPTER_NAME = [aborted, ok(ROTATIONAL)];
    renderAt("/browse?ch=7");

    const line = (await screen.findByText(/load this chapter.s name/)).closest("p");
    fireEvent.click(within(line).getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("button", { name: "Remove filter Rotational Motion" })).toBeTruthy();
    expect(heading()).toBe("Rotational Motion");
    expect(nameFailure()).toBeNull();
    expect(calls.filter((c) => c.table === "chapters" && c.single)).toHaveLength(2);
  });

  it("a retry that is still in flight looks pending again, not failed", async () => {
    CHAPTER_NAME = [aborted, hang];
    renderAt("/browse?ch=7");

    const line = (await screen.findByText(/load this chapter.s name/)).closest("p");
    fireEvent.click(within(line).getByRole("button", { name: "Try again" }));
    await settle();

    expect(nameFailure()).toBeNull();
    expect(heading()).toBe("Filtered courses");
  });

  // The selection card's Try again is the page's existing retry. When the
  // outage that failed the scope lookup also failed the name, one press must
  // re-ask both — and the page must not show two Try again buttons for it.
  it("the selection card's Try again re-asks a failed chapter name too", async () => {
    SCOPE_LEVELS = [aborted, ok([])];
    CHAPTER_NAME = [aborted, ok(ROTATIONAL)];
    renderAt("/browse?ch=7");

    const card = (await screen.findByText(/load this selection/)).parentElement;
    await settle();
    expect(screen.getAllByRole("button", { name: "Try again" }), "two retries for one outage").toHaveLength(1);

    fireEvent.click(within(card).getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("button", { name: "Remove filter Rotational Motion" })).toBeTruthy();
    expect(heading()).toBe("Rotational Motion");
  });

  // Borrowing the parent's name is the same claim one level up: "Physics" over
  // courses that are one chapter of Physics.
  it("does not borrow the subject's name while the chapter's is missing", async () => {
    CHAPTER_NAME = [aborted];
    renderAt("/browse?sub=3&ch=7");

    await screen.findByRole("button", { name: "Remove filter Physics" });
    await screen.findByRole("button", { name: "Remove filter 7" });
    await settle();

    expect(heading()).not.toBe("Physics");
    expect(heading()).toBe("Filtered courses");
  });

  it("nor in a search heading", async () => {
    CHAPTER_NAME = [aborted];
    renderAt("/browse?q=torque&sub=3&ch=7");

    await screen.findByRole("button", { name: "Remove filter Physics" });
    await screen.findByRole("button", { name: "Remove filter 7" });
    await settle();

    expect(heading()).toBe("Search results for “torque”");
  });
});

describe("the other scopes that reached the same fallback", () => {
  // A legacy id is labelled from the filter panel's dimension lists. When those
  // abort, the panel's own card and Try again are the existing way back.
  it("a legacy subject id whose name list aborted, and the panel's Try again restores it", async () => {
    DIMENSIONS = "abort";
    renderAt("/browse?sub=3");

    await screen.findByRole("button", { name: "Remove filter 3" });
    await settle();
    expect(heading()).not.toBe("All courses");
    expect(heading()).toBe("Filtered courses");

    DIMENSIONS = "ok";
    fireEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]);
    expect(await screen.findByRole("button", { name: "Remove filter Physics" })).toBeTruthy();
    expect(heading()).toBe("Physics");
  });

  it("a legacy goal id whose name list aborted", async () => {
    DIMENSIONS = "abort";
    renderAt("/browse?goal=1");

    await screen.findByRole("button", { name: "Remove filter 1" });
    await settle();
    expect(heading()).toBe("Filtered courses");
  });

  // These scopes are never named in the heading, so "All courses" was false on
  // them even when every request succeeded.
  it.each([
    ["class", "/browse?class=11"],
    ["teacher", "/browse?teacher=7"],
    ["channel", "/browse?channel=3"],
  ])("a %s filter", async (_scope, url) => {
    renderAt(url);
    await settle();
    await settle();
    expect(heading()).not.toBe("All courses");
    expect(heading()).toBe("Filtered courses");
  });
});

// GUARDS, not fail-first: these pass before and after. They pin the other side
// of the change, so it cannot become "never say All courses".
describe("'All courses' is still said where it is true", () => {
  it.each([
    ["/browse", "All courses"],
    ["/browse?tab=lectures", "All lessons"],
    ["/browse?page=2", "All courses"],
  ])("%s", async (url, expected) => {
    renderAt(url);
    await settle();
    expect(heading()).toBe(expected);
  });

  it("a known chapter name still heads the page", async () => {
    renderAt("/browse?ch=7");
    expect(await screen.findByRole("heading", { name: "Rotational Motion" })).toBeTruthy();
  });
});

describe("useChapterName reports a failure it can be asked again about", () => {
  it("exposes the failure, retries it, and clears it when switched off", async () => {
    CHAPTER_NAME = [aborted, aborted];
    const { result, rerender } = renderHook(
      ({ enabled }) => useChapterName(7, { enabled }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.name).toBeNull();

    result.current.retry();
    await waitFor(() => expect(calls.filter((c) => c.table === "chapters" && c.single)).toHaveLength(2));

    // Another source now knows the name: a stale failure must not linger.
    rerender({ enabled: false });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.name).toBeNull();
  });
});
