// useFilterOptions: how many requests one /browse load actually costs.
//
// The four dimension lookups (goals, classes, subjects, institutes) do not
// depend on the subject, but they used to share one effect with the chapter
// query, keyed on [subjectId, nonce]. BrowsePage passes canonical.subjectId,
// which is null until the URL's subject SLUG has been resolved to an id by a
// round trip of its own — so every cold load fetched those four tables twice:
// once against null, then again when the id arrived. Measured on production on
// 2026-09-02: /browse issued 20-21 Supabase queries plus 14 CORS preflights in
// three dependent waves before the first course card, five of them exact
// duplicates.
//
// These tests count REQUESTS, not rendered output. A test that only asserted
// the options are right would have stayed green through the whole defect.
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queries, failing } = vi.hoisted(() => ({
  queries: { current: [] },
  failing: { current: null },
}));

const ROWS = {
  learning_goals: [{ id: 1, slug: "jee", name: "JEE" }],
  class_levels: [{ id: 1, slug: "class-11", name: "Class 11" }],
  subjects: [{ id: 2, slug: "physics", name: "Physics" }],
  institutes_channels: [{ id: 3, name: "Allen", logo_url: null }],
  chapters: [{ id: 9, slug: "kinematics", name: "Kinematics", subject_id: 2 }],
};

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from(table) {
      const rec = { table, eq: {} };
      queries.current.push(rec);
      const result = failing.current === table
        ? { data: null, error: { message: "boom" } }
        : { data: ROWS[table] ?? [], error: null };
      const b = {
        select() { return b; },
        eq(k, v) { rec.eq[k] = v; return b; },
        order() { return Promise.resolve(result); },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
      };
      return b;
    },
  },
}));

import { useFilterOptions } from "./useFilterOptions.js";

const countOf = (table) => queries.current.filter((q) => q.table === table).length;

beforeEach(() => {
  queries.current = [];
  failing.current = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("useFilterOptions request cost", () => {
  it("fetches the subject-independent lookups ONCE when the subject id arrives late", async () => {
    const { result, rerender } = renderHook(
      ({ subjectId }) => useFilterOptions({ subjectId }),
      { initialProps: { subjectId: null } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    // The slug has now resolved to an id — the state BrowsePage reaches on
    // every /browse?subject=… load.
    rerender({ subjectId: 2 });
    await waitFor(() => expect(result.current.options.chapter?.length).toBe(1));

    for (const table of ["learning_goals", "class_levels", "subjects", "institutes_channels"]) {
      expect(countOf(table), `${table} was fetched more than once`).toBe(1);
    }
    // The chapter list is the one thing that legitimately depends on it.
    expect(countOf("chapters")).toBe(1);
  });

  it("does not ask for chapters at all until a subject is chosen", async () => {
    const { result } = renderHook(() => useFilterOptions({ subjectId: null }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(countOf("chapters")).toBe(0);
    expect(result.current.options.chapter).toEqual([]);
  });

  it("re-fetches chapters, and only chapters, when the subject changes", async () => {
    const { result, rerender } = renderHook(
      ({ subjectId }) => useFilterOptions({ subjectId }),
      { initialProps: { subjectId: 2 } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    queries.current = [];

    rerender({ subjectId: 5 });
    await waitFor(() => expect(countOf("chapters")).toBe(1));

    expect(countOf("learning_goals")).toBe(0);
    expect(countOf("subjects")).toBe(0);
    expect(queries.current.at(-1).eq).toEqual({ subject_id: 5 });
  });

  it("retry re-fetches everything, so a failed panel can recover", async () => {
    const { result } = renderHook(() => useFilterOptions({ subjectId: 2 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    queries.current = [];

    result.current.retry();
    await waitFor(() => expect(countOf("learning_goals")).toBe(1));
    expect(countOf("chapters")).toBe(1);
  });
});

describe("useFilterOptions honesty", () => {
  it("reports a failed lookup instead of presenting an empty panel", async () => {
    // "No options" and "we could not find out" are different answers, and only
    // one of them is true. An empty panel would tell a student their subject
    // has no chapters.
    failing.current = "subjects";
    const { result } = renderHook(() => useFilterOptions({ subjectId: 2 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.options).toEqual({});
  });

  it("reports a failed CHAPTER lookup too, rather than an empty chapter list", async () => {
    failing.current = "chapters";
    const { result } = renderHook(() => useFilterOptions({ subjectId: 2 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeTruthy();
    expect(result.current.options).toEqual({});
  });

  it("still returns every option list it did load", async () => {
    const { result } = renderHook(() => useFilterOptions({ subjectId: 2 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(Object.keys(result.current.options).sort())
      .toEqual(["channel", "chapter", "class", "goal", "subject"]);
    // class_levels.slug "class-11" is emitted as the URL's short "11".
    expect(result.current.options.class[0].value).toBe("11");
  });
});
