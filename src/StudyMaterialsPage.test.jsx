import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("./AppShell.jsx", () => ({ Page: ({ children }) => <>{children}</> }));
vi.mock("./useStudyMaterialCatalog.js", () => ({
  useStudyMaterialCatalog: () => ({
    goals: [{ id: 4, slug: "school", name: "School Boards", count: 1 }],
    boards: [{ id: 1, slug: "cbse", name: "CBSE", count: 1 }],
    classes: [{ id: 11, slug: "class-11", name: "Class 11", count: 1 }],
    subjects: [{ id: 1, slug: "physics", name: "Physics", count: 1 }],
    chapters: [{ id: 1, slug: "kinematics", name: "Kinematics", count: 1 }],
    loading: false,
    error: null,
    unavailable: false,
  }),
}));
vi.mock("./useStudyMaterials.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useStudyMaterials: () => ({ items: [], total: 0, loading: false, error: null, unavailable: false }),
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
