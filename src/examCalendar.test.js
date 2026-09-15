// examCalendar: the date logic behind the countdown, and the honesty rules
// that stop it stating an estimate as fact, counting past a finished exam, or
// repeating "not announced yet" after anyone last checked.
import { describe, expect, it } from "vitest";
import {
  CHECK_EXPIRES_AFTER_DAYS,
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
  // Checked shortly before every date these fixtures count from, so the expiry
  // rule stays out of the way of the tests that are not about it.
  checkedOn: "2026-12-20",
};
const EXPECTED = { ...ANNOUNCED, slug: "test-expected", status: "expected", date: null };

/** The shipped calendar, re-checked on `iso`: for tests about ordering, not expiry. */
const checkedAt = (iso) => EXAM_CALENDAR.map((exam) => ({ ...exam, checkedOn: iso }));

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

  it("records when every entry was last checked, and no check is dated after its exam", () => {
    for (const exam of EXAM_CALENDAR) {
      expect(exam.checkedOn, exam.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // A check dated after the day the countdown counts to is a typo, most
      // likely a wrong year. Compared with that day rather than expectedFrom:
      // an announced exam keeps its old window, and re-checking it close to
      // the real date must not turn CI red.
      expect(Date.parse(`${exam.checkedOn}T00:00:00Z`) <= targetDay(exam), exam.slug).toBe(true);
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
  // Every case here uses entries checked shortly before its own date. The
  // shipped stamps move each time someone re-checks an exam, the one routine
  // edit examCalendar.js asks for, and a check dated after the clock no longer
  // counts, so a test about ordering must not read them.
  it("picks the soonest upcoming exam in a lane and skips finished ones", () => {
    // Well before everything: JEE's soonest is session 1.
    const jee = nextExam("jee", at("2026-09-01"), checkedAt("2026-08-25"));
    expect(jee.exam.slug).toBe("jee-main-2027-session-1");
    // After session 1's window opens, session 2 becomes the soonest.
    const later = nextExam("jee", at("2027-02-01"), checkedAt("2027-01-25"));
    expect(later.exam.slug).toBe("jee-main-2027-session-2");
  });

  it("returns null once a lane has no upcoming exam left", () => {
    expect(nextExam("jee", at("2030-01-01"), checkedAt("2029-12-25"))).toBeNull();
    expect(nextExam("not-a-goal", at("2026-09-01"), checkedAt("2026-08-25"))).toBeNull();
  });

  it("falls back to the soonest across all lanes with no goal", () => {
    expect(nextExam(null, at("2026-09-01"), checkedAt("2026-08-25")).exam.slug)
      .toBe("jee-main-2027-session-1");
  });
});

describe("labels and lookup", () => {
  it("qualifies a session but not a single-sitting exam", () => {
    expect(examLabel(findExam("jee-main-2027-session-1"))).toBe("JEE Main 2027 (Session 1)");
    expect(examLabel(findExam("neet-ug-2027"))).toBe("NEET UG 2027");
    expect(findExam("nope")).toBeNull();
  });
});

// The countdown read the UTC calendar day while targets are midnight UTC, so an
// Indian student between 00:00 and 05:30 IST saw a number one day too high.
// Every pre-existing case used T09:00Z — inside the safe window — so nothing
// covered the small hours this audience actually studies in.
describe("counts from the student's own calendar day", () => {
  const exam = {
    slug: "x", name: "X", status: "announced", date: "2027-01-20", goal: "jee",
    checkedOn: "2027-01-01",
  };

  it("uses the local date, not the UTC date, to decide 'today'", () => {
    // Build a moment whose LOCAL day is 2027-01-20 in whatever zone the runner
    // is in. On exam day the answer must be 0 regardless of the UTC offset.
    const localExamDay = new Date(2027, 0, 20, 1, 30, 0);
    expect(examCountdown(exam, localExamDay).days).toBe(0);
    // And the day before is exactly 1, not 0 or 2.
    const dayBefore = new Date(2027, 0, 19, 23, 0, 0);
    expect(examCountdown(exam, dayBefore).days).toBe(1);
  });
});

// "NTA has not announced dates yet" goes false the day the bulletin appears,
// and nothing in the file changes when it does. These pin the rule that a
// countdown nobody has re-checked disappears instead of repeating it.
describe("a countdown expires when nobody has re-checked it", () => {
  const checkedOn = "2026-11-01";
  const exam = { ...EXPECTED, checkedOn }; // window opens 2027-01-21
  // Local-time constructor: the same calendar-day convention examCountdown uses.
  const daysAfterCheck = (n) => new Date(2026, 10, 1 + n, 12, 0, 0);

  it("shows on the day of the check and on the last day the check is good for", () => {
    expect(examCountdown(exam, daysAfterCheck(0))).not.toBeNull();
    expect(examCountdown(exam, daysAfterCheck(CHECK_EXPIRES_AFTER_DAYS))).not.toBeNull();
  });

  it("disappears the day after the check expires", () => {
    expect(examCountdown(exam, daysAfterCheck(CHECK_EXPIRES_AFTER_DAYS + 1))).toBeNull();
  });

  it("expires an announced date too, because dates get moved", () => {
    const announced = { ...ANNOUNCED, checkedOn };
    expect(examCountdown(announced, daysAfterCheck(CHECK_EXPIRES_AFTER_DAYS))).not.toBeNull();
    expect(examCountdown(announced, daysAfterCheck(CHECK_EXPIRES_AFTER_DAYS + 1))).toBeNull();
  });

  it("never shows an entry with no usable record of being checked", () => {
    expect(examCountdown({ ...EXPECTED, checkedOn: undefined }, at("2027-01-01"))).toBeNull();
    expect(examCountdown({ ...EXPECTED, checkedOn: null }, at("2027-01-01"))).toBeNull();
    expect(examCountdown({ ...EXPECTED, checkedOn: "recently" }, at("2027-01-01"))).toBeNull();
  });

  it("lets nextExam fall through to an exam whose check is still good", () => {
    const stale = { ...EXPECTED, slug: "stale-but-sooner", checkedOn: "2026-06-01" };
    const fresh = { ...EXPECTED, slug: "fresh-but-later", expectedFrom: "2027-01-28", checkedOn };
    expect(nextExam("jee", daysAfterCheck(10), [stale, fresh]).exam.slug).toBe("fresh-but-later");
    expect(nextExam("jee", daysAfterCheck(10), [stale])).toBeNull();
  });

  it("keeps a check good for 45 days, stated in dates rather than the constant", () => {
    // Every other case moves with CHECK_EXPIRES_AFTER_DAYS, so any window from
    // 35 to 81 days left them all green. Checked 1 Nov: shown 16 Dec, gone 17 Dec.
    expect(examCountdown(exam, new Date(2026, 11, 16, 12))).not.toBeNull();
    expect(examCountdown(exam, new Date(2026, 11, 17, 12))).toBeNull();
  });

  it("does not count a check dated two or more days ahead as fresh", () => {
    // Nobody can check tomorrow, so a future stamp is a typo. Its age came out
    // negative, and a negative age passed the window: "2026-12-15" typed for
    // "2026-09-15" kept "not announced yet" up until the exam window opened.
    const typo = { ...EXPECTED, checkedOn: "2026-12-15" };
    expect(examCountdown(typo, new Date(2026, 8, 15, 12))).toBeNull();
    expect(examCountdown(typo, new Date(2026, 11, 13, 12))).toBeNull();
  });

  it("allows one day of slack, for a student whose calendar is behind India's", () => {
    // A check stamped in IST can ship while a student west of India is still on
    // the previous day. Two days ahead is not a time zone.
    expect(examCountdown(exam, daysAfterCheck(-1))).not.toBeNull();
    expect(examCountdown(exam, daysAfterCheck(-2))).toBeNull();
  });

  it("expires every shipped entry the day after its own check runs out", () => {
    for (const shipped of EXAM_CALENDAR) {
      const [y, m, d] = shipped.checkedOn.split("-").map(Number);
      expect(examCountdown(shipped, new Date(y, m - 1, d, 12)), shipped.slug).not.toBeNull();
      expect(
        examCountdown(shipped, new Date(y, m - 1, d + CHECK_EXPIRES_AFTER_DAYS + 1, 12)),
        shipped.slug,
      ).toBeNull();
    }
  });
});
