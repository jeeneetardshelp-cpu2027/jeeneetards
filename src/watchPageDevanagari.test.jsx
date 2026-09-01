// Devanagari titles, spoken correctly on the watch page.
//
// index.html declares lang="en". That is right for the interface and wrong for
// the catalogue: real course, lesson and chapter names here are written in
// Devanagari, and under an English lang a screen reader either applies English
// phonetics to them or spells them out. lang.js explains the fix and its
// limits; these tests pin the CALL SITES, which is where the fix either
// happens or silently does not.
//
// The watch page matters most: its h1 is sr-only, so that heading exists for
// no reason other than to be spoken.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { ThemeProvider } from "./theme.jsx";
import { LessonList, VideoView } from "./MinimalUI.jsx";
import CourseOverview from "./CourseOverview.jsx";

// The real player is an iframe embed; all these tests need from it is the
// end-of-lesson callback that raises the up-next overlay.
vi.mock("./YouTubePlayer.jsx", () => ({
  default: ({ videoId, onEnded }) => (
    <button onClick={() => onEnded?.({ videoId })}>Finish video</button>
  ),
}));

const HINDI_COURSE = "कबीर की साखी";
const HINDI_LESSON = "गति के नियम";
const HINDI_CHAPTER = "गति";

const lesson = (over = {}) => ({
  id: 101,
  videoId: "video-one",
  title: HINDI_LESSON,
  position: 1,
  chapter: { id: 1, name: HINDI_CHAPTER, slug: "gati" },
  durationSeconds: 600,
  embeddingStatus: "allowed",
  ...over,
});

const lessons = [
  lesson(),
  lesson({
    id: 102, videoId: "video-two", title: "Lesson two", position: 2,
    chapter: { id: 2, name: "Thermodynamics", slug: "thermodynamics" },
  }),
];

const showWatch = (over = {}) => render(
  <MemoryRouter>
    <ThemeProvider>
      <VideoView
        course={{ id: 1, title: HINDI_COURSE, lectures: 2 }}
        videoId="video-one"
        videoTitle={HINDI_LESSON}
        lessons={lessons}
        activeLessonId={101}
        {...over}
      />
    </ThemeProvider>
  </MemoryRouter>,
);

const showLessons = () => render(
  <MemoryRouter>
    <ThemeProvider>
      <LessonList lessons={lessons} activeLessonId={101} onSelectLesson={() => {}} />
    </ThemeProvider>
  </MemoryRouter>,
);

describe("the watch page tags Devanagari for screen readers", () => {
  it("tags the sr-only h1 — the page's only h1, and audio-only by design", () => {
    const { container } = showWatch();
    const headings = container.querySelectorAll("h1");
    expect(headings.length).toBe(1);
    expect(headings[0].textContent).toBe(HINDI_COURSE);
    expect(headings[0].getAttribute("lang")).toBe("hi");
  });

  it("tags the visible lesson title", () => {
    showWatch();
    expect(screen.getByRole("heading", { name: HINDI_LESSON, level: 2 })
      .getAttribute("lang")).toBe("hi");
  });

  it("tags the up-next line when the next lesson's title is Devanagari", () => {
    showWatch({
      videoId: "video-two",
      videoTitle: "Lesson two",
      activeLessonId: 102,
      lessons: [lessons[1], lesson({ id: 103, videoId: "video-three", position: 3 })],
    });
    fireEvent.click(screen.getByRole("button", { name: "Finish video" }));
    const upNext = screen.getByText(/Up next: Lesson 3/);
    expect(upNext.getAttribute("lang")).toBe("hi");
    // The whole line is tagged, not a span inside it — splitting the text into
    // two nodes buys a listener nothing and breaks every text query on it.
    expect(upNext.textContent).toContain(HINDI_LESSON);
  });

  it("leaves a Latin course title under the document's own lang", () => {
    const { container } = showWatch({ course: { id: 2, title: "Complete Kinematics", lectures: 2 } });
    expect(container.querySelector("h1").getAttribute("lang")).toBeNull();
  });
});

describe("the lesson rail tags Devanagari", () => {
  it("tags a lesson title, and only the Devanagari one", () => {
    showLessons();
    expect(screen.getByText(HINDI_LESSON).getAttribute("lang")).toBe("hi");
    expect(screen.getByText("Lesson two").getAttribute("lang")).toBeNull();
  });

  it("tags the chapter heading between lessons", () => {
    showLessons();
    // The same chapter name is also an <option> in the filter above the list,
    // so ask for the heading specifically rather than "the one with this text".
    const heading = screen.getAllByText(HINDI_CHAPTER).find((el) => el.tagName === "P");
    expect(heading.getAttribute("lang")).toBe("hi");
  });

  it("tags the chapter names inside the filter dropdown", () => {
    showLessons();
    // The <option> is where a screen reader reads a chapter name when the
    // student opens the filter, so the tag has to be on the option itself.
    const options = screen.getAllByRole("option");
    const hindi = options.find((o) => o.textContent === HINDI_CHAPTER);
    const latin = options.find((o) => o.textContent === "Thermodynamics");
    expect(hindi.getAttribute("lang")).toBe("hi");
    expect(latin.getAttribute("lang")).toBeNull();
  });
});

describe("the course overview card tags Devanagari", () => {
  const show = (over = {}) => render(
    <MemoryRouter>
      <ThemeProvider>
        <CourseOverview
          course={{
            id: 1, title: HINDI_COURSE, subject: "Physics", lectures: 1,
            syllabus: [
              { id: 1, name: HINDI_CHAPTER, slug: "gati", subject: "Physics" },
              { id: 2, name: "Thermodynamics", slug: "thermodynamics", subject: "Physics" },
            ],
            ...over,
          }}
          lessons={[{ id: 101, videoId: "video-one", position: 1 }]}
          onStart={() => {}}
        />
      </ThemeProvider>
    </MemoryRouter>,
  );

  it("tags the course title", () => {
    show();
    expect(screen.getByRole("heading", { name: HINDI_COURSE }).getAttribute("lang")).toBe("hi");
  });

  it("tags each Devanagari chapter in the syllabus scope, and no other", () => {
    show();
    expect(screen.getByText(HINDI_CHAPTER).getAttribute("lang")).toBe("hi");
    expect(screen.getByText("Thermodynamics").getAttribute("lang")).toBeNull();
  });

  it("leaves a Latin course title alone", () => {
    show({ title: "Complete Kinematics" });
    expect(screen.getByRole("heading", { name: "Complete Kinematics" })
      .getAttribute("lang")).toBeNull();
  });
});
