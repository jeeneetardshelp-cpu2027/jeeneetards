import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = [];
let response;

function builder(table) {
  const call = { table, columns: null, order: null };
  calls.push(call);
  const query = {
    select(columns) { call.columns = columns; return query; },
    order(column) { call.order = column; return query; },
    then(resolve, reject) { return Promise.resolve(response).then(resolve, reject); },
  };
  return query;
}

vi.mock("./supabaseClient.js", () => ({
  isSupabaseConfigured: true,
  supabase: { from: (table) => builder(table) },
}));

import { mapHomepageChannels, useHomepageChannels } from "./useHomepageChannels.js";

let seen;
function Probe() {
  seen = useHomepageChannels();
  return null;
}

beforeEach(() => {
  calls.length = 0;
  seen = undefined;
  response = { data: [], error: null };
});

describe("complete homepage channel catalogue", () => {
  it("keeps every channel with uploaded content and excludes empty registry rows", () => {
    expect(mapHomepageChannels([
      {
        id: 1, name: "Mohit Tyagi", logo_url: "https://yt3.ggpht.com/mohit=s88",
        playlists: [{ count: 92 }], videos: [{ count: 1839 }],
      },
      {
        id: 2, name: "Video-only channel", logo_url: null,
        playlists: [{ count: 0 }], videos: [{ count: 3 }],
      },
      {
        id: 3, name: "Empty channel", logo_url: null,
        playlists: [{ count: 0 }], videos: [{ count: 0 }],
      },
    ])).toEqual([
      {
        id: 1,
        name: "Mohit Tyagi",
        logoUrl: "https://yt3.ggpht.com/mohit=s88",
        playlistCount: 92,
        videoCount: 1839,
        to: "/browse?channel=1",
      },
      {
        id: 2,
        name: "Video-only channel",
        logoUrl: null,
        playlistCount: 0,
        videoCount: 3,
        to: "/browse?channel=2&tab=lectures",
      },
    ]);
  });

  it("loads the full bounded registry with real playlist and video counts", async () => {
    response = {
      data: [{
        id: 136,
        name: "Aakash NEET",
        logo_url: "https://yt3.ggpht.com/aakash=s88",
        playlists: [{ count: 40 }],
        videos: [{ count: 276 }],
      }],
      error: null,
    };

    render(<Probe />);
    await waitFor(() => expect(seen.loading).toBe(false));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      table: "institutes_channels",
      columns: "id, name, logo_url, playlists(count), videos(count)",
      order: "name",
    });
    expect(seen.channels).toHaveLength(1);
    expect(seen.channels[0]).toMatchObject({
      id: 136,
      name: "Aakash NEET",
      playlistCount: 40,
      videoCount: 276,
    });
  });
});
