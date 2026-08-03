import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const rpcCalls = [];
const fromCalls = [];
let rpcImpl;
let tableRows;

function builder(table) {
  const call = { table, select: null, order: null, eq: {} };
  fromCalls.push(call);
  const chain = {
    select(columns) { call.select = columns; return chain; },
    order(column) { call.order = column; return chain; },
    eq(column, value) { call.eq[column] = value; return chain; },
    then(resolve, reject) {
      return Promise.resolve(tableRows[table] ?? { data: [], error: null }).then(resolve, reject);
    },
  };
  return chain;
}

const supabaseMock = {
  rpc(name, args) {
    rpcCalls.push({ name, args });
    return Promise.resolve(rpcImpl(name, args));
  },
  from: builder,
};

vi.mock("./supabaseClient.js", () => ({
  isSupabaseConfigured: true,
  get supabase() { return supabaseMock; },
}));

import { useGoalCatalog, useLearningGoals } from "./useExplore.js";
import { useBrowseFacets } from "./useBrowseFacets.js";
import FilterPanel from "./FilterPanel.jsx";

let hookState;
function GoalProbe() { hookState = useLearningGoals(); return null; }
function CatalogProbe(props) { hookState = useGoalCatalog(props); return null; }
function FacetProbe(props) { hookState = useBrowseFacets(props); return null; }

beforeEach(() => {
  rpcCalls.length = 0;
  fromCalls.length = 0;
  tableRows = {};
  hookState = null;
  rpcImpl = () => ({ data: [], error: null });
});

describe("verified curriculum RPC in the guided journey", () => {
  it("loads distinct course counts without reading the video junction", async () => {
    rpcImpl = () => ({
      data: [{ entity_id: 1, slug: "jee", name: "JEE", course_count: 12 }],
      error: null,
    });
    render(<GoalProbe />);
    await waitFor(() => expect(hookState.loading).toBe(false));

    expect(rpcCalls).toEqual([{
      name: "get_browse_curriculum",
      args: { p_goal: null, p_class: null, p_subject: null },
    }]);
    expect(fromCalls).toEqual([]);
    expect(hookState.goals[0]).toMatchObject({
      id: 1, slug: "jee", count: 12, countUnit: "course",
    });
  });

  it("fails closed without downloading the video junction when the RPC is absent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpcImpl = () => ({ data: null, error: { code: "PGRST202", message: "not in schema cache" } });
    render(<GoalProbe />);
    await waitFor(() => expect(hookState.loading).toBe(false));

    expect(fromCalls).toEqual([]);
    expect(hookState.goals).toEqual([]);
    expect(hookState.error).toMatch(/couldn't load/i);
    console.error.mockRestore();
  });

  it("keeps subject and chapter navigation bounded when the RPC is absent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpcImpl = () => ({ data: null, error: { code: "PGRST202", message: "not in schema cache" } });
    render(<CatalogProbe goal="jee" goalId={1} stage="class-11" subject="physics" />);
    await waitFor(() => expect(hookState.loading).toBe(false));

    expect(fromCalls).toEqual([]);
    expect(hookState.subjects).toEqual([]);
    expect(hookState.chaptersBySubject).toEqual({});
    expect(hookState.error).toMatch(/couldn't load/i);
    console.error.mockRestore();
  });

  it("forwards goal, class and subject and maps chapter course counts", async () => {
    rpcImpl = (_name, args) => args.p_subject
      ? {
          data: [{ entity_id: 8, slug: "kinematics", name: "Kinematics", course_count: 3 }],
          error: null,
        }
      : {
          data: [{ entity_id: 4, slug: "physics", name: "Physics", course_count: 5 }],
          error: null,
        };
    render(<CatalogProbe goal="jee" goalId={1} stage="class-11" subject="physics" />);
    await waitFor(() => expect(hookState.loading).toBe(false));

    expect(rpcCalls.map((call) => call.args)).toEqual([
      { p_goal: "jee", p_class: "class-11", p_subject: null },
      { p_goal: "jee", p_class: "class-11", p_subject: "physics" },
    ]);
    expect(fromCalls).toEqual([]);
    expect(hookState.subjects[0]).toMatchObject({ count: 5, countUnit: "course" });
    expect(hookState.chaptersBySubject[4][0]).toMatchObject({
      slug: "kinematics", count: 3,
    });
  });

  it("reports a real RPC failure instead of presenting an honest-empty message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpcImpl = () => ({ data: null, error: { code: "XX000", message: "database failed" } });
    render(<GoalProbe />);
    await waitFor(() => expect(hookState.loading).toBe(false));

    expect(hookState.error).toMatch(/couldn't load/i);
    expect(fromCalls).toEqual([]);
    console.error.mockRestore();
  });
});

describe("one contextual facet call", () => {
  it("forwards every active filter and maps rows into count lookups", async () => {
    rpcImpl = () => ({
      data: [
        { facet: "class", value: "dropper", n: 4 },
        { facet: "subject", value: "physics", n: 2 },
      ],
      error: null,
    });
    render(<FacetProbe
      goal="jee" stage="dropper" subject="physics" chapter="kinematics"
      channelId="13" language={["hinglish"]} contentType={["full-course"]}
      difficulty={["advanced"]} search="rotation"
    />);
    await waitFor(() => expect(hookState.loading).toBe(false));

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0]).toEqual({
      name: "browse_facet_counts",
      args: {
        p_goal: "jee", p_class: "dropper", p_subject: "physics",
        p_chapter: "kinematics", p_channel: 13,
        p_language: ["hinglish"], p_type: ["full-course"],
        p_difficulty: ["advanced"], p_search: "rotation",
      },
    });
    expect(hookState.counts).toEqual({
      class: { dropper: 4 }, subject: { physics: 2 },
    });
  });

  it("omits counts, but does not report a filter error, before v9 is deployed", async () => {
    rpcImpl = () => ({ data: null, error: { code: "PGRST202", message: "missing function" } });
    render(<FacetProbe goal="jee" />);
    await waitFor(() => expect(hookState.loading).toBe(false));

    expect(hookState).toMatchObject({ counts: null, unavailable: true, error: null });
  });

  it("makes no request when a filter outside the v9 contract requires counts to be suppressed", async () => {
    render(<FacetProbe goal="jee" enabled={false} />);
    await waitFor(() => expect(hookState.loading).toBe(false));

    expect(rpcCalls).toEqual([]);
    expect(hookState.counts).toBeNull();
  });

  it("renders zero and Dropper superset counts without changing the options", () => {
    render(
      <MemoryRouter>
        <FilterPanel
          options={{
            goal: [{ id: 1, value: "jee", label: "JEE" }],
            class: [
              { id: 1, value: "11", label: "Class 11" },
              { id: 2, value: "dropper", label: "Dropper" },
            ],
          }}
          params={new URLSearchParams("goal=jee")}
          onChange={vi.fn()}
          counts={{ goal: { jee: 4 }, class: { "class-11": 0, dropper: 4 } }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Class 11, 0 courses" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dropper, 4 courses" })).toBeTruthy();
  });

  it("hides zero-course chapter reference rows after counts settle", () => {
    render(
      <MemoryRouter>
        <FilterPanel
          options={{
            goal: [{ id: 1, value: "jee", label: "JEE" }],
            subject: [{ id: 1, value: "physics", label: "Physics" }],
            chapter: [
              { id: 1, value: "kinematics", label: "Kinematics" },
              { id: 80, value: "basic-mathematics-for-physics", label: "Basic Mathematics for Physics" },
            ],
          }}
          params={new URLSearchParams("goal=jee&subject=physics")}
          onChange={vi.fn()}
          counts={{ chapter: { kinematics: 4 } }}
          countsLoading={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Kinematics, 4 courses" })).toBeTruthy();
    expect(screen.queryByText("Basic Mathematics for Physics")).toBeNull();
  });

  it("keeps a selected zero-course chapter removable from a shared URL", () => {
    render(
      <MemoryRouter>
        <FilterPanel
          options={{
            goal: [{ id: 1, value: "jee", label: "JEE" }],
            subject: [{ id: 1, value: "physics", label: "Physics" }],
            chapter: [
              { id: 80, value: "basic-mathematics-for-physics", label: "Basic Mathematics for Physics" },
            ],
          }}
          params={new URLSearchParams(
            "goal=jee&subject=physics&chapter=basic-mathematics-for-physics",
          )}
          onChange={vi.fn()}
          counts={{ chapter: {} }}
          countsLoading={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", {
      name: "Basic Mathematics for Physics, 0 courses",
    }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the School chapter picker inside its exam and class curriculum", () => {
    render(
      <MemoryRouter>
        <FilterPanel
          options={{
            goal: [{ id: 3, value: "school", label: "School Boards" }],
            subject: [{ id: 3, value: "mathematics", label: "Mathematics" }],
            chapter: [
              { id: 66, value: "probability", label: "Probability" },
              { id: 131, value: "complex-numbers", label: "Complex Numbers" },
            ],
          }}
          params={new URLSearchParams(
            "goal=school&class=10&board=cbse&subject=mathematics&chapter=probability",
          )}
          onChange={vi.fn()}
          counts={null}
          chapterScopeValues={["probability"]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Probability" })).toBeTruthy();
    expect(screen.queryByText("Complex Numbers")).toBeNull();
  });

  it("keeps a selected out-of-scope chapter removable while curriculum loads", () => {
    render(
      <MemoryRouter>
        <FilterPanel
          options={{
            goal: [{ id: 3, value: "school", label: "School Boards" }],
            subject: [{ id: 3, value: "mathematics", label: "Mathematics" }],
            chapter: [
              { id: 131, value: "complex-numbers", label: "Complex Numbers" },
            ],
          }}
          params={new URLSearchParams(
            "goal=school&class=10&board=cbse&subject=mathematics&chapter=complex-numbers",
          )}
          onChange={vi.fn()}
          chapterScopeValues={[]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Complex Numbers" })
      .getAttribute("aria-pressed")).toBe("true");
  });
});
