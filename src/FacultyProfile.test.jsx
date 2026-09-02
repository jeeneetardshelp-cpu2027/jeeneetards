import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

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
        {/* One route with an optional slug, mirroring App.jsx: a course link
            from here is the canonical /course/:id/:slug, and a two-route
            stand-in would let a slugged href fall through to no match. */}
        <Route path="/course/:id/:slug?" element={<p>Course destination</p>} />
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
    expect(document.head.querySelector('[data-schema-key="Person"]')?.textContent)
      .toContain('"alternateName":["ABJ Sir"]');
  });

  it("links every course to its canonical slugged course page", () => {
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
    expect(link.getAttribute("href")).toBe("/course/9/complete-kinematics");
    expect(screen.getByText("1 student rating")).toBeDefined();
  });

  it("links back to the canonical faculty directory", () => {
    profileHook.value = {
      loading: false, error: null,
      profile: {
        display_name: "Amit Bijarnia", slug: "amit-bijarnia", verified: true,
        course_count: 0, aliases: [], courses: [],
      },
    };
    renderProfile();
    expect(screen.getByRole("link", { name: "Faculty" }).getAttribute("href"))
      .toBe("/faculty");
  });

  it("shows the reviewed faculty pilot with visible sources and matching schema", () => {
    profileHook.value = {
      loading: false, error: null,
      profile: {
        id: 7, slug: "amit-bijarnia", display_name: "Amit Bijarnia",
        verified: true, course_count: 0, bio: "Legacy database bio.", photo_url: null,
        aliases: [{ alias: "ABJ Sir", status: "verified" }],
        institutes: ["Mohit Tyagi"], courses: [],
      },
    };
    renderProfile();

    expect(screen.getByRole("heading", { name: "Source-backed profile" })).toBeDefined();
    expect(screen.getByText(/listed by Competishun as a Physics faculty member/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Competishun faculty overview/ })
      .getAttribute("href")).toBe("https://competishun.com/");
    expect(screen.getByText("Sources checked 2026-08-25.")).toBeDefined();
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
      .toContain("Competishun Physics faculty for JEE");
    expect(document.head.querySelector('[data-schema-key="Person"]')?.textContent)
      .toContain('"description":"Amit Bijarnia');
    expect(document.head.querySelector('[data-schema-key="Person"]')?.textContent)
      .not.toContain("Legacy database bio.");
  });
});

// ------------------------------------------------------- Devanagari (lang.js)
// A teacher's name, their aliases and their course titles are catalogue text
// under a document that declares lang="en". See lang.js.
describe("Devanagari on a faculty profile", () => {
  it("tags the name, the aliases and the course titles, and nothing else", () => {
    profileHook.value = {
      loading: false, error: null,
      profile: {
        slug: "amit", display_name: "अमित बिजारणिया", verified: true, course_count: 1,
        aliases: [{ alias: "एबीजे सर", status: "verified" }],
        courses: [{ playlist_id: 1, title: "कबीर की साखी", average_rating: null, ratings_count: 0 }],
      },
    };
    const { container } = renderProfile();

    // The breadcrumb already tags its own copy of the name (AppShell), so ask
    // for the one in the page heading specifically.
    expect(container.querySelector("h1 [lang='hi']").textContent).toBe("अमित बिजारणिया");
    expect(screen.getByText("एबीजे सर").getAttribute("lang")).toBe("hi");
    expect(screen.getByText("कबीर की साखी").getAttribute("lang")).toBe("hi");
    // Same course, the other half of the slug rule: no ASCII to slugify means
    // the canonical address is the bare id, not a percent-encoded guess.
    expect(screen.getByText("कबीर की साखी").closest("a").getAttribute("href"))
      .toBe("/course/1");
    // The Verified badge shares the h1 and must not inherit Hindi.
    expect(screen.getByText("Verified").closest("[lang]")).toBeNull();
  });

  it("leaves a Latin profile untagged and unwrapped", () => {
    profileHook.value = {
      loading: false, error: null,
      profile: {
        slug: "someone", display_name: "A. Sharma", verified: false, course_count: 1,
        aliases: [{ alias: "AS Sir", status: "verified" }],
        courses: [{ playlist_id: 1, title: "Complete Kinematics", average_rating: null, ratings_count: 0 }],
      },
    };
    const { container } = renderProfile();
    expect(container.querySelector("[lang]")).toBeNull();
    expect(screen.getByText(/Also known as AS Sir/)).toBeDefined();
  });
});
