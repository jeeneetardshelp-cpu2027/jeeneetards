import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { Hero, SocialProof, pickInstitutes, pickFeaturedChannels } from "./HomeSections.jsx";

describe("homepage navigation shortcuts", () => {
  it("makes the course and exam-track statistics real navigation links", () => {
    render(
      <MemoryRouter>
        <Hero
          stats={[
            { value: 380, label: "Free courses", note: "Curriculum-tagged", to: "/browse" },
            { value: 4, label: "Exam tracks", note: "JEE, NEET, Boards", to: "/explore" },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /380 Free courses/i }).getAttribute("href"))
      .toBe("/browse");
    expect(screen.getByRole("link", { name: /4 Exam tracks/i }).getAttribute("href"))
      .toBe("/explore");
  });

  it("keeps channel ids and links every channel to its filtered playlist catalogue", () => {
    const institutes = pickInstitutes([
      { instituteId: 13, institute: "Competishun+", instituteLogoUrl: "https://yt3.ggpht.com/competishun=s88" },
      { instituteId: 13, institute: "Competishun+" },
      { instituteId: 27, institute: "Mohit Tyagi" },
      { instituteId: 42, institute: "Aakash NEET" },
      { instituteId: null, institute: "Unknown channel" },
    ]);

    expect(institutes).toEqual([
      { id: 13, name: "Competishun+", logoUrl: "https://yt3.ggpht.com/competishun=s88" },
      { id: 27, name: "Mohit Tyagi", logoUrl: null },
      { id: 42, name: "Aakash NEET", logoUrl: null },
    ]);

    const { container } = render(
      <MemoryRouter>
        <SocialProof institutes={institutes} loading={false} />
      </MemoryRouter>,
    );

    expect(screen.getByText("All 3 YouTube channels in this library")).toBeTruthy();

    institutes.forEach((institute) => {
      const links = screen.getAllByRole("link", {
        name: `View all courses from ${institute.name}`,
      });
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute("href")).toBe(`/browse?channel=${institute.id}`);
    });
    expect(container.querySelector("[inert]")).toBeNull();
    expect([...container.querySelectorAll("img")].some(
      (image) => image.getAttribute("src") === "https://yt3.ggpht.com/competishun=s88",
    )).toBe(true);
  });
});

// The homepage used to render EVERY channel: 5,171px of chips, 44% of a
// 17.6-screen page, and — because each chip was an unbounded nowrap box wider
// than a phone — a 39px sideways drag on every screen including the hero.
describe("homepage channel wall is bounded and honest", () => {
  const channel = (id, name, videoCount, playlistCount = 1) =>
    ({ id, name, logoUrl: null, videoCount, playlistCount, to: `/browse?channel=${id}` });

  it("shows the densest channels first, not whatever sorts alphabetically", () => {
    // The source orders by name, so a plain slice would lead with "Aardvark".
    const picked = pickFeaturedChannels([
      channel(1, "Aardvark Academy", 2),
      channel(2, "Zenith Physics", 900),
      channel(3, "Middle Institute", 300),
    ], 2);
    expect(picked.map((c) => c.name)).toEqual(["Zenith Physics", "Middle Institute"]);
  });

  it("breaks ties on playlist count, then name, so the order is deterministic", () => {
    const picked = pickFeaturedChannels([
      channel(1, "Beta", 10, 1),
      channel(2, "Alpha", 10, 1),
      channel(3, "Gamma", 10, 5),
    ]);
    expect(picked.map((c) => c.name)).toEqual(["Gamma", "Alpha", "Beta"]);
  });

  it("caps the wall and points at the rest without overstating what is shown", () => {
    const many = Array.from({ length: 73 }, (_, i) => channel(i + 1, `Channel ${i + 1}`, 100 - i));
    render(<MemoryRouter><SocialProof institutes={many} loading={false} /></MemoryRouter>);

    // Bounded: 8 chips, not 73.
    expect(screen.getAllByRole("link", { name: /^View all courses from/ })).toHaveLength(8);
    // Honest: the total is still reported, but NOT claimed as "All".
    expect(screen.getByText("73 YouTube channels in this library")).toBeTruthy();
    expect(screen.queryByText(/^All 73 /)).toBeNull();
    // And every channel stays reachable.
    expect(screen.getByRole("link", { name: "See all 73 channels" }).getAttribute("href"))
      .toBe("/browse");
  });

  it("still says \"All\" — and offers no extra link — when nothing is left out", () => {
    const few = [channel(1, "One", 5), channel(2, "Two", 4)];
    render(<MemoryRouter><SocialProof institutes={few} loading={false} /></MemoryRouter>);
    expect(screen.getByText("All 2 YouTube channels in this library")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /See all/ })).toBeNull();
  });
});
