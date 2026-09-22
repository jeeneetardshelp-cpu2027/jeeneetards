// Explore.stageStep.test.jsx — the stage step (/explore/:goal), which every
// homepage exam card leads to, when one of its two lookups fails or is still
// in flight.
//
// The step needs BOTH the class_levels reference rows (the names) and one
// get_browse_curriculum check per offered class (which ones have courses).
// Since supabaseClient.js puts a deadline on every request, a slow lookup now
// ENDS — and postgrest resolves it, never rejects, with the ABORTED shape
// below. Two things went wrong with that, both measured on the real page:
//
//   * a failed class check left four skeletons pulsing forever with no error
//     and no Try again, because the step's `loading` was true whenever the
//     hook was not `ready`, and a failure is never ready;
//   * a failed class_levels lookup read "Nothing here yet." — a failed
//     request presented as an empty catalogue.
//
// The rule both fixes are held to: a FAILED lookup ends in an error with a
// working Try again; a PENDING one still looks pending.
//
// Real useExplore hooks and the real page; only the network is stubbed.

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const net = vi.hoisted(() => ({
  HANG: Symbol("never settles"),
  answer: () => null,
  calls: [],
}));

vi.mock("./supabaseClient", () => {
  const reply = (key) => {
    net.calls.push(key);
    const value = net.answer(key);
    return value === net.HANG ? new Promise(() => {}) : Promise.resolve(value);
  };
  return {
    isSupabaseConfigured: true,
    supabase: {
      // Keyed by what was asked: the goal list, one class check, or a catalogue.
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
// Explore.unknownSlug.test.jsx does.
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

const GOALS = ok([
  { level: "goal", entity_id: 1, slug: "jee", name: "JEE", display_order: 1, course_count: 268 },
  { level: "goal", entity_id: 2, slug: "neet", name: "NEET", display_order: 2, course_count: 282 },
]);
const CLASS_LEVELS = ok([
  { id: 1, name: "Class 10", slug: "class-10" },
  { id: 2, name: "Class 11", slug: "class-11" },
  { id: 3, name: "Class 12", slug: "class-12" },
  { id: 4, name: "Dropper", slug: "dropper" },
]);
const SUBJECTS = ok([
  { level: "subject", entity_id: 11, slug: "physics", name: "Physics", display_order: 1, course_count: 5 },
]);

// Everything answers, except the keys an override names (matched by prefix).
const answers = (overrides = {}) => (key) => {
  for (const [prefix, value] of Object.entries(overrides)) {
    if (key.startsWith(prefix)) return value;
  }
  if (key === "goals") return GOALS;
  if (key === "class_levels") return CLASS_LEVELS;
  if (key.startsWith("classes:")) return SUBJECTS;
  return ok([]);
};

const STAGE_ERROR = "We couldn't load the available stages.";

// What the DOM held at every commit, by path. Layout effects run after the
// commit's DOM mutations and before any passive effect, so this sees a render
// the page later corrects — which a post-act assertion never would.
const seen = { navigate: null, commits: [] };
function Harness() {
  const location = useLocation();
  seen.navigate = useNavigate();
  useLayoutEffect(() => {
    seen.commits.push({ path: location.pathname, text: document.body.textContent });
  });
  return null;
}

const renderAt = (url) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/:goal" element={<Explore />} />
          <Route path="/explore/:goal/:s1" element={<Explore />} />
          <Route path="/explore/:goal/:s1/:s2" element={<Explore />} />
        </Routes>
        <Harness />
      </MemoryRouter>
    </ThemeProvider>,
  );

const pulses = () => document.querySelector("main").querySelectorAll(".animate-pulse").length;
const callsTo = (prefix) => net.calls.filter((key) => key.startsWith(prefix)).length;
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

beforeEach(() => {
  window.scrollTo = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {});
  net.calls.length = 0;
  net.answer = answers();
  seen.commits.length = 0;
});

describe("the stage step when a class check fails", () => {
  it("ends in the stage error with a working Try again, not an endless skeleton", async () => {
    net.answer = answers({ "classes:": ABORTED });
    renderAt("/explore/jee");

    expect(await screen.findByText(STAGE_ERROR)).toBeTruthy();
    expect(pulses()).toBe(0);
    expect(callsTo("classes:jee")).toBe(3);

    net.answer = answers();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Class 11" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Dropper" })).toBeTruthy();
    expect(screen.queryByText(STAGE_ERROR)).toBeNull();
    expect(callsTo("classes:jee")).toBe(6);
  });

  it("keeps its skeleton, and claims nothing, while a class check is still in flight", async () => {
    net.answer = answers({ "classes:": net.HANG });
    renderAt("/explore/jee");

    await screen.findByRole("heading", { name: "Choose a stage for JEE" });
    await waitFor(() => expect(callsTo("classes:jee")).toBe(3));
    await flush();

    expect(pulses()).toBe(4);
    expect(screen.queryByText(STAGE_ERROR)).toBeNull();
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("never shows another exam's failure under this exam while its own check is pending", async () => {
    // Browser Back from /explore/neet to /explore/jee keeps the same Explore
    // instance, and with it the hook state that still holds NEET's failure.
    net.answer = answers({ "classes:neet": ABORTED, "classes:jee": net.HANG });
    renderAt("/explore/neet");
    expect(await screen.findByText(STAGE_ERROR)).toBeTruthy();

    act(() => { seen.navigate("/explore/jee"); });
    await screen.findByRole("heading", { name: "Choose a stage for JEE" });
    await flush();

    const jeeCommits = seen.commits.filter((commit) => commit.path === "/explore/jee");
    expect(jeeCommits.length).toBeGreaterThan(0);
    for (const commit of jeeCommits) expect(commit.text).not.toContain(STAGE_ERROR);
    expect(pulses()).toBe(4);
  });
});

describe("the stage step when the class_levels lookup fails", () => {
  it("says the stages could not load, with Try again, instead of \"Nothing here yet.\"", async () => {
    net.answer = answers({ class_levels: ABORTED });
    renderAt("/explore/jee");

    expect(await screen.findByText(STAGE_ERROR)).toBeTruthy();
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
    expect(pulses()).toBe(0);

    net.answer = answers();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Class 11" })).toBeTruthy();
    expect(callsTo("class_levels")).toBe(2);
    // Only the lookup that failed is asked again.
    expect(callsTo("classes:jee")).toBe(3);
  });

  it("keeps its skeleton, not an empty claim, while class_levels is still in flight", async () => {
    net.answer = answers({ class_levels: net.HANG });
    renderAt("/explore/jee");

    await screen.findByRole("heading", { name: "Choose a stage for JEE" });
    await waitFor(() => expect(callsTo("classes:jee")).toBe(3));
    await flush();

    expect(screen.queryByText("Nothing here yet.")).toBeNull();
    expect(screen.queryByText(STAGE_ERROR)).toBeNull();
    expect(pulses()).toBe(4);
  });

  it("recovers both lookups with the one Try again when both failed", async () => {
    net.answer = answers({ class_levels: ABORTED, "classes:": ABORTED });
    renderAt("/explore/jee");

    expect(await screen.findByText(STAGE_ERROR)).toBeTruthy();
    await flush();
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(1);

    net.answer = answers();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Class 11" })).toBeTruthy();
    expect(callsTo("class_levels")).toBe(2);
    expect(callsTo("classes:jee")).toBe(6);
  });

  it("says so on a deep link to a class, instead of spinning under the stage heading", async () => {
    // /explore/jee/class-11 cannot resolve "class-11" to a class without the
    // class_levels rows, so the page falls back to the stage step — where the
    // class checks never run, because a class is already in the URL.
    net.answer = answers({ class_levels: ABORTED });
    renderAt("/explore/jee/class-11");

    expect(await screen.findByText(STAGE_ERROR)).toBeTruthy();
    expect(pulses()).toBe(0);

    net.answer = answers();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    // The subject step then loads its own catalogue, so the link comes after
    // the heading.
    expect(await screen.findByRole("heading", { name: "Choose a subject for JEE Class 11" }))
      .toBeTruthy();
    expect(await screen.findByRole("link", { name: /Physics/ })).toBeTruthy();
    expect(screen.queryByText(STAGE_ERROR)).toBeNull();
  });
});
