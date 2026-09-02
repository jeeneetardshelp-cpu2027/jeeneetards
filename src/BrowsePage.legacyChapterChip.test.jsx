// ROUTE-LEVEL test: a search chapter result deep-links /browse?ch=<id>
// (universal_search returns no slugs, so searchDestinations.js cannot build
// the canonical ?chapter=<slug> URL), and the student must STILL see the
// chapter's name. The live defect: the filter chip read "27 ×" and the heading
// stayed "All courses", because no label source could resolve a bare legacy id
// — the slug resolver only names slugs, and the chapter option list only loads
// once a subject is selected.
//
// Run: npm test
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";

const calls = [];
let CHAPTER_ROW = null;

function builder(table) {
  const rec = { table, cols: null, eq: {}, range: null, single: false };
  calls.push(rec);
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    order() { return b; },
    limit() { return b; },
    range(a, z) { rec.range = [a, z]; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    ilike() { return b; },
    in() { return b; },
    maybeSingle() {
      rec.single = true;
      return Promise.resolve(
        table === "chapters"
          ? { data: CHAPTER_ROW, error: null }
          : { data: null, error: null },
      );
    },
    then(resolve) {
      // The channel dimension list backs the ?channel= chip label below.
      const data = table === "institutes_channels"
        ? [{ id: 3, name: "Competishun", logo_url: null }]
        : [];
      return Promise.resolve({ data, error: null, count: 0 }).then(resolve);
    },
  };
  return b;
}
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t) => builder(t),
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}));

import BrowsePage from "./BrowsePage.jsx";

function LocationProbe() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
}

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/browse" element={<><LocationProbe /><BrowsePage /></>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  calls.length = 0;
  CHAPTER_ROW = { id: 27, name: "Rotational Motion" };
});

describe("legacy ?ch=<id> links are labelled with the chapter's name", () => {
  it("shows the name on the chip and in the heading, via one primary-key lookup", async () => {
    renderAt("/browse?ch=27");

    expect(await screen.findByRole("button", { name: "Remove filter Rotational Motion" }))
      .toBeTruthy();
    expect(screen.getByRole("heading", { name: "Rotational Motion" })).toBeTruthy();

    // Bounded: the name came from a single by-id chapters lookup, not a list.
    const q = calls.find((c) => c.table === "chapters" && c.single);
    expect(q).toBeTruthy();
    expect(q.eq.id).toBe(27);
  });

  it("removing the chip still clears the legacy param", async () => {
    renderAt("/browse?ch=27");
    fireEvent.click(await screen.findByRole("button", { name: "Remove filter Rotational Motion" }));

    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/browse"));
    expect(await screen.findByRole("heading", { name: "All courses" })).toBeTruthy();
  });

  it("falls back to the raw value when the chapter cannot be found", async () => {
    // A chip must never assert a name we could not look up — but it must still
    // exist, so the student can remove the filter.
    CHAPTER_ROW = null;
    renderAt("/browse?ch=27");
    expect(await screen.findByRole("button", { name: "Remove filter 27" })).toBeTruthy();
  });
});

describe("channel links are labelled with the channel's name", () => {
  it("labels the ?channel= chip from the dimension list already fetched", async () => {
    // Institute search results land on /browse?channel=<id> — the same
    // dead-end family: the chip used to read "3".
    renderAt("/browse?channel=3");
    expect(await screen.findByRole("button", { name: "Remove filter Competishun" }))
      .toBeTruthy();
  });
});
