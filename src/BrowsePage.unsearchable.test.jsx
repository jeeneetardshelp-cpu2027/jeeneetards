// What /browse says when it did not search.
//
// useBrowse.js refuses a query the server cannot answer and returns an empty
// result WITHOUT a request. That lands in the same "no lessons" branch as a real
// empty result, and until now the page said "No lessons match your filters." —
// which asserts the catalogue was searched and came back empty. It was never
// asked.
//
// The search box already had the honest sentences for this exact state. These
// tests pin /browse to the same ones, so the two surfaces cannot describe one
// state two ways.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

const calls = [];
const rpcCalls = [];
function builder(table) {
  const rec = { table, cols: null, eq: {}, range: null, orders: [], limits: [] };
  calls.push(rec);
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order(column, options) { if (!options?.referencedTable) rec.orders.push(column); return b; },
    limit(count, options) { rec.limits.push([count, options?.referencedTable ?? null]); return b; },
    range(a, z) { rec.range = [a, z]; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    ilike() { return b; },
    in() { return b; },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) { return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve); },
  };
  return b;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t) => builder(t),
    rpc: (name, args) => {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: [], error: null });
    },
  },
}));

import BrowsePage from "./BrowsePage.jsx";
import { MIN_QUERY } from "./useUniversalSearch.js";

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/browse" element={<BrowsePage />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  calls.length = 0;
  rpcCalls.length = 0;
});

describe("/browse explains a query it never sent", () => {
  // One short word: the student can act on "type more characters".
  it("tells a one-letter query to keep typing", async () => {
    // Was "ac" until 2026-09-08. "ac" now answers 200 with 58 rows and the
    // Alternating Current chapter as row 1, so it is sent; a single letter is
    // what is left with nothing to search on.
    renderAt("/browse?tab=lectures&q=p");

    expect(
      await screen.findByText(new RegExp(`Type at least ${MIN_QUERY} characters`, "i")),
    ).toBeTruthy();
    // And it does not claim the catalogue was searched.
    expect(screen.queryByText(/No lessons match your filters/i)).toBeNull();
  });

  // Several short words. "p c" is three characters, so "type at least 3
  // characters" would be both wrong and unactionable — the student already did.
  it.each(["p c", "a b c", "p n c"])(
    "tells %j that its words are too short, not that it is too short",
    async (q) => {
      renderAt(`/browse?tab=lectures&q=${encodeURIComponent(q)}`);

      expect(await screen.findByText(/Try a longer word/i)).toBeTruthy();
      expect(screen.queryByText(/Type at least/i)).toBeNull();
      expect(screen.queryByText(/No lessons match your filters/i)).toBeNull();
    },
  );

  // The third sentence, and the case that needed it, are gone: "p and c" is
  // sent now and answers with its own chapter. What remains below is the
  // proof that a genuinely unsearchable query still sends nothing.
  //
  // Was: "p and c" is refused for a THIRD reason, and needs a third sentence: it has
  // a three-character word, so neither "type at least 3 characters" nor "try a
  // longer word" described it. Production answers it 200 with 36 rows and the
  // Permutations and Combinations chapter as row 1, so it is sent.
  it("sends “p and c” instead of refusing it", async () => {
    renderAt("/browse?tab=lectures&q=p%20and%20c");

    await waitFor(() => {
      // No refusal sentence of any kind: this query is not refused any more.
      expect(screen.queryByText(/Try a longer word/i)).toBeNull();
      expect(screen.queryByText(/Type at least/i)).toBeNull();
    });
    // And with the mock returning nothing, "No lessons match your filters" is
    // now the CORRECT sentence — the catalogue really was asked. That is the
    // difference this whole file exists to keep straight.
    expect(screen.getByText(/No lessons match your filters/i)).toBeTruthy();
  });

  // The queries the old rule refused for having no 4-character word. Each was
  // measured at HTTP 200 on production, so /browse must actually search them.
  it.each(["iit jee", "jee adv", "x ray", "def int"])(
    "searches %j instead of refusing it",
    async (q) => {
      renderAt(`/browse?tab=lectures&q=${encodeURIComponent(q)}`);

      expect(await screen.findByText(/No lessons match your filters/i)).toBeTruthy();
      expect(screen.queryByText(/Try a longer word/i)).toBeNull();
      expect(screen.queryByText(/more specific word/i)).toBeNull();
    },
  );

  // The other direction: a servable query that genuinely finds nothing must
  // still say so. Without this, the fix could swallow every empty result.
  it("still says nothing matched when a real search came back empty", async () => {
    renderAt("/browse?tab=lectures&q=kinematics");

    expect(await screen.findByText(/No lessons match your filters/i)).toBeTruthy();
    expect(screen.queryByText(/Type at least/i)).toBeNull();
    expect(screen.queryByText(/Try a longer word/i)).toBeNull();
  });

  it("keeps the empty-catalogue wording when nothing was asked for at all", async () => {
    renderAt("/browse?tab=lectures");

    expect(await screen.findByText(/No lessons have been added yet/i)).toBeTruthy();
  });

  it("sent no request for the unservable query", async () => {
    renderAt("/browse?tab=lectures&q=p%20c");

    await screen.findByText(/Try a longer word/i);
    // The guard in useBrowse.js short-circuits before the RPC and before the
    // catalogue query; the message is not the result of a failed round trip.
    await waitFor(() => {
      expect(rpcCalls.filter((c) => c.name === "search_video_ids")).toHaveLength(0);
    });
  });
});

// THE DEFAULT TAB. Every case above pins ?tab=lectures, and that is exactly how
// this survived: /browse opens on Playlists when no ?tab= is present
// (BrowsePage.jsx: params.get("tab") === "lectures" ? "lectures" : "playlists"),
// so the honest copy covered the half of the page students do not land on.
// A preflight found it on one reconcile, it went unfixed, and a second
// preflight found it again independently. These pin the tab a student actually
// gets.
describe("/browse default tab — the one with no ?tab= in the URL", () => {
  it.each([
    ["p", /Type at least/i],
    ["p c", /Try a longer word/i],
    ["a b c", /Try a longer word/i],
  ])("explains %s instead of claiming the catalogue was searched", async (q, hint) => {
    renderAt("/browse?q=" + encodeURIComponent(q));

    expect(await screen.findByText(hint)).toBeTruthy();
    // The two assertions the page used to make about a catalogue it never asked.
    expect(screen.queryByText(/No courses match this view/i)).toBeNull();
    expect(screen.queryByText(/No courses are listed for/i)).toBeNull();
  });

  it("prints no course count for a search it never ran", async () => {
    renderAt("/browse?q=p%20c");

    await screen.findByText(/Try a longer word/i);
    // "0 courses" is a match count. There was no match attempt to count.
    expect(screen.queryByText(/^0 courses$/)).toBeNull();
  });

  it("sends no course query at all for an unservable term", async () => {
    renderAt("/browse?q=p%20c");

    await screen.findByText(/Try a longer word/i);
    expect(rpcCalls.some((c) => c.name === "search_playlist_ids")).toBe(false);
  });

  // The control. Without this the three above could pass because the page
  // renders nothing at all, and nobody would notice.
  it("still names the filter for a real empty result on a servable query", async () => {
    renderAt("/browse?q=kinematics");

    expect(await screen.findByText(/No courses match this view/i)).toBeTruthy();
    expect(screen.queryByText(/Type at least/i)).toBeNull();
  });
});
