// What the /browse heading CLAIMS it found.
//
// The lecture search is deliberately fuzzy — trigram similarity is what lets
// "kinamatics" find Kinematics — so the result set is wider than the question.
// Measured on production 2026-09-08 (and captured in
// src/__fixtures__/searchStrongMatch.production.json), "kinematics" returns 172
// lessons of which 38 carry the word in the title, and the heading said
// "172 lessons": a number four and a half times the size of the answer.
//
// useVideos now has the whole match set in hand on every sort and reports how
// much of it literally matches, so the heading can name both numbers. Nothing
// was removed to make the count smaller — paging still runs off the real total.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import fixture from "./__fixtures__/searchStrongMatch.production.json";

let videoRows = [];
let videoCount = 0;
const rpcResponses = {};

function builder(table) {
  const rec = { table };
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order() { return b; },
    limit() { return b; },
    range() { return b; },
    eq() { return b; },
    ilike() { return b; },
    in() { return b; },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      return Promise.resolve(
        table === "videos"
          ? { data: videoRows, error: null, count: videoCount }
          : { data: [], error: null, count: 0 },
      ).then(resolve);
    },
  };
  return b;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t) => builder(t),
    rpc: (name) => Promise.resolve(rpcResponses[name] ?? { data: [], error: null }),
  },
}));

import BrowsePage from "./BrowsePage.jsx";

/** Arrange the mocked database to answer one of the captured queries. */
function arrange(query) {
  const fx = fixture.queries[query];
  // Order is irrelevant to the count; the hook is given the whole match set,
  // which is what it now requests on every sort.
  videoRows = fx.rows.map((r) => ({
    id: r.id, youtube_video_id: `y${r.id}`, title: r.title,
    institutes_channels: null, subjects: null, chapters: null, membership: [],
  }));
  videoCount = fx.rows.length;
  rpcResponses.search_video_ids = { data: fx.rankedIds.map((id) => ({ id })), error: null };
  rpcResponses.search_query_tokens = {
    data: [{ qlen: query.length, q: query, q_tokens: fx.qTokens, q_long: fx.qTokens[0] ?? "" }],
    error: null,
  };
}

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/browse" element={<BrowsePage />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  videoRows = [];
  videoCount = 0;
  for (const key of Object.keys(rpcResponses)) delete rpcResponses[key];
});

describe("the lecture count names what actually matched", () => {
  it("says 38 of 172 for kinematics instead of 172", async () => {
    arrange("kinematics");
    renderAt("/browse?tab=lectures&q=kinematics&lsort=shortest");
    expect(await screen.findByText("38 title matches of 172 lessons")).toBeTruthy();
    // The old, inflated claim is gone.
    expect(screen.queryByText("172 lessons")).toBeNull();
  });

  it("is honest on the default sort too, where the page was already right", async () => {
    arrange("friction problems");
    renderAt("/browse?tab=lectures&q=friction+problems");
    expect(await screen.findByText("18 title matches of 47 lessons")).toBeTruthy();
  });

  // HIDE WHEN IT ADDS NOTHING, never a placeholder. These are the two queries
  // whose strong block is everything and nothing, and neither has a second
  // number worth showing.
  it("adds nothing when every result matches", async () => {
    arrange("trigonometry");
    renderAt("/browse?tab=lectures&q=trigonometry&lsort=shortest");
    expect(await screen.findByText("91 lessons")).toBeTruthy();
    expect(screen.queryByText(/title match/i)).toBeNull();
  });

  it("adds nothing when a typo matched only by similarity", async () => {
    // "kinamatics" finds 38 real Kinematics lessons and not one of them
    // contains the misspelling. Saying "0 title matches" would be true and
    // useless, and would read as a broken page.
    arrange("kinamatics");
    renderAt("/browse?tab=lectures&q=kinamatics&lsort=shortest");
    expect(await screen.findByText("38 lessons")).toBeTruthy();
    expect(screen.queryByText(/title match/i)).toBeNull();
  });

  it("adds nothing when nothing was searched for", async () => {
    videoRows = [];
    videoCount = 5;
    renderAt("/browse?tab=lectures");
    expect(await screen.findByText("5 lessons")).toBeTruthy();
    expect(screen.queryByText(/title match/i)).toBeNull();
  });
});
