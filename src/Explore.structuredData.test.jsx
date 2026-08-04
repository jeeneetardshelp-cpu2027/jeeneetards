// Explore.jsx's structured-data wiring: proves it reuses the SAME `crumbs`
// array already built for its own header (trivial reuse per the brief — no
// second breadcrumb derivation to drift from what's on screen), and that a
// live scoped search removes the markup rather than describing an unstable
// page identity. Mocks mirror Explore.unknownSlug.test.jsx's scaffolding.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./useExplore.js", () => ({
  useLearningGoals: () => ({
    goals: [{ id: 1, slug: "jee", name: "JEE", count: 10 }],
    loading: false,
    error: null,
    retry: () => {},
  }),
  useClassLevels: () => ({
    classLevels: [{ id: 2, slug: "class-11", name: "Class 11" }],
  }),
  useBoards: () => ({ boards: [], loading: false, error: null, unavailable: false }),
  usePopulatedClasses: () => ({
    classSlugs: ["class-11"], loading: false, error: null, ready: true, retry: () => {},
  }),
  useGoalCatalog: () => ({
    subjects: [{ id: 11, slug: "physics", name: "Physics", count: 16 }],
    chaptersBySubject: {
      11: [{ id: 101, slug: "kinematics", name: "Kinematics", count: 4 }],
    },
    loading: false,
    error: null,
    ready: true,
    retry: () => {},
  }),
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

function renderAt(url) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/explore/:goal/:s1/:s2" element={<Explore />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function breadcrumbSchema() {
  const el = document.head.querySelector(
    'script[type="application/ld+json"][data-schema-key="BreadcrumbList"]',
  );
  return el ? JSON.parse(el.textContent) : null;
}

beforeEach(() => {
  window.scrollTo = vi.fn();
});

describe("Explore structured data wiring", () => {
  it("mirrors the same crumbs the header renders, as absolute urls", async () => {
    renderAt("/explore/jee/class-11/physics");
    await screen.findByRole("heading", { name: "Choose a chapter" });

    const schema = breadcrumbSchema();
    expect(schema.itemListElement.map((i) => i.name)).toEqual([
      "Explore", "JEE", "Class 11", "Physics",
    ]);
    expect(schema.itemListElement.map((i) => i.item)).toEqual([
      "https://www.jeeneetard.com/explore",
      "https://www.jeeneetard.com/explore/jee",
      "https://www.jeeneetard.com/explore/jee/class-11",
      "https://www.jeeneetard.com/explore/jee/class-11/physics",
    ]);
  });

  it("removes the breadcrumb markup while a scoped search is live", async () => {
    renderAt("/explore/jee/class-11/physics");
    await screen.findByRole("heading", { name: "Choose a chapter" });
    expect(breadcrumbSchema()).not.toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Search within/i), {
      target: { value: "kinematics" },
    });
    await waitFor(() => expect(breadcrumbSchema()).toBeNull());
  });
});
