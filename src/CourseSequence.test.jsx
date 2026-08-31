import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LessonList, LESSONS_PER_VIEW } from "./MinimalUI.jsx";
import { ThemeProvider } from "./theme.jsx";

const makeLessons = (count = 120) => Array.from({ length: count }, (_, index) => {
  const position = index + 1;
  const secondChapter = position > 60;
  return {
    id: position,
    videoId: `video-${position}`,
    title: `Lesson ${position}`,
    position,
    durationSeconds: 60,
    embeddingStatus: "embeddable",
    chapter: secondChapter
      ? { id: 2, name: "Laws of Motion" }
      : { id: 1, name: "Kinematics" },
  };
});

function renderList(props = {}) {
  const lessons = props.lessons ?? makeLessons();
  return render(
    <ThemeProvider>
      <LessonList
        lessons={lessons}
        activeLessonId={props.activeLessonId ?? 1}
        watchedIds={props.watchedIds ?? []}
        completedIds={props.completedIds ?? []}
        onSelectLesson={props.onSelectLesson ?? vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe("large course lesson sequence", () => {
  it("shows the lesson's YouTube thumbnail at the size-appropriate quality", () => {
    const lessons = makeLessons(1);
    lessons[0].videoId = "CBvaO-uDvs8";
    const { container } = renderList({ lessons });

    const image = container.querySelector("img");
    // mqdefault, not hqdefault: these rows draw at 80-96px, and the medium
    // rendition is a third of the bytes on a phone connection.
    expect(image?.getAttribute("src"))
      .toBe("https://img.youtube.com/vi/CBvaO-uDvs8/mqdefault.jpg");
    expect(image?.getAttribute("loading")).toBe("lazy");
  });

  it("keeps the rendered sequence bounded and pages through the full course", async () => {
    renderList();

    expect(LESSONS_PER_VIEW).toBe(50);
    expect(screen.getByText("Lesson 50")).toBeTruthy();
    expect(screen.queryByText("Lesson 51")).toBeNull();
    expect(screen.getByText("Showing 1–50 of 120")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
    await screen.findByText("Lesson 51");
    expect(screen.queryByText("Lesson 1")).toBeNull();
    expect(screen.getByText("Showing 51–100 of 120")).toBeTruthy();
  });

  it("searches the entire course, including lessons outside the current page", async () => {
    renderList();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search lessons in this course" }), {
      target: { value: "Lesson 117" },
    });

    expect(await screen.findByText("Lesson 117")).toBeTruthy();
    expect(screen.getByText("Showing 1–1 of 1")).toBeTruthy();
    expect(screen.queryByText("Lesson 1")).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Search lessons in this course" })).toBeTruthy();
  });

  it("explains when filters hide the playing lesson and can reveal it", async () => {
    const lessons = makeLessons();
    const view = renderList({ lessons, activeLessonId: 117 });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search lessons in this course" }), {
      target: { value: "Lesson 117" },
    });
    await screen.findByText("Lesson 117");

    view.rerender(
      <ThemeProvider>
        <LessonList
          lessons={lessons}
          activeLessonId={116}
          watchedIds={[]}
          onSelectLesson={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(await screen.findByText("The lesson playing now is hidden by your lesson filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show current lesson" }));
    await waitFor(() => expect(screen.getByText("Lesson 116")).toBeTruthy());
    const active = screen.getAllByRole("button")
      .find((button) => button.getAttribute("aria-current") === "step");
    expect(active?.textContent).toContain("Lesson 116");
  });

  it("opens on the page containing a resumed lesson", async () => {
    renderList({ activeLessonId: 117 });

    await waitFor(() => expect(screen.getByText("Page 3 of 3")).toBeTruthy());
    expect(screen.getByText("Lesson 117")).toBeTruthy();
    expect(screen.getByText("Showing 101–120 of 120")).toBeTruthy();
  });

  it("filters by real chapter metadata and watched state", async () => {
    renderList({ watchedIds: ["video-61"] });

    fireEvent.change(screen.getByRole("combobox", { name: "Filter lessons by chapter" }), {
      target: { value: "2" },
    });
    await waitFor(() => expect(screen.getByText("Showing 1–50 of 60")).toBeTruthy());
    expect(screen.getByText("Lesson 61")).toBeTruthy();
    expect(screen.queryByText("Lesson 1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Unwatched only" }));
    await waitFor(() => expect(screen.getByText("Showing 1–50 of 59")).toBeTruthy());
    expect(screen.queryByText("Lesson 61")).toBeNull();
    expect(screen.getByText("Lesson 62")).toBeTruthy();
  });

  it("shows a completed check only for finished lessons, not merely started ones", () => {
    // Lesson 2 finished, lesson 3 started-but-unfinished, lesson 4 untouched.
    // Lesson 1 is the active lesson, so it shows its number, not a state mark.
    renderList({ activeLessonId: 1, watchedIds: ["video-2", "video-3"], completedIds: ["video-2"] });

    // A completed lesson gets the check; a started-but-unfinished one gets the
    // honest "in progress" mark instead of falsely claiming done.
    expect(screen.getAllByRole("img", { name: "Completed" })).toHaveLength(1);
    expect(screen.getAllByRole("img", { name: "In progress" })).toHaveLength(1);
    // An untouched lesson shows its position number, no state mark.
    expect(screen.getByText("Lesson 4")).toBeTruthy();
  });

  it("offers a useful reset when no lesson matches", async () => {
    renderList();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search lessons in this course" }), {
      target: { value: "a title that is not present" },
    });

    expect(await screen.findByText("No lessons match these filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Lesson 1")).toBeTruthy();
  });
});
