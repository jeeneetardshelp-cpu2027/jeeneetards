import { describe, expect, it } from "vitest";
import {
  ageInDays,
  computeVideoStats,
  isStale,
  median,
  popularityScore,
  recencyFactor,
  rollupPlaylist,
  viewsPerDay,
  HALF_LIFE_DAYS,
} from "./statsMath.js";

const NOW = new Date("2026-07-25T00:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("ageInDays", () => {
  it("counts whole days since publish", () => {
    expect(ageInDays(daysAgo(30), NOW)).toBe(30);
  });
  it("returns null for missing or unparseable dates", () => {
    expect(ageInDays(null, NOW)).toBeNull();
    expect(ageInDays("not-a-date", NOW)).toBeNull();
  });
  it("never goes negative for a future date", () => {
    expect(ageInDays(daysAgo(-5), NOW)).toBe(0);
  });
});

describe("viewsPerDay", () => {
  it("spreads views across the lifetime", () => {
    expect(viewsPerDay(3000, daysAgo(30), NOW)).toBe(100);
  });
  it("never divides by zero for a same-day upload", () => {
    expect(viewsPerDay(500, daysAgo(0), NOW)).toBe(500);
  });
});

describe("recencyFactor", () => {
  it("is 0.5 at exactly one half-life", () => {
    expect(recencyFactor(daysAgo(HALF_LIFE_DAYS), NOW)).toBeCloseTo(0.5, 5);
  });
  it("is near 1 for a brand-new video", () => {
    expect(recencyFactor(daysAgo(0), NOW)).toBeCloseTo(1, 5);
  });
  it("uses a neutral factor when the date is unknown", () => {
    expect(recencyFactor(null, NOW)).toBe(0.5);
  });
});

describe("popularityScore", () => {
  it("a fresh, fast-growing video can beat an old viral one", () => {
    const oldViral = popularityScore(1_000_000, daysAgo(1000), NOW);
    const freshHit = popularityScore(150_000, daysAgo(10), NOW);
    expect(freshHit).toBeGreaterThan(oldViral); // recency wins over raw size
  });
  it("log-dampens so a 10x view gap is not a 10x score gap", () => {
    const a = popularityScore(100_000, daysAgo(30), NOW);
    const b = popularityScore(1_000_000, daysAgo(30), NOW);
    expect(b / a).toBeLessThan(2); // one extra order of magnitude ≈ +1 in log10
  });
  it("handles zero views without NaN/Infinity", () => {
    const s = popularityScore(0, daysAgo(30), NOW);
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBe(0);
  });
});

describe("computeVideoStats", () => {
  it("produces the row the refresh job writes", () => {
    const row = computeVideoStats(
      { viewCount: "3000", likeCount: "250", publishedAt: daysAgo(30) },
      NOW,
    );
    expect(row.view_count).toBe(3000);
    expect(row.like_count).toBe(250);
    expect(row.views_per_day).toBe(100);
    expect(row.popularity_score).toBeGreaterThan(0);
  });
  it("preserves null likes (creator hid them)", () => {
    const row = computeVideoStats({ viewCount: "10", likeCount: null, publishedAt: daysAgo(5) }, NOW);
    expect(row.like_count).toBeNull();
  });
});

describe("median", () => {
  it("odd length", () => expect(median([3, 1, 2])).toBe(2));
  it("even length averages the middle two", () => expect(median([1, 2, 3, 4])).toBe(2.5));
  it("empty is 0", () => expect(median([])).toBe(0));
});

describe("rollupPlaylist", () => {
  it("sums views, medians the score, and reports the OLDEST fetch", () => {
    const roll = rollupPlaylist([
      { view_count: 1000, popularity_score: 2, fetched_at: "2026-07-20T00:00:00Z" },
      { view_count: 3000, popularity_score: 6, fetched_at: "2026-07-18T00:00:00Z" },
      { view_count: 2000, popularity_score: 4, fetched_at: "2026-07-24T00:00:00Z" },
    ]);
    expect(roll.view_count_total).toBe(6000);
    expect(roll.popularity_score).toBe(4); // median of 2,4,6
    expect(roll.stats_fetched_at).toBe("2026-07-18T00:00:00Z"); // oldest = most honest
  });
  it("an empty course rolls up to zeros, not NaN", () => {
    expect(rollupPlaylist([])).toEqual({
      view_count_total: 0,
      popularity_score: 0,
      stats_fetched_at: null,
    });
  });
});

describe("isStale", () => {
  it("never-fetched is stale", () => expect(isStale(null, NOW, 7)).toBe(true));
  it("older than the interval is stale", () => expect(isStale(daysAgo(8), NOW, 7)).toBe(true));
  it("within the interval is fresh", () => expect(isStale(daysAgo(3), NOW, 7)).toBe(false));
});
