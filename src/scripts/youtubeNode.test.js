import { afterEach, describe, expect, it, vi } from "vitest";
import { getPlaylistOwner, getVideoDetails } from "./youtubeNode.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getVideoDetails", () => {
  it("requests and preserves public snippet attribution evidence", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: "abcdefghijk",
          snippet: {
            description: "Official lesson description",
            tags: ["NEET", "Tarun Sir"],
          },
          contentDetails: { duration: "PT2M", caption: "false" },
          status: { embeddable: true },
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const details = await getVideoDetails("test-key", ["abcdefghijk"]);

    expect(fetchMock).toHaveBeenCalledOnce();
    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestUrl.searchParams.get("part"))
      .toBe("snippet,contentDetails,status");
    expect(details.get("abcdefghijk")).toEqual({
      description: "Official lesson description",
      tags: ["NEET", "Tarun Sir"],
      durationSeconds: 120,
      captionStatus: "none",
      embeddingStatus: "embeddable",
    });
  });
});

describe("getPlaylistOwner", () => {
  it("preserves the public playlist description for attribution review", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: "PL_review",
          snippet: {
            channelId: "UC_owner",
            channelTitle: "Example Academy",
            title: "JEE Physics",
            description: "Faculty: Alakh Pandey",
          },
          contentDetails: { itemCount: 12 },
        }],
      }),
    }));

    await expect(getPlaylistOwner("test-key", "PL_review")).resolves.toEqual({
      channelId: "UC_owner",
      channelTitle: "Example Academy",
      playlistId: "PL_review",
      playlistTitle: "JEE Physics",
      playlistDescription: "Faculty: Alakh Pandey",
      videoCount: 12,
    });
  });
});
