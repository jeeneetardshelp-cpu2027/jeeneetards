// Finding a lecture the admin course builder could not previously find.
//
// The form used to filter a preloaded array. That array came from one
// unbounded `.select()` on `videos`, which PostgREST silently caps at 1000
// rows; production holds 5471, ordered id DESC, so the 4471 it never fetched
// were the OLDEST. Searching for one of those said "No videos match" — the
// same words the form shows when a lecture genuinely does not exist.
//
// These tests assert on the REQUEST as much as the result, because the bug was
// never visible in what rendered: the newest 1000 rendered fine throughout.
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Model ILIKE for real, escapes included, so a test cannot pass by pretending
// the pattern matched literally. Walks the pattern: a backslash makes the next
// character literal, % is any run, _ is any one character.
function likeMatches(pattern, value) {
  let rx = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "\\") {
      i += 1;
      rx += pattern[i] === undefined ? "" : pattern[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (ch === "%") rx += ".*";
    else if (ch === "_") rx += ".";
    else rx += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + rx + "$", "i").test(value);
}

const { db, calls } = vi.hoisted(() => ({
  db: { rows: [], error: null },
  calls: { ilike: [], limits: [], orders: [] },
}));

vi.mock("./supabaseClient.js", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from() {
      const q = {
        __pattern: null,
        select() { return q; },
        order(column, opts) { calls.orders.push([column, opts?.ascending]); return q; },
        limit(n) { calls.limits.push(n); return q; },
        ilike(column, pattern) { calls.ilike.push([column, pattern]); q.__pattern = pattern; return q; },
        then(resolve, reject) {
          if (db.error) return Promise.resolve({ data: null, error: db.error }).then(resolve, reject);
          let rows = db.rows;
          if (q.__pattern !== null) rows = db.rows.filter((r) => likeMatches(q.__pattern, r.title));
          return Promise.resolve({ data: rows.slice(0, 25), error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  },
}));

const { useVideoSearch, escapeLikePattern, VIDEO_SEARCH_LIMIT } =
  await import("./useVideoSearch.js");

const video = (id, title) => ({ id, title, youtube_video_id: `yt${id}`, chapter_id: null });

beforeEach(() => {
  db.rows = [];
  db.error = null;
  calls.ilike = [];
  calls.limits = [];
  calls.orders = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("escaping what the admin typed", () => {
  it.each([
    ["100%", "100\\%"],
    ["a_b", "a\\_b"],
    ["back\\slash", "back\\\\slash"],
    ["plain title", "plain title"],
  ])("turns %s into %s", (input, expected) => {
    expect(escapeLikePattern(input)).toBe(expected);
  });

  it("does not let a typed % match everything", async () => {
    db.rows = [video(1, "Kinematics 100% Revision"), video(2, "Thermodynamics")];
    const { result } = renderHook(() => useVideoSearch("100%"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Unescaped, "%100%%" would have matched Thermodynamics too.
    expect(result.current.results.map((r) => r.title)).toEqual(["Kinematics 100% Revision"]);
  });
});

describe("asking the database instead of a preloaded array", () => {
  it("finds a lecture that sits far outside the first 1000 rows", async () => {
    // The row is at index 5000 of 5471. Under the old code it was not in
    // memory at all, and the form said "No videos match".
    db.rows = [
      ...Array.from({ length: 5000 }, (_, i) => video(9000 - i, `Filler ${i}`)),
      video(12, "Rotational Motion — 2019 archive"),
    ];
    const { result } = renderHook(() => useVideoSearch("Rotational"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results.map((r) => r.id)).toEqual([12]);
  });

  it("asks for only what the picker shows", async () => {
    db.rows = [video(1, "Kinematics")];
    const { result } = renderHook(() => useVideoSearch("kin"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(calls.limits).toContain(VIDEO_SEARCH_LIMIT);
    expect(VIDEO_SEARCH_LIMIT).toBe(25);
  });

  it("lists the newest lectures before anything is typed", async () => {
    db.rows = [video(3, "Newest"), video(2, "Middle"), video(1, "Oldest")];
    const { result } = renderHook(() => useVideoSearch(""));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // No filter at all, so opening the form is not a blank list.
    expect(calls.ilike).toEqual([]);
    expect(calls.orders).toContainEqual(["id", false]);
    expect(result.current.results).toHaveLength(3);
  });

  it("reports a failure instead of showing an empty list", async () => {
    db.error = { message: "boom" };
    const { result } = renderHook(() => useVideoSearch("kin"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    // "No videos match" for a failed request is the exact confusion this
    // whole change exists to remove.
    expect(result.current.error).toBe("Couldn't search lectures.");
    expect(result.current.results).toEqual([]);
  });
});

describe("a search box that keeps up with typing", () => {
  it("issues one request for a settled query, not one per keystroke", async () => {
    db.rows = [video(1, "Kinematics")];
    const { rerender, result } = renderHook(({ q }) => useVideoSearch(q), {
      initialProps: { q: "k" },
    });
    rerender({ q: "ki" });
    rerender({ q: "kin" });
    rerender({ q: "kinematics" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    // The empty-query listing is not debounced and does not run here, so every
    // recorded ilike is a settled search.
    expect(calls.ilike).toEqual([["title", "%kinematics%"]]);
  });
});
