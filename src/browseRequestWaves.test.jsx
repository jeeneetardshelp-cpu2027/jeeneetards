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
// Two causes, both fixed here:
//
//   * get_faculty_facets ran once with every id null — while
//     useCanonicalFilters was still turning the URL's slugs into ids — and
//     again when they arrived. The hook already took an `enabled` flag; the
//     call site passed none.
//   * useGoalCatalog awaited its subject call before starting its chapter
//     call, though the second's arguments come from a prop and never depended
//     on the first's answer. That serialisation was a whole wave.
//
// These tests count REQUESTS and their ORDER. Asserting on rendered output
// would have passed throughout: the page always did eventually show the right
// courses, it just asked twice and waited longer than it needed to.
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcCalls, inFlight } = vi.hoisted(() => ({
  rpcCalls: { current: [] },
  inFlight: { current: { now: 0, peak: 0 } },
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc(name, args) {
      rpcCalls.current.push({ name, args });
      inFlight.current.now += 1;
      inFlight.current.peak = Math.max(inFlight.current.peak, inFlight.current.now);
      return new Promise((resolve) => {
        setTimeout(() => {
          inFlight.current.now -= 1;
          resolve({ data: [{ level: "subject", entity_id: 1, slug: "physics", name: "Physics", course_count: 3 }], error: null });
        }, 12);
      });
    },
    from() {
      const q = {
        select() { return q; }, eq() { return q; }, gt() { return q; }, gte() { return q; },
        order() { return Promise.resolve({ data: [], error: null, count: 0 }); },
        then(res, rej) { return Promise.resolve({ data: [], error: null, count: 0 }).then(res, rej); },
      };
      return q;
    },
  },
}));

import { useGoalCatalog } from "./useExplore.js";
import { useFacultyFacets } from "./useFaculty.js";

beforeEach(() => {
  rpcCalls.current = [];
  inFlight.current = { now: 0, peak: 0 };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const curriculumCalls = () => rpcCalls.current.filter((c) => c.name === "get_browse_curriculum");

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
