// Explore.boardStep.test.jsx — the board step (/explore/school), when the
// boards lookup fails, is still in flight, or is not deployed at all.
//
// Since supabaseClient.js puts a deadline on every request, a slow boards GET
// now ENDS — and postgrest resolves it, never rejects, with the ABORTED shape
// below. The page drew that as a bare "Couldn't load boards." paragraph: no
// heading, and nothing that could ask again, because useBoards had no retry
// and the page skipped the Step component that already carries one.
//
// The rule: a FAILED lookup ends in an error with a working Try again; a
// PENDING one still looks pending; an answer clears the error. A boards table
// that does not exist is not a failure: that stays "not available yet".
//
// Real useExplore hooks and the real page; only the network is stubbed.

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const net = vi.hoisted(() => ({ answer: () => null, calls: [] }));

vi.mock("./supabaseClient", () => {
  // A pending answer is a promise the test settles (or never does).
  const reply = (key) => {
    net.calls.push(key);
    return Promise.resolve(net.answer(key));
  };
  return {
    isSupabaseConfigured: true,
    supabase: {
      // Keyed by what was asked: the goal list, or one class check.
      rpc: (_fn, args = {}) => reply(
        args.p_goal == null ? "goals" : `classes:${args.p_goal}:${args.p_class}`,
      ),
      from: (table) => {
        const chain = {
          select: () => chain,
          order: () => chain,
          eq: () => chain,
          then: (resolve, reject) => reply(table).then(resolve, reject),
        };
        return chain;
      },
    },
  };
});

// Never typed into; keeps the search module graph off the network, as
// Explore.stageStep.test.jsx does.
vi.mock("./useUniversalSearch.js", () => ({
  useUniversalSearch: () => ({
    groups: {}, loading: false, error: null, tooShort: false,
    retry: () => {}, page: 0, setPage: () => {},
  }),
  GROUPS: [{ key: "chapter", label: "Chapters" }],
  MIN_QUERY: 2,
}));

import Explore from "./Explore.jsx";
import { ThemeProvider } from "./theme.jsx";

const ok = (data) => ({ data, error: null, count: null, status: 200, statusText: "OK" });

// What postgrest-js resolves with when the request deadline aborts a request
// (dist/index.cjs, the AbortError branch of its fetch catch).
const ABORTED = {
  success: false,
  data: null,
  error: {
    message: "AbortError: Request timeout: the server did not answer in time.",
    details: "AbortError: Request timeout: the server did not answer in time.",
    hint: "Request was aborted (timeout or manual cancellation)",
    code: "",
  },
  count: null,
  status: 0,
  statusText: "",
};

// PostgREST's answer when the boards table is not in the schema at all.
const NO_BOARDS_TABLE = {
  success: false,
  data: null,
  error: {
    code: "PGRST205",
    message: "Could not find the table 'public.boards' in the schema cache",
    details: null,
    hint: null,
  },
  count: null,
  status: 404,
  statusText: "Not Found",
};

const GOALS = ok([
  { level: "goal", entity_id: 1, slug: "jee", name: "JEE", display_order: 1, course_count: 268 },
  { level: "goal", entity_id: 3, slug: "school", name: "School Boards", display_order: 3, course_count: 30 },
]);
const CLASS_LEVELS = ok([
  { id: 1, name: "Class 10", slug: "class-10" },
  { id: 2, name: "Class 11", slug: "class-11" },
  { id: 3, name: "Class 12", slug: "class-12" },
  { id: 4, name: "Dropper", slug: "dropper" },
]);
// Shaped like production's boards answer.
const BOARDS = ok([
  { id: 1, name: "CBSE", slug: "cbse", playlist_boards: [{ count: 27 }] },
  { id: 3, name: "ICSE", slug: "icse", playlist_boards: [{ count: 0 }] },
  { id: 4, name: "State Board", slug: "state", playlist_boards: [{ count: 0 }] },
]);
const SUBJECTS = ok([
  { level: "subject", entity_id: 11, slug: "science", name: "Science", display_order: 1, course_count: 5 },
]);

// Everything answers, except the keys an override names (matched by prefix).
const answers = (overrides = {}) => (key) => {
  for (const [prefix, value] of Object.entries(overrides)) {
    if (key.startsWith(prefix)) return value;
  }
  if (key === "goals") return GOALS;
  if (key === "class_levels") return CLASS_LEVELS;
  if (key === "boards") return BOARDS;
  if (key.startsWith("classes:")) return SUBJECTS;
  return ok([]);
};

const BOARD_HEADING = "Choose a school board";
const BOARD_ERROR = "Couldn't load boards.";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const renderAt = (url) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/:goal" element={<Explore />} />
          <Route path="/explore/:goal/:s1" element={<Explore />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

const pulses = () => document.querySelector("main").querySelectorAll(".animate-pulse").length;
const callsTo = (prefix) => net.calls.filter((key) => key.startsWith(prefix)).length;
// Small slices, never one long act(): a single act holds passive effects until
// it returns, so a "still pending" check inside one would pass whatever the
// page does.
const slices = async (count = 8) => {
  for (let i = 0; i < count; i += 1) {
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  }
};

beforeEach(() => {
  window.scrollTo = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {});
  net.calls.length = 0;
  net.answer = answers();
});

describe("the board step when the boards lookup fails", () => {
  it("shows the error under the step's heading, with a Try again that asks for boards again", async () => {
    net.answer = answers({ boards: ABORTED });
    renderAt("/explore/school");

    expect(await screen.findByText(BOARD_ERROR)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: BOARD_HEADING })).toBeTruthy();
    expect(pulses()).toBe(0);

    // The network is back but slow: Try again is pending, so it looks pending.
    const later = deferred();
    net.answer = answers({ boards: later.promise });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await slices();

    expect(pulses()).toBe(4);
    expect(screen.queryByText(BOARD_ERROR)).toBeNull();
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

    await act(async () => { later.resolve(BOARDS); });

    expect(await screen.findByRole("link", { name: /CBSE/ })).toBeTruthy();
    expect(screen.queryByText(BOARD_ERROR)).toBeNull();
    expect(pulses()).toBe(0);
    // Only the lookup that failed is asked again.
    expect(callsTo("boards")).toBe(2);
    expect(callsTo("goals")).toBe(1);
    expect(callsTo("class_levels")).toBe(1);
  });

  it("brings the error back, with its Try again, when the second attempt fails too", async () => {
    net.answer = answers({ boards: ABORTED });
    renderAt("/explore/school");
    await screen.findByText(BOARD_ERROR);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    // Cleared the moment it asks again, before the answer lands.
    expect(screen.queryByText(BOARD_ERROR)).toBeNull();

    expect(await screen.findByText(BOARD_ERROR)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: BOARD_HEADING })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(callsTo("boards")).toBe(2);
  });

  it("recovers a deep link to a board with the same Try again", async () => {
    // /explore/school/cbse cannot resolve "cbse" without the boards rows, so
    // the page holds the board step until they arrive.
    net.answer = answers({ boards: ABORTED });
    renderAt("/explore/school/cbse");
    expect(await screen.findByText(BOARD_ERROR)).toBeTruthy();

    net.answer = answers();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Choose a stage for School Boards CBSE" }))
      .toBeTruthy();
    expect(await screen.findByRole("link", { name: "Class 10" })).toBeTruthy();
    expect(screen.queryByText(BOARD_ERROR)).toBeNull();
  });
});

describe("the board step when the boards lookup is still in flight", () => {
  it("keeps its skeleton and claims nothing", async () => {
    net.answer = answers({ boards: new Promise(() => {}) });
    renderAt("/explore/school");

    await screen.findByRole("heading", { level: 1, name: BOARD_HEADING });
    await waitFor(() => expect(callsTo("boards")).toBe(1));
    await slices();

    expect(pulses()).toBe(4);
    expect(screen.queryByText(BOARD_ERROR)).toBeNull();
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

describe("the board step when boards are not deployed", () => {
  it("still says School Boards is not available yet, with nothing to retry", async () => {
    net.answer = answers({ boards: NO_BOARDS_TABLE });
    renderAt("/explore/school");

    expect(await screen.findByText("School Boards is not available yet.")).toBeTruthy();
    await slices(2);
    expect(screen.queryByText(BOARD_ERROR)).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(pulses()).toBe(0);
  });
});
