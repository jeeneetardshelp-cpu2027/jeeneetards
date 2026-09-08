// What one cold /browse load spends before a student sees a course.
//
// Measured against production on 2026-09-02, after the duplicate dimension
// fetches were fixed: 16 Supabase requests in three dependent waves, with
// get_faculty_facets and get_browse_curriculum each issued twice.
//
//   wave 1  get_faculty_facets, learning_goals x2, subjects x2, playlists x3,
//           class_levels, institutes_channels
//   wave 2  get_faculty_facets, chapters, playlists, get_browse_curriculum
//   wave 3  browse_facet_counts, get_browse_curriculum
//
// Three causes, all fixed here:
//
//   * get_faculty_facets ran once with every id null — while
//     useCanonicalFilters was still turning the URL's slugs into ids — and
//     again when they arrived. The hook already took an `enabled` flag; the
//     call site passed none.
//   * useGoalCatalog awaited its subject call before starting its chapter
//     call, though the second's arguments come from a prop and never depended
//     on the first's answer. That serialisation was a whole wave.
//   * useCanonicalFilters itself spent all three waves on its own: goal and
//     subject, then the chapter narrowed by the subject ID it had just
//     learned, then that chapter's class levels. Nothing downstream could
//     start until all three had landed, and 204 of the 205 /browse URLs in
//     public/sitemap.xml carry a chapter=. Measured against production on
//     7 Sep 2026 for the real arrival shape
//     /browse?goal=jee&class=11&subject=physics&chapter=kinematics:
//     3 waves / 4 requests / 2816 ms before, 1 wave / 3 requests / 832 ms after.
//
// These tests count REQUESTS and their ORDER. Asserting on rendered output
// would have passed throughout: the page always did eventually show the right
// courses, it just asked twice and waited longer than it needed to.
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcCalls, fromCalls, inFlight } = vi.hoisted(() => ({
  rpcCalls: { current: [] },
  fromCalls: { current: [] },
  inFlight: { current: { now: 0, peak: 0 } },
}));

// One shared latency, so "were these two open at the same moment?" is a fair
// question to ask of any pair of requests in this file.
const LATENCY = 12;

const settle = (value) => {
  inFlight.current.now += 1;
  inFlight.current.peak = Math.max(inFlight.current.peak, inFlight.current.now);
  return new Promise((resolve) => {
    setTimeout(() => {
      inFlight.current.now -= 1;
      resolve(value);
    }, LATENCY);
  });
};

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc(name, args) {
      rpcCalls.current.push({ name, args });
      return settle({
        data: [{ level: "subject", entity_id: 1, slug: "physics", name: "Physics", course_count: 3 }],
        error: null,
      });
    },
    from(table) {
      const rec = { table, cols: null, eq: {}, limit: null };
      fromCalls.current.push(rec);
      const rows = {
        learning_goals: [{ id: 1, slug: "jee", name: "JEE" }],
        subjects: [{ id: 2, slug: "physics", name: "Physics" }],
        chapters: [{
          id: 42, slug: "kinematics", name: "Kinematics",
          subjects: { slug: "physics" },
          chapter_class_levels: [{ class_levels: { slug: "class-11" } }],
        }],
      }[table] ?? [];
      const q = {
        select(cols) { rec.cols = cols; return q; },
        eq(k, v) { rec.eq[k] = v; return q; },
        gt() { return q; }, gte() { return q; },
        limit(n) { rec.limit = n; return q; },
        maybeSingle() { return settle({ data: rows[0] ?? null, error: null }); },
        order() { return settle({ data: [], error: null, count: 0 }); },
        then(res, rej) { return settle({ data: rows, error: null, count: rows.length }).then(res, rej); },
      };
      return q;
    },
  },
}));

import { useGoalCatalog } from "./useExplore.js";
import { useFacultyFacets } from "./useFaculty.js";
import { useCanonicalFilters } from "./useCanonicalFilters.js";

beforeEach(() => {
  rpcCalls.current = [];
  fromCalls.current = [];
  inFlight.current = { now: 0, peak: 0 };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const curriculumCalls = () => rpcCalls.current.filter((c) => c.name === "get_browse_curriculum");
const tableCalls = (table) => fromCalls.current.filter((c) => c.table === table);

// The arrival shape Google hands students: 204 of 205 sitemap /browse URLs.
const ARRIVAL = new URLSearchParams("goal=jee&class=11&subject=physics&chapter=kinematics");

describe("useCanonicalFilters resolves the whole URL in ONE wave", () => {
  it("asks for the chapter in the same wave as the subject, not after it", async () => {
    const { result } = renderHook(() => useCanonicalFilters(ARRIVAL));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(tableCalls("learning_goals")).toHaveLength(1);
    expect(tableCalls("subjects")).toHaveLength(1);
    expect(tableCalls("chapters")).toHaveLength(1);
    // The proof of concurrency, and the whole point of the change: all three
    // were open at the same moment. Serialised behind the subject lookup — the
    // old shape — the peak could never exceed 2.
    expect(inFlight.current.peak).toBeGreaterThanOrEqual(3);
  });

  it("spends ONE wave in total, not three — no follow-up scope request", async () => {
    const { result } = renderHook(() => useCanonicalFilters(ARRIVAL));
    await waitFor(() => expect(result.current.ready).toBe(true));

    // Wave 3 collapsed into the chapter row: the junction is embedded, so it
    // is never asked for on its own.
    expect(tableCalls("chapter_class_levels")).toHaveLength(0);
    expect(fromCalls.current).toHaveLength(3);
    expect(result.current.chapterClassSlugs).toEqual(["class-11"]);
  });

  it("carries the same answers the three waves used to produce", async () => {
    const { result } = renderHook(() => useCanonicalFilters(ARRIVAL));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.goalId).toBe(1);
    expect(result.current.subjectId).toBe(2);
    expect(result.current.chapterId).toBe(42);
    expect(result.current.stage).toBe("class-11");
    expect(result.current.names.chapter).toEqual({ kinematics: "Kinematics" });
    expect(result.current.unresolved).toEqual([]);
  });

  it("disambiguates on the subject SLUG, which the URL already has", async () => {
    const { result } = renderHook(() => useCanonicalFilters(ARRIVAL));
    await waitFor(() => expect(result.current.ready).toBe(true));

    const chapters = tableCalls("chapters")[0];
    // The subject ID is what made this a second wave. It is gone.
    expect(chapters.eq).toEqual({ slug: "kinematics", "subjects.slug": "physics" });
    expect(chapters.eq.subject_id).toBeUndefined();
    expect(chapters.cols).toContain("subjects!inner(slug)");
  });
});

describe("useGoalCatalog asks its two questions at once", () => {
  it("issues both curriculum calls concurrently, not one after the other", async () => {
    const { result } = renderHook(() =>
      useGoalCatalog({ goal: "jee", stage: "class-11", subject: "physics", enabled: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(curriculumCalls()).toHaveLength(2);
    // The proof of concurrency: both were open at the same moment. Serialised,
    // the peak would be 1.
    expect(inFlight.current.peak).toBeGreaterThanOrEqual(2);
  });

  it("still asks for the subject list and the chosen subject's chapters", async () => {
    const { result } = renderHook(() =>
      useGoalCatalog({ goal: "jee", stage: "class-11", subject: "physics", enabled: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const subjects = curriculumCalls().map((c) => c.args.p_subject);
    expect(subjects).toContain(null);
    expect(subjects).toContain("physics");
  });

  it("asks only once when no subject is chosen", async () => {
    const { result } = renderHook(() =>
      useGoalCatalog({ goal: "jee", stage: "class-11", subject: null, enabled: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(curriculumCalls()).toHaveLength(1);
    expect(curriculumCalls()[0].args.p_subject).toBeNull();
  });
});

describe("faculty facets wait for the ids they filter on", () => {
  it("asks nothing while the slugs are still resolving", async () => {
    renderHook(() => useFacultyFacets({ goalId: null, subjectId: null, chapterId: null, enabled: false }));
    await new Promise((r) => setTimeout(r, 30));

    expect(rpcCalls.current.filter((c) => c.name === "get_faculty_facets")).toHaveLength(0);
  });

  it("stays in loading while disabled, so the filter reads as not-yet-known", async () => {
    // Not "unavailable": that would hide the teacher filter outright, which is
    // a different and wrong claim while the answer is simply not in yet.
    const { result } = renderHook(() => useFacultyFacets({ enabled: false }));
    await new Promise((r) => setTimeout(r, 30));

    expect(result.current.loading).toBe(true);
    expect(result.current.unavailable).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("asks exactly once when the ids arrive", async () => {
    const { rerender } = renderHook(
      ({ scope }) => useFacultyFacets(scope),
      { initialProps: { scope: { goalId: null, subjectId: null, chapterId: null, enabled: false } } },
    );
    rerender({ scope: { goalId: 1, subjectId: 2, chapterId: null, enabled: true } });
    await waitFor(() =>
      expect(rpcCalls.current.filter((c) => c.name === "get_faculty_facets")).toHaveLength(1));

    const call = rpcCalls.current.find((c) => c.name === "get_faculty_facets");
    expect(call.args).toMatchObject({ p_goal_id: 1, p_subject_id: 2 });
  });
});
