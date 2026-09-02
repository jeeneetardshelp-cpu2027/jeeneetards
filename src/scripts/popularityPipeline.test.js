// The popularity pipeline's two silent failures.
//
// Both looked exactly like success in the console, and both would have shipped
// a ranking that meant something other than what it claimed:
//
//   1. published_at was null on all 5,471 videos, so viewsPerDay divided by an
//      age of 1 and returned raw views, and recencyFactor returned its
//      unknown-age constant. popularity_score collapsed to log(view count) —
//      the big-old-channel bias this site positions itself against.
//   2. Every table read was unbounded, and PostgREST silently caps those at
//      1,000 rows. The job saw 1,000 of 5,471 videos and 1,000 of 5,477
//      playlist_videos, so 82% of the catalogue never got stats and course
//      popularity was rolled up from a fifth of its members.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { computeVideoStats, popularityScore, viewsPerDay } from "./statsMath.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const source = (file) => readFileSync(resolve(HERE, file), "utf8");

const NOW = new Date("2026-09-01T00:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400_000).toISOString();

describe("age fairness is actually applied", () => {
  it("turns a view total into a rate", () => {
    // 717,673 views over ~6 years is ~318/day, not 717,673/day.
    expect(viewsPerDay(717673, daysAgo(2256), NOW)).toBeCloseTo(318.1, 0);
  });

  it("ranks a fast young video above a slow old one", () => {
    // This is the promise in statsMath.js's own comment. With publishedAt
    // missing it was never kept: the older video simply had more views.
    const young = popularityScore(300_000, daysAgo(14), NOW);
    const old = popularityScore(1_000_000, daysAgo(1095), NOW);
    expect(young).toBeGreaterThan(old);
  });

  it("degrades to raw views when the age is unknown — the old behaviour", () => {
    // Pinned so the failure mode is recognisable if it ever returns: with no
    // date, the rate IS the total and ordering is by view count alone.
    expect(viewsPerDay(42142, null, NOW)).toBe(42142);
    const a = popularityScore(1_000_000, null, NOW);
    const b = popularityScore(300_000, null, NOW);
    expect(a).toBeGreaterThan(b);
  });

  it("computeVideoStats uses the date it is handed", () => {
    const withDate = computeVideoStats(
      { viewCount: 717673, likeCount: 12184, publishedAt: daysAgo(2256) }, NOW,
    );
    const without = computeVideoStats(
      { viewCount: 717673, likeCount: 12184, publishedAt: null }, NOW,
    );
    expect(withDate.views_per_day).toBeLessThan(without.views_per_day);
    expect(withDate.views_per_day).toBeCloseTo(318.12, 1);
    expect(without.views_per_day).toBe(717673);
  });
});

// Source-level, because the bug is an ABSENCE — a missing .range() and a
// missing part — and no unit test of the maths can see either.
describe("the job reads whole tables and asks for the date", () => {
  const refresh = source("refreshVideoStats.js");
  const youtube = source("youtubeNode.js");

  it("requests publishedAt on the same call as the statistics", () => {
    expect(youtube).toContain('part: "statistics,snippet"');
    expect(youtube).toContain("publishedAt: it.snippet?.publishedAt ?? null");
  });

  it("prefers the freshly fetched date over the row's stale null", () => {
    expect(refresh).toContain("s.publishedAt ?? video.published_at ?? null");
  });

  it("backfills the date it learned, so the next run need not ask again", () => {
    expect(refresh).toContain("published_at: s.publishedAt");
    // UPDATE, never upsert. videos.id is GENERATED ALWAYS, so any statement
    // naming it is refused — "cannot insert a non-DEFAULT value into column
    // id" — and an upsert always names its conflict target. That killed the
    // whole run before a single stat row was written.
    expect(refresh).toContain('db.from("videos").update({ published_at }).eq("id", id)');
    expect(refresh).not.toMatch(/from\("videos"\)[\s\S]{0,40}\.upsert\(/);
  });

  it("does not let a failed backfill cost the run its stats", () => {
    // The backfill is an optimisation — the stats written below already use
    // the date fetched from YouTube — so failing hard here would throw away
    // the run's actual work for a nicety.
    const block = refresh.slice(
      refresh.indexOf("const backfill = []"),
      refresh.indexOf("Would upsert"),
    );
    expect(block).not.toContain("fail(`backfilling");
  });

  it("pages every table read, so none is silently capped at 1000", () => {
    // The four reads that feed the job. An unbounded .select() on any of them
    // is the bug returning.
    for (const table of ["videos", "video_stats", "playlist_videos"]) {
      expect(refresh, table).toContain(`readAll(db, "${table}"`);
    }
    expect(refresh).toMatch(/\.range\(from, from \+ PAGE - 1\)/);
    expect(refresh).toContain("const PAGE = 1000");
  });

  it("orders each page by a column that table actually has", () => {
    // video_stats is keyed by video_id and has no id; ordering by a missing
    // column fails the whole run.
    expect(refresh).toContain('readAll(db, "video_stats", "video_id, fetched_at", "video_id")');
  });
});
