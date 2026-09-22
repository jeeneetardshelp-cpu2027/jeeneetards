// What the Playlists tab says about a count it never established.
//
// The request deadline (supabaseClient.js) turns a hang into a rejected
// request, which is the right outcome — but it also makes the catalogue's
// error rendering reachable for the first time. In that state usePlaylistBrowse
// reports {items: [], total: null, error: "Couldn't load courses."}, and both
// count sites read straight through it:
//
//   `${items.length} courses`                 -> "0 courses"
//   `Show ${total ?? items.length} course(s)` -> "Show 0 courses"
//
// Neither number was ever counted. The Individual lectures tab already prints
// nothing on the identical failure (BrowsePage.jsx guards its count on
// !loading && !error), and ModerationDigest.jsx states the house rule: never
// show a 0 you cannot vouch for. These pin the Playlists tab, and its mobile
// filter drawer — the surface the deadline exists for — to the same rule.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

// One mutable result for the single list query usePlaylistBrowse sends.
const RESULT = vi.hoisted(() => ({ next: { data: [], error: null, count: 0 } }));

vi.mock("./supabaseClient", () => {
  const builder = () => {
    const b = {
      select: () => b, order: () => b, range: () => b, eq: () => b,
      ilike: () => b, in: () => b, limit: () => b,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (resolve) => Promise.resolve(RESULT.next).then(resolve),
    };
    return b;
  };
  return {
    isSupabaseConfigured: true,
    supabase: { from: builder, rpc: () => Promise.resolve({ data: [], error: null }) },
  };
});
vi.mock("./useRatingsAvailability.js", () => ({ useRatingsAvailability: () => null }));
vi.mock("./usePopularityAvailability.js", () => ({ usePopularityAvailability: () => null }));

import PlaylistBrowse from "./PlaylistBrowse.jsx";

// The shape a deadline abort actually produces: a rejected request that is
// neither the missing-stats-column case (42703 / PGRST204) nor the
// out-of-range page (PGRST103), so the hook takes its real error branch.
const DEADLINE_ERROR = {
  next: { data: null, error: { message: "signal timed out", code: "57014" }, count: null },
};
const rows = (n) => ({
  next: {
    data: Array.from({ length: n }, (_, i) => ({
      id: i + 1, title: `Course ${i + 1}`, teacher: null,
      average_rating: 0, ratings_count: 0, language: null, content_type: null,
      difficulty: null, class_levels: [], institutes_channels: null,
      subjects: null, playlist_videos: [{ count: 3 }],
    })),
    error: null,
    count: n,
  },
});

const renderBrowse = (props = {}, url = "/browse") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/browse" element={
          <PlaylistBrowse
            tab="playlists" onTabChange={() => {}} lectureView={<div />}
            filters={{ search: "", enabled: true }}
            {...props}
          />
        } />
      </Routes>
    </MemoryRouter>,
  );

const openDrawer = () => {
  fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  return screen.getByRole("button", { name: /^Show/ });
};

let consoleError;
beforeEach(() => {
  RESULT.next = { data: [], error: null, count: 0 };
  // The hook logs the failure it is reporting; that is deliberate, and it is
  // not this file's output.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { consoleError.mockRestore(); });

describe("the Playlists count when the request failed", () => {
  it("prints no course count at all, the way the Lectures tab does", async () => {
    RESULT.next = DEADLINE_ERROR.next;
    renderBrowse();

    // The failure itself is still reported, with its retry.
    expect(await screen.findByText("Couldn’t load courses")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    // …but "0 courses" is a count of a catalogue that never answered, and no
    // other number may stand in for it either.
    expect(screen.queryByText(/^0 courses$/)).toBeNull();
    expect(screen.queryByText(/^\d+ courses?$/)).toBeNull();
  });

  it("still prints the count when the catalogue actually answered", async () => {
    RESULT.next = rows(3).next;
    renderBrowse();

    expect(await screen.findByText("3 courses")).toBeTruthy();
  });
});

describe("the mobile filter drawer's Show button", () => {
  it("offers no course count when the request failed", async () => {
    RESULT.next = DEADLINE_ERROR.next;
    renderBrowse();
    await screen.findByText("Couldn’t load courses");

    // The same shape a hang produces today (deadlineMs:0): usable button,
    // no invented number.
    expect(openDrawer().textContent).toBe("Show courses");
  });

  it("offers no course count for a search the server was never asked", async () => {
    // usePlaylistBrowse refuses an unservable term and returns total: 0
    // WITHOUT sending anything. The count line above already prints nothing
    // for this; the drawer said "Show 0 courses" for a query never run.
    renderBrowse({ filters: { search: "p c", enabled: true } }, "/browse?q=p%20c");

    expect(openDrawer().textContent).toBe("Show courses");
  });

  it("still counts what the catalogue actually returned", async () => {
    RESULT.next = rows(2).next;
    renderBrowse();
    await screen.findByText("2 courses");

    expect(openDrawer().textContent).toBe("Show 2 courses");
  });

  it("offers no lesson count when the lectures request failed", async () => {
    // BrowsePage passes useVideos' total straight through, and that total is
    // null on a failed request — `lectureTotal ?? 0` turned it into a claim.
    renderBrowse({ tab: "lectures", lectureTotal: null, lectureLoading: false });

    expect(openDrawer().textContent).toBe("Show lessons");
  });

  it("still counts the lessons the lectures tab actually loaded", async () => {
    renderBrowse({ tab: "lectures", lectureTotal: 7, lectureLoading: false });

    expect(openDrawer().textContent).toBe("Show 7 lessons");
  });

  it("keeps the singular when exactly one lesson loaded", async () => {
    renderBrowse({ tab: "lectures", lectureTotal: 1, lectureLoading: false });

    expect(openDrawer().textContent).toBe("Show 1 lesson");
  });
});
