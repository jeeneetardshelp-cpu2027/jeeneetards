import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const facultyHooks = vi.hoisted(() => ({
  options: null,
  directory: null,
  search: null,
}));

vi.mock("./useFaculty.js", () => ({
  useFacultyDirectoryOptions: () => facultyHooks.options,
  useFacultyFacets: vi.fn(() => facultyHooks.directory),
  useTeacherSearch: vi.fn(() => facultyHooks.search),
}));
vi.mock("./useBrowse.js", () => ({ useDebouncedValue: (value) => value }));

import FacultyDirectory from "./FacultyDirectory.jsx";
import { useFacultyFacets, useTeacherSearch } from "./useFaculty.js";

const ABJ = {
  teacher_id: 7,
  display_name: "Amit Bijarnia",
  slug: "amit-bijarnia",
  verified: true,
  institutes: "Competishun",
  course_count: 4,
};
const MOHIT = {
  teacher_id: 8,
  display_name: "Mohit Tyagi",
  slug: "mohit-tyagi",
  verified: true,
  institutes: "Competishun",
  course_count: 3,
};

function renderAt(url = "/faculty") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/faculty" element={<FacultyDirectory />} />
        <Route path="/faculty/:slug" element={<p>Faculty profile</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FacultyDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    facultyHooks.options = {
      goals: [{ id: 1, slug: "jee", name: "JEE" }],
      subjects: [{ id: 2, slug: "physics", name: "Physics" }],
      loading: false,
      error: null,
      retry: vi.fn(),
    };
    facultyHooks.directory = {
      facets: [ABJ, MOHIT],
      loading: false,
      error: null,
      retry: vi.fn(),
    };
    facultyHooks.search = { results: [], loading: false, error: null, retry: vi.fn() };
  });

  it("lists linked faculty profiles with honest scoped course counts", () => {
    renderAt();

    expect(screen.getByRole("heading", { name: "Find courses by faculty" })).toBeDefined();
    expect(screen.getByRole("link", { name: "View Amit Bijarnia faculty profile" })
      .getAttribute("href")).toBe("/faculty/amit-bijarnia");
    expect(screen.getByText("4 linked courses")).toBeDefined();
    expect(screen.getAllByLabelText("Verified faculty")).toHaveLength(2);
  });

  it("restores exam and subject filters from readable URL slugs", () => {
    renderAt("/faculty?goal=jee&subject=physics");

    expect(screen.getByRole("combobox", { name: "Exam" }).value).toBe("jee");
    expect(screen.getByRole("combobox", { name: "Subject" }).value).toBe("physics");
    expect(useFacultyFacets).toHaveBeenCalledWith({
      goalId: 1,
      subjectId: 2,
      enabled: true,
    });
  });

  it("uses the reviewed alias search and keeps results inside the selected scope", () => {
    facultyHooks.search = {
      results: [
        { ...ABJ, matched_on: "ABJ Sir" },
        { teacher_id: 99, display_name: "Outside Scope", slug: "outside-scope" },
      ],
      loading: false,
      error: null,
      retry: vi.fn(),
    };
    renderAt("/faculty?q=ABJ");

    expect(useTeacherSearch).toHaveBeenCalledWith("ABJ", 50);
    expect(screen.getByText("Amit Bijarnia")).toBeDefined();
    expect(screen.queryByText("Outside Scope")).toBeNull();
    expect(screen.queryByText("Mohit Tyagi")).toBeNull();
  });

  it("does not announce a false zero while an alias lookup is loading", () => {
    facultyHooks.search = {
      results: [], loading: true, error: null, retry: vi.fn(),
    };
    renderAt("/faculty?q=ABJ");

    expect(screen.getByText("Loading faculty…")).toBeDefined();
    expect(screen.queryByText("0 faculty members")).toBeNull();
  });

  it("writes filter changes into the URL and can clear the complete view", async () => {
    renderAt();
    fireEvent.change(screen.getByRole("combobox", { name: "Exam" }), {
      target: { value: "jee" },
    });

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Exam" }).value).toBe("jee"));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("combobox", { name: "Exam" }).value).toBe("");
  });

  it("does not turn a failed registry lookup into a false empty directory", () => {
    facultyHooks.directory = {
      facets: [], loading: false, error: "Couldn't load faculty filters.", retry: vi.fn(),
    };
    renderAt();

    expect(screen.getByRole("alert").textContent).toContain("Faculty directory unavailable");
    expect(screen.queryByText("No faculty match this view")).toBeNull();
  });
});

// The directory rendered every match at once — 89 cards is 18,438px at 360px,
// roughly 23 phone screens of near-identical tiles with no way past them. Same
// unbounded-list pattern already fixed on the homepage channel wall.
describe("faculty directory is bounded on a phone", () => {
  const many = (n) => Array.from({ length: n }, (_, i) => ({
    teacher_id: 100 + i,
    display_name: `Teacher ${i + 1}`,
    slug: `teacher-${i + 1}`,
    verified: false,
    institutes: "Some Institute",
    course_count: 1,
  }));

  it("caps the first view and reveals the rest on request", async () => {
    facultyHooks.directory = { facets: many(40), loading: false, error: null, retry: vi.fn() };
    renderAt();

    // Bounded: 24 cards, not 40.
    await waitFor(() => expect(screen.getAllByRole("link", { name: /faculty profile$/ })).toHaveLength(24));
    // The true total is still reported, so the cap never understates the match.
    // Both the result label and the reveal button carry it; one of them is enough
    // to prove the cap never understates how many actually matched.
    expect(screen.getAllByText(/40 faculty members/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Teacher 40 faculty profile/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show all 40 faculty members" }));
    await waitFor(() => expect(screen.getAllByRole("link", { name: /faculty profile$/ })).toHaveLength(40));
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("offers no reveal when everything already fits", async () => {
    facultyHooks.directory = { facets: many(5), loading: false, error: null, retry: vi.fn() };
    renderAt();
    await waitFor(() => expect(screen.getAllByRole("link", { name: /faculty profile$/ })).toHaveLength(5));
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });
});
