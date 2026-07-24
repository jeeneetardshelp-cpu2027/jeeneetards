// Comparison tests.
//
// Comparison is CHAPTER-SCOPED, so most of these are validation tests: the
// interesting failures are a stale id, a cross-chapter id, and the interaction
// between them (a bad id must never soften the "at least two" rule).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

let EXISTING = [];             // rows in `playlists`
let CHAPTER_OF = {};           // playlist id -> [chapter ids it teaches]
let FAIL = false;
let LAST_RPC_ARGS = null;

vi.mock("./supabaseClient", () => {
  const rpc = vi.fn((_name, args) => {
    LAST_RPC_ARGS = args;
    if (FAIL) return Promise.resolve({ data: null, error: { message: "boom" } });
    const rows = args.p_playlist_ids.map((id, index) => {
      const found = EXISTING.find((row) => row.playlist_id === id);
      if (!found) return {
        requested_order: index + 1, playlist_id: id, course_status: "not-found", title: null,
      };
      return {
        ...found,
        requested_order: index + 1,
        course_status: (CHAPTER_OF[id] ?? []).includes(Number(args.p_chapter_id))
          ? "ok" : "wrong-chapter",
      };
    });
    return Promise.resolve({ data: rows, error: null });
  });
  return { isSupabaseConfigured: true, supabase: { rpc } };
});

const { default: Compare, parseCompareIds, bestFor, visibleAttributes, ATTRIBUTES } =
  await import("./Compare.jsx");

const course = (id, over = {}) => ({
  playlist_id: id, title: `Course ${id}`, teacher: null, average_rating: 0, ratings_count: 0,
  language: null, content_type: null, difficulty: null, class_levels: null,
  last_verified_at: null, channel_title: null, subject_title: null,
  chapter_lecture_count: 10, chapter_duration_seconds: null,
  syllabus_coverage_pct: null, coverage_mapped_topics: null,
  coverage_required_topics: null, best_for: null, ...over,
});

function Probe() { const l = useLocation(); return <div data-testid="loc">{l.pathname + l.search}</div>; }

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
      <Routes>
        <Route path="/compare" element={<Compare />} />
        <Route path="*" element={<div data-testid="landed" />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => { EXISTING = []; CHAPTER_OF = {}; FAIL = false; LAST_RPC_ARGS = null; });

// ---------------------------------------------------------------- parsing
describe("selection parsing", () => {
  it("keeps at most four and reports the overflow", () => {
    expect(parseCompareIds("1,2,3,4,5,6")).toEqual({ ids: [1, 2, 3, 4], overflow: true });
    expect(parseCompareIds("1,2")).toEqual({ ids: [1, 2], overflow: false });
  });

  it("drops duplicates and junk", () => {
    expect(parseCompareIds("7,7,abc,-1,0,2.5,8").ids).toEqual([7, 8]);
    expect(parseCompareIds("").ids).toEqual([]);
    expect(parseCompareIds(null).ids).toEqual([]);
  });
});

// ---------------------------------------------------------------- chapter
describe("chapter context is required", () => {
  it("refuses a comparison with no chapter at all", async () => {
    EXISTING = [course(1), course(2)];
    renderAt("/compare?ids=1,2");
    expect(await screen.findByText(/Comparison needs a chapter/i)).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();
  });

  it("compares courses that all teach the chapter", async () => {
    EXISTING = [course(1), course(2)];
    CHAPTER_OF = { 1: [77], 2: [77] };
    renderAt("/compare?chapter=77&ids=1,2");
    await screen.findByRole("table");
    expect(screen.getByText("Course 1")).toBeTruthy();
    expect(screen.getByText("Course 2")).toBeTruthy();
  });

  it("passes the learning-goal context to the verified comparison RPC", async () => {
    EXISTING = [course(1), course(2)];
    CHAPTER_OF = { 1: [77], 2: [77] };
    renderAt("/compare?chapter=77&goal=9&ids=1,2");
    await screen.findByRole("table");
    expect(LAST_RPC_ARGS).toEqual({
      p_playlist_ids: [1, 2], p_chapter_id: 77, p_learning_goal_id: 9,
    });
  });

  it("REFUSES a mixed-chapter selection", async () => {
    // course 2 exists but teaches a different chapter
    EXISTING = [course(1), course(2)];
    CHAPTER_OF = { 1: [77], 2: [88] };
    renderAt("/compare?chapter=77&ids=1,2");
    expect(await screen.findByText(/out of date/i)).toBeTruthy();
    expect(screen.getByText(/do not teach this chapter|does not teach this chapter/i)).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();
  });

  it("excludes the cross-chapter course but still compares when enough remain", async () => {
    EXISTING = [course(1), course(2), course(3)];
    CHAPTER_OF = { 1: [77], 2: [77], 3: [88] };
    renderAt("/compare?chapter=77&ids=1,2,3");
    await screen.findByRole("table");
    expect(screen.getByText("Course 1")).toBeTruthy();
    expect(screen.getByText("Course 2")).toBeTruthy();
    expect(screen.queryByText("Course 3")).toBeNull();
    expect(screen.getByText(/does not teach this chapter/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------- validation
describe("a stale id must never weaken validation", () => {
  it("two requested, only one resolves -> NO table", async () => {
    EXISTING = [course(1)];                 // id 999 does not exist
    CHAPTER_OF = { 1: [77] };
    renderAt("/compare?chapter=77&ids=1,999");
    expect(await screen.findByText(/out of date/i)).toBeTruthy();
    expect(screen.getByText(/Only one course is left/i)).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();
  });

  it("offers a way forward rather than a dead end", async () => {
    EXISTING = [course(1)];
    CHAPTER_OF = { 1: [77] };
    renderAt("/compare?chapter=77&ids=1,999");
    expect(await screen.findByRole("button", { name: /Choose another course/i })).toBeTruthy();
  });

  it("says the link is out of date when nothing resolves", async () => {
    renderAt("/compare?chapter=77&ids=901,902");
    expect(await screen.findByText(/out of date/i)).toBeTruthy();
    expect(screen.getByText(/None of the selected courses/i)).toBeTruthy();
  });

  it("one valid + one cross-chapter is still refused", async () => {
    EXISTING = [course(1), course(2)];
    CHAPTER_OF = { 1: [77], 2: [88] };
    renderAt("/compare?chapter=77&ids=1,2");
    expect(await screen.findByText(/Only one course is left/i)).toBeTruthy();
    expect(document.querySelector("table")).toBeNull();
  });

  it("asks for more when the link names fewer than two", async () => {
    renderAt("/compare?chapter=77&ids=5");
    expect(await screen.findByText(/Pick at least 2 courses/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------- claims
describe("no unsupported claims", () => {
  it("has no exam-suitability row derived from difficulty", () => {
    expect(ATTRIBUTES.find((a) => /main|advanced|suitab/i.test(a.label))).toBeUndefined();
  });

  it("never infers exam suitability from difficulty", async () => {
    EXISTING = [course(1, { difficulty: "advanced" }), course(2, { difficulty: "intermediate" })];
    CHAPTER_OF = { 1: [77], 2: [77] };
    renderAt("/compare?chapter=77&ids=1,2");
    await screen.findByRole("table");
    const table = document.querySelector("table").textContent;
    expect(table).toContain("Advanced");          // the difficulty itself is fine
    expect(table).not.toMatch(/JEE Main|JEE Advanced|Main \/ Advanced/i);
  });

  it("does not claim thoroughness from a lecture count", () => {
    expect(bestFor(course(1, { chapter_lecture_count: 40 }))).toBeNull();
    expect(bestFor(course(1, { chapter_lecture_count: 3 }))).toBeNull();
  });

  it("Best for restates curated metadata only", () => {
    expect(bestFor(course(1, { best_for: "Students revising before a test" })))
      .toBe("Students revising before a test");
    expect(bestFor(course(1, { content_type: "one-shot" }))).toBeNull();
    expect(bestFor(course(1, { difficulty: "advanced" }))).toBeNull();
    expect(bestFor(course(1))).toBeNull();
  });
});

// ---------------------------------------------------------------- unknowns
describe("unknown data", () => {
  it("hides a row that is unknown for EVERY course", async () => {
    EXISTING = [course(1), course(2)];        // no duration, coverage, rating...
    CHAPTER_OF = { 1: [77], 2: [77] };
    renderAt("/compare?chapter=77&ids=1,2");
    await screen.findByRole("table");
    expect(screen.queryByText("Total duration")).toBeNull();
    expect(screen.queryByText("Syllabus coverage")).toBeNull();
    expect(screen.queryByText("Student rating")).toBeNull();
  });

  it("keeps a row when at least one course has a value", async () => {
    EXISTING = [course(1, { teacher: "A. Sharma" }), course(2)];
    CHAPTER_OF = { 1: [77], 2: [77] };
    renderAt("/compare?chapter=77&ids=1,2");
    await screen.findByRole("table");
    expect(screen.getByText("Faculty")).toBeTruthy();
    expect(screen.getByText("A. Sharma")).toBeTruthy();
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0);   // the other column
  });

  it("never renders a missing value as 0, 0% or 0.0", async () => {
    EXISTING = [course(1, { teacher: "A" }), course(2, { teacher: "B" })];
    CHAPTER_OF = { 1: [77], 2: [77] };
    renderAt("/compare?chapter=77&ids=1,2");
    await screen.findByRole("table");
    const t = document.querySelector("table").textContent;
    expect(t).not.toMatch(/\b0%/);
    expect(t).not.toMatch(/\b0\.0\b/);
  });

  it("visibleAttributes drops all-unknown rows and keeps the rest", () => {
    const rows = [course(1, { teacher: "A" }), course(2)];
    const keys = visibleAttributes(rows).map((a) => a.key);
    expect(keys).toContain("faculty");
    expect(keys).not.toContain("duration");
    expect(keys).not.toContain("coverage");
  });
});

// ---------------------------------------------------------------- back
describe("Back returns to the filtered catalogue", () => {
  it("uses history, so filters and scroll survive", async () => {
    EXISTING = [course(1), course(2)];
    CHAPTER_OF = { 1: [77], 2: [77] };
    renderAt("/compare?chapter=77&ids=1,2");
    const back = await screen.findByRole("button", { name: /Back to results/i });
    expect(back.tagName).toBe("BUTTON");
    expect(back.getAttribute("href")).toBeNull();
  });
});
