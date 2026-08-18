// Mirror of useRatingsAvailability.test.jsx for the popularity-driven sorts.
//
// "Most popular" and "Most viewed" order by playlists.popularity_score and
// view_count_total, both filled only by the video_stats rollup job. Until it
// runs they are 0 catalogue-wide, so the sorts rank nothing. This hook is the
// positive check that lets the browse page hide them.
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  gt: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { from: mocks.from },
}));

import {
  fetchPopularityAvailability, usePopularityAvailability,
} from "./usePopularityAvailability.js";

// Each call chains .from().select().gt(); return per-column counts by inspecting
// the column passed to .gt().
function armCounts({ popularity_score, view_count_total }) {
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ gt: mocks.gt });
  mocks.gt.mockImplementation((column) =>
    Promise.resolve({
      count: column === "popularity_score" ? popularity_score : view_count_total,
      error: null,
    }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("popularity availability", () => {
  it("reports both false when neither column has a positive value", async () => {
    armCounts({ popularity_score: 0, view_count_total: 0 });

    await expect(fetchPopularityAvailability()).resolves.toEqual({ popular: false, views: false });
    expect(mocks.from).toHaveBeenCalledWith("playlists");
    expect(mocks.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    // The measured production state: 0 of 419 courses have a view count.
    expect(mocks.gt).toHaveBeenCalledWith("popularity_score", 0);
    expect(mocks.gt).toHaveBeenCalledWith("view_count_total", 0);
  });

  it("reports each sort independently once its own column has data", async () => {
    armCounts({ popularity_score: 3, view_count_total: 0 });
    await expect(fetchPopularityAvailability()).resolves.toEqual({ popular: true, views: false });
  });

  it("updates the hook after the check completes", async () => {
    armCounts({ popularity_score: 0, view_count_total: 0 });
    const { result } = renderHook(() => usePopularityAvailability());

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual({ popular: false, views: false }));
  });

  it("leaves availability unknown when the optional check fails", async () => {
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ gt: mocks.gt });
    mocks.gt.mockResolvedValue({ count: null, error: { message: "offline" } });

    const { result } = renderHook(() => usePopularityAvailability());
    await waitFor(() => expect(mocks.gt).toHaveBeenCalled());
    // Null, never a partial object: an error must keep the controls, not hide
    // a sort on a failed check.
    expect(result.current).toBeNull();
  });
});
