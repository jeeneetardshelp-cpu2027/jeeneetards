// Explore.unknownSlug.test.jsx — unknown explore slugs redirect to the
// nearest real step instead of rendering a lying picker.
//
// /explore/boards used to show the exam picker under an "Explore Boards
// courses" title — a soft-404 with mismatched metadata. The redirect guards
// must also be exactly as strict as the steps they protect:
//  * a class the goal never offers (JEE Class 10) is as unknown as garbage;
//  * catalogue data from ANOTHER scope (state survives param-only
//    navigations) must never trigger a redirect off a valid deep link.

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const catalog = vi.hoisted(() => ({ state: null }));

vi.mock("./useExplore.js", () => ({
  useLearningGoals: () => ({
    goals: [
      { id: 1, slug: "jee", name: "JEE", count: 10 },
      { id: 2, slug: "neet", name: "NEET", count: 5 },
      { id: 3, slug: "school", name: "School Boards", count: 3 },
    ],
    loading: false,
    error: null,
    retry: () => {},
  }),
  useClassLevels: () => ({
    classLevels: [
      { id: 1, slug: "class-10", name: "Class 10" },
      { id: 2, slug: "class-11", name: "Class 11" },
      { id: 3, slug: "class-12", name: "Class 12" },
      { id: 4, slug: "dropper", name: "Dropper" },
    ],
  }),
  useBoards: () => ({
    boards: [{ id: 1, slug: "cbse", name: "CBSE", courseCount: 3 }],
    loading: false,
    error: null,
    unavailable: false,
  }),
  useGoalCatalog: () => catalog.state,
}));

vi.mock("./useScopedSearch.js", () => ({
  useScopedSearch: () => ({
    results: { chapters: [], lectures: [] },
    loading: false,
    total: 0,
  }),
}));

import Explore from "./Explore.jsx";
import { ThemeProvider } from "./theme.jsx";

function Probe() {
  const location = useLocation();
  return <output aria-label="route">{location.pathname}</output>;
}

const renderAt = (url) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/:goal" element={<Explore />} />
          <Route path="/explore/:goal/:s1" element={<Explore />} />
          <Route path="/explore/:goal/:s1/:s2" element={<Explore />} />
          <Route path="/explore/:goal/:s1/:s2/:s3" element={<Explore />} />
        </Routes>
        <Probe />
      </MemoryRouter>
    </ThemeProvider>,
  );

const JEE_CLASS_11_CATALOG = {
  subjects: [
    { id: 11, slug: "physics", name: "Physics", count: 16 },
    { id: 12, slug: "chemistry", name: "Chemistry", count: 12 },
  ],
  chaptersBySubject: {
    11: [{ id: 101, slug: "kinematics", name: "Kinematics", count: 4 }],
  },
  loading: false,
  error: null,
  ready: true,
  retry: () => {},
};

beforeEach(() => {
  window.scrollTo = vi.fn();
  catalog.state = { ...JEE_CLASS_11_CATALOG, subjects: [], chaptersBySubject: {}, ready: false };
});

describe("unknown explore slugs", () => {
  it("redirects an unknown goal to /explore", () => {
    renderAt("/explore/boards");
    expect(screen.getByLabelText("route").textContent).toBe("/explore");
  });

  it("redirects a class the goal never offers, exactly like the step filter", () => {
    // class-10 exists globally (school boards) but is never offered for JEE.
    renderAt("/explore/jee/class-10");
    expect(screen.getByLabelText("route").textContent).toBe("/explore/jee");
  });

  it("keeps a valid offered class", () => {
    renderAt("/explore/jee/class-11");
    expect(screen.getByLabelText("route").textContent).toBe("/explore/jee/class-11");
  });

  it("never redirects a subject while the catalogue holds another scope's data", () => {
    // Simulates the first render after a Back-jump: subjects from a previous
    // goal/class are still in state, loading=false, but ready=false because
    // they belong to a different request. biology is absent from this stale
    // list — the guard must WAIT, not redirect.
    catalog.state = { ...JEE_CLASS_11_CATALOG, ready: false };
    renderAt("/explore/neet/class-11/biology");
    expect(screen.getByLabelText("route").textContent).toBe(
      "/explore/neet/class-11/biology",
    );
  });

  it("redirects an unknown subject once the catalogue is ready for this scope", () => {
    catalog.state = { ...JEE_CLASS_11_CATALOG, ready: true };
    renderAt("/explore/jee/class-11/biology");
    expect(screen.getByLabelText("route").textContent).toBe(
      "/explore/jee/class-11",
    );
  });

  it("redirects an unknown chapter to the chapter picker", () => {
    catalog.state = { ...JEE_CLASS_11_CATALOG, ready: true };
    renderAt("/explore/jee/class-11/physics/no-such-chapter");
    expect(screen.getByLabelText("route").textContent).toBe(
      "/explore/jee/class-11/physics",
    );
  });
});
