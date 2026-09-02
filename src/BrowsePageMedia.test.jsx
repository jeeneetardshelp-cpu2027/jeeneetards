import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "./theme.jsx";
import { VideoCard } from "./Dashboard.jsx";

const video = {
  id: 9,
  youtubeVideoId: "CBvaO-uDvs8",
  title: "Vectors for JEE",
  instituteId: 8,
  institute: "Mohit Tyagi",
  instituteLogoUrl: "https://yt3.ggpht.com/mohit-tyagi=s88",
  subject: "Physics",
  chapter: "Vectors",
  // The course this lesson is watched inside. useVideos reads it from the
  // playlist_videos embed — `videos` has no playlist_id column of its own.
  playlistId: 5,
};

const renderWithAppContext = (node) => render(
  <MemoryRouter>
    <ThemeProvider>{node}</ThemeProvider>
  </MemoryRouter>,
);

describe("individual lecture visuals and channel navigation", () => {
  it("shows the YouTube thumbnail and links the card's channel credit", () => {
    const { container } = renderWithAppContext(<VideoCard video={video} />);

    expect(container.querySelector('img[src="https://img.youtube.com/vi/CBvaO-uDvs8/hqdefault.jpg"]'))
      .toBeTruthy();
    expect(container.querySelector('img[src="https://yt3.ggpht.com/mohit-tyagi=s88"]'))
      .toBeTruthy();
    expect(screen.getByRole("link", { name: "View all courses from Mohit Tyagi" })
      .getAttribute("href")).toBe("/browse?channel=8");
  });
});

// The card used to open a bare youtube-nocookie iframe in a modal on this
// page. That player recorded no progress, so a lesson watched there earned no
// Continue-watching entry, no streak day and no watched tick, and it carried
// none of the lesson sequence, notes, materials, rating or report controls.
// The lesson's real home is /course/:playlistId?v=:youtubeVideoId.
describe("a lecture card leads to the watch page, not a second player", () => {
  it("links the thumbnail and the button to the lesson inside its course", () => {
    renderWithAppContext(<VideoCard video={video} />);

    const thumbnail = screen.getByRole("link", { name: "Watch Vectors for JEE" });
    expect(thumbnail.getAttribute("href")).toBe("/course/5?v=CBvaO-uDvs8");

    // ?v= takes the YouTube id, not the row id: that is what CourseVideoPage
    // matches its lessons on.
    const watch = screen.getByRole("link", { name: "Watch Lesson" });
    expect(watch.getAttribute("href")).toBe("/course/5?v=CBvaO-uDvs8");
    expect(watch.getAttribute("href")).not.toContain("v=9");
    // Thumb-sized on a phone.
    expect(watch.className).toContain("min-h-11");
  });

  it("plays nothing in place — no dialog, no second iframe", () => {
    const { container } = renderWithAppContext(<VideoCard video={video} />);

    fireEvent.click(screen.getByRole("link", { name: "Watch Vectors for JEE" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    // No leftover play buttons either: every way in is a link now.
    expect(screen.queryByRole("button", { name: /Watch/i })).toBeNull();
  });

  it("escapes the video id it puts in the URL", () => {
    renderWithAppContext(
      <VideoCard video={{ ...video, youtubeVideoId: "a b&c" }} />,
    );
    expect(screen.getByRole("link", { name: "Watch Lesson" }).getAttribute("href"))
      .toBe("/course/5?v=a%20b%26c");
  });

  it("promises nothing when no course contains the lesson", () => {
    renderWithAppContext(<VideoCard video={{ ...video, playlistId: null }} />);

    expect(screen.queryByRole("link", { name: "Watch Lesson" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Watch Vectors for JEE" })).toBeNull();
    expect(screen.getByText(/isn’t part of a course yet/)).toBeTruthy();
    // The card still shows what it knows.
    expect(screen.getByText("Vectors for JEE")).toBeTruthy();
  });
});
