// searchHistory.test.js — the device-local memory of searches that worked.
//
// Three properties matter more than the rest, and each has a test that fails
// loudly if it stops holding:
//
//   1. ONLY SUCCESSFUL QUERIES. Offering a student their own dead ends back is
//      worse than offering nothing, so a zero-result search is never stored.
//   2. IT DEGRADES, IT DOES NOT THROW. A school-lab machine or a private
//      window can make every localStorage call raise; the search box must
//      still render, with no history rather than an error.
//   3. THE STARTERS ARE EVIDENCE-BACKED. Every curated prompt is traceable to
//      something in this repository that says it returns results in
//      production. An invented suggestion is a broken promise on the first
//      screen a new student sees, so the test derives the list from the
//      evidence rather than restating it.

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_RECENT_SEARCHES,
  SEARCH_HISTORY_KEY,
  STARTER_QUERIES,
  clearRecentSearches,
  getRecentSearches,
  rememberSearch,
  scheduleSearchMemory,
} from "./searchHistory.js";

const found = (query, resultCount = 3) => rememberSearch(query, { resultCount });

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("only searches that actually worked are remembered", () => {
  it("stores a query that returned at least one row", () => {
    found("rotational motion", 4);
    expect(getRecentSearches()).toEqual(["rotational motion"]);
  });

  it("never stores a query that returned nothing", () => {
    rememberSearch("zzqqxx no such topic", { resultCount: 0 });
    expect(getRecentSearches()).toEqual([]);
    // Not even the key is created — nothing happened, so nothing is written.
    expect(localStorage.getItem(SEARCH_HISTORY_KEY)).toBeNull();
  });

  it("ignores a count that is missing or not a number", () => {
    rememberSearch("kinematics");
    rememberSearch("kinematics", { resultCount: "lots" });
    rememberSearch("kinematics", { resultCount: NaN });
    expect(getRecentSearches()).toEqual([]);
  });

  it("ignores a query too short to have been run", () => {
    // Two characters is MIN_QUERY in useUniversalSearch.js and the floor in
    // the RPC; one character never reached the server at all.
    found("a");
    expect(getRecentSearches()).toEqual([]);
    found("ac");
    expect(getRecentSearches()).toEqual(["ac"]);
  });
});

describe("the list caps and de-duplicates, most recent first", () => {
  it("puts the newest search at the front", () => {
    found("kinematics");
    found("gravitation");
    found("shm");
    expect(getRecentSearches()).toEqual(["shm", "gravitation", "kinematics"]);
  });

  it("moves a repeated query back to the front instead of duplicating it", () => {
    found("kinematics");
    found("gravitation");
    found("kinematics");
    expect(getRecentSearches()).toEqual(["kinematics", "gravitation"]);
  });

  it("treats a re-typed query as the same one regardless of case", () => {
    found("shm");
    found("SHM");
    // One entry, spelled the way the student last typed it.
    expect(getRecentSearches()).toEqual(["SHM"]);
  });

  it("collapses whitespace so one query is not stored twice", () => {
    found("  rotational   motion ");
    found("rotational motion");
    expect(getRecentSearches()).toEqual(["rotational motion"]);
  });

  it(`keeps at most ${MAX_RECENT_SEARCHES}, dropping the oldest`, () => {
    for (let i = 1; i <= MAX_RECENT_SEARCHES + 4; i += 1) found(`query ${i}`);
    const recent = getRecentSearches();
    expect(recent).toHaveLength(MAX_RECENT_SEARCHES);
    expect(recent[0]).toBe(`query ${MAX_RECENT_SEARCHES + 4}`);
    expect(recent).not.toContain("query 1");
  });

  it("drops garbage a hand-edited key put in the store", () => {
    localStorage.setItem(
      SEARCH_HISTORY_KEY,
      JSON.stringify({ queries: ["shm", 42, null, { a: 1 }, "", "x", "goc"] }),
    );
    expect(getRecentSearches()).toEqual(["shm", "goc"]);
  });

  it("clears completely", () => {
    found("shm");
    found("goc");
    expect(clearRecentSearches()).toEqual([]);
    expect(getRecentSearches()).toEqual([]);
    expect(localStorage.getItem(SEARCH_HISTORY_KEY)).toBeNull();
  });
});

describe("blocked or corrupt storage degrades instead of throwing", () => {
  it("reads as empty when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => getRecentSearches()).not.toThrow();
    expect(getRecentSearches()).toEqual([]);
  });

  it("swallows a write that throws and still reports the truth", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    // No crash, and no chip promised that would vanish on the next reload.
    expect(() => found("shm")).not.toThrow();
    expect(found("shm")).toEqual([]);
  });

  it("survives a clear that throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => clearRecentSearches()).not.toThrow();
  });

  it("reads as empty when the stored value is not JSON", () => {
    localStorage.setItem(SEARCH_HISTORY_KEY, "{not json");
    expect(getRecentSearches()).toEqual([]);
  });

  it("reads as empty when the stored shape is from somewhere else", () => {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify({ days: ["2026-09-02"] }));
    expect(getRecentSearches()).toEqual([]);
  });
});

describe("a half-typed prefix never becomes a remembered search", () => {
  beforeEach(() => { vi.useFakeTimers(); });

  it("waits for the query to settle before storing anything", () => {
    scheduleSearchMemory("kinematics", { resultCount: 5, delay: 1000 });
    vi.advanceTimersByTime(999);
    expect(getRecentSearches()).toEqual([]);
    vi.advanceTimersByTime(2);
    expect(getRecentSearches()).toEqual(["kinematics"]);
  });

  it("a longer query supersedes the prefix that was on its way", () => {
    // What a student typing "kine…matics" with a pause actually produces:
    // two settled searches, only one of which they meant.
    scheduleSearchMemory("kine", { resultCount: 2, delay: 1000 });
    vi.advanceTimersByTime(300);
    scheduleSearchMemory("kinematics", { resultCount: 5, delay: 1000 });
    vi.advanceTimersByTime(2000);
    expect(getRecentSearches()).toEqual(["kinematics"]);
  });

  it("schedules nothing at all for a search that found nothing", () => {
    const cancel = scheduleSearchMemory("zzqqxx", { resultCount: 0, delay: 1000 });
    vi.advanceTimersByTime(2000);
    expect(getRecentSearches()).toEqual([]);
    expect(() => cancel()).not.toThrow();
  });

  it("can be withdrawn by the caller", () => {
    const cancel = scheduleSearchMemory("shm", { resultCount: 3, delay: 1000 });
    cancel();
    vi.advanceTimersByTime(2000);
    expect(getRecentSearches()).toEqual([]);
  });
});

describe("every starter prompt is backed by evidence in this repository", () => {
  // The two places that record what production actually answers:
  //   * the applied alias migration, whose self-test runs universal_search on
  //     every seeded alias AND its expansion and aborts if either finds
  //     nothing, and whose section D re-runs the six queries the previous
  //     change to this code path was measured against;
  //   * searchAliases.js, whose header records row counts measured against
  //     production on 2026-09-02.
  const aliasMigration = readFileSync(
    "supabase/migrations/20260902170000_search_aliases.sql",
    "utf8",
  ).toLowerCase();
  const clientAliases = readFileSync("src/searchAliases.js", "utf8").toLowerCase();

  it("has a short list and no duplicates", () => {
    expect(STARTER_QUERIES.length).toBeGreaterThan(2);
    expect(STARTER_QUERIES.length).toBeLessThanOrEqual(8);
    expect(new Set(STARTER_QUERIES).size).toBe(STARTER_QUERIES.length);
  });

  it.each(STARTER_QUERIES)("%s is written down as something that returns results", (query) => {
    const needle = query.toLowerCase();
    const evidence =
      aliasMigration.includes(`'${needle}'`) || clientAliases.includes(needle);
    expect(
      evidence,
      `"${query}" is not traceable to a query this repository records as returning results. ` +
        "Suggestions must be derived from the catalogue, not invented — drop it instead.",
    ).toBe(true);
  });

  it("every starter is long enough for the search box to run it", () => {
    for (const query of STARTER_QUERIES) expect(query.trim().length).toBeGreaterThanOrEqual(2);
  });
});
