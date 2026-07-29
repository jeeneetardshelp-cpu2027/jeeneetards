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

describe("corrupted storage never breaks playback", () => {
  it("corrupted progress JSON reads as no resume point and is recoverable", () => {
    localStorage.setItem(KEY, "{not valid json");
    expect(getLessonPosition(1, "abc")).toBe(0);
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
