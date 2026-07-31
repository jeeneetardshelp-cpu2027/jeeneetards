// The site must never invent watch history.
//
// Regression guards for the 31 July audit (docs/audit_2026-07-31.md, finding A8
// and A9). Two independent bugs conspired to fabricate progress:
//
//   1. YouTubePlayer.reportProgress fired on teardown/pagehide even when the
//      lesson had never played, so merely OPENING a course page and leaving
//      recorded a real position — which then synced to the server and came back
//      as a permanent watched tick on every device the student signs into.
//   2. mergeRemoteEntry documented itself as "only ever moves data FORWARD" but
//      compared timestamps only, so a server row 1ms newer carrying position 0
//      overwrote a genuine 12-minute resume point with zero.
//
// Both are "nothing is invented" violations — the project's core content rule
// applied to the student's own data.
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import YouTubePlayer from "./YouTubePlayer.jsx";
import { mergeRemoteEntry, recordLessonPosition, getLessonPosition } from "./progress.js";

let latestOptions;
let destroy;
let getCurrentTime;
let getDuration;

beforeEach(() => {
  localStorage.clear();
  latestOptions = null;
  destroy = vi.fn();
  getCurrentTime = vi.fn(() => 137);
  getDuration = vi.fn(() => 600);
  window.YT = {
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
    Player: vi.fn(function Player(mount, options) {
      latestOptions = options;
      this.destroy = destroy;
      this.getCurrentTime = getCurrentTime;
      this.getDuration = getDuration;
      queueMicrotask(() => options.events.onReady());
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete window.YT;
});

const flush = async () => { await act(async () => { await Promise.resolve(); }); };

describe("a lesson that never played is never recorded as progress", () => {
  it("reports nothing when the student opens a lesson and navigates away without pressing play", async () => {
    const onProgress = vi.fn();
    const { unmount } = render(
      <YouTubePlayer videoId="abc12345678" title="Lesson" onProgress={onProgress} />,
    );
    await flush();

    // No PLAYING event was ever fired — the student just looked and left.
    unmount();

    expect(onProgress).not.toHaveBeenCalled();
  });

  it("reports nothing when the tab is closed on a lesson that never played", async () => {
    const onProgress = vi.fn();
    render(<YouTubePlayer videoId="abc12345678" title="Lesson" onProgress={onProgress} />);
    await flush();

    window.dispatchEvent(new Event("pagehide"));

    expect(onProgress).not.toHaveBeenCalled();
  });

  it("still reports the final position when the lesson DID play (no data loss)", async () => {
    const onProgress = vi.fn();
    const { unmount } = render(
      <YouTubePlayer videoId="abc12345678" title="Lesson" onProgress={onProgress} />,
    );
    await flush();

    // A genuine playback event.
    act(() => { latestOptions.events.onStateChange({ data: 1 }); });
    onProgress.mockClear();

    unmount();

    expect(onProgress).toHaveBeenCalledWith({
      videoId: "abc12345678", seconds: 137, duration: 600,
    });
  });
});

describe("mergeRemoteEntry only ever moves a resume point forward", () => {
  const remote = (over = {}) => ({
    playlistId: 1, chapterId: 7, courseTitle: "Optics", videoId: "vidA",
    videoTitle: "Lesson A", position: 0, duration: 600, watched: true,
    updatedAt: Date.now() + 60000, ...over,
  });

  it("a newer server row carrying position 0 does NOT destroy a real resume point", () => {
    recordLessonPosition({ playlistId: 1, videoId: "vidA", seconds: 720, duration: 1800 });
    expect(getLessonPosition(1, "vidA")).toBe(720);

    mergeRemoteEntry(remote({ position: 0, duration: 1800 }));

    expect(getLessonPosition(1, "vidA")).toBe(720);
  });

  it("a newer server row that is genuinely further ahead still wins", () => {
    recordLessonPosition({ playlistId: 1, videoId: "vidA", seconds: 300, duration: 1800 });
    mergeRemoteEntry(remote({ position: 900, duration: 1800 }));
    expect(getLessonPosition(1, "vidA")).toBe(900);
  });

  it("a finished lesson from another device still wins even though its position reads as 0", () => {
    // Completion is stored as seconds=duration, which getLessonPosition then
    // reports as 0 ("restart from the beginning"). That is a legitimate
    // backwards move and must not be blocked by the forward-only rule.
    recordLessonPosition({ playlistId: 1, videoId: "vidA", seconds: 300, duration: 600 });
    mergeRemoteEntry(remote({ position: 600, duration: 600 }));
    expect(getLessonPosition(1, "vidA")).toBe(0);
    expect(readPositions().vidA.t).toBe(600);
  });

  it("an older server row never wins, regardless of position", () => {
    recordLessonPosition({ playlistId: 1, videoId: "vidA", seconds: 300, duration: 1800 });
    mergeRemoteEntry(remote({ position: 1200, duration: 1800, updatedAt: 1 }));
    expect(getLessonPosition(1, "vidA")).toBe(300);
  });
});

function readPositions() {
  return JSON.parse(localStorage.getItem("ll_progress_v1"))["1"].positions;
}
