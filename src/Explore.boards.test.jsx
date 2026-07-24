// Board isolation — CBSE and ICSE must never bleed into each other.
//
// This behaviour MOVED. It used to live in Explore's own <ChapterResults/>,
// which had its own query, its own cards and its own empty states. Explore now
// hands off to the one result system at the canonical URL, so board scoping is
// enforced in the BROWSE QUERY instead. These tests follow the behaviour to
// its new home rather than being deleted along with the component.
//
// Deleting them would have been the dangerous option: the hand-off initially
// dropped board filtering altogether, and it was only these tests failing that
// revealed CBSE and ICSE had started to bleed.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const calls = [];
function makeBuilder() {
  const rec = { table: null, cols: null, eq: {} };
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order() { return b; },
    range() { return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    ilike() { return b; },
    in() { return b; },
    then(resolve) { return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve); },
  };
  calls.push(rec);
  return b;
}
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { from: (t) => { const b = makeBuilder(); calls[calls.length - 1].table = t; return b; } },
}));

import { usePlaylistBrowse } from "./usePlaylistBrowse.js";
import { canonicalBrowseUrl } from "./canonicalUrl.js";

function Probe(props) { usePlaylistBrowse(props); return null; }
const run = async (props) => {
  render(<MemoryRouter><Probe {...props} /></MemoryRouter>);
  await new Promise((r) => setTimeout(r, 0));
  return calls[calls.length - 1];
};

beforeEach(() => { calls.length = 0; });

describe("board scoping happens in the database", () => {
  it("joins playlist_boards and filters when a board is selected", async () => {
    const q = await run({ boardId: 1, chapterId: 9 });
    expect(q.cols).toContain("playlist_boards!inner");
    expect(q.eq["playlist_boards.board_id"]).toBe(1);
  });

  it("CBSE and ICSE produce different queries — this is the no-bleed rule", async () => {
    const cbse = await run({ boardId: 1, chapterId: 9 });
    calls.length = 0;
    const icse = await run({ boardId: 2, chapterId: 9 });
    expect(cbse.eq["playlist_boards.board_id"]).toBe(1);
    expect(icse.eq["playlist_boards.board_id"]).toBe(2);
    expect(cbse.eq["playlist_boards.board_id"])
      .not.toBe(icse.eq["playlist_boards.board_id"]);
  });

  it("adds NO board join for entrance-exam content", async () => {
    const q = await run({ goalId: 1, chapterId: 9 });
    expect(q.cols).not.toContain("playlist_boards");
    expect(q.eq["playlist_boards.board_id"]).toBeUndefined();
  });

  it("filters by board IN the query, not after paging", async () => {
    // A post-filter would drop rows from an already-truncated page, so the
    // board predicate has to be part of the same request as the range.
    const q = await run({ boardId: 1, chapterId: 9, page: 3 });
    expect(q.eq["playlist_boards.board_id"]).toBe(1);
    expect(calls.filter((c) => c.table === "playlists")).toHaveLength(1);
  });
});

describe("the guided journey hands off to the one result system", () => {
  it("builds the canonical board-scoped URL", () => {
    expect(canonicalBrowseUrl({
      goal: "school", board: "cbse", cls: "class-10",
      subject: "physics", chapter: "motion",
    })).toBe("/browse?goal=school&class=10&board=cbse&subject=physics&chapter=motion");
  });

  it("keeps the board in the URL, so a refresh stays on the same board", () => {
    const url = canonicalBrowseUrl({ goal: "school", board: "icse", cls: "class-10" });
    expect(url).toContain("board=icse");
    expect(url).not.toContain("cbse");
  });
});
