import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = [];
let fail = false;
let failAtRangeStart = null;
let serverRowCap = Infinity;
let suppressCount = false;
let playlistData;
let lessonData;

function builder(table) {
  const call = {
    table, cols: null, selectOptions: null, eq: {}, orders: [], range: null, signal: null,
  };
  calls.push(call);
  const response = () => {
    if (fail || (table === "playlist_videos" && call.range?.[0] === failAtRangeStart)) {
      return { data: null, error: { code: "500", message: "database unavailable" } };
    }
    if (table === "playlists") return { data: playlistData, error: null };

    const start = call.range?.[0] ?? 0;
    const requestedEnd = call.range?.[1] ?? lessonData.length - 1;
    const count = call.selectOptions?.count === "exact" && !suppressCount
      ? lessonData.length
      : null;
    if (start >= lessonData.length && start > 0) {
      return {
        data: null,
        count,
        error: { code: "PGRST103", message: "Requested range not satisfiable" },
      };
    }
    const cappedEnd = Math.min(requestedEnd + 1, start + serverRowCap);
    return { data: lessonData.slice(start, cappedEnd), error: null, count };
  };
  const b = {
    select(cols, options) { call.cols = cols; call.selectOptions = options ?? null; return b; },
    eq(key, value) { call.eq[key] = value; return b; },
    order(key, options) { call.orders.push([key, options]); return b; },
    range(start, end) { call.range = [start, end]; return b; },
    abortSignal(signal) { call.signal = signal; return b; },
    maybeSingle() { return Promise.resolve(response()); },
    then(resolve) { return Promise.resolve(response()).then(resolve); },
  };
  return b;
}

vi.mock("./supabaseClient.js", () => ({
  isSupabaseConfigured: true,
  supabase: { from: (table) => builder(table) },
}));

import { usePlaylistVideos } from "./usePlaylistVideos.js";

let seen;
function Probe({ playlistId = "4" }) {
  seen = usePlaylistVideos(playlistId);
  return null;
}

beforeEach(() => {
  calls.length = 0;
  fail = false;
  failAtRangeStart = null;
  serverRowCap = Infinity;
  suppressCount = false;
  playlistData = {
    id: 4, title: "Course", ratings_count: 0,
    institutes_channels: null, subjects: null,
    playlist_learning_goals: [], playlist_class_levels: [], class_levels: [],
  };
  lessonData = [{
    id: 90,
    position: 1,
    videos: {
      id: 9, youtube_video_id: "abcdefghijk", title: "Lesson", description: null,
      duration_seconds: 1200, embedding_status: "embeddable",
      last_verified_at: null, chapters: null, subjects: null,
    },
  }];
});

describe("bounded course detail query", () => {
  it("requests one exact course and only its ordered lessons", async () => {
    render(<Probe />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(calls).toHaveLength(2);
    expect(calls[0].table).toBe("playlists");
    expect(calls[0].eq.id).toBe(4);
    expect(calls[0].cols).toContain("average_rating");
    expect(calls[0].cols).toContain("playlist_class_levels");
    expect(calls[0].cols).toContain("institutes_channels(name, logo_url)");
    expect(calls[1].table).toBe("playlist_videos");
    expect(calls[1].eq.playlist_id).toBe(4);
    expect(calls[1].orders).toEqual([
      ["position", { ascending: true }],
      ["id", { ascending: true }],
    ]);
    expect(calls[1].range).toEqual([0, 499]);
    expect(calls[1].selectOptions).toEqual({ count: "exact" });
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
    expect(calls[1].signal).toBeInstanceOf(AbortSignal);
    expect(calls[1].cols).toContain("embedding_status");
    expect(seen.lessons).toHaveLength(1);
  });

  it("does not query an invalid shared link", async () => {
    render(<Probe playlistId="not-an-id" />);
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(calls).toHaveLength(0);
    expect(seen.course).toBeNull();
  });

  it("retries the same bounded query after a transient failure", async () => {
    fail = true;
    render(<Probe />);
    await waitFor(() => expect(seen.error).toBe("Couldn’t load this course."));
    expect(calls).toHaveLength(2);

    fail = false;
    await act(() => seen.reload());
    await waitFor(() => expect(seen.loading).toBe(false));
    expect(seen.error).toBeNull();
    expect(seen.course.title).toBe("Course");
    expect(calls).toHaveLength(4);
  });

  it("loads every lesson across explicit PostgREST pages", async () => {
    lessonData = Array.from({ length: 1201 }, (_, index) => ({
      id: index + 1,
      position: index + 1,
      videos: {
        id: index + 1,
        youtube_video_id: `video-${index + 1}`,
        title: `Lesson ${index + 1}`,
        description: null,
        duration_seconds: 60,
        embedding_status: "embeddable",
        last_verified_at: null,
        chapters: null,
        subjects: null,
      },
    }));

    render(<Probe />);
    await waitFor(() => expect(seen.loading).toBe(false));

    expect(seen.lessons).toHaveLength(1201);
    expect(calls.filter((call) => call.table === "playlist_videos").map((call) => call.range)).toEqual([
      [0, 499], [500, 999], [1000, 1200],
    ]);
    expect(seen.lessons.at(-1).title).toBe("Lesson 1201");
  });

  it("fails the whole course instead of presenting a truncated sequence", async () => {
    lessonData = Array.from({ length: 700 }, (_, index) => ({
      id: index + 1,
      position: index + 1,
      videos: {
        id: index + 1, youtube_video_id: `video-${index + 1}`, title: `Lesson ${index + 1}`,
        description: null, duration_seconds: 60, embedding_status: "embeddable",
        last_verified_at: null, chapters: null, subjects: null,
      },
    }));
    failAtRangeStart = 500;

    render(<Probe />);
    await waitFor(() => expect(seen.loading).toBe(false));

    expect(seen.error).toBe("Couldn’t load this course.");
    expect(seen.lessons).toHaveLength(0);
  });

  it.each([500, 1000])("does not request a known out-of-range page for exactly %i lessons", async (count) => {
    lessonData = Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      position: index + 1,
      videos: {
        id: index + 1, youtube_video_id: `video-${index + 1}`, title: `Lesson ${index + 1}`,
        description: null, duration_seconds: 60, embedding_status: "embeddable",
        last_verified_at: null, chapters: null, subjects: null,
      },
    }));

    render(<Probe />);
    await waitFor(() => expect(seen.loading).toBe(false));

    expect(seen.error).toBeNull();
    expect(seen.lessons).toHaveLength(count);
    expect(calls.filter((call) => call.table === "playlist_videos")).toHaveLength(count / 500);
  });

  it("adapts when the server row cap is smaller than the requested page", async () => {
    serverRowCap = 100;
    lessonData = Array.from({ length: 251 }, (_, index) => ({
      id: index + 1,
      position: index + 1,
      videos: {
        id: index + 1, youtube_video_id: `video-${index + 1}`, title: `Lesson ${index + 1}`,
        description: null, duration_seconds: 60, embedding_status: "embeddable",
        last_verified_at: null, chapters: null, subjects: null,
      },
    }));

    render(<Probe />);
    await waitFor(() => expect(seen.loading).toBe(false));

    expect(seen.error).toBeNull();
    expect(seen.lessons).toHaveLength(251);
    expect(calls.filter((call) => call.table === "playlist_videos").map((call) => call.range)).toEqual([
      [0, 499], [100, 250], [200, 250],
    ]);
  });

  it("fails closed when PostgREST omits the exact count", async () => {
    suppressCount = true;
    render(<Probe />);
    await waitFor(() => expect(seen.loading).toBe(false));

    expect(seen.error).toBe("Couldn’t load this course.");
    expect(seen.lessons).toHaveLength(0);
  });

  it("accepts a real course whose lesson sequence is empty", async () => {
    lessonData = [];
    render(<Probe />);
    await waitFor(() => expect(seen.loading).toBe(false));

    expect(seen.error).toBeNull();
    expect(seen.course.title).toBe("Course");
    expect(seen.lessons).toEqual([]);
  });

  it("aborts the old course requests when the route changes", async () => {
    const view = render(<Probe playlistId="4" />);
    await waitFor(() => expect(seen.loading).toBe(false));
    const oldSignals = calls.map((call) => call.signal);

    view.rerender(<Probe playlistId="5" />);
    await waitFor(() => expect(calls).toHaveLength(4));
    await waitFor(() => expect(seen.loading).toBe(false));

    expect(oldSignals.every((signal) => signal?.aborted)).toBe(true);
    expect(calls.slice(2).every((call) => call.signal && !call.signal.aborted)).toBe(true);
  });
});
