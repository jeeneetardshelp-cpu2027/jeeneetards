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
      { instituteId: 13, institute: "Competishun+" },
      { instituteId: 13, institute: "Competishun+" },
      { instituteId: 27, institute: "Mohit Tyagi" },
      { instituteId: null, institute: "Unknown channel" },
    ]);

    expect(institutes).toEqual([
      { id: 13, name: "Competishun+" },
      { id: 27, name: "Mohit Tyagi" },
    ]);

    render(
      <MemoryRouter>
        <SocialProof institutes={institutes} loading={false} />
      </MemoryRouter>,
    );

    const competishunLinks = screen.getAllByRole("link", {
      name: "View all courses from Competishun+",
    });
    expect(competishunLinks.length).toBeGreaterThan(0);
    expect(competishunLinks.every((link) => link.getAttribute("href") === "/browse?channel=13"))
      .toBe(true);
  });
});
