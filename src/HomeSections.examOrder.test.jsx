// ExamGrid leads with the student's own exam — the lane remembered from the
// countdown (ll_exam_lane_v1) — while every other card keeps its order. A
// visitor with no stored lane sees exactly the old grid.
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ExamGrid } from "./HomeSections.jsx";

const EXAMS = [
  { id: "jee", label: "JEE", available: true, hint: "", count: 5 },
  { id: "neet", label: "NEET", available: true, hint: "", count: 4 },
  { id: "school", label: "Boards", available: true, hint: "", count: 3 },
  { id: "olympiad", label: "Olympiad", available: false, hint: "Coming soon", count: 0 },
];

const renderGrid = () => render(
  <MemoryRouter>
    <ExamGrid exams={EXAMS} />
  </MemoryRouter>,
);

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const cardTitles = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("ExamGrid ordering", () => {
  it("keeps the default order when no lane is remembered", () => {
    renderGrid();
    expect(cardTitles()).toEqual(["JEE", "NEET", "Boards", "Olympiad"]);
  });

  it("puts the remembered exam first, everything else untouched", () => {
    localStorage.setItem("ll_exam_lane_v1", "neet");
    renderGrid();
    expect(cardTitles()).toEqual(["NEET", "JEE", "Boards", "Olympiad"]);
  });

  it("ignores a stored value that is not a lane", () => {
    localStorage.setItem("ll_exam_lane_v1", "definitely-not-an-exam");
    renderGrid();
    expect(cardTitles()).toEqual(["JEE", "NEET", "Boards", "Olympiad"]);
  });
});
