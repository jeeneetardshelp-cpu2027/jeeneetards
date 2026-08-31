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
