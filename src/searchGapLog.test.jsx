// searchGapLog.test.jsx — what reaches the server when a search finds nothing.
//
// The RPC is mocked, but the mock RECORDS its arguments, because every claim
// this feature makes is a claim about the REQUEST: that a settled zero-result
// search produces exactly one row, that a superseded one produces none, and
// that nothing identifying is attached.
//
// Module-level dedupe state (sentAt in searchGapLog.js) outlives any one test,
// so — like progressSync.test.js with its videoDbId counter — every test uses
// its own query string. Reusing one would leak a dedupe hit between tests.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

let RPC_ROWS = [];
let RPC_ERROR = null;
// "ok" | "error" (supabase-js resolves with an error object) | "reject".
let GAP_RESULT = "ok";
const rpcCalls = [];

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (fn, args) => {
      rpcCalls.push({ fn, args });
      if (fn === "log_search_gap") {
        if (GAP_RESULT === "reject") return Promise.reject(new Error("offline"));
        if (GAP_RESULT === "error") {
          return Promise.resolve({
            data: null,
            error: { code: "PGRST202", message: "function public.log_search_gap does not exist" },
          });
        }
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: RPC_ERROR ? null : RPC_ROWS, error: RPC_ERROR });
    },
    from: () => {
      const builder = { select: () => builder, in: () => Promise.resolve({ data: [], error: null }) };
      return builder;
    },
  },
}));

const { useUniversalSearch, DEBOUNCE_MS } = await import("./useUniversalSearch.js");
const { logSearchGap, GAP_LOG_DELAY_MS, GAP_LOG_MAX_LENGTH } =
  await import("./searchGapLog.js");

const row = (over = {}) => ({
  group_key: "chapter", entity_id: 1, title: "Kinematics", subtitle: "Physics",
  aka: null, slug: "kinematics", match_type: "exact", match_rank: 1,
  matched_on: "Kinematics", is_ambiguous: false, group_total: 1, extra: {}, ...over,
});

const gapCalls = () => rpcCalls.filter((c) => c.fn === "log_search_gap");
const searchCalls = () => rpcCalls.filter((c) => c.fn === "universal_search");

/** Let the request debounce elapse and the mocked promise chain settle. */
async function settle() {
  await act(async () => { vi.advanceTimersByTime(DEBOUNCE_MS + 20); });
  for (let i = 0; i < 5; i += 1) await act(async () => {});
}

/** Then let the "the student stopped typing" window elapse. */
async function waitOutGapDelay() {
  await act(async () => { vi.advanceTimersByTime(GAP_LOG_DELAY_MS + 50); });
  for (let i = 0; i < 3; i += 1) await act(async () => {});
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  RPC_ROWS = []; RPC_ERROR = null; GAP_RESULT = "ok"; rpcCalls.length = 0;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("logging searches that found nothing", () => {
  it("logs a settled zero-result search once, and only after the student stops", async () => {
    RPC_ROWS = [];
    renderHook(() => useUniversalSearch("liquid solutions numericals"));

    await settle();
    expect(searchCalls()).toHaveLength(1);
    // Not yet: the query has to stand still first, or every prefix of a
    // slowly typed word becomes its own row.
    expect(gapCalls()).toHaveLength(0);

    await waitOutGapDelay();
    expect(gapCalls()).toHaveLength(1);
    expect(gapCalls()[0].args).toEqual({
      p_query: "liquid solutions numericals",
      p_result_count: 0,
    });
  });

  it("sends the query and a count, and nothing that identifies anyone", async () => {
    RPC_ROWS = [];
    renderHook(() => useUniversalSearch("ray optics revision sheet"));
    await settle();
    await waitOutGapDelay();

    expect(gapCalls()).toHaveLength(1);
    // The whole payload, asserted exhaustively on purpose: a future change
    // that starts attaching a user id has to break this line to do it.
    expect(Object.keys(gapCalls()[0].args).sort()).toEqual(["p_query", "p_result_count"]);
  });

  it("does not log a search that found something", async () => {
    RPC_ROWS = [row()];
    renderHook(() => useUniversalSearch("kinematics"));
    await settle();
    await waitOutGapDelay();

    expect(searchCalls()).toHaveLength(1);
    expect(gapCalls()).toHaveLength(0);
  });

  it("does not log a query too short to be a search", async () => {
    renderHook(() => useUniversalSearch("k"));
    await settle();
    await waitOutGapDelay();

    expect(searchCalls()).toHaveLength(0);   // never asked the server either
    expect(gapCalls()).toHaveLength(0);
    // And the module refuses it directly, matching the floor inside the RPC.
    expect(logSearchGap("k")).toBe(false);
    expect(logSearchGap("   ")).toBe(false);
    expect(logSearchGap("")).toBe(false);
  });

  it("does not log the prefixes of a query the student kept typing", async () => {
    RPC_ROWS = [];
    const { rerender } = renderHook(({ q }) => useUniversalSearch(q), {
      initialProps: { q: "electroche" },
    });
    await settle();                       // "electroche" settles with nothing
    await act(async () => { vi.advanceTimersByTime(300); });  // still typing

    rerender({ q: "electrochemis" });
    await settle();
    await act(async () => { vi.advanceTimersByTime(300); });

    rerender({ q: "electrochemistry zzq" });
    await settle();
    await waitOutGapDelay();

    // Three settled zero-result searches, one row: the two abandoned prefixes
    // were cancelled by the effect cleanup before their timers fired.
    expect(searchCalls()).toHaveLength(3);
    expect(gapCalls().map((c) => c.args.p_query)).toEqual(["electrochemistry zzq"]);
  });

  it("does not log a stale response that lost its race", async () => {
    RPC_ROWS = [];
    const { rerender } = renderHook(({ q }) => useUniversalSearch(q), {
      initialProps: { q: "superseded probe one" },
    });
    // Supersede BEFORE the debounce fires: the first request never leaves.
    rerender({ q: "superseded probe two" });
    await settle();
    await waitOutGapDelay();

    expect(searchCalls().map((c) => c.args.p_query)).toEqual(["superseded probe two"]);
    expect(gapCalls().map((c) => c.args.p_query)).toEqual(["superseded probe two"]);
  });

  it("does not log the same query twice", async () => {
    RPC_ROWS = [];
    const first = renderHook(() => useUniversalSearch("repeated gap probe"));
    await settle();
    await waitOutGapDelay();
    expect(gapCalls()).toHaveLength(1);
    first.unmount();

    // A remount, a back-navigation or a reload of the same /browse URL.
    renderHook(() => useUniversalSearch("repeated gap probe"));
    await settle();
    await waitOutGapDelay();
    expect(gapCalls()).toHaveLength(1);
  });

  it("does not log a search the student narrowed with a group filter", async () => {
    RPC_ROWS = [];
    renderHook(() => useUniversalSearch("filtered gap probe", { type: "faculty" }));
    await settle();
    await waitOutGapDelay();

    expect(searchCalls()).toHaveLength(1);
    expect(gapCalls()).toHaveLength(0);
  });

  it("does not log an exhausted Show more page", async () => {
    RPC_ROWS = [row()];
    const { result } = renderHook(() => useUniversalSearch("paged gap probe"));
    await settle();
    expect(gapCalls()).toHaveLength(0);

    RPC_ROWS = [];                                  // page 1 comes back empty
    await act(async () => { result.current.setPage(1); });
    await settle();
    await waitOutGapDelay();

    expect(searchCalls()).toHaveLength(2);
    expect(gapCalls()).toHaveLength(0);
  });

  it("does not log a search that failed", async () => {
    RPC_ERROR = { message: "boom" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderHook(() => useUniversalSearch("errored gap probe"));
    await settle();
    await waitOutGapDelay();

    expect(gapCalls()).toHaveLength(0);   // a broken search is not an empty library
    spy.mockRestore();
  });

  it("swallows a rejected log without noise or an unhandled rejection", async () => {
    GAP_RESULT = "reject";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    RPC_ROWS = [];

    renderHook(() => useUniversalSearch("rejected gap probe"));
    await settle();
    await waitOutGapDelay();
    await act(async () => {});

    expect(gapCalls()).toHaveLength(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("stays quiet while the migration is unapplied", async () => {
    // supabase-js RESOLVES with an error object for a missing function, so
    // this is the shape production sees today.
    GAP_RESULT = "error";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    RPC_ROWS = [];

    const { result } = renderHook(() => useUniversalSearch("unapplied gap probe"));
    await settle();
    await waitOutGapDelay();

    expect(gapCalls()).toHaveLength(1);
    expect(spy).not.toHaveBeenCalled();
    // The search itself is untouched: still an empty, non-erroring result.
    expect(result.current.error).toBeNull();
    expect(result.current.groups).toEqual({});
    spy.mockRestore();
  });

  it("truncates a pasted essay instead of sending it whole", () => {
    const long = `pasted probe ${"x".repeat(400)}`;
    expect(logSearchGap(long)).toBe(true);
    const sent = gapCalls().at(-1).args.p_query;
    expect(sent).toHaveLength(GAP_LOG_MAX_LENGTH);
    expect(sent.startsWith("pasted probe ")).toBe(true);
  });

  it("never sends a count it cannot vouch for", () => {
    expect(logSearchGap("count shape probe", Number.NaN)).toBe(true);
    expect(gapCalls().at(-1).args.p_result_count).toBe(0);
    expect(logSearchGap("count shape probe two", -3)).toBe(true);
    expect(gapCalls().at(-1).args.p_result_count).toBe(0);
  });
});
