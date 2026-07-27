import { afterEach, describe, expect, it, vi } from "vitest";
import { getVideoDetails } from "./youtubeNode.js";

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
