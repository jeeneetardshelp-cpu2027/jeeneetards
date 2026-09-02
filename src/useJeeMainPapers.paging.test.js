// How many papers one load of the papers landing actually holds.
//
// fetchJeeMainPapers caps a single request at 100 rows. The landing states
// section counts from what it holds — "98 reviewed papers", "14 official
// answer keys" — so a count taken over the first page is a lower bound
// presented as a fact. Measured on production 2026-09-02: 112 JEE Main papers
// exist, the page held 100, and because the order is exam_year DESC the 12 it
// never fetched were the OLDEST (2014-2015). They were absent from the page
// entirely, not merely from the counts.
//
// These tests count REQUESTS and rows. A test that only checked the rendered
// list would have passed throughout, because the first 100 rows do render.
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ranges, library } = vi.hoisted(() => ({
  ranges: { current: [] },
  library: { rows: [], total: 0, emptyPages: false },
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from() {
      const q = {
        select() { return q; },
        eq() { return q; },
        ilike() { return q; },
        order() { return q; },
        abortSignal() { return q; },
        range(start, end) {
          ranges.current.push([start, end]);
          const data = library.emptyPages && start > 0
            ? []
            : library.rows.slice(start, end + 1);
          q.__result = { data, error: null, count: library.total };
          return q;
        },
        then(resolve, reject) { return Promise.resolve(q.__result).then(resolve, reject); },
      };
      return q;
    },
  },
}));

import { useJeeMainPapers } from "./useJeeMainPapers.js";

const paper = (id) => ({
  id,
  title: `JEE Main ${2026 - Math.floor(id / 10)} Paper ${id}`,
  description: "Official NTA question paper.",
  material_type: "previous_year_paper",
  source_url: `https://nta.example/${id}.pdf`,
  exam_year: 2026 - Math.floor(id / 10),
  paper_kind: "question_paper",
});

beforeEach(() => {
  ranges.current = [];
  library.rows = [];
  library.total = 0;
  library.emptyPages = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("a fresh load holds the whole collection", () => {
  it("pages past the 100-row request cap until it has all 112", async () => {
    library.rows = Array.from({ length: 112 }, (_, i) => paper(i + 1));
    library.total = 112;

    const { result } = renderHook(() => useJeeMainPapers());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toHaveLength(112);
    expect(result.current.total).toBe(112);
    // Nothing left behind a button, so the count on every section card is a
    // count rather than a lower bound.
    expect(result.current.hasMore).toBe(false);
    expect(ranges.current).toEqual([[0, 99], [100, 199]]);
  });

  it("stops at one request when the first page already has everything", async () => {
    library.rows = Array.from({ length: 40 }, (_, i) => paper(i + 1));
    library.total = 40;

    const { result } = renderHook(() => useJeeMainPapers());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toHaveLength(40);
    expect(ranges.current).toHaveLength(1);
  });

  it("keeps the OLDEST papers, which are the ones the cap was dropping", async () => {
    // exam_year DESC ordering means the tail of the collection is the oldest
    // years — exactly what a student looking for a 2014 paper needs.
    library.rows = Array.from({ length: 112 }, (_, i) => paper(i + 1));
    library.total = 112;

    const { result } = renderHook(() => useJeeMainPapers());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const ids = result.current.items.map((item) => item.id);
    expect(ids).toContain(112);
    expect(ids).toContain(101);
  });
});

describe("the loop cannot run away", () => {
  it("stops on an empty page even when the total says there is more", async () => {
    // A stale or wrong count must not spin the hook.
    library.rows = Array.from({ length: 100 }, (_, i) => paper(i + 1));
    library.total = 999;
    library.emptyPages = true;

    const { result } = renderHook(() => useJeeMainPapers());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(ranges.current).toHaveLength(2);
    expect(result.current.items).toHaveLength(100);
  });

  it("never issues more than the page cap", async () => {
    library.rows = Array.from({ length: 5000 }, (_, i) => paper(i + 1));
    library.total = 5000;

    const { result } = renderHook(() => useJeeMainPapers());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(ranges.current.length).toBeLessThanOrEqual(10);
    // And when it does stop short, it says so rather than pretending it is
    // complete — the load-more button is what hasMore drives.
    expect(result.current.hasMore).toBe(true);
  });
});

describe("the explicit load-more button is unchanged", () => {
  it("asks for exactly one more page, not the rest of the library", async () => {
    library.rows = Array.from({ length: 5000 }, (_, i) => paper(i + 1));
    library.total = 5000;

    const { result } = renderHook(() => useJeeMainPapers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = ranges.current.length;

    await result.current.loadMore();
    await waitFor(() => expect(result.current.loadingMore).toBe(false));

    expect(ranges.current.length).toBe(before + 1);
  });
});
