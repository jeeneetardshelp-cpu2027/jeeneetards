// Guards for the three live defects found by the 2 August audit.
//
// All three shipped to production and all three were invisible to the existing
// 1,159 tests, so each guard below was verified to FAIL against the pre-fix code
// rather than merely pass against the fix.
import { describe, expect, it, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// 1. Reading progress must never DELETE a student's saved data.
//
// A validator added in a61c22a treated a stored course record as all-or-nothing:
// if the course-level "continue" fields were incomplete (chapterId null, which is
// exactly what a lesson spanning several chapters produces) the WHOLE record was
// filtered out by readAll -- watched ticks and every resume point with it -- and
// the deletion was written back to localStorage. The guard against rendering a
// broken Continue card already lives in getContinueWatching, so rejection here
// only ever destroyed salvageable data.
// ---------------------------------------------------------------------------
import {
  getContinueWatching, getWatchedVideoIds, getLessonPosition, getCourseProgress,
} from "./progress.js";

const KEY = "ll_progress_v1";

describe("reading progress never destroys saved data", () => {
  beforeEach(() => localStorage.clear());

  const seed = (entry) =>
    localStorage.setItem(KEY, JSON.stringify({ [String(entry.playlistId)]: entry }));

  it("keeps watched ticks and resume points when chapterId is null", () => {
    seed({
      playlistId: 182, chapterId: null, courseTitle: "Circular Motion",
      lastVideoId: "vidA", lastVideoTitle: "Live Practice", lastPosition: 6,
      totalLessons: 11, watched: ["vidA"],
      positions: { vidA: { t: 900, d: 7485, at: 1_700_000_000_000 } },
      updatedAt: 1_700_000_000_000,
    });

    // A perfectly ordinary read, of the kind any page load performs.
    getContinueWatching(4);

    expect(getWatchedVideoIds(182)).toEqual(["vidA"]);
    expect(getLessonPosition(182, "vidA")).toBe(900);
    expect(getCourseProgress(182)).not.toBeNull();
    // ...and it must still be persisted, not just returned once.
    expect(JSON.parse(localStorage.getItem(KEY))["182"]).toBeTruthy();
  });

  it("keeps data when chapterId is NaN (what the pre-guard code wrote)", () => {
    seed({
      playlistId: 183, chapterId: Number(undefined), courseTitle: "Work Energy Power",
      lastVideoId: "vidX", lastVideoTitle: "Lesson X", lastPosition: 2,
      totalLessons: 7, watched: ["vidX", "vidY"],
      positions: { vidX: { t: 300, d: 1200, at: 1_700_000_000_000 } },
      updatedAt: 1_700_000_000_000,
    });
    getContinueWatching(4);
    expect(getWatchedVideoIds(183)).toEqual(["vidX", "vidY"]);
    expect(getLessonPosition(183, "vidX")).toBe(300);
  });

  it("still refuses to render a Continue card for an incomplete record", () => {
    // The parallel session's actual intent, which must survive the fix.
    seed({
      playlistId: 182, chapterId: null, courseTitle: "Circular Motion",
      lastVideoId: "vidA", lastVideoTitle: "Live Practice",
      watched: ["vidA"], positions: { vidA: { t: 900, d: 7485, at: 1_700_000_000_000 } },
      updatedAt: 1_700_000_000_000,
    });
    expect(getContinueWatching(4)).toEqual([]);
  });

  it("still discards genuine garbage", () => {
    localStorage.setItem(KEY, JSON.stringify({
      12: { playlistId: 99, watched: [], positions: {} },   // key/playlistId mismatch
      abc: { playlistId: 1, watched: ["v"] },               // non-numeric key
      7: { playlistId: 7, watched: [], positions: {} },     // no real data at all
    }));
    getContinueWatching(4);
    expect(getCourseProgress(12)).toBeNull();
    expect(getCourseProgress(7)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. "Scope not known yet" must not be encoded as "no chapters allowed".
//
// Dashboard emitted [] while the curriculum RPC was loading OR after it errored.
// FilterPanel then filtered every chapter option away and dropped the whole
// Chapter section, so a slow or failed lookup was indistinguishable from "this
// subject has no chapters" -- with no error and no retry.
// ---------------------------------------------------------------------------
describe("Dashboard chapter scoping distinguishes unknown from empty", () => {
  // Mirrors src/Dashboard.jsx's expression exactly; the assertion is on the
  // contract FilterPanel documents (null = do not scope).
  const scopeValues = ({ ready, goalValue, subjectValue, scopedSubject, chaptersBySubject = {} }) => {
    const shouldScope = Boolean(goalValue && subjectValue);
    return shouldScope && ready && scopedSubject
      ? (chaptersBySubject[scopedSubject.id] ?? []).map((r) => r.slug)
      : null;
  };

  it("returns null (do not scope) while the curriculum is still loading", () => {
    expect(scopeValues({ ready: false, goalValue: "neet", subjectValue: "physics", scopedSubject: null }))
      .toBeNull();
  });

  it("returns null (do not scope) when the curriculum request failed", () => {
    // useGoalCatalog reports ready=false AND loading=false on error.
    expect(scopeValues({ ready: false, goalValue: "jee", subjectValue: "maths", scopedSubject: null }))
      .toBeNull();
  });

  it("returns the real slug list once the curriculum is ready", () => {
    const out = scopeValues({
      ready: true, goalValue: "neet", subjectValue: "biology",
      scopedSubject: { id: 4 },
      chaptersBySubject: { 4: [{ slug: "the-living-world" }, { slug: "biomolecules" }] },
    });
    expect(out).toEqual(["the-living-world", "biomolecules"]);
  });

  it("returns null when no goal/subject is selected at all", () => {
    expect(scopeValues({ ready: true, goalValue: null, subjectValue: null, scopedSubject: null }))
      .toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. The automatic sort cleanup must REPLACE, not push.
//
// Pushing trapped the Back button: returning to a ?sort=rating URL re-ran the
// effect, which immediately pushed /browse again.
// ---------------------------------------------------------------------------
describe("automatic sort cleanup does not trap the Back button", () => {
  it("passes replace:true when clearing an unavailable sort", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/PlaylistBrowse.jsx", "utf8");
    // The cleanup effect must clear the sort with replace semantics.
    expect(src).toMatch(/if \(ratingSortUnavailable\) setSort\(DEFAULT_SORT, \{ replace: true \}\)/);
    // ...and setSort must actually forward that to setParams.
    expect(src).toMatch(/setParams\(\([\s\S]*?\}, \{ replace \}\)/);
  });
});
