import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChannelAvatar, { channelAvatarUrl } from "./ChannelAvatar.jsx";

describe("ChannelAvatar", () => {
  it("allows only trusted HTTPS YouTube image hosts", () => {
    expect(channelAvatarUrl("https://yt3.ggpht.com/channel=s88")).toContain("yt3.ggpht.com");
    expect(channelAvatarUrl("http://yt3.ggpht.com/channel=s88")).toBeNull();
    expect(channelAvatarUrl("https://tracking.example/channel")).toBeNull();
  });

  it("falls back to the channel icon when an image fails", () => {
    const { container } = render(
      <ChannelAvatar url="https://yt3.ggpht.com/channel=s88" name="Example channel" />,
    );
    fireEvent.error(container.querySelector("img"));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
