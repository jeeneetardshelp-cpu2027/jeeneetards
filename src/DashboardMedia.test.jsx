import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme.jsx";
import { VideoCard, VideoModal } from "./Dashboard.jsx";

const video = {
  id: 9,
  youtubeVideoId: "CBvaO-uDvs8",
  title: "Vectors for JEE",
  instituteId: 8,
  institute: "Mohit Tyagi",
  instituteLogoUrl: "https://yt3.ggpht.com/mohit-tyagi=s88",
  subject: "Physics",
  chapter: "Vectors",
};

const renderWithAppContext = (node) => render(
  <MemoryRouter>
    <ThemeProvider>{node}</ThemeProvider>
  </MemoryRouter>,
);

describe("individual lecture visuals and channel navigation", () => {
  it("shows the YouTube thumbnail and links the card's channel credit", () => {
    const onOpen = vi.fn();
    const { container } = renderWithAppContext(<VideoCard video={video} onOpen={onOpen} />);

    expect(container.querySelector('img[src="https://img.youtube.com/vi/CBvaO-uDvs8/hqdefault.jpg"]'))
      .toBeTruthy();
    expect(container.querySelector('img[src="https://yt3.ggpht.com/mohit-tyagi=s88"]'))
      .toBeTruthy();
    expect(screen.getByRole("link", { name: "View all courses from Mohit Tyagi" })
      .getAttribute("href")).toBe("/browse?channel=8");

    fireEvent.click(screen.getByRole("button", { name: "Watch Vectors for JEE" }));
    expect(onOpen).toHaveBeenCalledWith(video);
  });

  it("keeps the video dialog's repeated channel credit clickable", () => {
    const onClose = vi.fn();
    const { container } = renderWithAppContext(<VideoModal video={video} onClose={onClose} />);

    const channelLink = screen.getByRole("link", { name: "View all courses from Mohit Tyagi" });
    expect(channelLink.getAttribute("href")).toBe("/browse?channel=8");
    expect(container.querySelector('img[src="https://yt3.ggpht.com/mohit-tyagi=s88"]'))
      .toBeTruthy();

    fireEvent.click(channelLink);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
