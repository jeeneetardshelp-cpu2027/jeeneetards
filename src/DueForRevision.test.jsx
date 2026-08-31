// The "Worth a revision" band. What is guarded here is mostly what it must
// NOT do: appear when nothing is due, invent a chapter name, state a lecture
// count it does not have, claim to know what a student has forgotten, or keep
// refilling itself once the row has been dealt with.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import DueForRevision from "./DueForRevision.jsx";
import { ThemeProvider } from "./theme.jsx";

const KEY = "ll_revision_v1";
const DAY = 86400000;
const NOW = new Date(2026, 7, 31, 10, 0, 0);

const item = (over, extra = {}) => ({
  courseId: 374,
  chapterId: 27,
  chapterName: "Rotational Motion",
  courseTitle: "Physics Class 11",
  subject: "Physics",
  totalLessons: 14,
  // `over` days ago, so with a step-0 rung of 7 days anything over 7 is due.
  clearedAt: NOW.getTime() - over * DAY,
  step: 0,
  revisedAt: null,
  revisedVia: null,
  snoozedUntil: null,
  graduated: false,
  ...extra,
});

const seed = (items, pausedOn = null) =>
  localStorage.setItem(KEY, JSON.stringify({ pausedOn, items }));

const show = () => render(
  <ThemeProvider>
    <MemoryRouter initialEntries={["/"]}>
      <DueForRevision />
    </MemoryRouter>
  </ThemeProvider>,
);

const stored = () => JSON.parse(localStorage.getItem(KEY)).items;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("the band stays hidden unless it has something honest to say", () => {
  it("renders nothing with an empty store", () => {
    const { container } = show();
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders nothing for a chapter finished today", () => {
    seed([item(0)]);
    const { container } = show();
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders nothing rather than a chapter it cannot name", () => {
    seed([item(24, { chapterName: "" })]);
    const { container } = show();
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders nothing while paused for the day", () => {
    seed([item(24)], "2026-08-31");
    const { container } = show();
    expect(container.querySelector("section")).toBeNull();
  });
});

describe("what it says", () => {
  it("states the measured fact, with real spaces between the values", () => {
    seed([item(24)]);
    show();
    expect(screen.getByText("Rotational Motion")).toBeTruthy();
    // A gap made only of margin reads as "Cleared 24 days ago14 lectures".
    expect(document.body.textContent).toMatch(/Cleared 24 days ago · 14 lectures/);
    expect(document.body.textContent).toMatch(/Physics · Physics Class 11/);
  });

  it("says '1 lecture', not '1 lectures'", () => {
    // 672 of 1,217 (course, chapter) pairs hold exactly one lesson — 55% — so
    // this is the common case, not an edge case.
    seed([item(24, { totalLessons: 1 })]);
    show();
    expect(document.body.textContent).toMatch(/Cleared 24 days ago · 1 lecture(?!s)/);
  });

  it("omits the lecture count it does not have rather than guessing one", () => {
    seed([item(24, { totalLessons: null })]);
    show();
    expect(screen.getByText("Rotational Motion")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/lectures/);
  });

  it("says what the student told us, not what we inferred", () => {
    // Revised by their own assertion 30 days ago, at rung 21.
    seed([item(60, {
      step: 1, revisedAt: NOW.getTime() - 30 * DAY, revisedVia: "marked",
    })]);
    show();
    expect(document.body.textContent).toMatch(/Revised 30 days ago/);

    // A replay is only ever "last watched" — never asserted as a revision.
    localStorage.clear();
    seed([item(60, {
      step: 1, revisedAt: NOW.getTime() - 30 * DAY, revisedVia: "watched",
    })]);
    show();
    expect(document.body.textContent).toMatch(/Last watched 30 days ago/);
  });

  it("does not print the course title twice when it is just the chapter name", () => {
    // Many chapter-sized playlists are titled after the chapter, and
    // "Rotational Motion / Physics · Rotational Motion" reads as a bug.
    seed([item(24, { courseTitle: "Rotational Motion" })]);
    show();
    expect(document.body.textContent).not.toMatch(/Physics · Rotational Motion/);
    expect(document.body.textContent).toMatch(/Physics/);
  });

  it("never claims to know what the student has forgotten", () => {
    seed([item(80)]);
    show();
    expect(document.body.textContent)
      .toMatch(/Based on when you finished each chapter./);
    expect(document.body.textContent).toMatch(/This list is kept on this device only/);
    expect(document.body.textContent)
      .not.toMatch(/forgot|forget|overdue|due today|memory|retention|spaced repetition/i);
  });

  it("links to the chapter, with no resume position", () => {
    // No ?v=: a revision starts at the top of the chapter, not mid-lecture.
    seed([item(24)]);
    show();
    const link = screen.getByRole("link", { name: "Open Rotational Motion" });
    expect(link.getAttribute("href")).toBe("/course/374/chapter/27");
  });
});

describe("it is a nudge, not a backlog", () => {
  it("shows at most three chapters and never a total", () => {
    seed(Array.from({ length: 8 }, (_, i) => item(30 + i, {
      chapterId: 100 + i, chapterName: `Chapter ${100 + i}`, subject: `Subject ${i}`,
    })));
    show();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(document.body.textContent).not.toMatch(/8 chapters|and 5 more|overdue/i);
  });

  it("does not top the row back up when the tab is returned to", () => {
    // Re-reading the queue on visibilitychange refilled the row after the
    // student had dismissed cards: chapters they had never seen appeared
    // mid-visit, and because the row never reached empty the day never paused.
    // On a phone — dismiss, switch apps, come back — that loop is unbounded.
    seed([
      item(30, { chapterId: 27, chapterName: "Rotational Motion", subject: "Physics" }),
      item(29, { chapterId: 31, chapterName: "Fluids", subject: "Chemistry" }),
      item(28, { chapterId: 33, chapterName: "Waves", subject: "Maths" }),
      item(27, { chapterId: 35, chapterName: "Optics", subject: "Biology" }),
      item(26, { chapterId: 37, chapterName: "Ray Optics", subject: "Physics" }),
    ]);
    show();
    fireEvent.click(screen.getByRole("button", { name: /^Not now: Rotational Motion/ }));
    const remaining = screen.getAllByRole("listitem").length;

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(remaining);
    // Specifically: no chapter the student has not already seen.
    expect(screen.queryByText("Optics")).toBeNull();
    expect(screen.queryByText("Ray Optics")).toBeNull();
  });

  it("stops for the day even when the cards are dismissed in one batch", () => {
    // Found in a real browser, not here: clicking three cards inside one task
    // batches the updates, so every handler saw the SAME `rows` from one
    // render. The band was left holding a card and never paused the day.
    // fireEvent flushes between clicks and so cannot reproduce it — these
    // clicks are dispatched inside a single act().
    seed([
      item(30, { chapterId: 27, chapterName: "Rotational Motion", subject: "Physics" }),
      item(29, { chapterId: 31, chapterName: "Fluids", subject: "Chemistry" }),
      item(28, { chapterId: 33, chapterName: "Waves", subject: "Maths" }),
      item(27, { chapterId: 35, chapterName: "Optics", subject: "Biology" }),
    ]);
    const { container, unmount } = show();
    const buttons = screen.getAllByRole("button", { name: /^Not now/ });
    act(() => {
      for (const button of buttons) {
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });

    expect(container.querySelector("section")).toBeNull();
    expect(JSON.parse(localStorage.getItem(KEY)).pausedOn).toBe("2026-08-31");
    unmount();

    // A fourth chapter is still due, but the day is done.
    const second = show();
    expect(second.container.querySelector("section")).toBeNull();
  });

  it("stops for the day once the row has been dealt with", () => {
    // The treadmill guard: clearing what is on screen must not summon more.
    seed([
      item(30, { chapterId: 27, chapterName: "Rotational Motion", subject: "Physics" }),
      item(29, { chapterId: 31, chapterName: "Fluids", subject: "Chemistry" }),
      item(28, { chapterId: 33, chapterName: "Waves", subject: "Maths" }),
      item(27, { chapterId: 35, chapterName: "Optics", subject: "Biology" }),
    ]);
    const { unmount } = show();
    for (const name of screen.getAllByRole("button", { name: /^Not now/ })) {
      fireEvent.click(name);
    }
    unmount();

    const { container } = show();
    expect(container.querySelector("section")).toBeNull();
  });
});

describe("the actions write what actually happened", () => {
  it("'Mark revised' advances the ladder and records the student's assertion", () => {
    seed([item(24)]);
    show();
    fireEvent.click(screen.getByRole("button", { name: "Mark Rotational Motion revised" }));

    const [saved] = stored();
    expect(saved.step).toBe(1);
    expect(saved.revisedVia).toBe("marked");
    expect(saved.revisedAt).toBe(NOW.getTime());
    expect(screen.queryByText("Rotational Motion")).toBeNull();
  });

  it("'Not now' hides it without ever claiming it was revised", () => {
    seed([item(24)]);
    show();
    fireEvent.click(screen.getByRole("button", { name: "Not now: Rotational Motion" }));

    const [saved] = stored();
    // The whole point: a snooze must never let the site later say "Revised".
    expect(saved.revisedAt).toBeNull();
    expect(saved.revisedVia).toBeNull();
    expect(saved.step).toBe(0);
    expect(saved.snoozedUntil).toBe(NOW.getTime() + 7 * DAY);
  });
});
