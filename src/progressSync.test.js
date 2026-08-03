// progressSync.test.js — sync throttling + server-row mapping, isolated from
// the network via a mocked supabaseClient (same pattern as
// CourseRatingAuth.test.jsx).
//
// Each test that exercises the throttle uses its own videoDbId: the throttle
// map is module-level state that outlives any single test, so reusing an id
// across tests would leak timing between them.

import { describe, it, expect, vi, beforeEach } from "vitest";

const upsertMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })));
// The pull chains .eq().order().range(); tests stub the RESULT via rangeMock.
// rangeCalls records each page request so pagination itself can be asserted.
const rangeMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: [], error: null })));
const rangeCalls = vi.hoisted(() => ({ current: [] }));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      upsert: upsertMock,
      select() { return this; },
      eq() { return this; },
      order() { return this; },
      range(from, to) { rangeCalls.current.push([from, to]); return rangeMock(from, to); },
    }),
  },
}));

import { queueProgressSync, pullServerProgress } from "./progressSync.js";

let nextVideoDbId = 1000;
function freshEntry(overrides = {}) {
  return {
    playlistId: 1, videoDbId: nextVideoDbId++, chapterId: 7,
    position: 100, duration: 900, watched: true, ...overrides,
  };
}

beforeEach(() => {
  upsertMock.mockClear();
  rangeCalls.current = [];
  rangeMock.mockClear();
});

describe("queueProgressSync throttling", () => {
  it("syncs immediately the first time for a given video", () => {
    queueProgressSync("user-1", freshEntry());
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("skips a second call for the same video within the throttle window", () => {
    const entry = freshEntry();
    queueProgressSync("user-1", entry);
    queueProgressSync("user-1", { ...entry, position: 105 });
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });

  it("force bypasses the throttle", () => {
    const entry = freshEntry();
    queueProgressSync("user-1", entry);
    queueProgressSync("user-1", { ...entry, position: 110 }, { force: true });
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });

  it("a different video is not throttled by another video's recent sync", () => {
    queueProgressSync("user-1", freshEntry());
    queueProgressSync("user-1", freshEntry());
    expect(upsertMock).toHaveBeenCalledTimes(2);
  });

  it("does nothing without a signed-in user", () => {
    queueProgressSync(null, freshEntry());
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("does nothing without a playlistId or videoDbId", () => {
    queueProgressSync("user-1", freshEntry({ videoDbId: undefined }));
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("sends the expected row shape and onConflict target", () => {
    const entry = freshEntry({ videoDbId: 42 });
    queueProgressSync("user-1", entry);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1", playlist_id: 1, video_id: 42, chapter_id: 7,
        position_seconds: 100, duration_seconds: 900, watched: true,
      }),
      { onConflict: "user_id,playlist_id,video_id" },
    );
  });
});

describe("pullServerProgress", () => {
  it("maps rows into mergeRemoteEntry-shaped objects", async () => {
    rangeMock.mockResolvedValueOnce({
      data: [
        {
          playlist_id: 5, chapter_id: 12, position_seconds: 300, duration_seconds: 900,
          watched: true, updated_at: "2026-07-01T00:00:00.000Z",
          videos: { youtube_video_id: "abc123", title: "Lesson 1" },
          playlists: { title: "Mechanics" },
        },
      ],
      error: null,
    });
    const rows = await pullServerProgress("user-1");
    expect(rows).toEqual([{
      playlistId: 5, chapterId: 12, courseTitle: "Mechanics", videoId: "abc123",
      videoTitle: "Lesson 1", position: 300, duration: 900, watched: true,
      updatedAt: new Date("2026-07-01T00:00:00.000Z").getTime(),
    }]);
  });

  it("drops a row whose embedded video is missing (deleted video, broken FK)", async () => {
    rangeMock.mockResolvedValueOnce({
      data: [{ playlist_id: 5, videos: null, playlists: null, updated_at: "2026-07-01T00:00:00.000Z" }],
      error: null,
    });
    expect(await pullServerProgress("user-1")).toEqual([]);
  });

  it("returns [] on a query error instead of throwing", async () => {
    rangeMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await pullServerProgress("user-1")).toEqual([]);
  });

  it("does nothing without a signed-in user", async () => {
    expect(await pullServerProgress(null)).toEqual([]);
    expect(rangeMock).not.toHaveBeenCalled();
  });
});

describe("pullServerProgress pagination", () => {
  const row = (i) => ({
    playlist_id: 5, chapter_id: 12, position_seconds: 100 + i, duration_seconds: 900,
    watched: true, updated_at: "2026-07-01T00:00:00.000Z",
    videos: { youtube_video_id: `vid${i}`, title: `Lesson ${i}` },
    playlists: { title: "Mechanics" },
  });

  it("keeps fetching past PostgREST's 1000-row cap instead of silently truncating", async () => {
    // A student with more than one page of saved positions. An unpaged select
    // would hand back only the first 1000 and report that as the whole history.
    const page1 = Array.from({ length: 1000 }, (_, i) => row(i));
    const page2 = Array.from({ length: 37 }, (_, i) => row(1000 + i));
    rangeMock
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: page2, error: null });

    const rows = await pullServerProgress("user-1");

    expect(rows).toHaveLength(1037);
    expect(rangeCalls.current).toEqual([[0, 999], [1000, 1999]]);
  });

  it("stops after a short page rather than looping forever", async () => {
    rangeMock.mockResolvedValueOnce({ data: [row(1)], error: null });
    const rows = await pullServerProgress("user-1");
    expect(rows).toHaveLength(1);
    expect(rangeCalls.current).toEqual([[0, 999]]);
  });

  it("keeps the pages it already has when a later page errors", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => row(i));
    rangeMock
      .mockResolvedValueOnce({ data: page1, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const rows = await pullServerProgress("user-1");
    expect(rows).toHaveLength(1000); // partial history beats none
  });
});
