// statsMath.js — pure, testable math behind popularity sorting.
//
// Kept free of any network/DB/clock access (the caller passes `now`) so every
// formula can be unit-tested deterministically. Constants are named and
// documented so they can be tuned after seeing real data — the same
// "explainable, not a black box" rule the tag-classifier follows.

// Popularity half-life: how fast a video's recency weight decays. At
// HALF_LIFE_DAYS old, recency_factor = 0.5. Larger = age matters less.
export const HALF_LIFE_DAYS = 180;

// When published_at is unknown we can't age-weight fairly. Use a neutral-ish
// factor rather than pretending the video is brand new (which would unfairly
// boost undated rows to the top).
const UNKNOWN_AGE_RECENCY = 0.5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole days between publish and now, floored at 0. Returns null if undated.
export function ageInDays(publishedAt, now) {
  if (!publishedAt) return null;
  const published = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - published.getTime()) / MS_PER_DAY));
}

// Age-fair rate: total views spread over the video's lifetime. A 2-week-old
// video with 300k views out-rates a 3-year-old with 1M on this measure.
export function viewsPerDay(viewCount, publishedAt, now) {
  const views = Number(viewCount) || 0;
  const age = ageInDays(publishedAt, now);
  return views / Math.max(age ?? 1, 1);
}

// Decays from 1 (brand new) toward 0 (old) with the half-life above.
export function recencyFactor(publishedAt, now, halfLife = HALF_LIFE_DAYS) {
  const age = ageInDays(publishedAt, now);
  if (age === null) return UNKNOWN_AGE_RECENCY;
  return 1 / (1 + age / halfLife);
}

// The "Most popular" signal: log-dampened views (so a viral outlier doesn't
// bury everything) times recency (so fresh, fast-growing content competes).
export function popularityScore(viewCount, publishedAt, now) {
  const views = Math.max(Number(viewCount) || 0, 0);
  return Math.log10(views + 1) * recencyFactor(publishedAt, now);
}

// One call → the three values the refresh job writes per video.
export function computeVideoStats({ viewCount, likeCount, publishedAt }, now) {
  return {
    view_count: viewCount == null ? null : Number(viewCount),
    like_count: likeCount == null ? null : Number(likeCount),
    views_per_day: Number(viewsPerDay(viewCount, publishedAt, now).toFixed(2)),
    popularity_score: Number(popularityScore(viewCount, publishedAt, now).toFixed(4)),
  };
}

export function median(numbers) {
  const xs = numbers.filter((n) => typeof n === "number" && !Number.isNaN(n)).sort((a, b) => a - b);
  if (xs.length === 0) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
}

// Aggregate a course's member-video stats into the playlist rollup columns.
// view_count_total = SUM (total reach); popularity_score = MEDIAN of member
// scores (median, not sum, so a 40-lesson course doesn't auto-beat a tight
// 12-lesson one); stats_fetched_at = OLDEST member fetch, so freshness shown
// to students is never more optimistic than the truth.
export function rollupPlaylist(memberStats = []) {
  if (memberStats.length === 0) {
    return { view_count_total: 0, popularity_score: 0, stats_fetched_at: null };
  }
  const viewTotal = memberStats.reduce((sum, s) => sum + (Number(s.view_count) || 0), 0);
  const score = median(memberStats.map((s) => Number(s.popularity_score) || 0));
  const oldest = memberStats
    .map((s) => s.fetched_at)
    .filter(Boolean)
    .sort()[0] ?? null;
  return {
    view_count_total: viewTotal,
    popularity_score: Number(score.toFixed(4)),
    stats_fetched_at: oldest,
  };
}

// Which videos need a fetch: never-fetched, or older than the refresh interval.
export function isStale(fetchedAt, now, intervalDays) {
  if (!fetchedAt) return true;
  const age = ageInDays(fetchedAt, now);
  return age === null || age >= intervalDays;
}
