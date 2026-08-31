// The Chapter Cleared share card. Two things matter and both are guarded here:
// it must not appear until a chapter is genuinely finished, and the share text
// must carry the deep link that makes the share worth sending.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { chapterCompletion, chapterShareMessage, courseByline } from "./chapterCompletion.js";
import ChapterCleared from "./ChapterCleared.jsx";
import { ThemeProvider } from "./theme.jsx";

const lesson = (id, videoId, chapterId, name = "Rotational Motion") => ({
  id, videoId, chapter: chapterId === null ? null : { id: chapterId, name },
});

// Two lessons in chapter 27, one in chapter 31 — so "completed the course" and
// "completed the chapter" are distinguishable.
const LESSONS = [
  lesson(1, "vidA", 27),
  lesson(2, "vidB", 27),
  lesson(3, "vidC", 31, "Fluids"),
];

describe("chapterCompletion", () => {
  it("counts only the lessons in the chapter asked for", () => {
    expect(chapterCompletion(LESSONS, ["vidA", "vidC"], 27))
      .toMatchObject({ total: 2, done: 1, cleared: false });
  });

  it("clears only when every lesson in the chapter is finished", () => {
    expect(chapterCompletion(LESSONS, ["vidA", "vidB"], 27).cleared).toBe(true);
  });

  it("matches on YouTube video ids, never on database lesson ids", () => {
    // progress.js keys its positions map by videoId. If this ever matched on
    // lesson.id the card would simply never appear for anyone — a silent
    // failure no other test would catch.
    expect(chapterCompletion(LESSONS, [1, 2], 27).done).toBe(0);
  });

  it("returns null for an unknown or absent chapter", () => {
    expect(chapterCompletion(LESSONS, ["vidA"], 999)).toBeNull();
    expect(chapterCompletion(LESSONS, ["vidA"], null)).toBeNull();
    expect(chapterCompletion([], ["vidA"], 27)).toBeNull();
  });

  it("tolerates a numeric id against a string one", () => {
    expect(chapterCompletion(LESSONS, ["vidA", "vidB"], "27").cleared).toBe(true);
  });
});

describe("chapterShareMessage", () => {
  it("carries the count, the teacher and the link", () => {
    expect(chapterShareMessage({
      chapterName: "Rotational Motion",
      total: 14,
      byline: courseByline("Ashish Arora", "Physics Wallah"),
      url: "https://www.jeeneetard.com/course/374/chapter/27",
    })).toBe(
      "Cleared Rotational Motion — all 14 lectures, taught by Ashish Arora — Physics Wallah. "
      + "Free chapter-wise lectures: https://www.jeeneetard.com/course/374/chapter/27",
    );
  });

  it("drops the byline rather than naming an unknown teacher", () => {
    const text = chapterShareMessage({
      chapterName: "Fluids", total: 1, byline: courseByline(null, null), url: "https://x/c",
    });
    expect(text).toBe("Cleared Fluids — all 1 lecture. Free chapter-wise lectures: https://x/c");
    expect(text).not.toMatch(/taught by/);
  });
});

const show = (props) => render(
  <ThemeProvider>
    <ChapterCleared
      lessons={LESSONS}
      chapterId={27}
      courseId={374}
      teacher="Ashish Arora"
      institute="Physics Wallah"
      {...props}
    />
  </ThemeProvider>,
);

// The card now also WRITES: it is the only place the app learns that a chapter
// was finished. Isolate the store so that record cannot leak between tests or
// into another suite.
beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("<ChapterCleared> records the finish", () => {
  const revision = () => JSON.parse(localStorage.getItem("ll_revision_v1") ?? "null");

  it("writes one record naming the chapter, the course and the count", () => {
    show({ completedIds: ["vidA", "vidB"], courseTitle: "Physics Class 11", subject: "Physics" });
    const items = revision().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      courseId: 374, chapterId: 27, chapterName: "Rotational Motion",
      courseTitle: "Physics Class 11", subject: "Physics", totalLessons: 2, step: 0,
    });
    expect(Math.abs(items[0].clearedAt - Date.now())).toBeLessThan(2000);
  });

  it("writes nothing for a chapter that is not cleared", () => {
    show({ completedIds: ["vidA"] });
    expect(revision()).toBeNull();
  });

  it("does not move the finish date when the card renders again", () => {
    // The card is a derivation of stored positions, not an event: it renders
    // on EVERY later visit to a cleared chapter. If a re-render overwrote the
    // record, the chapter would restart its schedule each time and never come
    // due for revision at all.
    const first = show({ completedIds: ["vidA", "vidB"] });
    const clearedAt = revision().items[0].clearedAt;
    first.unmount();

    show({ completedIds: ["vidA", "vidB"] });
    expect(revision().items).toHaveLength(1);
    expect(revision().items[0].clearedAt).toBe(clearedAt);
  });
});

describe("<ChapterCleared>", () => {
  it("renders nothing at all until the chapter is cleared", () => {
    const { container } = show({ completedIds: ["vidA"] });
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for a chapter it cannot measure", () => {
    const { container } = show({ completedIds: ["vidA", "vidB"], chapterId: null });
    expect(container.innerHTML).toBe("");
  });

  it("celebrates the chapter, honestly counted", () => {
    show({ completedIds: ["vidA", "vidB"] });
    expect(screen.getByText("Chapter cleared")).toBeTruthy();
    expect(screen.getByText("Rotational Motion")).toBeTruthy();
    expect(screen.getByText("2/2 lectures")).toBeTruthy();
    expect(screen.getByText("Taught by Ashish Arora — Physics Wallah")).toBeTruthy();
  });

  it("does not read the chapter name and the count run together", () => {
    // A gap made only of margin is invisible to innerText and to a screen
    // reader: "Rotational Motion2/2 lectures".
    show({ completedIds: ["vidA", "vidB"] });
    expect(document.body.textContent).toMatch(/Rotational Motion 2\/2 lectures/);
  });
});

describe("<ChapterCleared> sharing", () => {
  const writeText = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    writeText.mockClear();
    // No navigator.share in this environment, so the clipboard branch runs —
    // which is also the desktop path in a real browser.
    vi.stubGlobal("navigator", { clipboard: { writeText } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("copies a message deep-linking to the chapter", async () => {
    show({ completedIds: ["vidA", "vidB"] });
    fireEvent.click(screen.getByRole("button", { name: /Share this/ }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0][0];
    // The link is the point of the share: it must reach the chapter, not the
    // homepage. That URL also renders the /api/og preview card.
    expect(text).toContain(`${window.location.origin}/course/374/chapter/27`);
    expect(text).toContain("Cleared Rotational Motion — all 2 lectures");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy();
  });
});
