// PrepStreak band: it hides itself before a student has watched anything,
// shows their own number without comparison or guilt, counts today honestly
// from real play timestamps, and lets the goal be set.
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme.jsx";
import PrepStreak, { streakMessage } from "./PrepStreak.jsx";

const STREAK_KEY = "ll_streak_v1";
const PROGRESS_KEY = "ll_progress_v1";

const renderBand = () => render(<ThemeProvider><PrepStreak /></ThemeProvider>);

/** A progress store whose lesson touches land on `date`. */
function seedProgress(date, lessons) {
  const at = date.getTime();
  const positions = {};
  for (let i = 0; i < lessons; i += 1) positions[`vid${i}0000000`] = { t: 12, d: 600, at };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({
    1: { playlistId: 1, watched: [], updatedAt: at, positions },
  }));
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 27, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
});

describe("PrepStreak", () => {
  it("renders nothing before the student has ever watched a lesson", () => {
    const { container } = renderBand();
    expect(container.querySelector("section")).toBeNull();
  });

  it("shows the student's own streak and today's progress", () => {
    localStorage.setItem(STREAK_KEY, JSON.stringify({
      days: ["2026-08-25", "2026-08-26", "2026-08-27"], goal: 2,
    }));
    seedProgress(new Date(2026, 7, 27, 9, 0, 0), 1);
    renderBand();

    expect(screen.getByRole("heading", { name: /3\s+days in a row/ })).toBeTruthy();
    expect(screen.getByText("Today: 1 of 2")).toBeTruthy();
    expect(screen.getByText("3/7 days this week")).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuetext")).toBe("1 of 2 lessons today");
    expect(bar.getAttribute("aria-valuemax")).toBe("2");
  });

  it("counts only lessons played TODAY toward the ring", () => {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ days: ["2026-08-20"], goal: 2 }));
    seedProgress(new Date(2026, 7, 20, 9, 0, 0), 3); // a week ago
    renderBand();
    expect(screen.getByText("Today: 0 of 2")).toBeTruthy();
  });

  it("lets the student choose their own daily goal, and remembers it", () => {
    localStorage.setItem(STREAK_KEY, JSON.stringify({ days: ["2026-08-27"], goal: 2 }));
    seedProgress(new Date(2026, 7, 27, 9, 0, 0), 1);
    renderBand();

    fireEvent.click(screen.getByRole("button", { name: "1 lesson a day" }));
    expect(screen.getByText("Today: 1 of 1")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STREAK_KEY)).goal).toBe(1);
    expect(screen.getByRole("button", { name: "1 lesson a day" }).getAttribute("aria-pressed"))
      .toBe("true");
  });

  it("still shows the band on a broken streak, without shaming it", () => {
    // Studied a week ago only: current 0, but there IS history.
    localStorage.setItem(STREAK_KEY, JSON.stringify({ days: ["2026-08-20"], goal: 2 }));
    renderBand();
    expect(screen.getByRole("heading", { name: /0\s+days in a row/ })).toBeTruthy();
    const text = screen.getByRole("heading", { name: /days in a row/ })
      .closest("section").textContent;
    expect(text).toMatch(/start a streak/i);
    expect(text).not.toMatch(/lost|broke|failed|missed/i);
  });
});

describe("streakMessage", () => {
  it("encourages, and never reprimands", () => {
    expect(streakMessage({ current: 0, studiedToday: false, done: false, goal: 2 }))
      .toMatch(/start a streak/i);
    expect(streakMessage({ current: 4, studiedToday: false, done: false, goal: 2 }))
      .toMatch(/keep the streak/i);
    expect(streakMessage({ current: 4, studiedToday: true, done: false, goal: 2 }))
      .toMatch(/keeps it going/i);
    expect(streakMessage({ current: 4, studiedToday: true, done: true, goal: 2 }))
      .toBe("Goal met today.");
    for (const args of [
      { current: 0, studiedToday: false, done: false, goal: 2 },
      { current: 9, studiedToday: true, done: true, goal: 3 },
    ]) {
      expect(streakMessage(args)).not.toMatch(/lost|failed|broke|don't|shouldn't/i);
    }
  });
});
