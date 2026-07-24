import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import YouTubePlayer from "./YouTubePlayer.jsx";

let latestOptions;
let latestMount;
let destroy;

beforeEach(() => {
  latestOptions = null;
  latestMount = null;
  destroy = vi.fn();
  window.YT = {
    PlayerState: { PLAYING: 1 },
    Player: vi.fn(function Player(mount, options) {
      latestMount = mount;
      latestOptions = options;
      this.destroy = destroy;
      queueMicrotask(() => options.events.onReady());
    }),
  };
});

afterEach(() => {
  cleanup();
  delete window.YT;
});

describe("YouTube course player", () => {
  it("never autoplays and reports only the first real PLAYING state", async () => {
    const onPlay = vi.fn();
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Lesson" onPlay={onPlay} />);

    await waitFor(() => expect(latestOptions).toBeTruthy());
    const src = new URL(latestMount.src);
    expect(src.origin).toBe("https://www.youtube-nocookie.com");
    expect(src.pathname).toBe("/embed/dQw4w9WgXcQ");
    expect(src.searchParams.get("autoplay")).toBe("0");
    expect(src.searchParams.get("playsinline")).toBe("1");
    expect(src.searchParams.get("enablejsapi")).toBe("1");
    expect(src.searchParams.get("origin")).toBe(window.location.origin);
    expect(onPlay).not.toHaveBeenCalled();

    act(() => latestOptions.events.onStateChange({ data: 2 }));
    expect(onPlay).not.toHaveBeenCalled();

    act(() => latestOptions.events.onStateChange({ data: 1 }));
    act(() => latestOptions.events.onStateChange({ data: 1 }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});
