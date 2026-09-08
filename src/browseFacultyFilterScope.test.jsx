// The "Taught by" filter is not shown on a /browse page that has not been
// narrowed yet — with one exception that matters more than the pixels.
//
// WHY. Measured on production at 375x812 on 7 Sep 2026: the row occupies 252 px
// of the 656 px above the first course card, i.e. 38% of everything a student
// scrolls past to reach a lecture. On a 360x640 budget Android no card is
// visible at all. What it offers in exchange, unscoped, is six teachers out of
// 89, covering 118 of 484 courses — a question a student cannot answer before
// choosing a subject, since they do not yet know which teachers are relevant.
//
// THE EXCEPTION. When the URL already carries ?teacher=, the filter renders
// even with nothing else chosen. Hiding it there would leave a student on a
// shared link looking at results silently narrowed to one teacher, with no
// control to see or clear it. Saving 252 px is not worth that, and this file
// exists mostly to stop someone "simplifying" the condition later.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Resolve slugs the way the real hook would, so the scope under test is the
// only variable. canonicalChapterWave.test.jsx owns resolution itself.
const canonical = { current: null };
vi.mock("./useCanonicalFilters.js", () => ({
  useCanonicalFilters: () => canonical.current,
}));

// FacultyFilter hides its own heading while facets are loading or errored
// (FacultyFilter.test.jsx pins that, and it is right). So the facets are stubbed
// as ALREADY LOADED here — otherwise every assertion below would pass for the
// wrong reason, and the ?teacher= case would look correct while being broken.
vi.mock("./useFaculty.js", () => ({
  useFacultyFacets: () => ({
    facets: [
      { id: 7, name: "Amit Bijarnia", courseCount: 36 },
      { id: 9, name: "Alok Kumar", courseCount: 25 },
    ],
    loading: false,
    error: null,
    unavailable: false,
  }),
  useTeacherSearch: () => ({ results: [], loading: false, error: null }),
}));

const RESOLVED = {
  goalId: 1, subjectId: null, chapterId: null, boardId: null,
  chapterClassSlugs: null, names: {}, loading: false, ready: true,
  error: null, unresolved: [],
};

const scope = (over) => { canonical.current = { ...RESOLVED, ...over }; };

const renderAt = async (url) => {
  const { default: BrowsePage } = await import("./BrowsePage.jsx");
  return render(
    <MemoryRouter initialEntries={[url]}>
      <BrowsePage />
    </MemoryRouter>,
  );
};

const taughtBy = () => screen.queryByText("Taught by");

beforeEach(() => {
  vi.resetModules();
  canonical.current = null;
});

describe("the Taught by filter's scope on /browse", () => {
  it("is hidden on the bare page, where it would cost 252px to ask an unanswerable question", async () => {
    scope({});
    await renderAt("/browse");
    expect(taughtBy()).toBeNull();
  });

  it("appears once a subject narrows it, which is when six names mean something", async () => {
    scope({ subjectId: 1 });
    await renderAt("/browse?subject=physics");
    expect(taughtBy()).not.toBeNull();
  });

  it("appears once a chapter narrows it", async () => {
    scope({ subjectId: 1, chapterId: 23 });
    await renderAt("/browse?subject=physics&chapter=thermodynamics");
    expect(taughtBy()).not.toBeNull();
  });

  // THE ONE THAT MATTERS. A shared link can carry a teacher and nothing else.
  it("appears for ?teacher= even with nothing else chosen, so the filter is visible and clearable", async () => {
    scope({});
    await renderAt("/browse?teacher=7");
    expect(
      taughtBy(),
      "a student arriving on ?teacher= saw results narrowed to one teacher with no way to see or clear it",
    ).not.toBeNull();
  });

  it("still hides it for a teacher param the parser rejects, because nothing is being filtered", async () => {
    // parseFilterParams drops a non-numeric id rather than sending it to
    // PostgREST, so there is no active filter to expose and no reason to
    // spend the space.
    scope({});
    await renderAt("/browse?teacher=abj");
    expect(taughtBy()).toBeNull();
  });
});
