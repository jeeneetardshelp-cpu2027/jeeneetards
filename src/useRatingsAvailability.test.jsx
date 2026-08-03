import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  gte: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { from: mocks.from },
}));

import { RATING_CONFIDENCE_MIN } from "./ratingConfidence.js";
import { fetchRatingsAvailability, useRatingsAvailability } from "./useRatingsAvailability.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ gte: mocks.gte });
});

describe("ratings availability", () => {
  it("reports false when no course has a genuine rating", async () => {
    mocks.gte.mockResolvedValue({ count: 0, error: null });

    await expect(fetchRatingsAvailability()).resolves.toBe(false);
    expect(mocks.from).toHaveBeenCalledWith("playlists");
    expect(mocks.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    // Must gate on the shared confidence minimum, not on "> 0" -- otherwise a
    // single vote arms a sort that orders the catalogue by a raw average the
    // site refuses to display anywhere else.
    expect(mocks.gte).toHaveBeenCalledWith("ratings_count", RATING_CONFIDENCE_MIN);
    expect(RATING_CONFIDENCE_MIN).toBeGreaterThan(1);
  });

  it("reports true only once a course clears the confidence minimum", async () => {
    mocks.gte.mockResolvedValue({ count: 1, error: null });
    await expect(fetchRatingsAvailability()).resolves.toBe(true);
  });

  it("updates the hook after the catalogue check completes", async () => {
    mocks.gte.mockResolvedValue({ count: 0, error: null });
    const { result } = renderHook(() => useRatingsAvailability());

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("leaves availability unknown when the optional check fails", async () => {
    mocks.gte.mockResolvedValue({ count: null, error: { message: "offline" } });
    const { result } = renderHook(() => useRatingsAvailability());

    await waitFor(() => expect(mocks.gte).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
