// The revision store. Two classes of bug matter here and both are pinned
// below: a schedule that silently never fires, and a store that claims a
// revision the student never did.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REVISION_LADDER, STALE_AFTER_DAYS,
  clearRevision, dueAt, dueForRevision, markChapterRevised, pauseRevisionForToday,
  rankDueChapters, recordChapterCleared, recordChapterWatched, revisionAge, snoozeChapter,
} from "./revision.js";

const KEY = "ll_revision_v1";
const DAY = 86400000;

// Local dates throughout, never UTC ISO strings: a student in IST is a day
// ahead of UTC for five and a half hours every evening, and UTC arithmetic
// makes "cleared 6 days ago" read as 7 across most of the Indian study night.
const CLEARED = new Date(2026, 7, 1, 21, 30, 0); // 2026-08-01 21:30 local

const CHAPTER = {
  courseId: 374,
  chapterId: 27,
  chapterName: "Rotational Motion",
  courseTitle: "Physics Class 11",
  subject: "Physics",
  totalLessons: 14,
};

const readStore = () => JSON.parse(localStorage.getItem(KEY) ?? "null");
const at = (days, hours = 0) => new Date(CLEARED.getTime() + days * DAY + hours * 3600000);

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(CLEARED);
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("recordChapterCleared", () => {
  it("writes one record carrying the finish date", () => {
    const item = recordChapterCleared(CHAPTER, CLEARED);
    expect(item.id).toBe("374:27");
    expect(item.clearedAt).toBe(CLEARED.getTime());
    expect(item.step).toBe(0);
    expect(readStore().items).toHaveLength(1);
  });

  it("is create-if-absent, so re-rendering the cleared card cannot reset the clock", () => {
    // THE load-bearing invariant. ChapterCleared is a derivation of stored
    // positions, not an event: it renders again on every later visit. If this
    // overwrote, clearedAt would move to today forever and the chapter would
    // never come due.
    recordChapterCleared(CHAPTER, CLEARED);
    expect(recordChapterCleared(CHAPTER, at(30))).toBeNull();

    const stored = readStore().items;
    expect(stored).toHaveLength(1);
    expect(stored[0].clearedAt).toBe(CLEARED.getTime());
  });

  it("dates the record from the watch record, not from the clock", () => {
    // The card fires the first time the app OBSERVES a chapter complete. On a
    // second device, or after a sign-out and sign-in, the server sync rebuilds
    // the completed set weeks later — and stamping "now" would tell a student
    // they finished in August something they finished in June.
    const june = new Date(2026, 5, 3, 18, 0, 0).getTime();
    const item = recordChapterCleared({ ...CHAPTER, clearedAt: june }, at(60));
    expect(item.clearedAt).toBe(june);
  });

  it("does not restart the clock for a chapter finished long ago", () => {
    // The consequence of dating honestly, and the right one: a chapter
    // finished in June and only observed in September is 112 days past its
    // first rung, so it is too stale to call revision and stays silent. The old
    // behaviour stamped "now" and would have nagged in a week as though the
    // student had just finished it.
    const june = new Date(2026, 5, 3, 18, 0, 0).getTime();
    recordChapterCleared({ ...CHAPTER, clearedAt: june }, at(60));
    expect(dueForRevision(3, at(60))).toHaveLength(0);
  });

  it("still surfaces a chapter observed late but inside the window", () => {
    // Finished 30 days ago, first observed today: due now, dated truthfully.
    const finished = at(-30).getTime();
    recordChapterCleared({ ...CHAPTER, clearedAt: finished }, CLEARED);
    const [due] = dueForRevision(3, CLEARED);
    expect(due.clearedAt).toBe(finished);
    expect(revisionAge(due, CLEARED).days).toBe(30);
  });

  it("refuses a date that cannot be evidence", () => {
    // A future timestamp is a broken clock, and null is simply "unknown";
    // both fall back to now rather than being trusted.
    for (const bad of [at(400).getTime(), null, undefined, 0, -1, "yesterday"]) {
      localStorage.clear();
      const item = recordChapterCleared({ ...CHAPTER, clearedAt: bad }, CLEARED);
      expect(item.clearedAt, String(bad)).toBe(CLEARED.getTime());
    }
  });

  it("refuses a record it could not render or link to, and never throws", () => {
    for (const bad of [
      { ...CHAPTER, chapterId: null },
      { ...CHAPTER, chapterId: 0 },
      { ...CHAPTER, chapterId: "twenty-seven" },
      { ...CHAPTER, courseId: undefined },
      { ...CHAPTER, chapterName: "   " },
    ]) {
      expect(recordChapterCleared(bad, CLEARED)).toBeNull();
    }
    expect(readStore()).toBeNull();
  });

  it("keeps a record whose optional context is missing", () => {
    // The wholesale-drop bug: a missing courseTitle/subject/totalLessons must
    // cost those fields, not the whole record.
    const item = recordChapterCleared({
      courseId: 374, chapterId: 31, chapterName: "Fluids",
    }, CLEARED);
    expect(item).toMatchObject({ courseTitle: null, subject: null, totalLessons: null });
    expect(readStore().items).toHaveLength(1);
  });
});

describe("the ladder", () => {
  it("is not due on day 6 and is due on day 7", () => {
    recordChapterCleared(CHAPTER, CLEARED);
    expect(dueForRevision(3, at(6))).toHaveLength(0);
    expect(dueForRevision(3, at(7))).toHaveLength(1);
  });

  it("crosses the boundary on local time, not UTC", () => {
    // Cleared 21:30 local. Due exactly 7*24h later: 21:29 on day 7 is early,
    // 21:31 is due. UTC arithmetic would shift this by 5.5 hours in IST.
    recordChapterCleared(CHAPTER, CLEARED);
    expect(dueForRevision(3, new Date(2026, 7, 8, 21, 29, 0))).toHaveLength(0);
    expect(dueForRevision(3, new Date(2026, 7, 8, 21, 31, 0))).toHaveLength(1);
  });

  it("walks 7 -> 21 -> 60 -> 150 and then graduates for good", () => {
    expect(REVISION_LADDER).toEqual([7, 21, 60, 150]);
    recordChapterCleared(CHAPTER, CLEARED);

    let clock = at(7);
    for (const [index, gap] of REVISION_LADDER.entries()) {
      expect(dueForRevision(3, clock), `rung ${index} due`).toHaveLength(1);
      markChapterRevised(CHAPTER, clock);
      // Gone the instant it is revised...
      expect(dueForRevision(3, clock), `rung ${index} cleared`).toHaveLength(0);
      const next = REVISION_LADDER[index + 1];
      if (next === undefined) break;
      // ...and back only after the NEXT interval, not this one.
      expect(dueForRevision(3, new Date(clock.getTime() + (next - 1) * DAY))).toHaveLength(0);
      clock = new Date(clock.getTime() + next * DAY);
      void gap;
    }

    const graduated = readStore().items[0];
    expect(graduated.graduated).toBe(true);
    expect(dueAt(graduated)).toBeNull();
    // Still stored — it just never surfaces again.
    expect(dueForRevision(3, at(4000))).toHaveLength(0);
  });

  it("drops out once it is too stale to call revision", () => {
    recordChapterCleared(CHAPTER, CLEARED);
    expect(dueForRevision(3, at(7 + STALE_AFTER_DAYS - 1))).toHaveLength(1);
    expect(dueForRevision(3, at(7 + STALE_AFTER_DAYS + 1))).toHaveLength(0);
  });

  it("reads without writing, so opening the homepage cannot change the schedule", () => {
    recordChapterCleared(CHAPTER, CLEARED);
    const before = localStorage.getItem(KEY);
    dueForRevision(3, at(9));
    dueForRevision(3, at(9));
    expect(localStorage.getItem(KEY)).toBe(before);
  });
});

describe("revision signals", () => {
  it("counts a re-watch, but only once per cooldown", () => {
    recordChapterCleared(CHAPTER, CLEARED);
    // Same evening: finishing lesson 14 then replaying lesson 3 is one
    // session, not a revision.
    expect(recordChapterWatched(CHAPTER, at(0, 2))).toBeNull();
    expect(recordChapterWatched(CHAPTER, at(2))).toBeNull();

    const advanced = recordChapterWatched(CHAPTER, at(4));
    expect(advanced.step).toBe(1);
    expect(advanced.revisedVia).toBe("watched");
    expect(dueForRevision(3, at(7))).toHaveLength(0);
  });

  it("never invents a record for a chapter that was never cleared", () => {
    // Watching a chapter you never finished is learning, not revising.
    expect(recordChapterWatched(CHAPTER, at(30))).toBeNull();
    expect(markChapterRevised(CHAPTER, at(30))).toBeNull();
    expect(readStore()).toBeNull();
  });

  it("distinguishes what the student asserted from what we observed", () => {
    recordChapterCleared(CHAPTER, CLEARED);
    expect(markChapterRevised(CHAPTER, at(7)).revisedVia).toBe("marked");
  });
});

describe("snooze never becomes a false claim", () => {
  it("hides for a week without recording a revision", () => {
    recordChapterCleared(CHAPTER, CLEARED);
    const snoozed = snoozeChapter(CHAPTER, at(7));

    // The whole point: a snooze must not let the site later say "Revised".
    expect(snoozed.revisedAt).toBeNull();
    expect(snoozed.revisedVia).toBeNull();
    expect(snoozed.step).toBe(0);

    expect(dueForRevision(3, at(10))).toHaveLength(0);
    expect(dueForRevision(3, at(15))).toHaveLength(1);
    expect(dueForRevision(3, at(15))[0].step).toBe(0);
  });
});

describe("the band is a nudge, not a treadmill", () => {
  it("stays quiet for the rest of the local day once paused", () => {
    recordChapterCleared(CHAPTER, CLEARED);
    // Cleared 2026-08-01 21:30, so due from 2026-08-08 21:30. Pause on the
    // morning of the 9th, well clear of a midnight boundary.
    const morning = new Date(2026, 7, 9, 10, 0, 0);
    expect(dueForRevision(3, morning)).toHaveLength(1);

    pauseRevisionForToday(morning);
    expect(dueForRevision(3, morning)).toHaveLength(0);
    // Later the same evening: still quiet.
    expect(dueForRevision(3, new Date(2026, 7, 9, 23, 45, 0))).toHaveLength(0);
    // Next calendar day: back.
    expect(dueForRevision(3, new Date(2026, 7, 10, 8, 0, 0))).toHaveLength(1);
  });
});

describe("rankDueChapters", () => {
  const item = (id, step, over, subject) => ({
    id, courseId: 1, chapterId: Number(id.split(":")[1]), chapterName: id,
    subject, totalLessons: null, courseTitle: null,
    clearedAt: CLEARED.getTime() - over * DAY, step,
    revisedAt: null, revisedVia: null, snoozedUntil: null, graduated: false,
  });

  it("puts an early rung before a far more overdue late rung", () => {
    // A week-old chapter is a twenty-minute win; a 150-day rung is the weakest
    // advice here, however overdue it looks.
    const ranked = rankDueChapters([item("1:2", 2, 400, "Physics"), item("1:1", 0, 8, "Physics")], CLEARED);
    expect(ranked.map((r) => r.id)).toEqual(["1:1", "1:2"]);
  });

  it("does not fill the row with one subject", () => {
    const ranked = rankDueChapters([
      item("1:1", 0, 30, "Physics"), item("1:2", 0, 29, "Physics"),
      item("1:3", 0, 28, "Physics"), item("1:4", 0, 10, "Chemistry"),
    ], CLEARED);
    expect(ranked.slice(0, 3).map((r) => r.subject))
      .toEqual(["Physics", "Chemistry", "Physics"]);
  });

  it("does not let one unknown subject block another", () => {
    const ranked = rankDueChapters([item("1:1", 0, 30, null), item("1:2", 0, 29, null)], CLEARED);
    expect(ranked).toHaveLength(2);
  });

  it("is stable across repeated reads", () => {
    const items = [
      item("1:1", 0, 30, "Physics"), item("1:2", 0, 30, "Physics"), item("1:3", 0, 30, "Maths"),
    ];
    const once = rankDueChapters(items, CLEARED).map((r) => r.id);
    expect(rankDueChapters(items, CLEARED).map((r) => r.id)).toEqual(once);
  });
});

describe("the store survives a hostile environment", () => {
  it("treats corrupt JSON as an empty queue", () => {
    localStorage.setItem(KEY, "{not json");
    expect(dueForRevision(3, CLEARED)).toEqual([]);
  });

  it("drops stored records that could not be rendered honestly", () => {
    localStorage.setItem(KEY, JSON.stringify({
      pausedOn: null,
      items: [
        { courseId: 374, chapterId: 27, chapterName: "Rotational Motion", clearedAt: CLEARED.getTime() },
        { courseId: 374, chapterId: 31, chapterName: "", clearedAt: CLEARED.getTime() },
        // No clearedAt: must be dropped, NOT defaulted to now — a synthesised
        // date would make an old chapter look freshly finished.
        { courseId: 374, chapterId: 33, chapterName: "Waves" },
      ],
    }));
    const due = dueForRevision(9, at(9));
    expect(due.map((d) => d.chapterName)).toEqual(["Rotational Motion"]);
  });

  it("does not propagate a blocked localStorage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => recordChapterCleared(CHAPTER, CLEARED)).not.toThrow();
    setItem.mockRestore();
  });

  it("caps the queue rather than growing without bound", () => {
    for (let i = 1; i <= 205; i += 1) {
      recordChapterCleared({ ...CHAPTER, chapterId: i, chapterName: `Chapter ${i}` }, CLEARED);
    }
    expect(readStore().items).toHaveLength(200);
  });

  it("clears on sign-out", () => {
    recordChapterCleared(CHAPTER, CLEARED);
    clearRevision();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
