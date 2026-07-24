import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const profileHook = vi.hoisted(() => ({ value: null }));
vi.mock("./useFaculty.js", () => ({
  useFacultyProfile: () => profileHook.value,
}));

import FacultyProfile from "./FacultyProfile.jsx";

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/faculty/amit-bijarnia"]}>
      <Routes>
        <Route path="/faculty/:slug" element={<FacultyProfile />} />
        <Route path="/course/:id" element={<p>Course destination</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FacultyProfile", () => {
  it("shows only verified aliases and never stringifies alias objects", () => {
    profileHook.value = {
      loading: false, error: null,
      profile: {
        display_name: "Amit Bijarnia", verified: true, course_count: 0,
        aliases: [
          { alias: "Amit Bijarnia", status: "verified" },
          { alias: "ABJ Sir", status: "verified" },
          { alias: "A. Bijarnia", status: "proposed" },
        ],
        courses: [],
      },
    };
    renderProfile();
    expect(screen.getByText(/Also known as ABJ Sir/)).toBeDefined();
    expect(screen.queryByText(/A\. Bijarnia/)).toBeNull();
    expect(document.body.textContent).not.toContain("[object Object]");
  });

  it("links every course to its real course page", () => {
    profileHook.value = {
      loading: false, error: null,
      profile: {
        display_name: "Amit Bijarnia", verified: true, course_count: 1, aliases: [],
        courses: [{
          playlist_id: 9, title: "Complete Kinematics", subject: "Physics",
          role: "instructor", average_rating: 5, ratings_count: 1,
        }],
      },
    };
    renderProfile();
    const link = screen.getByRole("link", { name: /Complete Kinematics/i });
    expect(link.getAttribute("href")).toBe("/course/9");
    expect(screen.getByText("1 student rating")).toBeDefined();
  });
});
