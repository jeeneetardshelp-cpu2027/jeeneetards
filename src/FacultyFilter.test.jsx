// Component tests for the faculty filter and its URL persistence.
//
// The database tests (F0–F21 in verifyImport.js) prove aliases, honorifics and
// ranking resolve correctly in Postgres. These prove the SCREEN uses that
// correctly: that a selection lands in the URL, that a URL restores a
// selection, and — the recurring bug in this project — that "loading" and
// "failed" are never rendered as "this teacher has no courses".
//
// Run: npm test
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useSearchParams } from "react-router";

vi.mock("./useFaculty.js", () => ({
  useFacultyFacets: vi.fn(),
  useTeacherSearch: vi.fn(),
  useTeacherPlaylistIds: vi.fn(),
  useFacultyProfile: vi.fn(),
  useSimilarTeachers: vi.fn(),
}));

import { useFacultyFacets, useTeacherSearch } from "./useFaculty.js";
import { FacultyFilter, readTeacherFilter } from "./FacultyFilter.jsx";

const ABJ = { teacher_id: 7, display_name: "Amit Bijarnia", slug: "amit-bijarnia", verified: true, course_count: 3 };
const PRIYA = { teacher_id: 9, display_name: "Priya Nair", slug: "priya-nair", verified: false, course_count: 1 };

// Renders the filter and exposes the current query string, so a test can assert
// what actually ended up in the URL.
function Harness() {
  const [params, setParams] = useSearchParams();
  return (
    <>
      <div data-testid="qs">{params.toString()}</div>
      <FacultyFilter params={params} setParams={setParams} scope={{ chapterId: 1 }} />
    </>
  );
}

const renderAt = (url = "/") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<Harness />} />
      </Routes>
    </MemoryRouter>
  );

describe("FacultyFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTeacherSearch.mockReturnValue({ results: [], loading: false, error: null });
  });

  it("shows each teacher with a database-supplied course count", () => {
    useFacultyFacets.mockReturnValue({ facets: [ABJ, PRIYA], loading: false, error: null });
    renderAt();
    expect(screen.getByText("Amit Bijarnia")).toBeDefined();
    expect(screen.getByText("(3)")).toBeDefined();
    expect(screen.getByText("Priya Nair")).toBeDefined();
    expect(screen.getByText("(1)")).toBeDefined();
  });

  it("writes the chosen teacher into the URL", () => {
    useFacultyFacets.mockReturnValue({ facets: [ABJ, PRIYA], loading: false, error: null });
    renderAt();
    expect(screen.getByTestId("qs").textContent).toBe("");
    fireEvent.click(screen.getByText("Amit Bijarnia"));
    expect(screen.getByTestId("qs").textContent).toContain("teacher=7");
  });

  // URL restoration: arriving on a link with ?teacher=7 must show that teacher
  // already selected, without any click.
  it("restores the selection from the URL", () => {
    useFacultyFacets.mockReturnValue({ facets: [ABJ, PRIYA], loading: false, error: null });
    renderAt("/?teacher=7");
    const chip = screen.getByText("Amit Bijarnia").closest("button");
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    const other = screen.getByText("Priya Nair").closest("button");
    expect(other.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking the selected teacher again clears the filter from the URL", () => {
    useFacultyFacets.mockReturnValue({ facets: [ABJ, PRIYA], loading: false, error: null });
    renderAt("/?teacher=7");
    fireEvent.click(screen.getByText("Amit Bijarnia"));
    expect(screen.getByTestId("qs").textContent).not.toContain("teacher=");
  });

  // Choosing a teacher re-scopes the results, so a stale page offset from an
  // earlier, larger view must be dropped — otherwise a teacher who has courses
  // renders the false "No courses match this view" empty state (page 2 of a
  // one-page result set returns an out-of-range, empty row window).
  it("drops a stale page offset when a teacher is chosen", () => {
    useFacultyFacets.mockReturnValue({ facets: [ABJ, PRIYA], loading: false, error: null });
    renderAt("/?page=2");
    fireEvent.click(screen.getByText("Amit Bijarnia"));
    const qs = screen.getByTestId("qs").textContent;
    expect(qs).toContain("teacher=7");
    expect(qs).not.toContain("page=");
  });

  it("drops the page offset when the faculty filter is cleared", () => {
    useFacultyFacets.mockReturnValue({ facets: [ABJ, PRIYA], loading: false, error: null });
    renderAt("/?teacher=7&page=2");
    fireEvent.click(screen.getByText("Clear"));
    const qs = screen.getByTestId("qs").textContent;
    expect(qs).not.toContain("teacher=");
    expect(qs).not.toContain("page=");
  });

  it("reports a failed facet query instead of showing an empty filter", () => {
    useFacultyFacets.mockReturnValue({ facets: [], loading: false, error: "Couldn't load faculty filters." });
    renderAt();
    expect(screen.getByText("Couldn't load faculty filters.")).toBeDefined();
    expect(screen.queryByText("Taught by")).toBeNull();
  });

  it("does not render 'no faculty' while facets are still loading", () => {
    useFacultyFacets.mockReturnValue({ facets: [], loading: true, error: null });
    renderAt();
    expect(screen.queryByText("Taught by")).toBeNull();
    expect(screen.queryByText(/no faculty/i)).toBeNull();
    expect(screen.getByLabelText("Loading faculty filters").className).toContain("h-32");
  });
});

describe("readTeacherFilter", () => {
  const p = (s) => new URLSearchParams(s);
  it("reads a valid id", () => expect(readTeacherFilter(p("teacher=7"))).toBe(7));
  it("ignores a missing param", () => expect(readTeacherFilter(p(""))).toBeNull());
  it("ignores a non-numeric id", () => expect(readTeacherFilter(p("teacher=abj"))).toBeNull());
  it("ignores a zero or negative id", () => {
    expect(readTeacherFilter(p("teacher=0"))).toBeNull();
    expect(readTeacherFilter(p("teacher=-3"))).toBeNull();
  });
});
