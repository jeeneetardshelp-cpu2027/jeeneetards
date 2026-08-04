import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { Hero, SocialProof, pickInstitutes } from "./HomeSections.jsx";

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
      { instituteId: 31, institute: "ALLEN NEET" },
      { instituteId: 42, institute: "Aakash NEET" },
      { instituteId: 56, institute: "Hindi Adhyapak" },
      { instituteId: 68, institute: "Mission JEET" },
      { instituteId: null, institute: "Unknown channel" },
    ]);

    expect(institutes).toEqual([
      { id: 13, name: "Competishun+", logoUrl: "https://yt3.ggpht.com/competishun=s88" },
      { id: 27, name: "Mohit Tyagi", logoUrl: null },
      { id: 31, name: "ALLEN NEET", logoUrl: null },
      { id: 42, name: "Aakash NEET", logoUrl: null },
      { id: 56, name: "Hindi Adhyapak", logoUrl: null },
      { id: 68, name: "Mission JEET", logoUrl: null },
    ]);

    const { container } = render(
      <MemoryRouter>
        <SocialProof institutes={institutes} loading={false} />
      </MemoryRouter>,
    );

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
