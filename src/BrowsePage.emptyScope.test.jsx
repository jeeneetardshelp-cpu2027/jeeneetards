// /browse — the empty box and the heading may name only the scope the results
// actually have, and while that name is unknown, neither may borrow a wider one.
//
// DEFECT 1, demonstrated with running code and verified against production
// (chapter 7 is Friction, subject 1 Physics, subject 3 Mathematics):
//
//   /browse?sub=1&ch=7&type=pyq with the chapter-name lookups pending and the
//   catalogue answered: under the heading "Filtered courses" the empty box read
//   "No courses are listed for Physics yet." — while /browse?sub=1&type=pyq
//   listed 6 courses. When Friction's name arrived it flipped to "...for
//   Friction yet.", so a PENDING name turned a false claim into a true one.
//   /browse?sub=3&ch=7 said "No courses are listed for Mathematics yet." for
//   good once the name lookup failed.
//
// The cause: emptyStateMessage picked chapterName ?? subjectName, and a name
// alone cannot tell "no chapter filter" from "a chapter filter we cannot name".
//
// DEFECT 2: the heading's rule said only the most specific curriculum level may
// name the page, but skipped class, so /browse?goal=jee&class=11 was headed
// "JEE" over one class of JEE. Board had the same gap.
//
// THE LINE THIS FILE DRAWS, as browseGateHeldBack.test.jsx and
// BrowsePage.scopeHeading.test.jsx do: a FAILED name ends in something true with
// a way to ask again; a PENDING name already reads as the honest generic form,
// and never flashes an error.
//
// Run: npx vitest run --project app src/BrowsePage.emptyScope.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

// The envelope a tripped deadline REALLY produces (supabaseClient.js wrapper):
// it RESOLVES, status 0, an empty code, the abort reason inside the message.
const ABORT_TEXT = "AbortError: Request timeout: the server did not answer in time.";
const ABORTED = {
  message: ABORT_TEXT, details: ABORT_TEXT,
  hint: "Request was aborted (timeout or manual cancellation)", code: "",
};
const aborted = () =>
  Promise.resolve({ data: null, error: ABORTED, count: null, status: 0, statusText: "" });
const hang = () => new Promise(() => {});
const ok = (data) => () =>
  Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : null, status: 200 });

// Per-test answers. Each queue is consumed one request at a time; the last entry
// repeats, so [aborted, ok(row)] means "fail once, then answer".
let CHAPTER_NAME;   // chapters?id=eq.<id>          (useChapterName)
let CHAPTER_LIST;   // chapters?subject_id=eq.<id>  (useFilterOptions, labels ?ch= too)
const next = (queue) => (queue.length > 1 ? queue.shift() : queue[0])();

const FRICTION = { id: 7, name: "Friction" };
const DIMENSION_ROWS = {
  learning_goals: [{ id: 1, slug: "jee", name: "JEE" }, { id: 4, slug: "school", name: "School" }],
  class_levels: [{ id: 11, slug: "class-11", name: "Class 11" }],
  subjects: [{ id: 1, slug: "physics", name: "Physics" }, { id: 3, slug: "mathematics", name: "Mathematics" }],
  institutes_channels: [],
};
// What useCanonicalFilters' slug lookups find.
const BY_SLUG = {
  learning_goals: { jee: { id: 1, name: "JEE" }, school: { id: 4, name: "School" } },
  subjects: { physics: { id: 1, name: "Physics" } },
  boards: { cbse: { id: 2, name: "CBSE" } },
};

function builder(table) {
  const rec = { table, eq: {} };
  const b = {
    select: () => b, order: () => b, limit: () => b, range: () => b,
    in: () => b, ilike: () => b, or: () => b, not: () => b, is: () => b,
    gt: () => b, gte: () => b, lt: () => b, lte: () => b,
    contains: () => b, overlaps: () => b, filter: () => b,
    eq(k, v) { rec.eq[k] = v; return b; },
    maybeSingle() {
      if (table === "chapters" && rec.eq.id != null) return next(CHAPTER_NAME);
      const row = BY_SLUG[table]?.[rec.eq.slug];
      return Promise.resolve({ data: row ? { ...row, slug: rec.eq.slug } : null, error: null });
    },
    then(resolve, reject) {
      let answer;
      if (table in DIMENSION_ROWS) answer = ok(DIMENSION_ROWS[table])();
      else if (table === "chapters" && rec.eq.slug === "kinematics") {
        answer = ok([{ id: 1, slug: "kinematics", name: "Kinematics", chapter_class_levels: [] }])();
      } else if (table === "chapters") answer = next(CHAPTER_LIST);
      // The catalogue and everything else: answered, and empty.
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

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/browse" element={<BrowsePage />} /></Routes>
    </MemoryRouter>,
  );

const heading = () => document.querySelector("main h1")?.textContent ?? null;
const emptyTitle = () =>
  [...document.querySelectorAll("main p")].map((p) => p.textContent)
    .find((text) => /^No .*courses/.test(text)) ?? null;
const nameFailure = () => screen.queryByText(/load this chapter.s name/);
const settle = () => new Promise((r) => setTimeout(r, 60));
// Small act slices, not one long wait: a single long act() holds React's passive
// effects until it returns, so a "still looks pending" check inside it would
// pass whatever the page did.
const slice = () => act(() => new Promise((r) => setTimeout(r, 50)));

// Every title and heading the page EVER showed, so a flash between two
// assertions is caught rather than slipped past.
let seenTitles;
let seenHeadings;
let observer;
const watchPage = () => {
  observer = new MutationObserver(() => {
    const title = emptyTitle();
    if (title) seenTitles.add(title);
    const h = heading();
    if (h) seenHeadings.add(h);
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
};

beforeEach(() => {
  CHAPTER_NAME = [ok(FRICTION)];
  CHAPTER_LIST = [ok([{ id: 7, slug: "friction", name: "Friction", subject_id: 1 }])];
  seenTitles = new Set();
  seenHeadings = new Set();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  observer?.disconnect();
  observer = null;
  vi.restoreAllMocks();
});

describe("the empty box never names the subject over a chapter it cannot name", () => {
  it("PENDING: /browse?sub=1&ch=7&type=pyq reads the generic form until Friction's name lands", async () => {
    let answerName;
    CHAPTER_NAME = [() => new Promise((r) => { answerName = r; })];
    CHAPTER_LIST = [hang];
    watchPage();
    renderAt("/browse?sub=1&ch=7&type=pyq");

    await screen.findByRole("button", { name: "Remove filter Physics" });
    await screen.findByRole("button", { name: "Remove filter 7" });
    // The catalogue answered: the empty box is on screen.
    await waitFor(() => expect(emptyTitle()).not.toBeNull());

    for (let i = 0; i < 10; i += 1) {
      await slice();
      expect(emptyTitle(), "the box named a wider scope than one chapter").toBe("No courses match this view.");
      expect(heading()).toBe("Filtered courses");
      expect(nameFailure(), "a pending name was rendered as a failure").toBeNull();
    }

    // The name arrives. Now, and only now, the box names the chapter.
    await act(async () => { answerName({ data: FRICTION, error: null }); });
    await waitFor(() => expect(emptyTitle()).toBe("No courses are listed for Friction yet."));
    expect(heading()).toBe("Friction");
    expect([...seenTitles].filter((t) => /Physics/.test(t)), "a flash of the subject's name").toEqual([]);
  });

  it("FAILED: /browse?sub=3&ch=7 never names Mathematics after the chapter name aborted", async () => {
    CHAPTER_NAME = [aborted];
    CHAPTER_LIST = [ok([])];   // Mathematics' chapters answered, and 7 is not one of them
    watchPage();
    renderAt("/browse?sub=3&ch=7");

    await screen.findByRole("button", { name: "Remove filter Mathematics" });
    await screen.findByText(/load this chapter.s name/);
    await waitFor(() => expect(emptyTitle()).not.toBeNull());
    for (let i = 0; i < 4; i += 1) await slice();

    expect(emptyTitle()).toBe("No courses match this view.");
    expect(heading()).toBe("Filtered courses");
    expect([...seenTitles].filter((t) => /Mathematics/.test(t))).toEqual([]);
  });

  it("FAILED, then Try again: the true named form arrives with the name", async () => {
    CHAPTER_NAME = [aborted, ok(FRICTION)];
    CHAPTER_LIST = [hang];
    watchPage();
    renderAt("/browse?sub=1&ch=7");

    const line = (await screen.findByText(/load this chapter.s name/)).closest("p");
    await waitFor(() => expect(emptyTitle()).toBe("No courses match this view."));

    fireEvent.click(within(line).getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(emptyTitle()).toBe("No courses are listed for Friction yet."));
    expect(heading()).toBe("Friction");
    expect([...seenTitles].filter((t) => /Physics/.test(t))).toEqual([]);
  });

  it("with a class: keeps the class wording, names nothing, and does not speak for the whole class", async () => {
    CHAPTER_NAME = [hang];
    CHAPTER_LIST = [hang];
    watchPage();
    renderAt("/browse?class=11&sub=1&ch=7");

    await screen.findByRole("button", { name: "Remove filter Physics" });
    await waitFor(() => expect(emptyTitle()).not.toBeNull());

    for (let i = 0; i < 6; i += 1) {
      await slice();
      expect(emptyTitle()).toBe("No Class 11 courses match this view.");
      expect(heading()).toBe("Filtered courses");
    }
    // Neither the borrowed subject, nor a claim that Class 11 as a whole is empty.
    expect([...seenTitles].filter((t) => /Physics|classified yet/.test(t))).toEqual([]);
    expect(screen.getByText(/without a class tag are not shown/i)).toBeTruthy();
  });
});

// GUARDS: these pass before and after. They pin the other side, so the fix
// cannot become "never name anything".
describe("the empty box still names a level that is the view", () => {
  it.each([
    ["the subject, with no chapter filter", "/browse?sub=1", "No courses are listed for Physics yet.", "Physics"],
    ["the subject and class", "/browse?class=11&sub=1", "No Class 11 courses are classified for Physics yet.", "Physics"],
    ["a known chapter", "/browse?ch=7", "No courses are listed for Friction yet.", "Friction"],
    ["a class on its own", "/browse?class=11", "No Class 11 courses are classified yet.", "Filtered courses"],
  ])("%s", async (_label, url, title, h1) => {
    renderAt(url);
    await waitFor(() => expect(emptyTitle()).toBe(title));
    await settle();
    expect(emptyTitle()).toBe(title);
    expect(heading()).toBe(h1);
  });
});

describe("a class or board is a curriculum level: the heading does not borrow the exam's name over it", () => {
  it("/browse?goal=jee&class=11 is not headed 'JEE', at any moment", async () => {
    watchPage();
    renderAt("/browse?goal=jee&class=11");

    await screen.findByRole("button", { name: "Remove filter JEE" });
    await waitFor(() => expect(emptyTitle()).not.toBeNull());
    for (let i = 0; i < 4; i += 1) await slice();

    expect(heading()).toBe("Filtered courses");
    expect([...seenHeadings], "headed with the wider exam").not.toContain("JEE");
    // The box and the heading agree: neither names the exam.
    expect(emptyTitle()).toBe("No Class 11 courses are classified yet.");
  });

  it("the lectures tab says so too", async () => {
    watchPage();
    renderAt("/browse?tab=lectures&goal=jee&class=11");

    await screen.findByRole("button", { name: "Remove filter JEE" });
    for (let i = 0; i < 4; i += 1) await slice();

    expect(heading()).toBe("Filtered lessons");
    expect([...seenHeadings]).not.toContain("JEE");
  });

  it("nor a search heading", async () => {
    watchPage();
    renderAt("/browse?q=torque&goal=jee&class=11");

    await screen.findByRole("button", { name: "Remove filter JEE" });
    for (let i = 0; i < 4; i += 1) await slice();

    expect(heading()).toBe("Search results for “torque”");
    expect([...seenHeadings].filter((h) => /in JEE/.test(h))).toEqual([]);
  });

  it("/browse?goal=school&board=cbse is not headed 'School'", async () => {
    watchPage();
    renderAt("/browse?goal=school&board=cbse");

    await screen.findByRole("button", { name: "Remove filter CBSE" });
    for (let i = 0; i < 4; i += 1) await slice();

    expect(heading()).toBe("Filtered courses");
    expect([...seenHeadings]).not.toContain("School");
  });
});

describe("the heading still names what it can vouch for", () => {
  it("an exam on its own", async () => {
    renderAt("/browse?goal=jee");
    expect(await screen.findByRole("heading", { name: "JEE" })).toBeTruthy();
  });

  it("a subject under an exam", async () => {
    renderAt("/browse?goal=jee&subject=physics");
    expect(await screen.findByRole("heading", { name: "Physics" })).toBeTruthy();
  });

  it("the canonical form names the chapter once it is known, class and all", async () => {
    renderAt("/browse?goal=jee&class=11&subject=physics&chapter=kinematics");
    expect(await screen.findByRole("heading", { name: "Kinematics" })).toBeTruthy();
  });

  it.each([
    ["/browse", "All courses"],
    ["/browse?tab=lectures", "All lessons"],
    ["/browse?sort=rating", "All courses"],
  ])("%s", async (url, expected) => {
    renderAt(url);
    await settle();
    expect(heading()).toBe(expected);
  });
});
