import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import YouTubeThumbnail, { youtubeThumbnailUrl } from "./YouTubeThumbnail.jsx";

describe("YouTubeThumbnail", () => {
  it("builds a thumbnail URL only for a valid YouTube video id", () => {
    expect(youtubeThumbnailUrl("CBvaO-uDvs8"))
      .toBe("https://img.youtube.com/vi/CBvaO-uDvs8/hqdefault.jpg");
    expect(youtubeThumbnailUrl("video-1")).toBeNull();
  });

  it("uses a quiet visual fallback when the image cannot load", () => {
    const { container } = render(<YouTubeThumbnail videoId="CBvaO-uDvs8" />);
    fireEvent.error(container.querySelector("img"));

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
