// streak.js — the day arithmetic behind the flame, and the rules that keep it
// honest: no "freeze" that counts a missed day as studied, a streak alive
// through today until a whole day is lost, and a store that survives garbage.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearStreak,
  dayKey,
  getDailyGoal,
  goalMetShownToday,
  markGoalMetShown,
  mergeStudyDays,
  recordStudyDay,
  setDailyGoal,
  streakStats,
} from "./streak.js";

const KEY = "ll_streak_v1";
const at = (iso) => new Date(`${iso}T10:00:00`);
const seed = (days, goal = 2) =>
  localStorage.setItem(KEY, JSON.stringify({ days, goal }));

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("dayKey", () => {
  it("uses the student's LOCAL calendar day, not UTC", () => {
    // 00:30 local on the 5th is still the 5th, whatever UTC thinks.
    expect(dayKey(new Date(2026, 7, 5, 0, 30))).toBe("2026-08-05");
    expect(dayKey(new Date(2026, 7, 5, 23, 45))).toBe("2026-08-05");
  });
});

describe("recordStudyDay", () => {
  it("records today once, however many lessons are played", () => {
    recordStudyDay(at("2026-08-27"));
    recordStudyDay(at("2026-08-27"));
    recordStudyDay(at("2026-08-27"));
    expect(JSON.parse(localStorage.getItem(KEY)).days).toEqual(["2026-08-27"]);
  });

  it("survives corrupt storage instead of throwing at the student", () => {
    localStorage.setItem(KEY, "{not json");
    expect(() => recordStudyDay(at("2026-08-27"))).not.toThrow();
    expect(streakStats(at("2026-08-27")).current).toBe(1);
  });
});

describe("streakStats", () => {
  it("counts consecutive days ending today", () => {
    seed(["2026-08-25", "2026-08-26", "2026-08-27"]);
    expect(streakStats(at("2026-08-27"))).toMatchObject({
      current: 3, studiedToday: true,
    });
  });

  it("keeps the streak alive through today until a WHOLE day is missed", () => {
    seed(["2026-08-25", "2026-08-26"]);
    // Morning of the 27th, nothing watched yet: yesterday still counts.
    expect(streakStats(at("2026-08-27"))).toMatchObject({
      current: 2, studiedToday: false,
    });
    // A full day later, the 27th was genuinely missed.
    expect(streakStats(at("2026-08-28")).current).toBe(0);
  });

  it("never counts a missed day as studied — no hidden freeze", () => {
    // Studied Mon, skipped Tue, studied Wed: Wednesday's streak is 1, not 3.
    seed(["2026-08-24", "2026-08-26"]);
    expect(streakStats(at("2026-08-26")).current).toBe(1);
  });

  it("remembers the longest run even after the current one breaks", () => {
    seed(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-20"]);
    const stats = streakStats(at("2026-08-20"));
    expect(stats.current).toBe(1);
    expect(stats.longest).toBe(4);
  });

  it("counts the last seven calendar days for context", () => {
    seed(["2026-08-21", "2026-08-24", "2026-08-27"]);
    expect(streakStats(at("2026-08-27")).thisWeek).toBe(3);
    // The 21st drops out of the window a day later.
    expect(streakStats(at("2026-08-28")).thisWeek).toBe(2);
  });

  it("reads zero on a device that has never studied", () => {
    expect(streakStats(at("2026-08-27"))).toMatchObject({
      current: 0, longest: 0, studiedToday: false, thisWeek: 0,
    });
  });
});

describe("daily goal", () => {
  it("defaults to two lessons and accepts only 1-3", () => {
    expect(getDailyGoal()).toBe(2);
    expect(setDailyGoal(3)).toBe(3);
    expect(getDailyGoal()).toBe(3);
    expect(setDailyGoal(9)).toBe(3);
    expect(setDailyGoal(0)).toBe(3);
  });

  it("keeps the goal when a study day is recorded", () => {
    setDailyGoal(1);
    recordStudyDay(at("2026-08-27"));
    expect(getDailyGoal()).toBe(1);
  });
});

describe("mergeStudyDays (the sign-in union)", () => {
  it("adds server days without removing anything this device already knows", () => {
    seed(["2026-08-26", "2026-08-27"]);
    const added = mergeStudyDays(["2026-08-24", "2026-08-25", "2026-08-26"]);
    expect(added).toBe(2);
    expect(JSON.parse(localStorage.getItem(KEY)).days).toEqual([
      "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27",
    ]);
    // The union is what the streak arithmetic now reads: four days in a row.
    expect(streakStats(at("2026-08-27")).current).toBe(4);
  });

  it("restores a streak onto an empty store (the post-sign-out case)", () => {
    // Sign-out wiped ll_streak_v1; the pull brings the server copy back.
    expect(mergeStudyDays(["2026-08-25", "2026-08-26", "2026-08-27"])).toBe(3);
    expect(streakStats(at("2026-08-27")).current).toBe(3);
  });

  it("keeps the student's goal setting through a merge", () => {
    seed(["2026-08-27"], 3);
    mergeStudyDays(["2026-08-26"]);
    expect(getDailyGoal()).toBe(3);
  });

  it("is idempotent and reports zero when nothing is new", () => {
    seed(["2026-08-26", "2026-08-27"]);
    expect(mergeStudyDays(["2026-08-26", "2026-08-27"])).toBe(0);
    expect(mergeStudyDays([])).toBe(0);
    expect(JSON.parse(localStorage.getItem(KEY)).days).toEqual([
      "2026-08-26", "2026-08-27",
    ]);
  });

  it("drops garbage instead of storing it", () => {
    seed(["2026-08-27"]);
    expect(mergeStudyDays(["not-a-day", null, 42, "2026-08-26"])).toBe(1);
    expect(JSON.parse(localStorage.getItem(KEY)).days).toEqual([
      "2026-08-26", "2026-08-27",
    ]);
    expect(mergeStudyDays("not-an-array")).toBe(0);
  });
});

describe("goal-met moment memory", () => {
  it("starts unshown, remembers today once marked, and resets on a new day", () => {
    expect(goalMetShownToday(at("2026-08-27"))).toBe(false);
    markGoalMetShown(at("2026-08-27"));
    expect(goalMetShownToday(at("2026-08-27"))).toBe(true);
    // The next calendar day earns its own moment.
    expect(goalMetShownToday(at("2026-08-28"))).toBe(false);
  });
});

describe("clearStreak", () => {
  it("wipes the shared-device store", () => {
    seed(["2026-08-27"]);
    clearStreak();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(streakStats(at("2026-08-27")).current).toBe(0);
  });

  it("also forgets the goal-moment date — it belongs to the same student", () => {
    markGoalMetShown(at("2026-08-27"));
    clearStreak();
    expect(goalMetShownToday(at("2026-08-27"))).toBe(false);
  });
});
