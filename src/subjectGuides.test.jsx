import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "./theme.jsx";
import { SubjectGuide } from "./Explore.jsx";
import {
  getSubjectGuide,
  SUBJECT_GUIDE_PATHS,
} from "./subjectGuides.js";

describe("subject guide editorial pilots", () => {
  it("publishes only the two explicitly reviewed route pilots", () => {
    expect(SUBJECT_GUIDE_PATHS).toEqual([
      "/explore/jee/class-11/physics",
      "/explore/neet/class-11/biology",
    ]);
    expect(getSubjectGuide({ goal: "jee", cls: "class-11", subject: "chemistry" }))
      .toBeNull();
  });

  it("keeps official-source boundaries visible in the JEE guide", () => {
    const guide = getSubjectGuide({ goal: "jee", cls: "class-11", subject: "physics" });
    expect(guide.introduction.join(" ")).toContain("not as an official class-wise syllabus");
    expect(guide.sources[0].href).toBe(
      "https://jeemain.nta.nic.in/document/syllabus-2026/",
    );
  });

  it("renders the student guidance, official sources, and methodology path", () => {
    const guide = getSubjectGuide({ goal: "neet", cls: "class-11", subject: "biology" });
    render(
      <ThemeProvider>
        <MemoryRouter>
          <SubjectGuide guide={guide} />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", {
      name: "A practical way to study NEET Class 11 Biology",
    })).toBeTruthy();
    expect(document.getElementById("subject-guide")).toBeTruthy();
    expect(screen.getByRole("link", {
      name: "Official NEET UG 2026 syllabus (NMC via NTA)",
    }).getAttribute("href")).toContain("202601081066816297.pdf");
    expect(screen.getByRole("link", {
      name: "how JEENEETARD classifies and checks courses",
    }).getAttribute("href")).toBe("/methodology");
  });
});
