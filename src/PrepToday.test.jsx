// PrepToday band: continue-watching, streak and countdown merged into one
// compact section. The guarantees the three old bands carried move here:
//  - a brand-new visitor with no data sees NOTHING personal at all;
//  - the countdown's provenance line always accompanies the number, the share
//    text carries the not-announced caveat, and a passed exam disappears
//    rather than counting negative;
//  - the streak never shames, never denies a study day it cannot see, and the
//    goal stays the student's to set;
//  - the chosen exam lane persists (ll_exam_lane_v1) and the band reopens on it.
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme.jsx";
import PrepToday, { shareMessage, streakMessage, streakUncounted } from "./PrepToday.jsx";
import { findExam, examCountdown } from "./examCalendar.js";

const STREAK_KEY = "ll_streak_v1";
const PROGRESS_KEY = "ll_progress_v1";
const LANE_KEY = "ll_exam_lane_v1";

const ENTRY = {
  playlistId: 374, chapterId: 27, courseTitle: "Rotational Motion",
  lastVideoId: "abcdEFGH123", lastVideoTitle: "Rotational Motion — L1",
  lastPosition: 3, totalLessons: 12, updatedAt: 1_000_000,
};

const renderBand = (entries = []) => render(
  <ThemeProvider>
    <MemoryRouter>
      <PrepToday entries={entries} />
    </MemoryRouter>
  </ThemeProvider>,
);

/** A progress store whose lesson touches land on `date`. */
function seedProgress(date, lessons) {
  const at = date.getTime();
  const positions = {};
  for (let i = 0; i < lessons; i += 1) positions[`vid${i}0000000`] = { t: 12, d: 600, at };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({
    1: { playlistId: 1, watched: [], updatedAt: at, positions },
  }));
}

function seedStreak(days, goal = 2) {
  localStorage.setItem(STREAK_KEY, JSON.stringify({ days, goal }));
}

beforeEach(() => {
  localStorage.clear();
  // Fixed "today" well before the seeded 2027 exams, so the countdown has
  // content. Local-time constructor, matching dayKey()'s local-day convention.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 1, 10, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PrepToday", () => {
  it("renders nothing at all for a brand-new visitor, upcoming exams or not", () => {
    const { container } = renderBand([]);
    expect(container.querySelector("section")).toBeNull();
    // Not even the countdown: with no data of their own, a first-time visitor
    // goes straight to the exam grid.
    expect(screen.queryByText(/to JEE Main/)).toBeNull();
  });

  it("shows streak, goal, countdown and the resume card in ONE section", () => {
    seedStreak(["2026-08-30", "2026-08-31", "2026-09-01"], 2);
    seedProgress(new Date(2026, 8, 1, 9, 0, 0), 1);
    const { container } = renderBand([ENTRY]);

    // One band where there used to be three stacked sections.
    expect(container.querySelectorAll("section").length).toBe(1);
    expect(screen.getByRole("heading", { name: "Your prep today" })).toBeTruthy();

    // Streak + goal, as before.
    expect(screen.getByText("days in a row")).toBeTruthy();
    expect(screen.getByText("Today: 1 of 2")).toBeTruthy();
    expect(screen.getByText("3/7 days this week")).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuetext")).toBe("1 of 2 lessons today");
    expect(bar.getAttribute("aria-valuemax")).toBe("2");

    // Countdown with, always, its provenance.
    expect(screen.getByText("about")).toBeTruthy();
    expect(screen.getByText(/to JEE Main 2027 \(Session 1\)/)).toBeTruthy();
    expect(screen.getByText(/NTA has not announced dates yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Official NTA site/ }).getAttribute("href"))
      .toBe("https://jeemain.nta.nic.in/");

    // The resume card keeps its link and its lesson context.
    expect(screen.getByText("Continue watching")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Rotational Motion/ });
    expect(link.getAttribute("href")).toBe("/course/374/chapter/27?v=abcdEFGH123");
    expect(link.textContent).toMatch(/lesson 3 of 12/);
  });

  it("keeps every continue-watching entry reachable, top one as the primary card", () => {
    seedStreak(["2026-09-01"], 2);
    renderBand([
      ENTRY,
      { playlistId: 55, chapterId: 2, courseTitle: "Thermodynamics",
        lastVideoId: "zzzzZZZZ999", lastVideoTitle: "Heat — L4", updatedAt: 2 },
    ]);
    expect(screen.getByRole("link", { name: /Rotational Motion/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Heat — L4/ }).getAttribute("href"))
      .toBe("/course/55/chapter/2?v=zzzzZZZZ999");
  });

  it("switches lane when another exam is chosen, and remembers it", () => {
    seedStreak(["2026-09-01"], 2);
    renderBand();

    fireEvent.click(screen.getByRole("button", { name: "NEET" }));
    expect(screen.getByText(/to NEET UG 2027/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "NEET" }).getAttribute("aria-pressed")).toBe("true");
    // The choice persists for the next visit — and for the exam grid's order.
    expect(localStorage.getItem(LANE_KEY)).toBe("neet");
  });

  it("opens on the remembered lane instead of asking again", () => {
    localStorage.setItem(LANE_KEY, "school");
    seedStreak(["2026-09-01"], 2);
    renderBand();
    expect(screen.getByText(/to CBSE Class 12 boards 2027/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Boards" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("falls back to the default lane when the stored value is garbage", () => {
    localStorage.setItem(LANE_KEY, "olympiad");
    seedStreak(["2026-09-01"], 2);
    renderBand();
    expect(screen.getByText(/to JEE Main 2027 \(Session 1\)/)).toBeTruthy();
  });

  it("copies a share message carrying the exam and a link home", () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    seedStreak(["2026-09-01"], 2);
    renderBand();

    // writeText is invoked synchronously inside the click handler (the await
    // is on its result), so no waitFor — which deadlocks under fake timers.
    fireEvent.click(screen.getByRole("button", { name: /Share countdown/ }));
    expect(writeText).toHaveBeenCalled();
    const text = writeText.mock.calls[0][0];
    expect(text).toContain("JEE Main 2027 (Session 1)");
    expect(text).toMatch(/^About \d+ days to /);
    expect(text).toContain("localhost");
  });

  it("lets the student choose their own daily goal, and remembers it", () => {
    seedStreak(["2026-09-01"], 2);
    seedProgress(new Date(2026, 8, 1, 9, 0, 0), 1);
    renderBand();

    fireEvent.click(screen.getByRole("button", { name: "1 lesson a day" }));
    expect(screen.getByText("Today: 1 of 1")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STREAK_KEY)).goal).toBe(1);
    expect(screen.getByRole("button", { name: "1 lesson a day" }).getAttribute("aria-pressed"))
      .toBe("true");
  });

  it("still shows the band on a broken streak, without shaming it", () => {
    // Studied a week ago only: current 0, but there IS history.
    seedStreak(["2026-08-25"], 2);
    const { container } = renderBand();
    const text = container.querySelector("section").textContent;
    expect(text).toMatch(/0\s+days in a row/);
    expect(text).toMatch(/start a streak/i);
    expect(text).not.toMatch(/lost|broke|failed|missed/i);
  });

  it("drops only the countdown once every seeded exam has passed", () => {
    vi.setSystemTime(new Date(2030, 0, 1, 10, 0, 0));
    seedStreak(["2029-12-31", "2030-01-01"], 2);
    const { container } = renderBand();
    // The streak still has an audience; a negative countdown does not.
    expect(container.querySelector("section")).not.toBeNull();
    expect(screen.getByText("days in a row")).toBeTruthy();
    expect(screen.queryByText(/to JEE Main/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Share countdown/ })).toBeNull();
  });
});

// The streak store is device-local and cleared on sign-out (deliberate — shared
// school machines), but watch progress IS restored from the server on the next
// sign-in. So the band could assert "0 days in a row" and "Watch one lesson to
// start a streak" directly beside "Today: 1 of 2" — telling a student who
// demonstrably studied today that they had not.
describe("does not deny a study day it cannot see", () => {
  it("says what it knows instead of claiming a zero streak", () => {
    // No streak record at all (as after a sign-out) but real play data today.
    seedProgress(new Date(2026, 8, 1, 9, 0, 0), 1);
    renderBand();

    expect(screen.queryByText("days in a row")).toBeNull();
    expect(screen.queryByText(/Watch one lesson to start a streak/)).toBeNull();
    // The half it CAN verify is still shown, and the gap is explained.
    expect(screen.getByText("Today's progress")).toBeTruthy();
    expect(screen.getByText("Today: 1 of 2")).toBeTruthy();
    expect(screen.getByText(/kept on the device you watch on/)).toBeTruthy();
  });

  it("still shows a real streak normally", () => {
    seedStreak(["2026-08-31", "2026-09-01"], 2);
    seedProgress(new Date(2026, 8, 1, 9, 0, 0), 1);
    const { container } = renderBand();
    expect(container.querySelector("section").textContent).toMatch(/2\s+days in a row/);
    expect(screen.queryByText(/kept on the device you watch on/)).toBeNull();
  });

  it("streakUncounted only fires when play data and the streak store disagree", () => {
    expect(streakUncounted({ current: 0, studiedToday: false, studiedTodayCount: 1 })).toBe(true);
    expect(streakUncounted({ current: 0, studiedToday: false, studiedTodayCount: 0 })).toBe(false);
    expect(streakUncounted({ current: 3, studiedToday: false, studiedTodayCount: 1 })).toBe(false);
    expect(streakUncounted({ current: 0, studiedToday: true, studiedTodayCount: 1 })).toBe(false);
  });
});

describe("shareMessage", () => {
  const exam = findExam("neet-ug-2027");

  it("carries the not-announced caveat with the number", () => {
    const text = shareMessage(exam, examCountdown(exam, new Date("2026-09-01T09:00:00Z")), "https://x.test");
    // The on-page band prints "not announced yet". A number shared into a batch
    // group without it is a guess wearing the clothes of a fact.
    expect(text).toMatch(/has not announced dates yet/);
    expect(text).toContain(exam.expectedLabel);
  });

  it("adds no caveat to an announced exam", () => {
    const announced = { ...exam, status: "announced", date: "2027-05-02" };
    const text = shareMessage(announced, examCountdown(announced, new Date("2027-05-01T09:00:00Z")), "https://x.test");
    expect(text).not.toMatch(/has not announced dates yet/);
  });

  it("marks an approximate count and never claims precision it lacks", () => {
    const text = shareMessage(exam, examCountdown(exam, new Date("2026-09-01T09:00:00Z")), "https://x.test");
    expect(text).toMatch(/^About \d+ days to NEET UG 2027\./);
    expect(text).toContain("https://x.test/");
  });

  it("drops the hedge for an announced exam and handles exam day", () => {
    const announced = { ...exam, status: "announced", date: "2027-05-02" };
    const text = shareMessage(announced, examCountdown(announced, new Date("2027-05-01T09:00:00Z")), "https://x.test");
    expect(text).toMatch(/^1 day to /);
    expect(text).not.toMatch(/^About/);
    const today = shareMessage(announced, examCountdown(announced, new Date("2027-05-02T09:00:00Z")), "https://x.test");
    expect(today).toMatch(/^Today to /);
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
