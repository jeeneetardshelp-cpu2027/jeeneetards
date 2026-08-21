import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import YouTubePlayer from "./YouTubePlayer.jsx";

let latestOptions;
let latestMount;
let destroy;
let getCurrentTime;
let getDuration;
let setPlaybackRate;

let playVideo;

beforeEach(() => {
  latestOptions = null;
  latestMount = null;
  destroy = vi.fn();
  getCurrentTime = vi.fn(() => 0);
  getDuration = vi.fn(() => 0);
  setPlaybackRate = vi.fn();
  playVideo = vi.fn();
  window.YT = {
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
    Player: vi.fn(function Player(mount, options) {
      latestMount = mount;
      latestOptions = options;
      this.destroy = destroy;
      this.getCurrentTime = getCurrentTime;
      this.getDuration = getDuration;
      this.setPlaybackRate = setPlaybackRate;
      this.playVideo = playVideo;
      queueMicrotask(() => options.events.onReady());
    }),
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete window.YT;
});

describe("YouTube course player", () => {
  const activatePlayer = () => fireEvent.click(screen.getByRole("button", { name: /play lesson/i }));

  it("loads YouTube only after Play and reports only the first real PLAYING state", async () => {
    const onPlay = vi.fn();
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" onPlay={onPlay} />);

    expect(latestOptions).toBeNull();
    expect(screen.getByText("The YouTube player loads after you press play.")).toBeTruthy();
    activatePlayer();
    await waitFor(() => expect(latestOptions).toBeTruthy());
    const src = new URL(latestMount.src);
    expect(src.origin).toBe("https://www.youtube-nocookie.com");
    expect(src.pathname).toBe("/embed/dQw4w9WgXcQ");
    expect(src.searchParams.get("autoplay")).toBe("1");
    expect(src.searchParams.get("playsinline")).toBe("1");
    expect(src.searchParams.get("enablejsapi")).toBe("1");
    expect(src.searchParams.get("origin")).toBe(window.location.origin);
    expect(src.searchParams.get("start")).toBeNull();
    expect(onPlay).not.toHaveBeenCalled();

    act(() => latestOptions.events.onStateChange({ data: 2 }));
    expect(onPlay).not.toHaveBeenCalled();

    act(() => latestOptions.events.onStateChange({ data: 1 }));
    act(() => latestOptions.events.onStateChange({ data: 1 }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("reports onEnded once per watch, re-arming when playback resumes", async () => {
    const onEnded = vi.fn();
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" onEnded={onEnded} />);
    activatePlayer();
    await waitFor(() => expect(latestOptions).toBeTruthy());

    act(() => latestOptions.events.onStateChange({ data: 1 }));
    expect(onEnded).not.toHaveBeenCalled();

    act(() => latestOptions.events.onStateChange({ data: 0 }));
    act(() => latestOptions.events.onStateChange({ data: 0 }));
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onEnded).toHaveBeenLastCalledWith({ videoId: "dQw4w9WgXcQ" });

    // A replay must be able to end again — otherwise the up-next overlay
    // never returns after a cancel-and-rewatch.
    act(() => latestOptions.events.onStateChange({ data: 1 }));
    act(() => latestOptions.events.onStateChange({ data: 0 }));
    expect(onEnded).toHaveBeenCalledTimes(2);
  });

  it("reports every PLAYING through onPlaying, unlike the once-only onPlay", async () => {
    const onPlay = vi.fn();
    const onPlaying = vi.fn();
    render(
      <YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" onPlay={onPlay} onPlaying={onPlaying} />,
    );
    activatePlayer();
    await waitFor(() => expect(latestOptions).toBeTruthy());

    act(() => latestOptions.events.onStateChange({ data: 1 }));
    act(() => latestOptions.events.onStateChange({ data: 2 }));
    act(() => latestOptions.events.onStateChange({ data: 1 }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlaying).toHaveBeenCalledTimes(2);
    expect(onPlaying).toHaveBeenLastCalledWith({ videoId: "dQw4w9WgXcQ" });
  });

  it("activates on playSignal and plays later signals without rebuilding the iframe", async () => {
    const { rerender } = render(
      <YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" playSignal={0} />,
    );
    expect(latestOptions).toBeNull();
    rerender(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" playSignal={1} />);
    await waitFor(() => expect(latestOptions).toBeTruthy());
    expect(new URL(latestMount.src).searchParams.get("autoplay")).toBe("1");
    const buildCount = window.YT.Player.mock.calls.length;

    rerender(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" playSignal={2} />);
    await waitFor(() => expect(playVideo).toHaveBeenCalledTimes(1));
    expect(window.YT.Player.mock.calls.length).toBe(buildCount);
  });

  it("flushes one final progress report when the player is torn down mid-watch", async () => {
    const onProgress = vi.fn();
    getCurrentTime.mockReturnValue(300);
    getDuration.mockReturnValue(600);
    const { unmount } = render(
      <YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" onProgress={onProgress} />,
    );
    activatePlayer();
    await waitFor(() => expect(latestOptions).toBeTruthy());
    act(() => latestOptions.events.onStateChange({ data: 1 }));
    expect(onProgress).not.toHaveBeenCalled();

    unmount();
    expect(onProgress).toHaveBeenCalledWith({
      videoId: "dQw4w9WgXcQ", seconds: 300, duration: 600,
    });
  });

  it("reports progress every ~5s while playing and flushes once on pause", async () => {
    vi.useFakeTimers();
    const onProgress = vi.fn();
    getCurrentTime.mockReturnValue(42);
    getDuration.mockReturnValue(600);
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" onProgress={onProgress} />);
    activatePlayer();
    // Fake timers stall waitFor, so flush the API promise + ready microtask directly.
    await act(async () => {});
    expect(latestOptions).toBeTruthy();

    act(() => latestOptions.events.onStateChange({ data: 1 }));
    expect(onProgress).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(5000));
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenLastCalledWith({
      videoId: "dQw4w9WgXcQ", seconds: 42, duration: 600,
    });

    getCurrentTime.mockReturnValue(97);
    act(() => vi.advanceTimersByTime(5000));
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith({
      videoId: "dQw4w9WgXcQ", seconds: 97, duration: 600,
    });

    getCurrentTime.mockReturnValue(101);
    act(() => latestOptions.events.onStateChange({ data: 2 }));
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenLastCalledWith({
      videoId: "dQw4w9WgXcQ", seconds: 101, duration: 600,
    });

    // The interval must be gone after pause — no ticks however long we wait.
    act(() => vi.advanceTimersByTime(30000));
    expect(onProgress).toHaveBeenCalledTimes(3);
  });

  it("puts a floored startSeconds into the embed URL", async () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" startSeconds={95.7} />);
    activatePlayer();
    await waitFor(() => expect(latestMount).toBeTruthy());
    const src = new URL(latestMount.src);
    expect(src.searchParams.get("start")).toBe("95");
  });

  it("activates immediately when the parent requests autoplay", async () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" autoplay />);
    await waitFor(() => expect(latestMount).toBeTruthy());
    expect(new URL(latestMount.src).searchParams.get("autoplay")).toBe("1");
  });

  it("applies the saved playback rate once the player is ready", async () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" playbackRate={1.5} />);
    activatePlayer();
    await waitFor(() => expect(setPlaybackRate).toHaveBeenCalledWith(1.5));
    expect(setPlaybackRate).toHaveBeenCalledTimes(1);
  });

  it("offers a YouTube link when the creator disabled embedding (101/150)", async () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" />);
    activatePlayer();
    await waitFor(() => expect(latestOptions).toBeTruthy());

    act(() => latestOptions.events.onError({ data: 150 }));
    expect(screen.getByText(/restricted by creator/i)).toBeTruthy();
    // Still watchable on YouTube, so the direct link is offered.
    const link = screen.getByRole("link", { name: /watch directly on youtube/i });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("says a removed/private video is gone (100) and offers no dead link", async () => {
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" />);
    activatePlayer();
    await waitFor(() => expect(latestOptions).toBeTruthy());

    act(() => latestOptions.events.onError({ data: 100 }));
    // Honest wording — not "restricted by creator", which would be a lie.
    expect(screen.getByText(/no longer available on youtube/i)).toBeTruthy();
    expect(screen.queryByText(/restricted by creator/i)).toBeNull();
    // A link to a deleted YouTube page would be another dead end.
    expect(screen.queryByRole("link", { name: /watch directly on youtube/i })).toBeNull();
  });

  it("passes playback-rate changes through to the parent", async () => {
    const onPlaybackRateChange = vi.fn();
    render(
      <YouTubePlayer
        videoId="dQw4w9WgXcQ"
        title="Lesson"
        onPlaybackRateChange={onPlaybackRateChange}
      />,
    );
    activatePlayer();
    await waitFor(() => expect(latestOptions).toBeTruthy());
    act(() => latestOptions.events.onPlaybackRateChange({ data: 2 }));
    expect(onPlaybackRateChange).toHaveBeenCalledWith(2);
  });
});
