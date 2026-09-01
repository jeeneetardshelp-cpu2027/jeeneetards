// PlaylistCard.jsx — the ONE shared course card, now in its own module so the
// homepage can import it without dragging the whole browse page into its
// bundle. These tests pin down the card's honesty rules; the browse-page tests
// (PlaylistBrowse.test.jsx) keep covering the card inside its grid.
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { PlaylistCard } from "./PlaylistCard.jsx";
import { ThemeProvider } from "./theme.jsx";

const show = (course, props = {}) =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <PlaylistCard course={course} to="/course/1" comparisonEnabled={false} {...props} />
      </ThemeProvider>
    </MemoryRouter>,
  );

const richCourse = (over = {}) => ({
  id: 1,
  title: "Complete Kinematics",
  subject: "Physics",
  classLevels: ["Class 11"],
  teacher: "ABJ Sir",
  lectures: 12,
  durationSeconds: 3600,
  coverage: 80,
  contentType: "full-course",
  difficulty: "advanced",
  coverVideoId: "CBvaO-uDvs8",
  ...over,
});

describe("PlaylistCard", () => {
  it("shows a confident rating as a score with its count", () => {
    show(richCourse({ rating: 4.6, ratingCount: 9 }));
    expect(screen.getByText("4.6")).toBeTruthy();
    expect(screen.getByText("(9)")).toBeTruthy();
  });

  it("shows a low-count rating as a count, never as a score", () => {
    show(richCourse({ rating: 5, ratingCount: 1 }));
    expect(screen.getByText("1 student rating")).toBeTruthy();
    expect(screen.queryByText("5.0")).toBeNull();
  });

  it("marks a card with three or more missing decision fields as limited", () => {
    show({ id: 2, title: "Mystery Course", classLevels: [] });
    expect(screen.getByText("Limited metadata")).toBeTruthy();
  });

  it("does not apologise on a card with rich metadata", () => {
    show(richCourse());
    expect(screen.queryByText("Limited metadata")).toBeNull();
    expect(screen.getByText("1h 0m")).toBeTruthy();
    expect(screen.getByText("12 lectures")).toBeTruthy();
  });

  it("keeps the full-quality cover image — this is the large rendition", () => {
    const { container } = show(richCourse());
    expect(container.querySelector("img")?.getAttribute("src"))
      .toBe("https://img.youtube.com/vi/CBvaO-uDvs8/hqdefault.jpg");
  });

  // LANGUAGE IS THE ONE ATTRIBUTE MOST OF THIS AUDIENCE FILTERS ON FIRST.
  // It used to be a grey word in the middle of the facts row; it is now a
  // badge above the title, where a student scanning a grid can see it.
  it("shows the course language as a badge, in the canonical vocabulary", () => {
    show(richCourse({ language: "hinglish" }));
    // "Taught in" is sr-only, so the badge reads as a sentence to a listener
    // while staying one scannable word on screen.
    const badge = screen.getByText("Taught in").parentElement;
    expect(badge.textContent.replace(/\s+/g, " ").trim()).toBe("Taught in Hinglish");
    expect(screen.getByText("Hinglish")).toBeTruthy();
  });

  it("uses the filter vocabulary's label, not the raw column value", () => {
    show(richCourse({ language: "hindi" }));
    // The database stores "hindi"; the badge must say what the filter says.
    expect(screen.getByText("Hindi")).toBeTruthy();
    expect(screen.queryByText("hindi")).toBeNull();
  });

  it("shows no language badge at all when the language is unknown", () => {
    show(richCourse({ language: null }));
    expect(screen.queryByText("Taught in")).toBeNull();
    for (const label of ["Hindi", "English", "Hinglish"])
      expect([label, screen.queryByText(label)]).toEqual([label, null]);
  });

  it("marks a Devanagari course title as Hindi for screen readers", () => {
    show(richCourse({ title: "कबीर की साखी" }));
    expect(screen.getByRole("heading", { name: "कबीर की साखी" }).getAttribute("lang")).toBe("hi");
  });

  it("leaves a Latin title under the document's own lang", () => {
    show(richCourse());
    expect(screen.getByRole("heading", { name: "Complete Kinematics" }).getAttribute("lang")).toBeNull();
  });

  it("renders a real link when `to` is given, and a button for legacy onOpen callers", () => {
    show(richCourse());
    expect(screen.getByRole("link", { name: "View course" })
      .getAttribute("href")).toBe("/course/1");

    const onOpen = vi.fn();
    const course = richCourse({ id: 3 });
    render(
      <MemoryRouter>
        <ThemeProvider>
          <PlaylistCard course={course} onOpen={onOpen} to={undefined} comparisonEnabled={false} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "View course" }));
    expect(onOpen).toHaveBeenCalledWith(course);
  });
});
