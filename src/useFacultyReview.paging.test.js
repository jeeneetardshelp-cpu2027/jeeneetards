// How much of the catalogue the faculty review context actually reads.
//
// The previous version asked for `.limit(1000)` once. PostgREST caps a request
// at 1000 rows, reports no error and sets no flag, so that reads as
// "everything" and means "the first 1000". With 484 courses in production the
// two are the same; past 1000 they diverge in silence.
//
// It matters more than a wrong count. proposalContext derives `isChannelName`
// as `channelNamed === total` — true only when EVERY course carrying a name
// sits on a channel of that name. Drop some of a teacher's rows and that
// equality can flip from false to TRUE, so a truncated read can tell a reviewer
// that a real person is "very likely the channel itself" and steer them to
// reject a real teacher. That is the case the last test here pins.
//
// These tests count REQUESTS and assert on conclusions. A test that only
// checked the rendered queue would have passed throughout, because the groups
// render either way.
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { catalogue, calls } = vi.hoisted(() => ({
  catalogue: { rows: [], failOnPage: null, unstable: false },
  calls: { ranges: [], ordered: [], limits: [] },
}));

vi.mock("./supabaseClient.js", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: async () => ({ data: GROUPS_FIXTURE, error: null }),
    from() {
      const q = {
        select() { return q; },
        not() { return q; },
        order(column) { calls.ordered.push(column); return q; },
        // Models PostgREST truthfully: it hands back the first n rows and says
        // nothing about the rest. Present so a comparison against the previous
        // implementation fails on its BEHAVIOUR, not on a missing stub.
        limit(n) { calls.limits.push(n); q.__result = { data: catalogue.rows.slice(0, n), error: null }; return q; },
        range(start, end) {
          const page = calls.ranges.length;
          calls.ranges.push([start, end]);
          if (catalogue.failOnPage === page) {
            q.__result = { data: null, error: { message: "boom" } };
            return q;
          }
          // `unstable` models an unordered read: without a stable order the
          // same rows can come back on every page. The hook must order.
          const slice = catalogue.unstable
            ? catalogue.rows.slice(0, end - start + 1)
            : catalogue.rows.slice(start, end + 1);
          q.__result = { data: slice, error: null };
          return q;
        },
        then(resolve, reject) { return Promise.resolve(q.__result).then(resolve, reject); },
      };
      return q;
    },
  },
}));

vi.mock("./useFaculty.js", () => ({ isMissingFacultyCapability: () => false }));

// One proposal for a real person who teaches on two channels. The fixture is
// declared before the mock uses it at call time, not at hoist time.
const GROUPS_FIXTURE = [
  { key: "anu-gupta", kind: "single", variants: [{ raw_teacher: "Anu Gupta" }] },
];

const { useFacultyReview } = await import("./useFacultyReview.js");

const row = (teacher, channel) => ({ teacher, institutes_channels: { name: channel } });

/** n rows of filler, so the interesting rows sit at a chosen offset. */
const filler = (n, from = 0) =>
  Array.from({ length: n }, (_, i) => row(`Filler Teacher ${from + i}`, "Filler Channel"));

beforeEach(() => {
  catalogue.rows = [];
  catalogue.failOnPage = null;
  catalogue.unstable = false;
  calls.ranges = [];
  calls.ordered = [];
  calls.limits = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const contextOf = (result) => result.current.groups[0]?.context;

describe("reading the catalogue", () => {
  it("asks once when the whole catalogue fits in one page", async () => {
    catalogue.rows = filler(484);
    const { result } = renderHook(() => useFacultyReview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // 484 courses today: one request, exactly as before. No regression in the
    // common case is the point of the short-page exit.
    expect(calls.ranges).toEqual([[0, 999]]);
  });

  it("keeps paging past 1000 until a short page ends it", async () => {
    catalogue.rows = filler(2400);
    const { result } = renderHook(() => useFacultyReview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls.ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("asks for a stable order, or paging would repeat and skip rows", async () => {
    catalogue.rows = filler(1200);
    const { result } = renderHook(() => useFacultyReview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls.ordered).toContain("id");
  });

  it("stops rather than looping when a page comes back full forever", async () => {
    // An unordered read can return the same full page indefinitely. The loop
    // must terminate, and must not present what it collected.
    catalogue.rows = filler(1000);
    catalogue.unstable = true;
    const { result } = renderHook(() => useFacultyReview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls.ranges.length).toBe(20);
    expect(contextOf(result).total).toBe(0);
  });
});

describe("an incomplete read yields no context, not partial context", () => {
  it("discards everything when a later page fails", async () => {
    catalogue.rows = [
      ...filler(1000),
      ...Array.from({ length: 3 }, () => row("Anu Gupta", "Physics Wallah")),
    ];
    catalogue.failOnPage = 1;
    const { result } = renderHook(() => useFacultyReview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // The first 1000 rows arrived and are thrown away on purpose.
    expect(calls.ranges.length).toBe(2);
    expect(contextOf(result).total).toBe(0);
    expect(contextOf(result).channels).toEqual([]);
  });

  it("still renders the queue when the context cannot be read", async () => {
    catalogue.failOnPage = 0;
    const { result } = renderHook(() => useFacultyReview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Best effort: losing an annotation must not cost the admin the queue.
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.error).toBeNull();
    expect(result.current.unavailable).toBe(false);
  });
});

describe("the conclusion truncation would have got wrong", () => {
  it("does not call a real person a channel when her courses span two pages", async () => {
    // Anu Gupta teaches 10 courses. Three sit on a channel named after her,
    // and they are the ones in the first 1000 rows; the seven that prove she
    // is a person sit past the cap.
    catalogue.rows = [
      ...Array.from({ length: 3 }, () => row("Anu Gupta", "Anu Gupta")),
      ...filler(997),
      ...Array.from({ length: 7 }, () => row("Anu Gupta", "Physics Wallah")),
    ];
    const { result } = renderHook(() => useFacultyReview());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const context = contextOf(result);
    expect(context.total).toBe(10);
    expect(context.channelNamed).toBe(3);
    // The whole point. Truncated at 1000 this reads total 3, channelNamed 3,
    // so channelNamed === total and the panel tells the reviewer she is
    // "very likely the channel itself" — about a real teacher.
    expect(context.isChannelName).toBe(false);
    expect(context.channels.map((c) => c.name)).toEqual(["Physics Wallah", "Anu Gupta"]);
  });

  it("still identifies an organisation whose every course is self-named", async () => {
    // The safeguard has to keep working, not just stop misfiring.
    catalogue.rows = [
      ...filler(1200),
      ...Array.from({ length: 10 }, () => row("Anu Gupta", "Anu Gupta")),
    ];
    const { result } = renderHook(() => useFacultyReview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const context = contextOf(result);
    expect(context.total).toBe(10);
    expect(context.isChannelName).toBe(true);
  });
});
