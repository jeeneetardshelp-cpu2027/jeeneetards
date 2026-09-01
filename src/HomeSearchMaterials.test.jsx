// HomeSearchMaterials.test.jsx — the homepage search covers all three pillars.
//
// Home renders its own group list (HOME_GROUPS), separate from /search's, so
// "the groups exist" is not enough — this asserts the homepage draws them and
// links them, and that it looks EXACTLY as it does today while the staged
// migration (supabase/migrations/20260901160000_universal_search_materials.sql)
// is still pending and the RPC returns no material or paper rows.
//
// Mocking follows HomeSearchVisible.test.jsx: the hook is replaced wholesale,
// so what is under test is the renderer and nothing else.

import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./usePlaylistBrowse.js", () => ({
  usePlaylistBrowse: () => ({ items: [], loading: false, error: null }),
}));
vi.mock("./progress.js", () => ({ getContinueWatching: () => [] }));
vi.mock("./useExplore.js", () => ({
  useLearningGoals: () => ({ goals: [], loading: false, error: null }),
}));

let GROUPS_FROM_SERVER = {};

vi.mock("./useUniversalSearch.js", () => ({
  useUniversalSearch: () => ({
    groups: GROUPS_FROM_SERVER,
    loading: false,
    error: null,
    tooShort: false,
    retry: () => {},
  }),
  MIN_QUERY: 2,
}));

const { default: Home } = await import("./Home.jsx");
const { ThemeProvider } = await import("./theme.jsx");

const LEGACY_GROUPS = {
  chapter: {
    total: 1,
    rows: [{ id: 7, title: "Kinematics", subtitle: "Physics", extra: { chapter_id: 7 } }],
  },
  lecture: {
    total: 1,
    rows: [{
      id: 9, title: "Relative motion", subtitle: "Kinematics course",
      extra: { playlist_id: 5, youtube_video_id: "CBvaO-uDvs8" },
    }],
  },
};

const MATERIAL_GROUPS = {
  material: {
    total: 1,
    rows: [{
      id: 21,
      title: "Kinematics Short Notes",
      subtitle: "Short notes · Physics · Kinematics",
      extra: {
        material_type: "short_notes", goal_slug: "jee", class_slug: "class-11",
        subject_slug: "physics", chapter_slug: "kinematics",
      },
    }],
  },
  paper: {
    total: 1,
    rows: [{
      id: 31,
      title: "JEE Main 2024 Session 1 Shift 1 Question Paper",
      subtitle: "2024 · NTA",
      extra: { material_type: "previous_year_paper", jee_main_landing: true },
    }],
  },
};

const renderSearch = (groups) => {
  GROUPS_FROM_SERVER = groups;
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/?q=kinematics"]}>
        <Home />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

const hrefFor = (text) => screen.getByText(text).closest("a")?.getAttribute("href");

afterEach(() => { cleanup(); GROUPS_FROM_SERVER = {}; });

describe("the homepage search shows study material", () => {
  it("draws a section for notes and one for previous-year papers", async () => {
    renderSearch({ ...LEGACY_GROUPS, ...MATERIAL_GROUPS });
    expect(await screen.findByText("Notes & sheets")).toBeTruthy();
    expect(screen.getByText("Previous-year papers")).toBeTruthy();
  });

  it("links a note to /materials with its own syllabus filters", async () => {
    renderSearch(MATERIAL_GROUPS);
    await screen.findByText("Kinematics Short Notes");
    expect(hrefFor("Kinematics Short Notes"))
      .toBe("/materials?goal=jee&class=class-11&subject=physics&chapter=kinematics&type=short_notes");
  });

  it("links a JEE Main paper to the curated papers landing", async () => {
    renderSearch(MATERIAL_GROUPS);
    await screen.findByText("JEE Main 2024 Session 1 Shift 1 Question Paper");
    expect(hrefFor("JEE Main 2024 Session 1 Shift 1 Question Paper"))
      .toBe("/materials/jee-main/previous-year-papers");
  });

  it("keeps the video results above them, unmoved", async () => {
    const { container } = renderSearch({ ...LEGACY_GROUPS, ...MATERIAL_GROUPS });
    await screen.findByText("Notes & sheets");
    const order = [...container.querySelectorAll("h2")].map((h) => h.textContent.trim());
    expect(order).toEqual([
      "Chapters", "Lectures", "Notes & sheets", "Previous-year papers",
    ]);
  });
});

describe("degrades to today's homepage until the migration is applied", () => {
  it("draws no study-material section when the RPC sends no such rows", async () => {
    const { container } = renderSearch(LEGACY_GROUPS);
    await screen.findByText("Kinematics");
    const order = [...container.querySelectorAll("h2")].map((h) => h.textContent.trim());
    expect(order).toEqual(["Chapters", "Lectures"]);
    expect(screen.queryByText("Notes & sheets")).toBeNull();
    expect(screen.queryByText("Previous-year papers")).toBeNull();
  });

  it("shows no error and no empty-results state", async () => {
    renderSearch(LEGACY_GROUPS);
    await screen.findByText("Kinematics");
    expect(screen.queryByText(/Search is unavailable/)).toBeNull();
    expect(screen.queryByText(/No results for/)).toBeNull();
  });
});
