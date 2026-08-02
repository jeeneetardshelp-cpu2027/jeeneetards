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

import { fetchRatingsAvailability, useRatingsAvailability } from "./useRatingsAvailability.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ gt: mocks.gt });
});

describe("ratings availability", () => {
  it("reports false when no course has a genuine rating", async () => {
    mocks.gt.mockResolvedValue({ count: 0, error: null });

    await expect(fetchRatingsAvailability()).resolves.toBe(false);
    expect(mocks.from).toHaveBeenCalledWith("playlists");
    expect(mocks.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(mocks.gt).toHaveBeenCalledWith("ratings_count", 0);
  });

  it("reports true as soon as at least one rated course exists", async () => {
    mocks.gt.mockResolvedValue({ count: 1, error: null });
    await expect(fetchRatingsAvailability()).resolves.toBe(true);
  });

  it("updates the hook after the catalogue check completes", async () => {
    mocks.gt.mockResolvedValue({ count: 0, error: null });
    const { result } = renderHook(() => useRatingsAvailability());

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("leaves availability unknown when the optional check fails", async () => {
    mocks.gt.mockResolvedValue({ count: null, error: { message: "offline" } });
    const { result } = renderHook(() => useRatingsAvailability());

    await waitFor(() => expect(mocks.gt).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
