// courseRelevance.test.jsx — the Courses tab's best-match order.
//
// search_playlist_ids answers with the matching course ids IN RELEVANCE ORDER
// and NO rank column, capped at 500 (see
// supabase/migrations/20260902210000_browse_course_relevance.sql). The ranking
// therefore exists on the client only as the POSITION of each id in that array.
// Feeding it to .in("id", …) and then ordering by display_order/popularity
// throws it away — SQL IN does not preserve the order of its arguments — which
// is how a student searching "kinematics" got a page of Mathematics courses
// while the two courses actually called Kinematics sat below the fold.
//
// Courses is the DEFAULT tab, so this is the first thing a searching student
// meets. These tests assert the ranking survives, across pages.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const calls = [];
const rpcCalls = [];
let response;
let rpcResponse;

function builder(table) {
  const rec = {
    table, cols: null, opts: null, eq: {}, in: {}, range: null, ilike: null,
    orders: [], embedOrders: [],
  };
  calls.push(rec);
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order(column, options) {
      // A referencedTable order sorts an EMBED (the cover thumbnail), not the
      // page. Keeping the two apart is the point: the page's ordering is what
      // paging depends on.
      (options?.referencedTable ? rec.embedOrders : rec.orders).push(
        column + (options?.ascending === false ? " desc" : ""),
      );
      return b;
    },
    range(a, z, options) {
      if (!options?.referencedTable) rec.range = [a, z];
      return b;
    },
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
    rpc: (name, args) => { rpcCalls.push({ name, args }); return Promise.resolve(rpcResponse); },
  },
}));

import { usePlaylistBrowse, PAGE_SIZE } from "./usePlaylistBrowse.js";
import { SORTS, DEFAULT_SORT, courseSortOptions } from "./filterModel.js";

let seen;
function Probe(props) {
  seen = usePlaylistBrowse(props);
  return null;
}

// Deliberately NOT ascending: if the hook fell back to database-id order the
// difference shows in the very first card.
const RANKED = Array.from({ length: 30 }, (_, i) => 1000 - i * 7);
const BY_ID = [...RANKED].sort((a, b) => a - b);   // what PostgREST returns
const row = (id, over = {}) => ({
  id, title: `Course ${id}`, institutes_channels: null, subjects: null,
  average_rating: 0, ratings_count: 0, class_levels: [],
  playlist_videos: [{ count: 3 }], ...over,
});
const ids = () => seen.items.map((c) => c.id);

beforeEach(() => {
  calls.length = 0;
  rpcCalls.length = 0;
  seen = undefined;
  response = { data: [], error: null, count: 0 };
  rpcResponse = { data: [], error: null };
});

describe("course search relevance order", () => {
  beforeEach(() => {
    rpcResponse = { data: RANKED.map((id) => ({ id })), error: null };
    response = { data: BY_ID.map((id) => row(id)), error: null, count: RANKED.length };
  });

  it("fetches the whole bounded match set instead of an id-ordered page", async () => {
    // The filters run in the DATABASE, so the page can only be cut AFTER they
    // have been applied. The RPC's own 500-id cap is what makes that one
    // bounded request rather than an unbounded fetch.
    render(<Probe search="kinematics" page={0} />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(rpcCalls).toEqual([{ name: "search_playlist_ids", args: { p_query: "kinematics" } }]);
    expect(calls[0].range).toEqual([0, RANKED.length - 1]);
    expect(calls[0].in.id).toEqual(RANKED);
    // The database ordering is untouched; the ranking is applied to the rows.
    expect(calls[0].orders).toEqual([
      "display_order", "popularity_score desc", "title", "id",
    ]);
  });

  it("returns the page in the server's order, not database-id order", async () => {
    render(<Probe search="kinematics" page={0} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(ids()).toEqual(RANKED.slice(0, PAGE_SIZE));
    expect(ids()).not.toEqual(BY_ID.slice(0, PAGE_SIZE));
    expect(seen.total).toBe(RANKED.length);
    expect(seen.hasMore).toBe(true);
  });

  it("continues the ranking on page 2 rather than restarting it", async () => {
    render(<Probe search="kinematics" page={1} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(ids()).toEqual(RANKED.slice(PAGE_SIZE, 2 * PAGE_SIZE));
    expect([...RANKED.slice(0, PAGE_SIZE), ...ids()]).toEqual(RANKED.slice(0, 2 * PAGE_SIZE));
    expect(seen.hasMore).toBe(true);
  });

  it("keeps the count the database computed, not the size of the page", async () => {
    render(<Probe search="kinematics" page={0} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(seen.items).toHaveLength(PAGE_SIZE);
    expect(seen.total).toBe(30);
  });

  it("ranks what the filters left, so a filtered page is still full", async () => {
    // Filters run in the database, so the fetched set is what SURVIVED them.
    // Ranking that set (rather than the raw id list) is what keeps page sizes
    // and totals honest when a filter removes highly ranked matches.
    const survivors = BY_ID.filter((id) => id % 2 === 0);
    response = { data: survivors.map((id) => row(id)), error: null, count: survivors.length };
    render(<Probe search="kinematics" subjectId={2} page={0} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(ids()).toEqual(RANKED.filter((id) => id % 2 === 0).slice(0, PAGE_SIZE));
    expect(seen.total).toBe(survivors.length);
  });

  it("lets an explicitly chosen sort win over relevance", async () => {
    // "Recently added" is a request for recent. It keeps normal paging and the
    // database's ordering, exactly as before.
    render(<Probe search="kinematics" sort="recent" page={1} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(calls[0].orders).toEqual(["created_at desc", "id"]);
    expect(calls[0].range).toEqual([PAGE_SIZE, 2 * PAGE_SIZE - 1]);
    expect(ids()).toEqual(BY_ID);          // the server's rows, unreordered
  });

  it("pages normally with no term, exactly as it did before", async () => {
    render(<Probe page={1} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(rpcCalls).toHaveLength(0);
    expect(calls[0].range).toEqual([PAGE_SIZE, 2 * PAGE_SIZE - 1]);
    expect(ids()).toEqual(BY_ID);
  });

  it("pages normally on the ILIKE fallback, which has no ranking to keep", async () => {
    // No search_playlist_ids means no relevance order exists. Inventing one
    // from an ILIKE would be a fake ranking, so this path stays a database page.
    rpcResponse = {
      data: null,
      error: { code: "PGRST202", message: "Could not find the function public.search_playlist_ids" },
    };
    render(<Probe search="kinematics" page={1} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(calls[0].ilike).toEqual(["title", "%kinematics%"]);
    expect(calls[0].range).toEqual([PAGE_SIZE, 2 * PAGE_SIZE - 1]);
    expect(ids()).toEqual(BY_ID);
    expect(seen.error).toBeNull();
  });

  it("still answers empty when nothing matched, rather than showing everything", async () => {
    rpcResponse = { data: [], error: null };
    render(<Probe search="zzqqxx" page={0} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(calls).toHaveLength(0);
    expect(seen.items).toEqual([]);
    expect(seen.total).toBe(0);
  });

  it("an unknown ?sort= is the default, not an inherited property", async () => {
    // A plain lookup finds Object.prototype.constructor here and treats it as
    // an ordering — which would also make it not-the-default, and silently
    // disable relevance.
    render(<Probe search="kinematics" sort="constructor" page={0} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(calls[0].orders).toEqual([
      "display_order", "popularity_score desc", "title", "id",
    ]);
    expect(ids()).toEqual(RANKED.slice(0, PAGE_SIZE));
  });

  it("lets relevance win over the chapter-depth heuristic", async () => {
    // A chapter page re-sorts by real chapter depth when nothing was typed,
    // because display_order ties there. But a student who typed a query asked a
    // DIFFERENT question, and answering both leaves neither control honest.
    const deep = (id, lectures) => row(id, { pv: Array.from({ length: lectures }, () => ({ videos: {} })) });
    // The LEAST relevant course is the deepest, so the two orders disagree.
    response = {
      data: BY_ID.map((id) => deep(id, RANKED.indexOf(id) + 1)),
      error: null,
      count: RANKED.length,
    };
    render(<Probe search="kinematics" chapterId={9} page={0} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(ids()).toEqual(RANKED.slice(0, PAGE_SIZE));
  });

  it("still re-sorts a chapter page by depth when nothing was typed", async () => {
    const deep = (id, lectures) => row(id, { pv: Array.from({ length: lectures }, () => ({ videos: {} })) });
    response = {
      data: [deep(1, 2), deep(2, 30), deep(3, 9)],
      error: null,
      count: 3,
    };
    render(<Probe chapterId={9} page={0} />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(ids()).toEqual([2, 3, 1]);
  });
});

// The control's word, not a new sort id. See filterModel.js.
describe("the courses sort control says what it is doing", () => {
  it("names the default sort for what it does during a search", () => {
    const searching = courseSortOptions(SORTS, "kinematics");
    expect(searching[0]).toEqual({ id: DEFAULT_SORT, label: "Best match" });
    // No option appears or vanishes, and no id changes — only the word moves,
    // so no ?sort= value exists that goes stale when the term is cleared.
    expect(searching.map((s) => s.id)).toEqual(SORTS.map((s) => s.id));
    expect(searching.slice(1)).toEqual(SORTS.slice(1));
  });

  it("goes back to Recommended when the search box is empty", () => {
    expect(courseSortOptions(SORTS, "")).toBe(SORTS);
    expect(courseSortOptions(SORTS, "   ")).toBe(SORTS);
    expect(courseSortOptions(SORTS, null)).toBe(SORTS);
    expect(courseSortOptions(SORTS, undefined)).toBe(SORTS);
  });

  it("relabels whatever list the availability check left, not SORTS itself", () => {
    // Which sorts EXIST is a data question; what the default is CALLED is a
    // search question. Composing them must not resurrect a hidden sort.
    const available = SORTS.filter((s) => !["rating", "most_viewed"].includes(s.id));
    const labelled = courseSortOptions(available, "kinematics");
    expect(labelled.map((s) => s.id)).toEqual(["recommended", "popular", "recent"]);
    expect(labelled[0].label).toBe("Best match");
  });
});
