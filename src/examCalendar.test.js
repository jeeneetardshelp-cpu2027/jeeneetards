// examCalendar: the date logic behind the countdown, and the honesty rules
// that stop it stating an estimate as fact or counting past a finished exam.
import { describe, expect, it } from "vitest";
import {
  EXAM_CALENDAR,
  examCountdown,
  examLabel,
  findExam,
  nextExam,
  targetDay,
} from "./examCalendar.js";

const at = (iso) => new Date(`${iso}T09:00:00Z`);

const ANNOUNCED = {
  slug: "test-announced", name: "Test Exam 2027", qualifier: null, goal: "jee",
  status: "announced", date: "2027-01-24",
  expectedFrom: "2027-01-21", expectedTo: "2027-01-31",
  expectedLabel: "late January 2027", authority: "NTA", officialUrl: "https://example.invalid/",
};
const EXPECTED = { ...ANNOUNCED, slug: "test-expected", status: "expected", date: null };

describe("the shipped calendar is honest by construction", () => {
  it("never ships a precise date unless the exam is marked announced", () => {
    for (const exam of EXAM_CALENDAR) {
      if (exam.status !== "announced") {
        expect(exam.date, `${exam.slug} carries a date while only expected`).toBeNull();
      } else {
        expect(exam.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("gives every exam an authority and an official link to check", () => {
    for (const exam of EXAM_CALENDAR) {
      expect(exam.authority, exam.slug).toBeTruthy();
      expect(exam.officialUrl, exam.slug).toMatch(/^https:\/\//);
      expect(exam.expectedFrom, exam.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("examCountdown", () => {
  it("counts exact days to an announced date and says so", () => {
    const c = examCountdown(ANNOUNCED, at("2027-01-01"));
    expect(c).toMatchObject({ days: 23, approximate: false });
    expect(c.detail).toContain("2027-01-24");
    expect(c.detail).not.toMatch(/not announced/i);
  });

  it("marks an expected exam approximate and names the missing announcement", () => {
    const c = examCountdown(EXPECTED, at("2027-01-01"));
    expect(c).toMatchObject({ days: 20, approximate: true });
    expect(c.detail).toContain("late January 2027");
    expect(c.detail).toMatch(/has not announced dates yet/i);
  });

  it("counts to the window START while expected, and the real date once announced", () => {
    expect(targetDay(EXPECTED)).toBe(Date.parse("2027-01-21T00:00:00Z"));
    expect(targetDay(ANNOUNCED)).toBe(Date.parse("2027-01-24T00:00:00Z"));
  });

  it("reads zero on exam day, never a negative number afterwards", () => {
    expect(examCountdown(ANNOUNCED, at("2027-01-24")).days).toBe(0);
    expect(examCountdown(ANNOUNCED, at("2027-01-25"))).toBeNull();
    expect(examCountdown(ANNOUNCED, at("2030-01-01"))).toBeNull();
  });

  it("returns null rather than guessing when a date is missing or malformed", () => {
    expect(examCountdown(null)).toBeNull();
    expect(examCountdown({ ...EXPECTED, expectedFrom: "someday" })).toBeNull();
    expect(examCountdown({ ...ANNOUNCED, date: "24-01-2027" })).toBeNull();
  });
});

describe("nextExam", () => {
  it("picks the soonest upcoming exam in a lane and skips finished ones", () => {
    // Well before everything: JEE's soonest is session 1.
    const jee = nextExam("jee", at("2026-09-01"));
    expect(jee.exam.slug).toBe("jee-main-2027-session-1");
    // After session 1's window opens, session 2 becomes the soonest.
    const later = nextExam("jee", at("2027-02-01"));
    expect(later.exam.slug).toBe("jee-main-2027-session-2");
  });

  it("returns null once a lane has no upcoming exam left", () => {
    expect(nextExam("jee", at("2030-01-01"))).toBeNull();
    expect(nextExam("not-a-goal", at("2026-09-01"))).toBeNull();
  });

  it("falls back to the soonest across all lanes with no goal", () => {
    expect(nextExam(null, at("2026-09-01")).exam.slug).toBe("jee-main-2027-session-1");
  });
});

describe("labels and lookup", () => {
  it("qualifies a session but not a single-sitting exam", () => {
    expect(examLabel(findExam("jee-main-2027-session-1"))).toBe("JEE Main 2027 (Session 1)");
    expect(examLabel(findExam("neet-ug-2027"))).toBe("NEET UG 2027");
    expect(findExam("nope")).toBeNull();
  });
});
