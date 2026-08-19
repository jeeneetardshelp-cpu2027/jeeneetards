import { describe, expect, it } from "vitest";
import {
  buildChannelLogoUpdates, trustedYouTubeLogoUrl,
} from "./refreshChannelLogos.js";

describe("channel logo refresh", () => {
  it("accepts only HTTPS YouTube avatar hosts", () => {
    expect(trustedYouTubeLogoUrl("https://yt3.ggpht.com/avatar=s88")).toContain("yt3.ggpht.com");
    expect(trustedYouTubeLogoUrl("http://yt3.ggpht.com/avatar")).toBeNull();
    expect(trustedYouTubeLogoUrl("https://tracking.example/avatar")).toBeNull();
  });

  it("updates changed logos without inventing rows for missing channels", () => {
    const channels = [
      { id: 1, name: "Alpha", youtube_channel_id: "UC12345678901234567890", logo_url: null },
      { id: 2, name: "Beta", youtube_channel_id: "UCabcdefghijABCDEFGHIJ", logo_url: null },
    ];
    const items = [{
      id: channels[0].youtube_channel_id,
      snippet: { thumbnails: { default: { url: "https://yt3.ggpht.com/alpha=s88" } } },
    }];

    const plan = buildChannelLogoUpdates(channels, items);
    expect(plan.updates).toEqual([
      { id: 1, name: "Alpha", logo_url: "https://yt3.ggpht.com/alpha=s88" },
    ]);
    expect(plan.missing.map((row) => row.name)).toEqual(["Beta"]);
    expect(plan.invalid).toEqual([]);
  });
});
