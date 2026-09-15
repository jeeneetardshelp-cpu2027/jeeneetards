// The /browse read path's half of the faculty link: the QUERY has to ask for
// the linked teacher, and the row mapper has to resolve it with the shared
// exactly-one rule. Asserting on `cols` matters as much as on the mapped card
// — a card can only link to a slug the request actually fetched, and the
// embed's alias is what the mapper reads back.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const calls = [];
let ROWS = [];
let failOnceWithMissingStats = false;

function builder(table) {
  const call = { table, cols: null, eq: {}, in: {}, range: null };
  calls.push(call);
  const b = {
    select(cols) { call.cols = cols; return b; },
    order() { return b; },
    range(from, to, options) { if (!options?.referencedTable) call.range = [from, to]; return b; },
    eq(key, value) { call.eq[key] = value; return b; },
    in(key, value) { call.in[key] = value; return b; },
    ilike() { return b; },
    then(resolve) {
      // The one retry this hook does: an environment without the video_stats
      // rollups answers 42703 and the query is rebuilt without those columns.
      // The faculty embed must survive that rebuild.
      if (failOnceWithMissingStats && call.cols.includes("view_count_total")) {
        return Promise.resolve({
          data: null, count: null,
          error: { code: "42703", message: 'column playlists.view_count_total does not exist' },
        }).then(resolve);
      }
      return Promise.resolve({ data: ROWS, error: null, count: ROWS.length }).then(resolve);
    },
  };
  return b;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { from: (table) => builder(table), rpc: () => Promise.resolve({ data: [], error: null }) },
}));

import { usePlaylistBrowse } from "./usePlaylistBrowse.js";

const row = (over = {}) => ({
  id: 398, title: "Complete Physics", teacher: "ABJ Sir",
  average_rating: 0, ratings_count: 0, language: null, content_type: null,
  difficulty: null, class_levels: [], institutes_channels: null, subjects: null,
  playlist_videos: [{ count: 9 }], ...over,
});
const linked = (slug) => ({ teachers: { slug } });

const load = async (props = {}) => {
  const view = renderHook(() => usePlaylistBrowse(props));
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view.result.current;
};

beforeEach(() => {
  calls.length = 0;
  failOnceWithMissingStats = false;
  ROWS = [row({ faculty: [linked("amit-bijarnia")] })];
});

describe("usePlaylistBrowse faculty link", () => {
  it("fetches the linked teacher's slug as a left join under its own alias", async () => {
    await load();
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("playlists");
    expect(calls[0].cols).toContain("faculty:playlist_teachers(teachers(slug))");
    // Unconditional, and never inner: 206 production courses have no faculty
    // link and every one of them must still appear in the catalogue.
    expect(calls[0].cols).not.toContain("playlist_teachers!inner");
  });

  it("keeps the embed clear of the faculty FILTER's own inner join", async () => {
    // Two embeds of the same table, two aliases, two jobs: `pt` narrows the
    // result set to one teacher's courses, `faculty` only decorates the rows.
    await load({ teacherId: 38 });
    expect(calls[0].cols).toContain("pt:playlist_teachers!inner(teacher_id)");
    expect(calls[0].cols).toContain("faculty:playlist_teachers(teachers(slug))");
    expect(calls[0].eq["pt.teacher_id"]).toBe(38);
  });

  it("keeps the embed when the stats columns are missing and the query is rebuilt", async () => {
    failOnceWithMissingStats = true;
    const state = await load();
    expect(calls).toHaveLength(2);
    expect(calls[1].cols).not.toContain("view_count_total");
    expect(calls[1].cols).toContain("faculty:playlist_teachers(teachers(slug))");
    expect(state.items[0].teacherSlug).toBe("amit-bijarnia");
  });

  it("puts the resolved slug on the card beside the credit it links", async () => {
    const state = await load();
    // The credit is untouched: the card still shows what the importer wrote.
    expect(state.items[0].teacher).toBe("ABJ Sir");
    expect(state.items[0].teacherSlug).toBe("amit-bijarnia");
  });

  it("leaves a card unlinked when two teachers are credited", async () => {
    // Playlist 91. Both names are real; neither is THE destination.
    ROWS = [row({ id: 91, faculty: [linked("teacher-one"), linked("teacher-two")] })];
    const state = await load();
    expect(state.items[0].teacher).toBe("ABJ Sir");
    expect(state.items[0].teacherSlug).toBeNull();
  });

  it.each([
    ["no faculty rows", []],
    ["a link whose teacher is null", [{ teachers: null }]],
    ["a linked teacher with no slug", [{ teachers: { slug: null } }]],
    ["no embed at all", undefined],
  ])("leaves a card unlinked with %s", async (_label, faculty) => {
    ROWS = [row({ faculty })];
    const state = await load();
    expect(state.items[0].teacherSlug).toBeNull();
  });
});
