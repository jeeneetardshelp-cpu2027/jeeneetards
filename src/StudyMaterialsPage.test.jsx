import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { describe, expect, it, vi } from "vitest";

// The whole library, as the RPC answers when a level is unfiltered. The mock
// below runs it through the REAL scoping rule, so these tests exercise the
// cascade rather than a hand-written picture of it.
const { LIBRARY } = vi.hoisted(() => ({
  LIBRARY: {
    goals: [{ id: 4, slug: "school", name: "School Boards", count: 1 }],
    boards: [{ id: 1, slug: "cbse", name: "CBSE", count: 1 }],
    classes: [{ id: 11, slug: "class-11", name: "Class 11", count: 1 }],
    subjects: [
      { id: 1, slug: "physics", name: "Physics", count: 1 },
      { id: 2, slug: "chemistry", name: "Chemistry", count: 1 },
    ],
    chapters: [
      { id: 1, slug: "kinematics", name: "Kinematics", count: 1 },
      { id: 2, slug: "the-p-block-elements", name: "The p-Block Elements", count: 1 },
    ],
  },
}));

vi.mock("./AppShell.jsx", () => ({ Page: ({ children }) => <>{children}</> }));
vi.mock("./useStudyMaterialCatalog.js", async (importOriginal) => {
  const { scopeStudyMaterialCatalog } = await importOriginal();
  return {
    scopeStudyMaterialCatalog,
    useStudyMaterialCatalog: (filters) => ({
      ...scopeStudyMaterialCatalog(LIBRARY, filters),
      loading: false,
      error: null,
      unavailable: false,
      retry: () => {},
    }),
  };
});
// Every filter set the page handed to the query, so a test can assert what
// actually reached get_study_materials — not merely what the controls show.
const { queried } = vi.hoisted(() => ({ queried: [] }));
vi.mock("./useStudyMaterials.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useStudyMaterials: (filters) => {
      queried.push(filters);
      return { items: [], total: 0, loading: false, error: null, unavailable: false };
    },
  };
});

import StudyMaterialsPage, { StudyMaterialsDirectoryView } from "./StudyMaterialsPage.jsx";
import { studyMaterialsPageSchemas } from "./studyMaterialsStructuredData.js";

const MATERIAL = {
  id: 7,
  title: "Rectilinear motion formula sheet",
  description: "A concise revision sheet for motion in one dimension.",
  type: "formula_sheet",
  typeLabel: "Formula sheets",
  sourceName: "Official physics resource",
  sourceUrl: "https://example.edu/rectilinear-motion.pdf",
  previewImageUrl: "https://example.edu/preview.jpg",
  fileFormat: "pdf",
  language: "English",
  pageCount: 4,
  scopes: [{
    goal: "jee", class: "class-11",
    subject: { name: "Physics", slug: "physics" },
    chapter: { name: "Motion in a Straight Line", slug: "motion-in-a-straight-line" },
  }],
};

// Shows the address bar the page is actually producing, and offers the Back
// button, so a shareable scope and a working history can both be asserted.
function ScopeProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p data-testid="scope">{location.search}</p>
      <button type="button" onClick={() => navigate(-1)}>go back</button>
    </>
  );
}

describe("StudyMaterialsDirectoryView", () => {
  it("shows a pictorial, syllabus-labelled material card with its reviewed source", () => {
    render(<StudyMaterialsDirectoryView items={[MATERIAL]} total={1} />);

    expect(screen.getByRole("heading", { name: "Study material" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: MATERIAL.title })).toBeTruthy();
    expect(screen.getByText(/JEE · Class 11 · Physics · Motion in a Straight Line/)).toBeTruthy();
    expect(screen.getByText("Official physics resource")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Open PDF/i });
    expect(link.getAttribute("href")).toBe(MATERIAL.sourceUrl);
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(document.querySelector("img")?.getAttribute("src")).toBe(MATERIAL.previewImageUrl);
  });

  it("publishes visible client material as an ItemList", () => {
    const schemas = studyMaterialsPageSchemas([MATERIAL]);
    const directory = schemas.find((schema) => schema["@type"] === "ItemList");

    expect(directory.itemListElement).toEqual([{
      "@type": "ListItem",
      position: 1,
      name: MATERIAL.title,
      url: MATERIAL.sourceUrl,
    }]);
  });

  it("keeps empty and retryable error states honest", () => {
    const retry = vi.fn();
    const { rerender } = render(<StudyMaterialsDirectoryView items={[]} />);
    expect(screen.getByText(/No reviewed material/)).toBeTruthy();

    rerender(<StudyMaterialsDirectoryView error="Couldn't load study material." retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("loads beyond the first bounded page and reports visible progress", () => {
    const loadMore = vi.fn();
    const items = Array.from({ length: 60 }, (_, index) => ({
      ...MATERIAL,
      id: index + 1,
      title: `JEE paper ${index + 1}`,
      sourceUrl: `https://example.edu/paper-${index + 1}.pdf`,
    }));
    const view = render(
      <StudyMaterialsDirectoryView
        items={items}
        total={124}
        hasMore
        loadMore={loadMore}
      />,
    );

    expect(screen.getByText("Showing 60 of 124 resources")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load 60 more resources" }));
    expect(loadMore).toHaveBeenCalledTimes(1);

    view.rerender(
      <StudyMaterialsDirectoryView
        items={items}
        total={124}
        hasMore
        loadMore={loadMore}
        loadingMore
      />,
    );
    expect(screen.getByRole("button", { name: /Loading more resources/ }).disabled).toBe(true);

    view.rerender(
      <StudyMaterialsDirectoryView
        items={items}
        total={124}
        hasMore
        loadMore={loadMore}
        loadMoreError="Couldn't load more study material."
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Couldn't load more study material.");
    fireEvent.click(screen.getByRole("button", { name: "Try loading more again" }));
    expect(loadMore).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Load 60 more resources" })).toBeNull();
  });

  // Zero short-notes rows exist (0 of 408 on 2026-09-01). A filter that can
  // only ever return nothing is a dead end, so the page does not offer it —
  // while still offering every type a student can actually find something
  // under. The hero copy must not promise it either.
  it("does not offer a material type the library holds none of", () => {
    render(
      <MemoryRouter initialEntries={["/materials"]}>
        <StudyMaterialsPage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Short notes" })).toBeNull();
    for (const name of ["Formula sheets", "Full lecture notes", "Previous-year papers"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(document.body.textContent.toLowerCase()).not.toContain("short notes");
  });

  it("offers material-backed CBSE filters even without a lecture catalogue branch", () => {
    render(
      <MemoryRouter initialEntries={["/materials?goal=school&board=cbse&class=class-11&subject=physics"]}>
        <StudyMaterialsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("option", { name: "CBSE" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Class 11" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Physics" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Kinematics" })).toBeTruthy();
  });

  it("links the curated JEE Main paper landing from the top of the directory", () => {
    render(
      <MemoryRouter initialEntries={["/materials"]}>
        <StudyMaterialsPage />
      </MemoryRouter>,
    );

    const banner = screen.getByRole("link", {
      name: /JEE Main previous-year papers, by year/i,
    });
    expect(banner.getAttribute("href")).toBe("/materials/jee-main/previous-year-papers");
    expect(banner.textContent).toContain("Official question papers and final answer keys");
    // The banner sits ABOVE the filters — a link into the deepest paper
    // shelf, not a card lost below the fold.
    const filters = screen.getByRole("combobox", { name: "Exam" });
    expect(banner.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  // ---- the curriculum controls cascade ----
  //
  // The chapter control used to be a single <select> holding every chapter of
  // every subject of every exam that had material: hundreds of options, in an
  // order that only means something inside one subject. Hiding it behind
  // `disabled` left the options in the page; these tests hold the list itself
  // to the chosen subject.

  it("offers no chapters until a subject is chosen, and says why", () => {
    render(
      <MemoryRouter initialEntries={["/materials?goal=school"]}>
        <StudyMaterialsPage />
      </MemoryRouter>,
    );

    const chapter = screen.getByRole("combobox", { name: "Chapter" });
    expect(chapter.disabled).toBe(true);
    expect(screen.queryByRole("option", { name: "Kinematics" })).toBeNull();
    expect(screen.getByText("Choose a subject to see its chapters.")).toBeTruthy();
    // The explanation is the control's description, not part of its name.
    expect(chapter.getAttribute("aria-describedby"))
      .toBe(screen.getByText("Choose a subject to see its chapters.").id);
  });

  it("lists chapters of the chosen subject only", () => {
    render(
      <MemoryRouter initialEntries={["/materials?goal=school&class=class-11&subject=physics"]}>
        <StudyMaterialsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("combobox", { name: "Chapter" }).disabled).toBe(false);
    expect(screen.getByRole("option", { name: "Kinematics" })).toBeTruthy();
  });

  it("clears the levels below the one that changed, and keeps the rest", () => {
    render(
      <MemoryRouter initialEntries={[
        "/materials?goal=school&class=class-11&subject=physics&chapter=kinematics&type=short_notes",
      ]}>
        <StudyMaterialsPage />
        <ScopeProbe />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Subject" }), {
      target: { value: "chemistry" },
    });

    const scope = new URLSearchParams(screen.getByTestId("scope").textContent);
    expect(scope.get("subject")).toBe("chemistry");
    expect(scope.get("chapter")).toBeNull();
    expect(scope.get("goal")).toBe("school");
    expect(scope.get("class")).toBe("class-11");
    expect(scope.get("type")).toBe("short_notes");
  });

  it("keeps a filtered view shareable, and lets Back undo one choice", () => {
    render(
      <MemoryRouter initialEntries={["/materials?goal=school&class=class-11&subject=physics"]}>
        <StudyMaterialsPage />
        <ScopeProbe />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Subject" }), {
      target: { value: "chemistry" },
    });
    expect(screen.getByTestId("scope").textContent).toContain("subject=chemistry");

    fireEvent.click(screen.getByRole("button", { name: "go back" }));
    expect(screen.getByTestId("scope").textContent).toContain("subject=physics");
  });

  it("carries a /browse scope instead of emptying the page over it", () => {
    // /browse spells the class `11` and uses ?type= for a COURSE type. Both
    // reach get_study_materials here, so the class is translated and the
    // course type is dropped — dropping widens the page; forwarding it would
    // return nothing and look like a broken library.
    queried.length = 0;
    render(
      <MemoryRouter initialEntries={["/materials?goal=school&class=11&subject=physics&type=full-course"]}>
        <StudyMaterialsPage />
        <ScopeProbe />
      </MemoryRouter>,
    );

    expect(queried.at(-1)).toMatchObject({ stage: "class-11", subject: "physics", type: null });
    const scope = new URLSearchParams(screen.getByTestId("scope").textContent);
    expect(scope.get("class")).toBe("class-11");
    expect(scope.get("type")).toBeNull();
  });

  it("still shows a selection the narrowed list no longer offers", () => {
    // Otherwise the select reads "All subjects" while the query filters by
    // biology — a control lying about what the page is doing.
    render(
      <MemoryRouter initialEntries={["/materials?goal=school&subject=biology"]}>
        <StudyMaterialsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("combobox", { name: "Subject" }).value).toBe("biology");
    expect(screen.getByRole("option", { name: "biology" })).toBeTruthy();
  });

  it("keeps the watch page's chapter hand-off", () => {
    queried.length = 0;
    render(
      <MemoryRouter initialEntries={["/materials?chapterId=42"]}>
        <StudyMaterialsPage />
        <ScopeProbe />
      </MemoryRouter>,
    );

    expect(queried.at(-1)).toMatchObject({ chapterId: 42 });
    expect(screen.getByTestId("scope").textContent).toContain("chapterId=42");
    expect(screen.getByText(/Showing material linked to the chapter you were watching/)).toBeTruthy();
  });

  it("writes the same Home to Study material breadcrumb as the edge response", async () => {
    render(
      <MemoryRouter initialEntries={["/materials"]}>
        <StudyMaterialsPage />
      </MemoryRouter>,
    );

    let schema;
    await waitFor(() => {
      const script = document.head.querySelector(
        'script[type="application/ld+json"][data-schema-key="BreadcrumbList"]',
      );
      expect(script).not.toBeNull();
      schema = JSON.parse(script.textContent);
    });
    expect(schema.itemListElement.map(({ name }) => name))
      .toEqual(["Home", "Study material"]);
    expect(schema.itemListElement[1].item)
      .toBe("https://www.jeeneetard.com/materials");
  });
});
