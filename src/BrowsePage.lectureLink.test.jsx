// ROUTE-LEVEL test: does a card on the Individual lectures tab actually lead
// to the watch page?
//
// /browse used to play lectures here, in a modal wrapping a bare
// youtube-nocookie iframe. It recorded no progress, so a lesson watched from
// this tab earned no Continue-watching entry, no streak day and no watched
// tick — and it offered no lesson sequence, notes, materials, rating or report
// control. A card-level test could show the card renders a link; only a route
// test can show the course id survives the query, the hook and the page.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

const calls = [];
function builder(table) {
  const rec = { table, cols: null, eq: {}, range: null, orders: [], limits: [] };
  calls.push(rec);
  const b = {
    select(cols, opts) { rec.cols = cols; rec.opts = opts; return b; },
    // Only the PARENT ordering is recorded; a referencedTable order sorts the
    // embed, not the page.
    order(column, options) {
      if (!options?.referencedTable) rec.orders.push(column);
      return b;
    },
    limit(count, options) { rec.limits.push([count, options?.referencedTable ?? null]); return b; },
    range(a, z) { rec.range = [a, z]; return b; },
    eq(k, v) { rec.eq[k] = v; return b; },
    ilike() { return b; },
    in() { return b; },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) { return Promise.resolve(responseFor(table)).then(resolve); },
  };
  return b;
}

// One lecture, shaped like a real PostgREST row: the course id arrives in the
// bounded playlist_videos embed, because `videos` has no playlist_id column.
const LECTURE_ROW = {
  id: 9,
  youtube_video_id: "CBvaO-uDvs8",
  title: "Vectors for JEE",
  institutes_channels: { id: 8, name: "Mohit Tyagi", logo_url: null },
  subjects: { name: "Physics" },
  chapters: { name: "Vectors" },
  membership: [{ playlist_id: 5 }],
};

let lectureRows = [LECTURE_ROW];
const responseFor = (table) => (table === "videos"
  ? { data: lectureRows, error: null, count: lectureRows.length }
  : { data: [], error: null, count: 0 });

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (t) => builder(t),
    rpc: () => Promise.resolve({ data: [], error: null }),
  },
}));

import BrowsePage from "./BrowsePage.jsx";

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/browse" element={<BrowsePage />} /></Routes>
    </MemoryRouter>,
  );

const lectureQuery = () => calls.find((c) => c.table === "videos" && c.range != null);

beforeEach(() => {
  calls.length = 0;
  lectureRows = [LECTURE_ROW];
});

describe("Individual lectures tab → the watch page", () => {
  it("links a lecture card to its lesson inside the course", async () => {
    renderAt("/browse?tab=lectures");

    const watch = await screen.findByRole("link", { name: "Watch Lesson" });
    // ?v= selects the lesson and takes the YouTube id, not the row id.
    expect(watch.getAttribute("href")).toBe("/course/5?v=CBvaO-uDvs8");
    expect(screen.getByRole("link", { name: "Watch Vectors for JEE" })
      .getAttribute("href")).toBe("/course/5?v=CBvaO-uDvs8");
  });

  it("opens no player of its own", async () => {
    const { container } = renderAt("/browse?tab=lectures");

    await screen.findByRole("link", { name: "Watch Lesson" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('[src*="youtube-nocookie"]')).toBeNull();
  });

  it("asks the database for the course id, one row per lecture", async () => {
    renderAt("/browse?tab=lectures");

    await waitFor(() => expect(lectureQuery()).toBeTruthy());
    const q = lectureQuery();
    expect(q.cols).toContain("membership:playlist_videos(playlist_id)");
    // Bounded: a lecture needs ONE course to link to, not every course it is in.
    expect(q.limits).toContainEqual([1, "membership"]);
    // The page's own ordering is untouched by the embed's.
    expect(q.orders).toEqual(["id"]);
  });

  it("keeps the course id when playlist filters force the inner join", async () => {
    renderAt("/browse?tab=lectures&language=hindi");

    await waitFor(() => expect(lectureQuery()).toBeTruthy());
    expect(lectureQuery().cols)
      .toContain("membership:playlist_videos!inner(playlist_id, playlists!inner(");
  });

  it("says so rather than linking nowhere when a lesson is in no course", async () => {
    lectureRows = [{ ...LECTURE_ROW, membership: [] }];
    renderAt("/browse?tab=lectures");

    expect(await screen.findByText(/isn’t part of a course yet/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Watch Lesson" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
