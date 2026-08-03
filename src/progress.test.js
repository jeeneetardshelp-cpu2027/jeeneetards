// Tests for the resume layer of the device-local progress store: per-lesson
// positions inside ll_progress_v1 and player prefs under ll_player_prefs_v1.
// The resume thresholds are product rules (a tiny scrub is not a session; a
// finished video restarts instead of resuming into the outro), and entries
// written before positions existed must keep working untouched.
//
// Run: npx vitest run src/progress.test.js

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordLessonView,
  recordLessonPosition,
  getLessonPosition,
  getPlayerPrefs,
  savePlayerPrefs,
  getWatchedVideoIds,
  getCourseProgress,
  getContinueWatching,
  mergeRemoteEntry,
  clearProgress,
} from "./progress.js";

const KEY = "ll_progress_v1";
const PREFS_KEY = "ll_player_prefs_v1";

// jsdom provides a real localStorage; each test starts from an empty one.
beforeEach(() => {
  localStorage.clear();
});

describe("getLessonPosition resume rules", () => {
  it("unknown course or video resumes at 0", () => {
    expect(getLessonPosition(1, "abc")).toBe(0);
    recordLessonPosition({ playlistId: 1, videoId: "abc", seconds: 120, duration: 600 });
    expect(getLessonPosition(1, "other")).toBe(0);
    expect(getLessonPosition(2, "abc")).toBe(0);
  });

  it("a tiny scrub (t < 10) resumes at 0", () => {
    recordLessonPosition({ playlistId: 1, videoId: "abc", seconds: 5, duration: 600 });
    expect(getLessonPosition(1, "abc")).toBe(0);
  });

  it("t = 10 is the first position worth resuming", () => {
    recordLessonPosition({ playlistId: 1, videoId: "abc", seconds: 10, duration: 600 });
    expect(getLessonPosition(1, "abc")).toBe(10);
  });

  it("a mid-video position resumes at t", () => {
    recordLessonPosition({ playlistId: 1, videoId: "abc", seconds: 300, duration: 1000 });
    expect(getLessonPosition(1, "abc")).toBe(300);
  });

  it("96% watched counts as finished — restart at 0", () => {
    recordLessonPosition({ playlistId: 1, videoId: "abc", seconds: 960, duration: 1000 });
    expect(getLessonPosition(1, "abc")).toBe(0);
  });

  it("within 30s of the end counts as finished even below 95%", () => {
    // 580/600 is ~96.7%, so use a short remainder on a position under 95%:
    // 80/100 = 80%, but 20s left → finished.
    recordLessonPosition({ playlistId: 1, videoId: "abc", seconds: 80, duration: 100 });
    expect(getLessonPosition(1, "abc")).toBe(0);
  });

  it("a real position with no usable duration resumes at t (never divides by zero)", () => {
    recordLessonPosition({ playlistId: 1, videoId: "abc", seconds: 120, duration: 0 });
    expect(getLessonPosition(1, "abc")).toBe(120);
    recordLessonPosition({ playlistId: 1, videoId: "def", seconds: 90 });
    expect(getLessonPosition(1, "def")).toBe(90);
  });
});

describe("recordLessonPosition stays in its lane", () => {
  it("never marks videos watched and never moves lastVideoId/lastVideoTitle", () => {
    recordLessonView({
      playlistId: 1,
      chapterId: 7,
      courseTitle: "Optics",
      videoId: "vidA",
      videoTitle: "Lesson A",
      position: 1,
      totalLessons: 12,
    });
    recordLessonPosition({ playlistId: 1, videoId: "vidB", seconds: 200, duration: 900 });

    const entry = getCourseProgress(1);
    expect(getWatchedVideoIds(1)).toEqual(["vidA"]);
    expect(entry.lastVideoId).toBe("vidA");
    expect(entry.lastVideoTitle).toBe("Lesson A");
    expect(entry.courseTitle).toBe("Optics");
    expect(getLessonPosition(1, "vidB")).toBe(200);
  });

  it("creates a minimal entry when the course has never been viewed", () => {
    const before = Date.now();
    const entry = recordLessonPosition({ playlistId: 5, videoId: "xyz", seconds: 45, duration: 300 });
    expect(entry).not.toBeNull();
    expect(entry.watched).toEqual([]);
    expect(entry.updatedAt).toBeGreaterThanOrEqual(before);
    expect(getLessonPosition(5, "xyz")).toBe(45);
  });

  it("merges positions per video instead of replacing the map", () => {
    recordLessonPosition({ playlistId: 1, videoId: "vidA", seconds: 100, duration: 900 });
    recordLessonPosition({ playlistId: 1, videoId: "vidB", seconds: 200, duration: 900 });
    expect(getLessonPosition(1, "vidA")).toBe(100);
    expect(getLessonPosition(1, "vidB")).toBe(200);
  });

  it("a later recordLessonView keeps the saved positions", () => {
    recordLessonPosition({ playlistId: 1, videoId: "vidA", seconds: 150, duration: 900 });
    recordLessonView({
      playlistId: 1,
      chapterId: 7,
      courseTitle: "Optics",
      videoId: "vidB",
      videoTitle: "Lesson B",
      position: 2,
      totalLessons: 12,
    });
    expect(getLessonPosition(1, "vidA")).toBe(150);
  });

  it("rejects calls without a playlist or video id", () => {
    expect(recordLessonPosition({ playlistId: null, videoId: "x", seconds: 60 })).toBeNull();
    expect(recordLessonPosition({ playlistId: 1, videoId: "", seconds: 60 })).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe("Continue Watching record validation", () => {
  it("returns only complete course records and applies the limit afterwards", () => {
    localStorage.setItem(KEY, JSON.stringify({
      1: {
        playlistId: 1, chapterId: 7, lastVideoId: "valid-old", courseTitle: "Optics",
        watched: ["valid-old"], updatedAt: 100,
      },
      2: {
        playlistId: 2, courseTitle: "Broken", watched: [], updatedAt: 300,
      },
      3: {
        playlistId: 3, chapterId: 8, lastVideoId: "valid-new", courseTitle: "Waves",
        watched: ["valid-new"], updatedAt: 200,
      },
    }));

    expect(getContinueWatching(2).map((entry) => entry.playlistId)).toEqual([3, 1]);
    expect(JSON.parse(localStorage.getItem(KEY))).not.toHaveProperty("2");
  });

  it("removes a historical partial record that would create an undefined route", () => {
    localStorage.setItem(KEY, JSON.stringify({
      193: { playlistId: 193, courseTitle: "Broken course", watched: [], updatedAt: 100 },
    }));

    expect(getContinueWatching()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps a valid position-only record private without rendering it as a course card", () => {
    recordLessonPosition({ playlistId: 5, videoId: "xyz", seconds: 45, duration: 300 });

    expect(getContinueWatching()).toEqual([]);
    expect(getLessonPosition(5, "xyz")).toBe(45);
    expect(getCourseProgress(5)).not.toBeNull();
  });

  it("rejects a lesson view without a valid course or video identifier", () => {
    expect(recordLessonView({ playlistId: 1, chapterId: 7, videoId: "" })).toBeNull();
    expect(recordLessonView({ playlistId: "not-an-id", chapterId: 7, videoId: "abc" })).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  // chapterId is deliberately NOT required. A lesson that legitimately spans
  // several chapters carries chapter_id NULL — the catalogue's own convention
  // for "no single correct chapter" — and video 2122 is exactly that, live in
  // three courses. Refusing to record it meant the student watched two hours
  // and the site recorded nothing, while the server sync still wrote
  // watched:true and then overwrote it with watched:false.
  it("records a watch for a lesson that has no single chapter", () => {
    const entry = recordLessonView({
      playlistId: 182, chapterId: null, courseTitle: "Circular Motion",
      videoId: "Z2J5R5k6WyE", videoTitle: "Live Practice Session",
      position: 6, totalLessons: 11,
    });

    expect(entry).not.toBeNull();
    expect(getWatchedVideoIds(182)).toEqual(["Z2J5R5k6WyE"]);
    expect(entry.chapterId).toBeNull();          // null, never NaN
    // ...but it still must not render a Continue card, because that card builds
    // a /course/:id/chapter/:chapterId URL it cannot construct.
    expect(getContinueWatching()).toEqual([]);
  });
});

describe("backward compatibility with pre-positions entries", () => {
  const oldEntry = {
    playlistId: 3,
    chapterId: 9,
    courseTitle: "Waves",
    lastVideoId: "old1",
    lastVideoTitle: "Old lesson",
    lastPosition: 4,
    totalLessons: 20,
    watched: ["old1", "old2"],
    updatedAt: 1700000000000,
  };

  it("an entry without positions reads as no resume point", () => {
    localStorage.setItem(KEY, JSON.stringify({ 3: oldEntry }));
    expect(getLessonPosition(3, "old1")).toBe(0);
  });

  it("recording a position onto an old entry keeps every existing field", () => {
    localStorage.setItem(KEY, JSON.stringify({ 3: oldEntry }));
    recordLessonPosition({ playlistId: 3, videoId: "old1", seconds: 400, duration: 2000 });

    const entry = getCourseProgress(3);
    expect(entry.courseTitle).toBe("Waves");
    expect(entry.lastVideoId).toBe("old1");
    expect(entry.lastVideoTitle).toBe("Old lesson");
    expect(entry.watched).toEqual(["old1", "old2"]);
    expect(entry.totalLessons).toBe(20);
    expect(entry.updatedAt).toBeGreaterThan(oldEntry.updatedAt);
    expect(getLessonPosition(3, "old1")).toBe(400);
  });
});

describe("player prefs", () => {
  it("reads { rate: null } when nothing was ever saved", () => {
    expect(getPlayerPrefs()).toEqual({ rate: null });
  });

  it("round-trips the playback rate", () => {
    savePlayerPrefs({ rate: 1.5 });
    expect(getPlayerPrefs()).toEqual({ rate: 1.5 });
    savePlayerPrefs({ rate: 2 });
    expect(getPlayerPrefs()).toEqual({ rate: 2 });
  });

  it("a non-numeric stored rate reads as null", () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ rate: "fast" }));
    expect(getPlayerPrefs()).toEqual({ rate: null });
  });
});

describe("mergeRemoteEntry (server → localStorage, sign-in pull)", () => {
  it("creates a fresh course entry on a device that has never seen it", () => {
    const entry = mergeRemoteEntry({
      playlistId: 9, chapterId: 3, courseTitle: "Mechanics", videoId: "vidA",
      videoTitle: "Lesson A", position: 250, duration: 1000, watched: true, updatedAt: 1000,
    });
    expect(entry.lastVideoId).toBe("vidA");
    expect(entry.lastVideoTitle).toBe("Lesson A");
    expect(entry.courseTitle).toBe("Mechanics");
    expect(getWatchedVideoIds(9)).toEqual(["vidA"]);
    expect(getLessonPosition(9, "vidA")).toBe(250);
  });

  it("a newer remote row overwrites this device's older position", () => {
    recordLessonPosition({ playlistId: 1, videoId: "vidA", seconds: 100, duration: 1000 });
    mergeRemoteEntry({
      playlistId: 1, chapterId: 7, courseTitle: "Optics", videoId: "vidA",
      videoTitle: "Lesson A", position: 400, duration: 1000, watched: true,
      updatedAt: Date.now() + 60000,
    });
    expect(getLessonPosition(1, "vidA")).toBe(400);
  });

  it("an older remote row never regresses this device's newer position", () => {
    recordLessonPosition({ playlistId: 1, videoId: "vidA", seconds: 500, duration: 1000 });
    mergeRemoteEntry({
      playlistId: 1, chapterId: 7, courseTitle: "Optics", videoId: "vidA",
      videoTitle: "Lesson A", position: 50, duration: 1000, watched: true, updatedAt: 1,
    });
    expect(getLessonPosition(1, "vidA")).toBe(500);
  });

  it("a stale remote row never moves lastVideoId backward", () => {
    recordLessonView({
      playlistId: 1, chapterId: 7, courseTitle: "Optics", videoId: "vidB",
      videoTitle: "Lesson B", position: 2, totalLessons: 12,
    });
    const fresh = getCourseProgress(1).updatedAt;
    mergeRemoteEntry({
      playlistId: 1, chapterId: 7, courseTitle: "Optics", videoId: "vidA",
      videoTitle: "Lesson A", position: 300, duration: 1000, watched: true,
      updatedAt: fresh - 60000,
    });
    expect(getCourseProgress(1).lastVideoId).toBe("vidB");
    // The per-video position still merges even though it didn't win lastVideoId.
    expect(getLessonPosition(1, "vidA")).toBe(300);
  });

  it("adds a remote-watched video to the local watched list without duplicating it", () => {
    recordLessonView({
      playlistId: 1, chapterId: 7, courseTitle: "Optics", videoId: "vidA",
      videoTitle: "Lesson A", position: 1, totalLessons: 12,
    });
    mergeRemoteEntry({
      playlistId: 1, chapterId: 7, courseTitle: "Optics", videoId: "vidA",
      videoTitle: "Lesson A", position: 10, duration: 1000, watched: true, updatedAt: 1,
    });
    expect(getWatchedVideoIds(1)).toEqual(["vidA"]);
  });

  it("rejects calls without a playlist, chapter, video id, or a valid updatedAt", () => {
    expect(mergeRemoteEntry({ playlistId: null, videoId: "x", updatedAt: 1 })).toBeNull();
    expect(mergeRemoteEntry({ playlistId: 1, chapterId: null, videoId: "x", updatedAt: 1 })).toBeNull();
    expect(mergeRemoteEntry({ playlistId: 1, videoId: "", updatedAt: 1 })).toBeNull();
    expect(mergeRemoteEntry({ playlistId: 1, videoId: "x", updatedAt: NaN })).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe("clearProgress (called on sign-out)", () => {
  it("wipes the shared store so the next student on the device starts clean", () => {
    recordLessonView({
      playlistId: 12, chapterId: 3, courseTitle: "Optics", videoId: "vidA",
      videoTitle: "Lesson A", position: 1, totalLessons: 8,
    });
    recordLessonPosition({ playlistId: 12, videoId: "vidA", seconds: 400, duration: 1800 });
    expect(getContinueWatching(3)).toHaveLength(1);

    clearProgress();

    expect(getContinueWatching(3)).toHaveLength(0);
    expect(getWatchedVideoIds(12)).toEqual([]);
    expect(getLessonPosition(12, "vidA")).toBe(0);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("leaves player preferences alone — they are device settings, not history", () => {
    savePlayerPrefs({ rate: 1.5 });
    clearProgress();
    expect(getPlayerPrefs()).toEqual({ rate: 1.5 });
  });

  it("is safe when nothing was ever stored", () => {
    expect(() => clearProgress()).not.toThrow();
  });
});

describe("corrupted storage never breaks playback", () => {
  it("corrupted progress JSON reads as no resume point and is recoverable", () => {
    localStorage.setItem(KEY, "{not valid json");
    expect(getLessonPosition(1, "abc")).toBe(0);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(() =>
      recordLessonPosition({ playlistId: 1, videoId: "abc", seconds: 60, duration: 600 })
    ).not.toThrow();
    expect(getLessonPosition(1, "abc")).toBe(60);
  });

  it("corrupted prefs JSON reads as { rate: null }", () => {
    localStorage.setItem(PREFS_KEY, "not json either");
    expect(getPlayerPrefs()).toEqual({ rate: null });
  });
});
