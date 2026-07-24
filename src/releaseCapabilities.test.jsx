import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "./theme.jsx";
import FeatureUnavailable from "./FeatureUnavailable.jsx";
import VideoReport from "./VideoReport.jsx";
import CourseRating from "./CourseRating.jsx";
import StudentAuth from "./StudentAuth.jsx";
import { RELEASE_CAPABILITIES, RELEASE_FEATURES } from "./releaseCapabilities.js";
import { examCardState, homeTagline } from "./Home.jsx";

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

describe("current production capability contract", () => {
  it("does not promise database features that are absent from production", () => {
    expect(RELEASE_CAPABILITIES).toEqual({
      catalogNavigation: true,
      universalSearch: false,
      comparison: false,
      facultyRegistry: false,
      boardClassification: false,
    });
    expect(RELEASE_FEATURES).toEqual({
      studentAccounts: false,
      courseRatingSubmission: false,
      contentReporting: false,
    });
    expect(homeTagline()).not.toMatch(/compare/i);
  });

  it("keeps every student-owned write surface hidden for the browse-only MVP", () => {
    render(
      <ThemeProvider>
        <VideoReport videoId={1} videoTitle="Lecture" />
        <CourseRating playlistId={1} initialAverage={5} initialCount={1} />
        <StudentAuth />
      </ThemeProvider>,
    );
    expect(screen.queryByRole("button", { name: "Report an issue" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in to rate" })).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.getByText("1 student rating")).toBeTruthy();
  });

  it("enables only exam cards with real course counts", () => {
    const goals = [
      { slug: "jee", count: 7 },
      { slug: "neet", count: 0 },
      { slug: "school", count: 3 },
    ];
    expect(examCardState({ id: "jee" }, goals).available).toBe(true);
    expect(examCardState({ id: "neet" }, goals).available).toBe(false);
    expect(examCardState({ id: "neet" }, goals).hint).toBe("Coming soon");
    expect(examCardState({ id: "school" }, goals, { boardClassification: false }).available)
      .toBe(false);
  });

  it("never turns a failed course-count request into an empty exam", () => {
    const state = examCardState({ id: "jee" }, [], { error: "network" });
    expect(state.available).toBe(false);
    expect(state.hint).toBe("Course guide unavailable");
  });
});

describe("unavailable feature page", () => {
  it("explains the limitation and keeps the student inside the working catalogue", () => {
    render(
      <MemoryRouter initialEntries={["/compare"]}>
        <ThemeProvider>
          <Routes>
            <Route path="/compare" element={
              <FeatureUnavailable title="Course comparison is coming soon" detail="Still being verified." />
            } />
            <Route path="/browse" element={<LocationProbe />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Course comparison is coming soon" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Browse available courses" }));
    expect(screen.getByTestId("location").textContent).toBe("/browse");
  });
});
