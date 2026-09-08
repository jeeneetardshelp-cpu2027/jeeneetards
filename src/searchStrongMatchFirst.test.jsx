// searchStrongMatchFirst.test.jsx — the lessons that actually match go first.
//
// THE BUG, measured on production 2026-09-08 and captured verbatim in
// src/__fixtures__/searchStrongMatch.production.json (lectures) and
// src/__fixtures__/searchStrongMatch.courses.production.json (courses): every
// id search_video_ids / search_playlist_ids returned for four real queries,
// in the server's own rank order, with the real titles, durations, view counts
// and timestamps, plus the tokens search_query_tokens produced for each query.
//
//     query               lessons   titles that literally match
//     kinematics            172            38
//     friction problems      47            18
//     trigonometry           91            91   <- everything: a literal no-op
//     kinamatics             38             0   <- nothing:    a literal no-op
//
// The ranking already handled this on the default sort. On "Shortest first" it
// did not, because "shortest" was applied to everything the fuzzy tier admitted
// rather than to the rows that match — the whole first page of "kinematics" was
// Kinetic Theory of Gases clips. The Courses tab had it under "Most popular".
//
// THE FIX MOVES ROWS, IT NEVER REMOVES THEM. So the load-bearing test here is
// not the one that proves the fix works; it is `idsBeforeThisChange`, an
// executable copy of what these hooks did BEFORE this change, which the two
// no-op queries are asserted equal to under every sort and every page. When the
// strong block is everything or nothing, the output must be the old output
// element for element — that is the proof this cannot touch the cases that must
// not move.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import lectureFixture from "./__fixtures__/searchStrongMatch.production.json";
import courseFixture from "./__fixtures__/searchStrongMatch.courses.production.json";

// ---------------------------------------------------------------- the "server"
const calls = [];
const rpcCalls = [];
let response;
const rpcResponses = {};

function builder(table) {
  const rec = {
    table, cols: null, opts: null, orders: [], embedOrders: [],
    range: null, eq: {}, in: {}, ilike: null, limits: [],
  };
  calls.push(rec);
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order(column, options) {
      (options?.referencedTable ? rec.embedOrders : rec.orders).push(
        column
          + (options?.ascending === false ? " desc" : "")
          + (options?.nullsFirst === false ? " nullslast" : ""));
      return b;
    },
    limit(n, options) { rec.limits.push([n, options?.referencedTable ?? null]); return b; },
    range(a, z, options) { if (!options?.referencedTable) rec.range = [a, z]; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    in(k, v) { rec.in[k] = v; return b; },
    ilike(k, v) { rec.ilike = [k, v]; return b; },
    then(resolve) { return Promise.resolve(response).then(resolve); },
  };
  return b;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table) => builder(table),
    rpc: (name, args) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpcResponses[name] ?? { data: [], error: null });
    },
  },
}));

import {
  useVideos, LECTURE_PAGE_SIZE, LECTURE_SORTS, DEFAULT_LECTURE_SORT,
} from "./useBrowse.js";
import { usePlaylistBrowse, PAGE_SIZE } from "./usePlaylistBrowse.js";
import { isStrongTitleMatch, partitionByStrength } from "./searchStrongMatch.js";

// ------------------------------------------------------- the database's ORDER BY
//
// The mock stands in for Postgres, so Postgres's ordering rules belong here.
// ASC puts NULLs last and DESC puts them first unless the .order() chain says
// otherwise; LECTURE_ORDER_BY pins nullsFirst:false on BOTH duration sorts, and
// leaves created_at at the default. Every chain ends in the unique id
// tie-break, which is what makes the server's order a total order.
const orderRows = (rows, by) => [...rows].sort((a, b) => by(a, b) || a.id - b.id);
const asc = (x, y) => (x == null && y == null ? 0 : x == null ? 1 : y == null ? -1 : x - y);
const descNullsLast = (x, y) => (x == null && y == null ? 0 : x == null ? 1 : y == null ? -1 : y - x);
const descNullsFirst = (x, y) => (x == null && y == null ? 0 : x == null ? -1 : y == null ? 1 : y - x);
const time = (v) => (v == null ? null : Date.parse(v));

const LECTURE_SERVER_ORDER = {
  recommended: (rows) => orderRows(rows, () => 0),
  shortest: (rows) => orderRows(rows, (a, b) => asc(a.durationSeconds, b.durationSeconds)),
  longest: (rows) => orderRows(rows, (a, b) => descNullsLast(a.durationSeconds, b.durationSeconds)),
  recent: (rows) => orderRows(rows, (a, b) => descNullsFirst(time(a.createdAt), time(b.createdAt))),
};
const COURSE_SERVER_ORDER = {
  recommended: (rows) => orderRows(rows, () => 0),
  popular: (rows) => orderRows(rows, (a, b) => descNullsFirst(a.popularityScore, b.popularityScore)),
  most_viewed: (rows) => orderRows(rows, (a, b) => descNullsFirst(a.viewCountTotal, b.viewCountTotal)),
  recent: (rows) => orderRows(rows, (a, b) => descNullsFirst(time(a.createdAt), time(b.createdAt))),
};

/**
 * WHAT THESE HOOKS DID BEFORE THIS CHANGE. Not a description of it — the code,
 * so the no-op assertions are an equality test against real prior behaviour.
 *
 *   default sort  -> the whole match set was fetched and re-sorted by the
 *                    position of each id in the RPC's ranked array, then sliced.
 *   any other     -> range() cut the page in the database and the rows were
 *                    handed back in the server's order, untouched.
 */
function idsBeforeThisChange({ rows, rankedIds, order, sort, defaultSort, pageSize, page }) {
  const ordered = order[sort](rows);
  if (sort === defaultSort) {
    const rankOf = new Map(rankedIds.map((id, i) => [id, i]));
    const rank = (r) => rankOf.get(r.id) ?? Number.MAX_SAFE_INTEGER;
    return [...ordered].sort((a, b) => rank(a) - rank(b) || a.id - b.id)
      .slice(page * pageSize, (page + 1) * pageSize).map((r) => r.id);
  }
  return ordered.slice(page * pageSize, (page + 1) * pageSize).map((r) => r.id);
}

// ---------------------------------------------------------------- the harnesses
let seen;
function LectureProbe(props) { seen = useVideos(props); return null; }
function CourseProbe(props) { seen = usePlaylistBrowse(props); return null; }

const QUERIES = ["kinematics", "friction problems", "trigonometry", "kinamatics"];

const tokensRow = (tokens) => ({
  data: [{ qlen: 10, q: "", q_tokens: tokens, q_long: tokens[0] ?? "" }],
  error: null,
});

beforeEach(() => {
  calls.length = 0;
  rpcCalls.length = 0;
  seen = undefined;
  response = { data: [], error: null, count: 0 };
  for (const key of Object.keys(rpcResponses)) delete rpcResponses[key];
});

async function settle() {
  await waitFor(() => {
    expect(seen).toBeDefined();
    expect(seen.loading).toBe(false);
  });
}

/** One render of the lectures hook against the captured production rows. */
async function lectures({ query, sort = DEFAULT_LECTURE_SORT, page = 0, tokens, tokensError }) {
  cleanup();
  calls.length = 0;
  rpcCalls.length = 0;
  seen = undefined;
  const fx = lectureFixture.queries[query];
  const ordered = LECTURE_SERVER_ORDER[sort](fx.rows);
  response = {
    data: ordered.map((r) => ({
      id: r.id, youtube_video_id: `y${r.id}`, title: r.title,
      institutes_channels: null, subjects: null, chapters: null, membership: [],
    })),
    error: null,
    count: fx.rows.length,
  };
  rpcResponses.search_video_ids = { data: fx.rankedIds.map((id) => ({ id })), error: null };
  rpcResponses.search_query_tokens = tokensError
    ? { data: null, error: { code: "PGRST202", message: "Could not find the function" } }
    : tokensRow(tokens ?? fx.qTokens);
  render(<LectureProbe search={query} sort={sort} page={page} />);
  await settle();
  return { ids: seen.videos.map((v) => v.id), titles: seen.videos.map((v) => v.title), state: seen };
}

/** One render of the courses hook against the captured production rows. */
async function courses({ query, sort = "recommended", page = 0, tokens }) {
  cleanup();
  calls.length = 0;
  rpcCalls.length = 0;
  seen = undefined;
  const fx = courseFixture.queries[query];
  const ordered = COURSE_SERVER_ORDER[sort](fx.rows);
  response = {
    data: ordered.map((r) => ({
      id: r.id, title: r.title, teacher: null, average_rating: null, ratings_count: 0,
      language: null, content_type: null, difficulty: null, class_levels: [],
      view_count_total: r.viewCountTotal, stats_fetched_at: null,
      institutes_channels: null, subjects: null, playlist_videos: [{ count: 3 }], cover: [],
    })),
    error: null,
    count: fx.rows.length,
  };
  rpcResponses.search_playlist_ids = { data: fx.rankedIds.map((id) => ({ id })), error: null };
  rpcResponses.search_query_tokens = tokensRow(tokens ?? fx.qTokens);
  render(<CourseProbe search={query} sort={sort} page={page} enabled />);
  await settle();
  return { ids: seen.items.map((c) => c.id), titles: seen.items.map((c) => c.title), state: seen };
}

const strongIn = (titles, tokens) => titles.filter((t) => isStrongTitleMatch(t, tokens)).length;

// =====================================================================
// 1. THE FOUR ACCEPTANCE CASES
// =====================================================================
describe("the four acceptance cases, measured on production 2026-09-08", () => {
  const EXPECTED = {
    kinematics: { rows: 172, strong: 38 },
    "friction problems": { rows: 47, strong: 18 },
    trigonometry: { rows: 91, strong: 91 },   // everything — a literal no-op
    kinamatics: { rows: 38, strong: 0 },      // nothing    — a literal no-op
  };

  it.each(QUERIES)("%j keeps every row and names the strong block", async (query) => {
    const { state } = await lectures({ query, sort: "shortest" });
    expect(state.total).toBe(EXPECTED[query].rows);
    expect(state.strongTotal).toBe(EXPECTED[query].strong);
  });

  // The membership of the result set is what a SQL threshold would have
  // changed, and the investigation ruled that out. Asserted per sort so no
  // ordering path can quietly drop a row.
  it.each(QUERIES)("%j returns the same rows under every sort", async (query) => {
    const fx = lectureFixture.queries[query];
    for (const { id: sort } of LECTURE_SORTS) {
      const collected = [];
      const pages = Math.ceil(fx.rows.length / LECTURE_PAGE_SIZE);
      for (let page = 0; page < pages; page += 1) {
        const { ids, state } = await lectures({ query, sort, page });
        expect(state.total).toBe(fx.rows.length);
        collected.push(...ids);
      }
      // Every id exactly once: a permutation of the match set, never a subset.
      expect([...collected].sort((a, b) => a - b))
        .toEqual([...fx.rankedIds].sort((a, b) => a - b));
      expect(new Set(collected).size).toBe(fx.rows.length);
    }
  });
});

// =====================================================================
// 2. THE GUARD: the two no-op queries may not move, byte for byte
// =====================================================================
describe("queries whose strong block is everything or nothing are untouched", () => {
  // trigonometry: 91 of 91 strong. kinamatics: 0 of 38. Concatenating a full
  // block with an empty one is the identity, so these must emit the SAME id
  // order this code emitted before the change — under every sort, on every page.
  const NO_OP = ["trigonometry", "kinamatics"];

  it.each(NO_OP)("%j emits an identical id order on the lectures tab", async (query) => {
    const fx = lectureFixture.queries[query];
    const pages = Math.ceil(fx.rows.length / LECTURE_PAGE_SIZE);
    let compared = 0;
    for (const { id: sort } of LECTURE_SORTS) {
      for (let page = 0; page < pages; page += 1) {
        const { ids } = await lectures({ query, sort, page });
        expect(ids).toEqual(idsBeforeThisChange({
          rows: fx.rows, rankedIds: fx.rankedIds, order: LECTURE_SERVER_ORDER,
          sort, defaultSort: DEFAULT_LECTURE_SORT, pageSize: LECTURE_PAGE_SIZE, page,
        }));
        compared += 1;
      }
    }
    // The loop must actually have run, or this asserts nothing.
    expect(compared).toBe(LECTURE_SORTS.length * pages);
  });

  it.each(NO_OP)("%j emits an identical id order on the courses tab", async (query) => {
    const fx = courseFixture.queries[query];
    const pages = Math.max(1, Math.ceil(fx.rows.length / PAGE_SIZE));
    for (const sort of Object.keys(COURSE_SERVER_ORDER)) {
      for (let page = 0; page < pages; page += 1) {
        const { ids } = await courses({ query, sort, page });
        expect(ids).toEqual(idsBeforeThisChange({
          rows: fx.rows, rankedIds: fx.rankedIds, order: COURSE_SERVER_ORDER,
          sort, defaultSort: "recommended", pageSize: PAGE_SIZE, page,
        }));
      }
    }
  });

  // And the count does not sprout a second number for them either: 91 of 91 and
  // 0 of 38 are both "nothing useful to add", which is why BrowsePage hides it.
  it("reports a strong block that is all or nothing, so the heading can hide it", async () => {
    expect((await lectures({ query: "trigonometry", sort: "shortest" })).state)
      .toMatchObject({ total: 91, strongTotal: 91 });
    expect((await lectures({ query: "kinamatics", sort: "shortest" })).state)
      .toMatchObject({ total: 38, strongTotal: 0 });
  });
});

// =====================================================================
// 3. THE FIX: shortest among the lessons that match, then the rest
// =====================================================================
describe("a chosen sort applies to the matching lessons first", () => {
  it.each([
    ["kinematics", 38],
    ["friction problems", 18],
  ])("%j: the first 12 under Shortest first all match (was 0 of 12)", async (query, strong) => {
    const fx = lectureFixture.queries[query];
    const { titles, state } = await lectures({ query, sort: "shortest", page: 0 });
    expect(state.strongTotal).toBe(strong);

    // AFTER: every one of the first twelve is about what was typed.
    expect(strongIn(titles.slice(0, 12), fx.qTokens)).toBe(12);
    // ...and the whole first page is strong up to the size of the block.
    expect(strongIn(titles, fx.qTokens)).toBe(Math.min(LECTURE_PAGE_SIZE, strong));

    // BEFORE: the same rows, the same sort, the pre-change slice — zero of
    // twelve. Without this the assertion above could pass on a no-op.
    const before = idsBeforeThisChange({
      rows: fx.rows, rankedIds: fx.rankedIds, order: LECTURE_SERVER_ORDER,
      sort: "shortest", defaultSort: DEFAULT_LECTURE_SORT,
      pageSize: LECTURE_PAGE_SIZE, page: 0,
    });
    const titleOf = new Map(fx.rows.map((r) => [r.id, r.title]));
    expect(strongIn(before.slice(0, 12).map((id) => titleOf.get(id)), fx.qTokens)).toBe(0);
  });

  it("keeps the server's own order INSIDE each block", async () => {
    const fx = lectureFixture.queries.kinematics;
    const ordered = LECTURE_SERVER_ORDER.shortest(fx.rows).map((r) => r.id);
    const { strong, weak } = partitionByStrength(
      LECTURE_SERVER_ORDER.shortest(fx.rows), fx.qTokens);

    const all = [];
    const pages = Math.ceil(fx.rows.length / LECTURE_PAGE_SIZE);
    for (let page = 0; page < pages; page += 1) {
      all.push(...(await lectures({ query: "kinematics", sort: "shortest", page })).ids);
    }
    // Strong block then weak block, each in the order the DATABASE returned —
    // which is what makes "shortest" still mean shortest within each.
    expect(all).toEqual([...strong.map((r) => r.id), ...weak.map((r) => r.id)]);
    // Each block is a subsequence of the server's ordering, so no row was
    // re-sorted by a comparator this code re-derived.
    const positionOf = new Map(ordered.map((id, i) => [id, i]));
    for (const block of [strong, weak]) {
      const positions = block.map((r) => positionOf.get(r.id));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  it("does not disturb the ranking on the default sort", async () => {
    // Relevance already puts the real matches on top. Running both orderings
    // would leave neither control honest, so the partition only reports a count.
    const fx = lectureFixture.queries.kinematics;
    const { ids, state } = await lectures({ query: "kinematics", sort: "recommended", page: 0 });
    expect(ids).toEqual(fx.rankedIds.slice(0, LECTURE_PAGE_SIZE));
    // The count is still reported, because the heading needs it on every sort.
    expect(state.strongTotal).toBe(38);
  });

  it("fixes Most popular on the courses tab the same way", async () => {
    const fx = courseFixture.queries.kinematics;
    const { titles, state } = await courses({ query: "kinematics", sort: "popular", page: 0 });
    // 48 courses matched; four are actually called Kinematics.
    expect(state.total).toBe(48);
    expect(state.strongTotal).toBe(4);
    expect(strongIn(titles.slice(0, 4), fx.qTokens)).toBe(4);

    const before = idsBeforeThisChange({
      rows: fx.rows, rankedIds: fx.rankedIds, order: COURSE_SERVER_ORDER,
      sort: "popular", defaultSort: "recommended", pageSize: PAGE_SIZE, page: 0,
    });
    const titleOf = new Map(fx.rows.map((r) => [r.id, r.title]));
    // Before: not one of the four was on the first page of "Most popular".
    expect(strongIn(before.map((id) => titleOf.get(id)), fx.qTokens)).toBe(0);
  });
});

// =====================================================================
// 4. THE WHOLE MATCH SET, ON EVERY SORT
// =====================================================================
describe("the request", () => {
  it.each(LECTURE_SORTS.map((s) => s.id))(
    "fetches the whole bounded match set under %j", async (sort) => {
      const fx = lectureFixture.queries.kinematics;
      await lectures({ query: "kinematics", sort });
      // range() covers everything the RPC named; nothing is narrowed away.
      expect(calls[0].range).toEqual([0, fx.rankedIds.length - 1]);
      expect(calls[0].in.id).toEqual(fx.rankedIds);
      // The DATABASE still answers the sort — the .order() chain is untouched.
      expect(calls[0].orders).toEqual({
        recommended: ["id"],
        shortest: ["duration_seconds nullslast", "id"],
        longest: ["duration_seconds desc nullslast", "id"],
        recent: ["created_at desc", "id"],
      }[sort]);
    });

  it("still pages in the database when no term is active", async () => {
    // No search means no bounded id set to fetch, so nothing about the
    // unsearched catalogue changes.
    render(<LectureProbe page={3} />);
    await settle();
    expect(rpcCalls).toHaveLength(0);
    expect(calls[0].range).toEqual([3 * LECTURE_PAGE_SIZE, 4 * LECTURE_PAGE_SIZE - 1]);
    expect(seen.strongTotal).toBeNull();
  });

  it.each(["popular", "most_viewed", "recent"])(
    "fetches the whole bounded course set under %j", async (sort) => {
      const fx = courseFixture.queries.kinematics;
      await courses({ query: "kinematics", sort });
      expect(calls[0].range).toEqual([0, fx.rankedIds.length - 1]);
      expect(calls[0].in.id).toEqual(fx.rankedIds);
    });
});

// =====================================================================
// 5. THE TOKENS COME FROM THE SERVER
// =====================================================================
describe("the content tokens are the server's, not a JS reimplementation", () => {
  it("asks search_query_tokens for the same trimmed term", async () => {
    await lectures({ query: "friction problems", sort: "shortest" });
    expect(rpcCalls.filter((c) => c.name === "search_query_tokens")).toEqual([
      { name: "search_query_tokens", args: { p_query: "friction problems" } },
    ]);
    await courses({ query: "friction problems", sort: "popular" });
    expect(rpcCalls.filter((c) => c.name === "search_query_tokens")).toEqual([
      { name: "search_query_tokens", args: { p_query: "friction problems" } },
    ]);
  });

  // THE MEASUREMENT THAT SETTLES IT. "problem" is filler, so the server
  // tokenises "friction problems" to ["friction"] and finds 18 strong titles.
  // A JS `split(/\s+/)` yields ["friction","problems"] and finds ZERO, because
  // no title in the match set contains both words. The naive version does not
  // degrade this feature, it deletes it — silently, with no error and a page
  // that simply looks unchanged.
  it("would find nothing if the tokens were split in the browser", async () => {
    const fx = lectureFixture.queries["friction problems"];
    expect(fx.qTokens).toEqual(["friction"]);

    const fromServer = await lectures({ query: "friction problems", sort: "shortest" });
    expect(fromServer.state.strongTotal).toBe(18);

    const naive = await lectures({
      query: "friction problems", sort: "shortest",
      tokens: "friction problems".split(/\s+/),
    });
    expect(naive.state.strongTotal).toBe(0);
    // ...and with an empty strong block the page collapses back to the bug.
    expect(strongIn(naive.titles.slice(0, 12), fx.qTokens)).toBe(0);
  });

  it("leaves the page exactly as it was when the tokeniser cannot answer", async () => {
    // A missing or failing helper must not break search, and must not invent a
    // block that means nothing. No tokens -> no partition -> today's page.
    const fx = lectureFixture.queries.kinematics;
    const { ids, state } = await lectures({
      query: "kinematics", sort: "shortest", page: 0, tokensError: true,
    });
    expect(state.error).toBeNull();
    expect(state.strongTotal).toBeNull();
    expect(ids).toEqual(idsBeforeThisChange({
      rows: fx.rows, rankedIds: fx.rankedIds, order: LECTURE_SERVER_ORDER,
      sort: "shortest", defaultSort: DEFAULT_LECTURE_SORT,
      pageSize: LECTURE_PAGE_SIZE, page: 0,
    }));
  });
});

// =====================================================================
// 6. THE PREDICATE
// =====================================================================
describe("the strong-title test", () => {
  it("matches morphology through a prefix, not the whole token", async () => {
    expect(isStrongTitleMatch("Kinematics 1D (Part 4)", ["kinematics"])).toBe(true);
    expect(isStrongTitleMatch("Kinematic equations", ["kinematics"])).toBe(true);
    expect(isStrongTitleMatch("Kinetic Theory of Gases | #7", ["kinematics"])).toBe(false);
  });

  it("requires every content token, not any of them", async () => {
    expect(isStrongTitleMatch("Friction on an inclined plane", ["friction", "problems"])).toBe(false);
    expect(isStrongTitleMatch("Friction problems for JEE", ["friction", "problems"])).toBe(true);
  });

  it("reads through the punctuation and case the catalogue actually uses", async () => {
    expect(isStrongTitleMatch("Class 11 Physics | KINEMATICS — #22", ["kinematics"])).toBe(true);
  });

  // [].every() is true, which would call every row strong the moment the
  // tokeniser failed. Callers check the length, and the predicate refuses too.
  it("is not a match when there are no tokens at all", () => {
    expect(isStrongTitleMatch("anything", [])).toBe(false);
    expect(isStrongTitleMatch("anything", undefined)).toBe(false);
  });

  // THE PREFIX CUT IS floor(), NOT ceil(), AND ONE CHARACTER IS A WHOLE WORD.
  //
  // This shipped as ceil first. ceil(11 * 0.7) = 8 makes the prefix for
  // "integration" be "integrat", and "integrals" diverges at exactly character
  // 8 — so the noun form of the same topic was called a weak match and pushed
  // below every strong row. Measured on production: query "integration" had 18
  // weak rows literally containing "integral", and under "Shortest first" the
  // shortest lesson in the entire match set fell from position 1 to 229.
  //
  // No test caught it, because the four acceptance queries do not have a
  // strong/weak boundary that falls inside a word. These do. They are written
  // against the predicate directly rather than a fixture, so they keep working
  // when the catalogue changes.
  it("matches the noun form when the query is the gerund, and vice versa", () => {
    // The case that regressed. Both directions, because the relation was
    // asymmetric under ceil: the noun found the gerund, the gerund buried the
    // noun.
    expect(isStrongTitleMatch("Definite Integrals", ["integration"])).toBe(true);
    expect(isStrongTitleMatch("Methods of evaluation of integral", ["integration"])).toBe(true);
    expect(isStrongTitleMatch("Integration by parts", ["integral"])).toBe(true);
  });

  it("matches the device when the query is the property", () => {
    // capacitance -> capacitor was the widest miss of all: 9 strong of 45 under
    // ceil, 31 under floor.
    expect(isStrongTitleMatch("Parallel Plate Capacitor", ["capacitance"])).toBe(true);
    expect(isStrongTitleMatch("Charging of Capacitor", ["capacitance"])).toBe(true);
    expect(isStrongTitleMatch("Structure of Atom in One Shot", ["structure"])).toBe(true);
  });

  it("still refuses the coincidental matches the partition exists to demote", () => {
    // Loosening the cut must not loosen it so far that the original defect
    // returns. These are the rows that filled page one under "Shortest first".
    expect(isStrongTitleMatch("Kinetic Theory of Gases", ["kinematics"])).toBe(false);
    expect(isStrongTitleMatch("Basic Mathematics for Physics", ["kinematics"])).toBe(false);
    expect(isStrongTitleMatch("Projection from Tower", ["friction"])).toBe(false);
  });
});
