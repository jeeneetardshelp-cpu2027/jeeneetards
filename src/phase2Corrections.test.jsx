// Phase 2 corrections.
//
// The theme running through all of these: an unresolved or invalid filter must
// never be treated as "no filter". Widening silently is worse than showing
// nothing, because the student cannot tell it happened — the heading still
// says "Kinematics" while the list shows the whole library.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import {
  parseEnumParam, parseChannelParam, parsePositiveIdParam,
  parseFilterParams, normalizeFilterParams,
  MAX_VALUES, MAX_VALUE_LENGTH, CANONICAL_CHANNEL_PARAM,
} from "./filterParams.js";
import {
  removeChip, clearAllChips, dropParam, applyFilterChange,
  dropCompareIfChapterChanged,
} from "./filterChips.js";
import { filterByKey } from "./filterSchema.js";

const P = (qs = "") => new URLSearchParams(qs);

// ============================================================ item 6
describe("invalid URL values never reach a query", () => {
  it("drops enum values outside the canonical vocabulary", () => {
    const r = parseEnumParam(P("type=full-course,wizardry"), "type");
    expect(r.values).toEqual(["full-course"]);
    expect(r.invalid).toEqual(["wizardry"]);
  });

  it("returns null (not []) when a filter is absent or wholly invalid", () => {
    // [] would mean "match nothing"; null means "do not filter".
    expect(parseEnumParam(P(""), "type").values).toBeNull();
    expect(parseEnumParam(P("type=nonsense"), "type").values).toBeNull();
  });

  it("collapses duplicates and keeps order", () => {
    expect(parseEnumParam(P("type=revision,full-course,revision"), "type").values)
      .toEqual(["revision", "full-course"]);
  });

  it("survives malformed CSV without producing empty predicates", () => {
    expect(parseEnumParam(P("type=,,full-course,,"), "type").values).toEqual(["full-course"]);
    expect(parseEnumParam(P("type=,,,"), "type").values).toBeNull();
  });

  it("bounds value length and value count", () => {
    const long = "x".repeat(MAX_VALUE_LENGTH + 50);
    expect(parseEnumParam(P(`type=${long}`), "type").values).toBeNull();
    const many = Array.from({ length: MAX_VALUES + 20 }, () => "revision").join(",");
    // duplicates collapse first, so this also proves the cap cannot be
    // side-stepped by repetition
    expect(parseEnumParam(P(`type=${many}`), "type").values).toEqual(["revision"]);
  });

  it("accepts only a positive integer channel", () => {
    expect(parseChannelParam(P("channel=3")).value).toBe("3");
    for (const bad of ["0", "-1", "1.5", "abc", "1e3", "12abc", " ", "9".repeat(80)])
      expect([bad, parseChannelParam(P(`channel=${bad}`)).value]).toEqual([bad, null]);
  });

  it("accepts only a positive integer faculty id", () => {
    expect(parsePositiveIdParam(P("teacher=7"), "teacher").value).toBe("7");
    expect(parseFilterParams(P("teacher=7")).teacherId).toBe("7");
    for (const bad of ["0", "-1", "1.5", "ABJ", "1e3"])
      expect([bad, parsePositiveIdParam(P(`teacher=${bad}`), "teacher").value])
        .toEqual([bad, null]);
  });

  it("reports what it rejected rather than swallowing it", () => {
    const r = parseFilterParams(P("type=bogus&channel=-4&difficulty=hard"));
    expect(r.invalid.map((i) => i.key).sort()).toEqual(["channel", "difficulty", "type"]);
  });
});

// ============================================================ item 5
describe("canonical channel= terminology", () => {
  it("reads the legacy institute= key", () => {
    expect(parseChannelParam(P("institute=2")).value).toBe("2");
  });

  it("prefers channel= when both are present", () => {
    expect(parseChannelParam(P("channel=5&institute=2")).value).toBe("5");
  });

  it("rewrites institute= to channel= and emits only the canonical key", () => {
    const next = normalizeFilterParams(P("institute=2"));
    expect(next.get(CANONICAL_CHANNEL_PARAM)).toBe("2");
    expect(next.get("institute")).toBeNull();
  });

  it("normalises junk out of the URL", () => {
    const next = normalizeFilterParams(P("type=revision,bogus,revision&channel=abc&teacher=ABJ"));
    expect(next.get("type")).toBe("revision");
    expect(next.get("channel")).toBeNull();
    expect(next.get("teacher")).toBeNull();
  });

  it("returns null when the URL is already canonical, so it cannot loop", () => {
    expect(normalizeFilterParams(P("type=revision&channel=2"))).toBeNull();
    expect(normalizeFilterParams(P(""))).toBeNull();
  });

  it("the schema uses channel, not institute", () => {
    expect(filterByKey("channel").param).toBe("channel");
    expect(filterByKey("institute")).toBeNull();
  });
});

// ============================================================ item 2
describe("comparison never outlives its chapter", () => {
  const WITH = "goal=jee&subject=physics&chapter=kinematics&compare=1,2";

  it("removing the Chapter chip clears it", () => {
    expect(removeChip(P(WITH), "chapter").get("compare")).toBeNull();
  });

  it("removing Subject clears it (chapter goes with the subject)", () => {
    expect(removeChip(P(WITH), "subject").get("compare")).toBeNull();
  });

  it("removing Goal clears it", () => {
    expect(removeChip(P(WITH), "goal").get("compare")).toBeNull();
  });

  it("Clear All clears it", () => {
    expect(clearAllChips(P(WITH)).get("compare")).toBeNull();
  });

  it("'Choose another chapter' clears it", () => {
    expect(dropParam(P(WITH), ["chapter", "ch"]).get("compare")).toBeNull();
  });

  it("changing to a different chapter clears it", () => {
    const next = applyFilterChange(P(WITH), filterByKey("chapter"), "friction");
    expect(next.get("compare")).toBeNull();
  });

  it("an incompatible parent change clears it", () => {
    const next = applyFilterChange(P(WITH), filterByKey("goal"), "neet");
    expect(next.get("chapter")).toBeNull();
    expect(next.get("compare")).toBeNull();
  });

  it("BUT survives while the same chapter is still active", () => {
    // Removing an unrelated filter must not throw away the student's selection.
    const next = removeChip(P(WITH + "&language=hindi"), "language", "hindi");
    expect(next.get("chapter")).toBe("kinematics");
    expect(next.get("compare")).toBe("1,2");
  });

  it("the helper is the single rule both directions", () => {
    const same = dropCompareIfChapterChanged(P("chapter=a&compare=1"), P("chapter=a&compare=1"));
    expect(same.get("compare")).toBe("1");
    const moved = dropCompareIfChapterChanged(P("chapter=a&compare=1"), P("chapter=b&compare=1"));
    expect(moved.get("compare")).toBeNull();
  });
});

// ============================================================ items 1 & 3
// A builder that records requests, so "no request was sent" is provable.
const calls = [];
let ROWS = [];
let FAIL = false;
let RESOLVE_SLUG = true;

function makeBuilder(table) {
  const rec = { table, cols: null, eq: {}, in: {}, range: null };
  const b = {
    select(c) { rec.cols = c; return b; },
    order() { return b; }, range(a, z) { rec.range = [a, z]; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    ilike() { return b; }, in(k, v) { rec.in[k] = v; return b; },
    maybeSingle() {
      // dimension lookup: resolve the slug, or report "not found"
      return Promise.resolve({ data: RESOLVE_SLUG ? { id: 42, slug: rec.eq.slug, name: "Kinematics" } : null, error: null });
    },
    then(resolve) {
      if (FAIL) return Promise.resolve({ data: null, error: { message: "boom", code: "500" } }).then(resolve);
      return Promise.resolve({ data: ROWS, error: null, count: ROWS.length }).then(resolve);
    },
  };
  calls.push(rec);
  return b;
}
const supabaseMock = { from: (t) => makeBuilder(t) };
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  get supabase() { return supabaseMock; },
}));

const { useCanonicalFilters } = await import("./useCanonicalFilters.js");
const { usePlaylistBrowse } = await import("./usePlaylistBrowse.js");

const catalogueCalls = () => calls.filter((c) => c.table === "playlists");

// Drives the real pair: resolver gates the catalogue hook, exactly as Dashboard does.
let seen;
function Wired({ qs }) {
  const params = new URLSearchParams(qs);
  const canonical = useCanonicalFilters(params);
  seen = usePlaylistBrowse({
    chapterId: canonical.chapterId, enabled: canonical.ready,
  });
  seen.canonical = canonical;
  return null;
}

beforeEach(() => {
  calls.length = 0; ROWS = [{ id: 1, title: "A", playlist_videos: [{ count: 1 }] }];
  FAIL = false; RESOLVE_SLUG = true; seen = undefined;
});

describe("no catalogue request before slugs resolve", () => {
  it("sends NO unfiltered request for /browse?chapter=kinematics", async () => {
    render(<MemoryRouter><Wired qs="chapter=kinematics" /></MemoryRouter>);
    // Before resolution completes there must be zero catalogue calls.
    expect(catalogueCalls()).toHaveLength(0);
    await waitFor(() => expect(seen.canonical.ready).toBe(true));
  });

  it("sends exactly ONE catalogue request, and it carries the predicate", async () => {
    render(<MemoryRouter><Wired qs="chapter=kinematics" /></MemoryRouter>);
    await waitFor(() => expect(catalogueCalls()).toHaveLength(1));
    expect(catalogueCalls()[0].eq["pv.videos.chapter_id"]).toBe(42);
    // and it stays at one
    await new Promise((r) => setTimeout(r, 30));
    expect(catalogueCalls()).toHaveLength(1);
  });

  it("holds the skeleton while unresolved rather than showing anything", async () => {
    render(<MemoryRouter><Wired qs="chapter=kinematics" /></MemoryRouter>);
    expect(seen.loading).toBe(true);
    expect(seen.items).toEqual([]);
  });

  it("an UNKNOWN slug never returns the unfiltered catalogue", async () => {
    RESOLVE_SLUG = false;
    render(<MemoryRouter><Wired qs="chapter=does-not-exist" /></MemoryRouter>);
    await waitFor(() => expect(seen.canonical.unresolved.length).toBe(1));
    expect(seen.canonical.ready).toBe(false);
    expect(catalogueCalls()).toHaveLength(0);      // the crux
    expect(seen.items).toEqual([]);
  });

  it("names the unresolved filter so the UI can offer to remove it", async () => {
    RESOLVE_SLUG = false;
    render(<MemoryRouter><Wired qs="chapter=does-not-exist" /></MemoryRouter>);
    await waitFor(() => expect(seen.canonical.unresolved.length).toBe(1));
    expect(seen.canonical.unresolved[0]).toEqual({ key: "chapter", slug: "does-not-exist" });
  });

  it("an id-only URL is ready immediately and queries once", async () => {
    render(<MemoryRouter><Wired qs="ch=7" /></MemoryRouter>);
    await waitFor(() => expect(catalogueCalls()).toHaveLength(1));
    expect(catalogueCalls()[0].eq["pv.videos.chapter_id"]).toBe(7);
  });
});

describe("catalogue failure is retryable", () => {
  it("reports an error, then recovers when Retry succeeds", async () => {
    FAIL = true;
    let hook;
    function Probe() { hook = usePlaylistBrowse({ enabled: true }); return null; }
    render(<MemoryRouter><Probe /></MemoryRouter>);
    await waitFor(() => expect(hook.error).toBeTruthy());
    expect(hook.items).toEqual([]);

    FAIL = false;
    await act(async () => { hook.reload(); });
    await waitFor(() => expect(hook.error).toBeNull());
    expect(hook.items).toHaveLength(1);
  });

  it("retrying re-runs the SAME query, so filters are preserved", async () => {
    FAIL = true;
    let hook;
    function Probe() { hook = usePlaylistBrowse({ enabled: true, contentType: ["revision"] }); return null; }
    render(<MemoryRouter><Probe /></MemoryRouter>);
    await waitFor(() => expect(hook.error).toBeTruthy());
    calls.length = 0;
    FAIL = false;
    await act(async () => { hook.reload(); });
    await waitFor(() => expect(hook.error).toBeNull());
    expect(catalogueCalls()[0].in["content_type"]).toEqual(["revision"]);
  });
});
