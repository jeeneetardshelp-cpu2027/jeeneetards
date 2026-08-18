// Phase 2 — every filter must run in the DATABASE, before paging and counting.
//
// The tests that matter here assert on the QUERY, not on what is painted. A
// render test cannot tell a database filter from a React post-filter: both
// show the right cards on page 1 of a 7-row fixture. The difference only
// appears in the count and on page 2, which is exactly where a post-filter
// silently lies.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const calls = [];
let FIXTURES = [];

function makeBuilder(table) {
  const rec = { table, cols: null, eq: {}, in: {}, ilike: null, range: null, opts: null, order: [] };
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order(c, o) {
      if (!o?.referencedTable) rec.order.push(o?.ascending === false ? `${c} desc` : c);
      return b;
    },
    range(a, z) { rec.range = [a, z]; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    ilike(k, v) { rec.ilike = [k, v]; return b; },
    in(k, v) { rec.in[k] = v; return b; },
    then(resolve) {
      let rows = FIXTURES;
      // emulate the class inner-join so results are non-vacuous
      if (rec.in["pcl.class_levels.slug"]) {
        const want = new Set(rec.in["pcl.class_levels.slug"]);
        rows = rows.filter((r) => (r.slugs ?? []).some((s) => want.has(s)));
      }
      for (const [k, v] of Object.entries(rec.in)) {
        if (k === "pcl.class_levels.slug") continue;
        const col = k.replace(/^.*\./, "");
        rows = rows.filter((r) => v.includes(r[col]));
      }
      if (rec.eq["channel_id"]) rows = rows.filter((r) => String(r.channel_id) === String(rec.eq["channel_id"]));
      const [from, to] = rec.range ?? [0, rows.length - 1];
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null, count: rows.length }).then(resolve);
    },
  };
  calls.push(rec);
  return b;
}
const supabaseMock = { from: (t) => makeBuilder(t) };
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  get supabase() { return supabaseMock; },
}));

import { usePlaylistBrowse, PAGE_SIZE } from "./usePlaylistBrowse.js";
import { applyFilterChange, removeChip, clearAllChips, buildChips } from "./filterChips.js";
import { AVAILABLE, DEFERRED, FILTER_PARAMS, filterByKey } from "./filterSchema.js";
import FilterPanel from "./FilterPanel.jsx";

const fx = (id, over = {}) => ({
  id, title: `Course ${id}`, slugs: ["class-11"], class_levels: ["11th"],
  language: "hinglish", content_type: "full-course", difficulty: "advanced",
  channel_id: 1, teacher: null, average_rating: 0, ratings_count: 0,
  institutes_channels: null, subjects: null, playlist_videos: [{ count: 3 }], ...over,
});
const CATALOGUE = [
  fx(1),
  fx(2, { language: "english", content_type: "revision" }),
  fx(3, { slugs: ["class-12"], class_levels: ["12th"], difficulty: "beginner" }),
  fx(4, { slugs: ["dropper"], class_levels: ["Dropper"], channel_id: 2 }),
  fx(5, { slugs: [], class_levels: [] }),          // untagged
];

let result;
function Probe(props) { result = usePlaylistBrowse(props); return null; }
const run = async (props) => {
  render(<MemoryRouter><Probe {...props} /></MemoryRouter>);
  await waitFor(() => expect(result.loading).toBe(false));
  return { q: calls[calls.length - 1], state: result };
};
const P = (qs = "") => new URLSearchParams(qs);

beforeEach(() => { calls.length = 0; FIXTURES = CATALOGUE; result = undefined; });

// ---------------------------------------------------------------- schema
describe("only filters the schema supports are offered", () => {
  it("every AVAILABLE filter names a real database source", () => {
    for (const f of AVAILABLE) {
      expect([f.key, typeof f.source]).toEqual([f.key, "string"]);
      expect([f.key, f.source.length > 0]).toEqual([f.key, true]);
    }
  });

  it("deferred filters are absent from the panel, not disabled", () => {
    const availableKeys = AVAILABLE.map((f) => f.key);
    for (const d of DEFERRED) expect([d.key, availableKeys.includes(d.key)]).toEqual([d.key, false]);
  });

  it("every deferred filter records what would unblock it", () => {
    for (const d of DEFERRED) {
      expect([d.key, Boolean(d.reason)]).toEqual([d.key, true]);
      expect([d.key, Boolean(d.unblockedBy)]).toEqual([d.key, true]);
    }
  });

  it("the channel filter is not labelled Institute", () => {
    // institutes_channels is a YouTube channel registry, not a curated
    // institute identity; the label must not claim otherwise.
    expect(filterByKey("channel").label).toBe("Channel");
    expect(filterByKey("channel").param).toBe("channel");
    expect(filterByKey("institute")).toBeNull();
  });
});

// ---------------------------------------------------------------- queries
describe("every filter changes the database query", () => {
  it("goal", async () => {
    const { q } = await run({ goalId: 2 });
    expect(q.cols).toContain("playlist_learning_goals!inner");
    expect(q.eq["playlist_learning_goals.learning_goal_id"]).toBe(2);
  });

  it("class", async () => {
    const { q } = await run({ stage: "class-12" });
    expect(q.cols).toContain("playlist_class_levels!inner");
    expect(q.in["pcl.class_levels.slug"]).toEqual(["class-12"]);
  });

  it("subject", async () => {
    const { q } = await run({ subjectId: 3 });
    expect(q.eq["subject_id"]).toBe(3);
  });

  it("chapter", async () => {
    const { q } = await run({ chapterId: 9 });
    expect(q.cols).toContain("videos!inner(chapter_id)");
    expect(q.eq["pv.videos.chapter_id"]).toBe(9);
  });

  it("channel", async () => {
    const { q } = await run({ channelId: "2" });
    expect(q.eq["channel_id"]).toBe("2");
  });

  it("faculty identity", async () => {
    const { q } = await run({ teacherId: "7" });
    expect(q.cols).toContain("playlist_teachers!inner");
    expect(q.eq["pt.teacher_id"]).toBe("7");
  });

  it("language", async () => {
    const { q } = await run({ language: ["hinglish"] });
    expect(q.in["language"]).toEqual(["hinglish"]);
  });

  it("course type", async () => {
    const { q } = await run({ contentType: ["revision"] });
    expect(q.in["content_type"]).toEqual(["revision"]);
  });

  it("difficulty", async () => {
    const { q } = await run({ difficulty: ["beginner"] });
    expect(q.in["difficulty"]).toEqual(["beginner"]);
  });

  it("no filter adds no predicate", async () => {
    const { q } = await run({});
    expect(Object.keys(q.eq)).toEqual([]);
    expect(Object.keys(q.in)).toEqual([]);
    expect(q.cols).not.toContain("!inner");
  });
});

describe("filters combine with AND", () => {
  it("all predicates ride in ONE request", async () => {
    const { q } = await run({
      goalId: 1, stage: "class-11", subjectId: 1, chapterId: 9,
      channelId: "1", language: ["hinglish"], contentType: ["full-course"],
      difficulty: ["advanced"],
      teacherId: "7",
    });
    expect(calls.filter((c) => c.table === "playlists")).toHaveLength(1);
    expect(q.eq["playlist_learning_goals.learning_goal_id"]).toBe(1);
    expect(q.eq["subject_id"]).toBe(1);
    expect(q.eq["pv.videos.chapter_id"]).toBe(9);
    expect(q.eq["channel_id"]).toBe("1");
    expect(q.eq["pt.teacher_id"]).toBe("7");
    expect(q.in["pcl.class_levels.slug"]).toEqual(["class-11"]);
    expect(q.in["language"]).toEqual(["hinglish"]);
    expect(q.in["content_type"]).toEqual(["full-course"]);
    expect(q.in["difficulty"]).toEqual(["advanced"]);
  });

  it("narrowing reduces the result set (non-vacuous)", async () => {
    const broad = (await run({})).state;
    calls.length = 0;
    const narrow = (await run({ contentType: ["revision"] })).state;
    expect(broad.total).toBe(5);
    expect(narrow.total).toBe(1);
    expect(narrow.items.map((i) => i.id)).toEqual([2]);
  });
});

describe("class semantics", () => {
  it("Class 11 is exact and excludes Class-12-only", async () => {
    const { state } = await run({ stage: "class-11" });
    expect(state.items.map((i) => i.id)).toEqual([1, 2]);
  });

  it("Dropper includes 11th, 12th and Dropper", async () => {
    const { state } = await run({ stage: "dropper" });
    expect(state.items.map((i) => i.id)).toEqual([1, 2, 3, 4]);
  });

  it("untagged matches nothing when a class is selected", async () => {
    for (const stage of ["class-11", "class-12", "dropper"]) {
      calls.length = 0;
      const { state } = await run({ stage });
      expect(state.items.map((i) => i.id)).not.toContain(5);
    }
  });

  it("but untagged IS included when no class is selected", async () => {
    const { state } = await run({});
    expect(state.items.map((i) => i.id)).toContain(5);
  });
});

describe("filters run before range and count", () => {
  it("the predicate and the range are in the same request", async () => {
    const { q } = await run({ contentType: ["revision"], page: 2 });
    expect(q.range).toEqual([2 * PAGE_SIZE, 3 * PAGE_SIZE - 1]);
    expect(q.opts).toEqual({ count: "exact" });
    expect(q.in["content_type"]).toEqual(["revision"]);
  });

  it("the count reflects the filter, not the whole catalogue", async () => {
    const { state } = await run({ contentType: ["revision"] });
    expect(state.total).toBe(1);
    expect(state.total).not.toBe(CATALOGUE.length);
  });

  it("ordering has a unique tie-breaker so paging cannot shuffle", async () => {
    const { q } = await run({});
    expect(q.order).toEqual([
      "display_order",
      "popularity_score desc",
      "title",
      "id",
    ]);
  });
});

describe("forbidden patterns are absent", () => {
  it("never selects *", async () => {
    const { q } = await run({ goalId: 1, chapterId: 9 });
    expect(q.cols).not.toBe("*");
    expect(q.cols).not.toContain("*");
  });

  it("issues no N+1 companion requests", async () => {
    calls.length = 0;
    await run({ goalId: 1, stage: "dropper", chapterId: 9, subjectId: 1 });
    expect(calls).toHaveLength(1);
    expect(calls.filter((c) => c.table === "playlist_videos")).toHaveLength(0);
    expect(calls.filter((c) => c.table === "playlist_class_levels")).toHaveLength(0);
  });

  it("passes no large id list back through .in()", async () => {
    const { q } = await run({ chapterId: 9 });
    for (const [k, v] of Object.entries(q.in))
      expect([k, Array.isArray(v) && v.length > 20]).toEqual([k, false]);
  });
});

// ---------------------------------------------------------------- cascade
describe("hierarchical rules", () => {
  const f = (key) => filterByKey(key);

  it("changing exam keeps a class the new exam still offers", () => {
    const next = applyFilterChange(P("goal=jee&class=11"), f("goal"), "neet");
    expect(next.get("goal")).toBe("neet");
    expect(next.get("class")).toBe("11");        // NEET also runs Class 11
  });

  it("changing exam drops a class the new exam does not offer", () => {
    const next = applyFilterChange(P("goal=jee&class=dropper"), f("goal"), "school");
    expect(next.get("goal")).toBe("school");
    expect(next.get("class")).toBeNull();        // school boards have no Dropper
  });

  it("changing exam always clears subject and chapter", () => {
    const next = applyFilterChange(
      P("goal=jee&subject=physics&chapter=kinematics"), f("goal"), "neet");
    expect(next.get("subject")).toBeNull();
    expect(next.get("chapter")).toBeNull();
  });

  it("changing subject clears chapter", () => {
    const next = applyFilterChange(
      P("goal=jee&subject=physics&chapter=kinematics"), f("subject"), "chemistry");
    expect(next.get("subject")).toBe("chemistry");
    expect(next.get("chapter")).toBeNull();
  });

  it("changing class leaves subject and chapter alone", () => {
    const next = applyFilterChange(
      P("goal=jee&class=11&subject=physics&chapter=kinematics"), f("class"), "12");
    expect(next.get("subject")).toBe("physics");
    expect(next.get("chapter")).toBe("kinematics");
  });

  it("changing chapter clears a comparison from the old chapter", () => {
    const next = applyFilterChange(
      P("subject=physics&chapter=kinematics&compare=1,2"), f("chapter"), "friction");
    expect(next.get("chapter")).toBe("friction");
    expect(next.get("compare")).toBeNull();
  });

  it("clearing the chapter also clears the comparison", () => {
    const next = applyFilterChange(
      P("subject=physics&chapter=kinematics&compare=1,2"), f("chapter"), "kinematics");
    expect(next.get("chapter")).toBeNull();
    expect(next.get("compare")).toBeNull();
  });

  it("a scalar filter does not disturb the hierarchy or the comparison", () => {
    const next = applyFilterChange(
      P("goal=jee&subject=physics&chapter=kinematics&compare=1,2"), f("language"), "hindi");
    expect(next.get("subject")).toBe("physics");
    expect(next.get("chapter")).toBe("kinematics");
    expect(next.get("compare")).toBe("1,2");
  });

  it("every filter change resets the page", () => {
    for (const key of ["goal", "class", "subject", "language", "type", "difficulty"])
      expect([key, applyFilterChange(P("page=4"), f(key), "x").get("page")]).toEqual([key, null]);
  });
});

describe("enum filters multi-select, dimension filters single-select", () => {
  it("enums accumulate and toggle off individually", () => {
    let p = applyFilterChange(P(), filterByKey("type"), "one-shot");
    p = applyFilterChange(p, filterByKey("type"), "revision");
    expect(p.get("type")).toBe("one-shot,revision");
    p = applyFilterChange(p, filterByKey("type"), "one-shot");
    expect(p.get("type")).toBe("revision");
  });

  it("dimensions replace, and toggle off when re-picked", () => {
    let p = applyFilterChange(P(), filterByKey("subject"), "physics");
    expect(p.get("subject")).toBe("physics");
    p = applyFilterChange(p, filterByKey("subject"), "physics");
    expect(p.get("subject")).toBeNull();
  });
});

describe("Clear All removes every catalogue filter", () => {
  it("clears all of them", () => {
    const all = FILTER_PARAMS.map((k) => `${k}=x`).join("&");
    const next = clearAllChips(P(all));
    for (const k of FILTER_PARAMS) expect([k, next.get(k)]).toEqual([k, null]);
  });
});

// ---------------------------------------------------------------- panel
describe("desktop and mobile render the SAME panel", () => {
  const options = {
    goal: [
      { id: 1, value: "jee", label: "JEE" },
      { id: 2, value: "neet", label: "NEET" },
      { id: 3, value: "school", label: "School Boards" },
    ],
    class: [
      { value: "10", label: "Class 10" },
      { value: "11", label: "Class 11" },
      { value: "12", label: "Class 12" },
      { value: "dropper", label: "Dropper" },
    ],
    subject: [{ value: "physics", label: "Physics" }],
    institute: [{ value: "1", label: "Competishun" }],
  };
  const renderPanel = (variant, qs = "") => {
    const params = P(qs);
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <FilterPanel variant={variant} options={options} params={params} onChange={onChange} />
      </MemoryRouter>
    );
    return { onChange, params };
  };

  it("both variants offer the same filter groups", () => {
    renderPanel("sidebar");
    const sidebarGroups = screen.getAllByRole("button", { expanded: true }).map((b) => b.textContent);
    document.body.innerHTML = "";
    renderPanel("sheet");
    const sheetGroups = screen.getAllByRole("button", { expanded: true }).map((b) => b.textContent);
    expect(sheetGroups).toEqual(sidebarGroups);
  });

  it("both write through the same model", () => {
    for (const variant of ["sidebar", "sheet"]) {
      document.body.innerHTML = "";
      const { onChange } = renderPanel(variant);
      fireEvent.click(screen.getByRole("button", { name: /^JEE$/ }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].get("goal")).toBe("jee");
    }
  });

  it("no deferred filter appears in either variant", () => {
    renderPanel("sidebar", "goal=jee&subject=physics");
    for (const label of ["Board", "Faculty", "Total duration", "Syllabus coverage", "Rating"])
      expect([label, screen.queryByText(label)]).toEqual([label, null]);
  });

  it("chapter is hidden until a subject is chosen", () => {
    renderPanel("sidebar", "goal=jee");
    expect(screen.queryByText("Chapter")).toBeNull();
  });

  it("class is hidden until an exam is chosen", () => {
    renderPanel("sidebar");
    expect(screen.queryByRole("button", { name: /^Class$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Class 10$/ })).toBeNull();
  });

  it("subject is hidden until an exam is chosen", () => {
    renderPanel("sidebar");
    expect(screen.queryByRole("button", { name: /^Subject$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Physics$/ })).toBeNull();
  });

  it("never offers Class 10 for JEE", () => {
    renderPanel("sidebar", "goal=jee");
    expect(screen.queryByRole("button", { name: /^Class 10$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Class 11$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Dropper$/ })).toBeTruthy();
  });

  it("resolves a legacy numeric goal before restricting classes", () => {
    renderPanel("sidebar", "goal=1");
    expect(screen.queryByRole("button", { name: /^Class 10$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Class 12$/ })).toBeTruthy();
  });

  it("offers Class 10 but not Dropper for School Boards", () => {
    renderPanel("sidebar", "goal=school");
    expect(screen.getByRole("button", { name: /^Class 10$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Dropper$/ })).toBeNull();
  });

  it("never offers Biology for JEE or Mathematics for NEET", () => {
    const subjectOptions = {
      ...options,
      subject: [
        { value: "physics", label: "Physics" },
        { value: "chemistry", label: "Chemistry" },
        { value: "mathematics", label: "Mathematics" },
        { value: "biology", label: "Biology" },
      ],
    };
    const renderFor = (goal) => render(
      <MemoryRouter>
        <FilterPanel options={subjectOptions} params={P(`goal=${goal}`)} onChange={() => {}} />
      </MemoryRouter>
    );

    renderFor("jee");
    expect(screen.queryByRole("button", { name: /^Biology$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Mathematics$/ })).toBeTruthy();

    document.body.innerHTML = "";
    renderFor("neet");
    expect(screen.queryByRole("button", { name: /^Mathematics$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Biology$/ })).toBeTruthy();
  });

  it("shows the selected state from the URL", () => {
    renderPanel("sidebar", "goal=neet");
    expect(screen.getByRole("button", { name: /^NEET$/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^JEE$/ }).getAttribute("aria-pressed")).toBe("false");
  });

  it("announces a filter group's selected count with a separated label", () => {
    renderPanel("sidebar", "goal=jee&type=revision");
    expect(screen.getByRole("button", { name: "Course type, 1 selected" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Course type1" })).toBeNull();
  });

  it("reports its own error state with a retry", () => {
    const onRetry = vi.fn();
    render(<MemoryRouter>
      <FilterPanel variant="sidebar" options={{}} params={P()} onChange={() => {}}
                   error="boom" onRetry={onRetry} />
    </MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------- staleness
describe("a superseded response cannot overwrite a newer one", () => {
  it("keeps the narrower result when the broader one lands late", async () => {
    let release;
    const slow = new Promise((r) => { release = r; });
    let call = 0;
    const orig = supabaseMock.from;
    supabaseMock.from = () => {
      const first = call++ === 0;
      const b = makeBuilder("playlists");
      const then = b.then;
      b.then = async (resolve) => { if (first) await slow; return then.call(b, resolve); };
      return b;
    };
    const { rerender } = render(<MemoryRouter><Probe /></MemoryRouter>);
    rerender(<MemoryRouter><Probe contentType={["revision"]} /></MemoryRouter>);
    await waitFor(() => expect(result.loading).toBe(false));
    const narrowed = result.items.map((i) => i.id);
    release();
    await new Promise((r) => setTimeout(r, 20));
    expect(result.items.map((i) => i.id)).toEqual(narrowed);
    supabaseMock.from = orig;
  });
});

describe("chips speak the vocabulary, not slugs", () => {
  it("labels an enum value from the canonical vocabulary", () => {
    expect(buildChips(P("type=full-course")).map((c) => c.label)).toEqual(["Full course"]);
    expect(buildChips(P("difficulty=advanced")).map((c) => c.label)).toEqual(["Advanced"]);
    expect(buildChips(P("language=hinglish")).map((c) => c.label)).toEqual(["Hinglish"]);
  });

  it("renders ONE chip per selected enum value", () => {
    const chips = buildChips(P("type=full-course,revision"));
    expect(chips.map((c) => c.label)).toEqual(["Full course", "Revision"]);
  });

  it("removing one enum chip keeps the others", () => {
    const next = removeChip(P("type=full-course,revision"), "type", "full-course");
    expect(next.get("type")).toBe("revision");
  });

  it("removing the last enum value drops the parameter", () => {
    expect(removeChip(P("type=revision"), "type", "revision").get("type")).toBeNull();
  });

  it("dimension chips still clear their dependants", () => {
    const next = removeChip(P("goal=jee&subject=physics&chapter=kinematics"), "subject", "physics");
    expect(next.get("subject")).toBeNull();
    expect(next.get("chapter")).toBeNull();
    expect(next.get("goal")).toBe("jee");
  });
});
