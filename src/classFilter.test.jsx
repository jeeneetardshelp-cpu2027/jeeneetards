// Class must be a DATABASE filter, not a React post-filter.
//
// A post-filter is wrong in two ways that a naive render test cannot see: the
// COUNT is computed before filtering (so "12 courses" is a lie) and the PAGE is
// truncated before filtering (so page 1 shows four cards instead of twelve).
// These tests therefore assert on the QUERY, and on fixture-backed results, not
// just on what happens to be painted.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// ---- a builder that records the query AND applies the class predicate to a
// fixture, so "different classes -> different non-empty results" is real.
const calls = [];
let FIXTURES = [];

function makeBuilder(table) {
  const rec = { table, cols: null, eq: {}, in: null, range: null, opts: null };
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order() { return b; },
    range(a, z) { rec.range = [a, z]; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    ilike() { return b; },
    in(k, v) { rec.in = [k, v]; return b; },
    then(resolve) {
      // Emulate the inner join: a playlist matches only if one of its junction
      // slugs is in the requested set. Untagged playlists have [] and so can
      // never satisfy an inner join — the same reason the database excludes them.
      let rows = FIXTURES;
      if (rec.in && rec.in[0] === "pcl.class_levels.slug") {
        const want = new Set(rec.in[1]);
        rows = rows.filter((r) => (r.slugs ?? []).some((s) => want.has(s)));
      }
      const [from, to] = rec.range ?? [0, rows.length - 1];
      return Promise.resolve({
        data: rows.slice(from, to + 1), error: null, count: rows.length,
      }).then(resolve);
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

import { usePlaylistBrowse, classSlugsForStage, PAGE_SIZE } from "./usePlaylistBrowse.js";
import { playlistMatchesClass } from "./classLevels.js";
import { useCanonicalFilters } from "./useCanonicalFilters.js";

// Non-vacuous fixtures: every class has content, so an empty result is a
// failure rather than the natural state of the data.
const fx = (id, slugs, labels) => ({
  id, title: `Course ${id}`, slugs, class_levels: labels,
  teacher: null, average_rating: 0, ratings_count: 0, language: null,
  content_type: null, difficulty: null, institutes_channels: null,
  subjects: null, playlist_videos: [{ count: 3 }],
});
const CATALOGUE = [
  fx(1, ["class-11"], ["11th"]),
  fx(2, ["class-11"], ["11th"]),
  fx(3, ["class-12"], ["12th"]),
  fx(4, ["dropper"], ["Dropper"]),
  fx(5, ["class-11", "class-12"], ["11th", "12th"]),
  fx(6, [], []),                                   // UNTAGGED
];

let result;
function Probe(props) { result = usePlaylistBrowse(props); return null; }
function UrlDrivenProbe({ params }) {
  const canonical = useCanonicalFilters(params);
  result = usePlaylistBrowse({
    goalId: canonical.goalId,
    subjectId: canonical.subjectId,
    stage: canonical.stage,
    enabled: canonical.ready,
  });
  return null;
}
const run = async (props) => {
  render(<MemoryRouter><Probe {...props} /></MemoryRouter>);
  await waitFor(() => expect(result.loading).toBe(false));
  return { query: calls[calls.length - 1], state: result };
};

beforeEach(() => { calls.length = 0; FIXTURES = CATALOGUE; result = undefined; });

// ---------------------------------------------------------------- semantics
describe("the slug set each stage filters on", () => {
  it("Class 11 and Class 12 are exact", () => {
    expect(classSlugsForStage("class-11")).toEqual(["class-11"]);
    expect(classSlugsForStage("class-12")).toEqual(["class-12"]);
  });

  it("Dropper includes Dropper, 11th and 12th", () => {
    expect(classSlugsForStage("dropper")).toEqual(["dropper", "class-11", "class-12"]);
  });

  it("no class selected means no filter at all", () => {
    expect(classSlugsForStage(null)).toBeNull();
    expect(classSlugsForStage(undefined)).toBeNull();
  });

  it("agrees with classLevels.js, which owns the rule", () => {
    // Same question asked of the in-memory rule and of the slug set.
    const label = { "class-11": "11th", "class-12": "12th", dropper: "Dropper" };
    for (const stage of ["class-11", "class-12", "dropper"]) {
      const slugs = new Set(classSlugsForStage(stage));
      for (const row of CATALOGUE) {
        const bySlug = (row.slugs ?? []).some((s) => slugs.has(s));
        const byLabel = playlistMatchesClass(label[stage], row.class_levels);
        expect({ stage, id: row.id, bySlug }).toEqual({ stage, id: row.id, bySlug: byLabel });
      }
    }
  });
});

// ---------------------------------------------------------------- the query
describe("class filtering happens in the database", () => {
  it("changes the database predicate when only the URL class changes", async () => {
    const class11 = new URLSearchParams("goal=1&subject=1&class=11");
    const class12 = new URLSearchParams("goal=1&subject=1&class=12");
    const view = (params) => (
      <MemoryRouter>
        <UrlDrivenProbe params={params} />
      </MemoryRouter>
    );

    const { rerender } = render(view(class11));
    await waitFor(() => {
      const query = calls.filter((call) => call.table === "playlists").at(-1);
      expect(query?.in).toEqual(["pcl.class_levels.slug", ["class-11"]]);
    });

    rerender(view(class12));
    await waitFor(() => {
      const query = calls.filter((call) => call.table === "playlists").at(-1);
      expect(query?.in).toEqual(["pcl.class_levels.slug", ["class-12"]]);
    });
  });

  it("joins the junction and filters on it", async () => {
    const { query } = await run({ stage: "class-11" });
    expect(query.cols).toContain("playlist_class_levels!inner");
    expect(query.cols).toContain("class_levels!inner(slug)");
    expect(query.in).toEqual(["pcl.class_levels.slug", ["class-11"]]);
  });

  it("different classes produce DIFFERENT query clauses", async () => {
    const a = (await run({ stage: "class-11" })).query;
    calls.length = 0;
    const b = (await run({ stage: "class-12" })).query;
    calls.length = 0;
    const c = (await run({ stage: "dropper" })).query;
    expect(a.in[1]).toEqual(["class-11"]);
    expect(b.in[1]).toEqual(["class-12"]);
    expect(c.in[1]).toEqual(["dropper", "class-11", "class-12"]);
    expect(a.in[1]).not.toEqual(b.in[1]);
    expect(c.in[1]).not.toEqual(a.in[1]);
  });

  it("adds NO class join when no class is selected", async () => {
    const { query } = await run({});
    expect(query.cols).not.toContain("playlist_class_levels");
    expect(query.in).toBeNull();
  });

  it("filters BEFORE paging, in the same request", async () => {
    const { query } = await run({ stage: "class-11", page: 2 });
    // one request, carrying both the predicate and the range
    expect(calls.filter((c) => c.table === "playlists")).toHaveLength(1);
    expect(query.in[0]).toBe("pcl.class_levels.slug");
    expect(query.range).toEqual([2 * PAGE_SIZE, 3 * PAGE_SIZE - 1]);
    expect(query.opts).toEqual({ count: "exact" });
  });
});

// ---------------------------------------------------------------- results
describe("results and counts differ by class (seeded fixtures)", () => {
  it("Class 11 returns only Class-11-tagged courses, non-empty", async () => {
    const { state } = await run({ stage: "class-11" });
    expect(state.items.map((i) => i.id)).toEqual([1, 2, 5]);
    expect(state.total).toBe(3);
  });

  it("Class 12 returns only Class-12-tagged courses, non-empty", async () => {
    const { state } = await run({ stage: "class-12" });
    expect(state.items.map((i) => i.id)).toEqual([3, 5]);
    expect(state.total).toBe(2);
  });

  it("Dropper returns 11th, 12th AND Dropper content, non-empty", async () => {
    const { state } = await run({ stage: "dropper" });
    expect(state.items.map((i) => i.id)).toEqual([1, 2, 3, 4, 5]);
    expect(state.total).toBe(5);
  });

  it("Class 11 EXCLUDES Class-12-only content", async () => {
    const { state } = await run({ stage: "class-11" });
    expect(state.items.map((i) => i.id)).not.toContain(3);   // 12th only
    expect(state.items.map((i) => i.id)).not.toContain(4);   // Dropper only
  });

  it("untagged content matches NO class", async () => {
    for (const stage of ["class-11", "class-12", "dropper"]) {
      calls.length = 0;
      const { state } = await run({ stage });
      expect(state.items.map((i) => i.id)).not.toContain(6);
    }
  });

  it("but untagged content IS shown when no class is selected", async () => {
    const { state } = await run({});
    expect(state.items.map((i) => i.id)).toContain(6);
    expect(state.total).toBe(6);
  });

  it("the COUNT reflects the filter, not the unfiltered catalogue", async () => {
    // This is what a React post-filter gets wrong: it would report 6 here.
    const { state } = await run({ stage: "class-12" });
    expect(state.total).toBe(2);
    expect(state.total).not.toBe(CATALOGUE.length);
  });
});

describe("a superseded response never overwrites a newer one", () => {
  // Filters resolve asynchronously (slug -> id), so this hook runs first with
  // no chapter and again with one. The UNFILTERED response is issued first and
  // can land last. That is what made /browse?ch=1 display all 7 courses while
  // the correct 5-course request had already returned.
  it("ignores the earlier, broader result when a narrower one supersedes it", async () => {
    let release;
    const slow = new Promise((r) => { release = r; });

    // First call (no filter) hangs; second call (filtered) resolves at once.
    let call = 0;
    const origFrom = supabaseMock.from;
    supabaseMock.from = () => {
      const isFirst = call++ === 0;
      const b = makeBuilder("playlists");
      const originalThen = b.then;
      b.then = async (resolve) => {
        if (isFirst) await slow;
        return originalThen.call(b, resolve);
      };
      return b;
    };

    const { rerender } = render(<MemoryRouter><Probe /></MemoryRouter>);
    rerender(<MemoryRouter><Probe stage="class-12" /></MemoryRouter>);
    await waitFor(() => expect(result.loading).toBe(false));
    const narrowed = result.items.map((i) => i.id);

    release();                                  // the stale, broader response lands
    await new Promise((r) => setTimeout(r, 20));

    expect(result.items.map((i) => i.id)).toEqual(narrowed);
    expect(result.items.map((i) => i.id)).not.toContain(6);   // untagged leaked back in
    supabaseMock.from = origFrom;
  });
});
