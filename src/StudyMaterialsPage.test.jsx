import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudyMaterialsDirectoryView } from "./StudyMaterialsPage.jsx";

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

  it("keeps empty and retryable error states honest", () => {
    const retry = vi.fn();
    const { rerender } = render(<StudyMaterialsDirectoryView items={[]} />);
    expect(screen.getByText(/No reviewed material/)).toBeTruthy();

    rerender(<StudyMaterialsDirectoryView error="Couldn't load study material." retry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
