// The way back from a mock-test page to lectures (examLectureLinks.js).
//
// /tests/:examId sends students to third-party test platforms. A student who
// just lost marks in a chapter needs that chapter's lectures next, and until
// this link nothing on the page led back to a single one.
import { render, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import ExamTestsPage from "./ExamTestsPage.jsx";
import { ThemeProvider } from "./theme.jsx";

const renderExam = (examId) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/tests/${examId}`]}>
        <Routes>
          <Route path="/tests/:examId" element={<ExamTestsPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe("/tests/:examId links back to lectures", () => {
  it.each([
    ["jee-main", "Find JEE lectures by chapter", "/explore/jee"],
    ["jee-advanced", "Find JEE lectures by chapter", "/explore/jee"],
    ["neet", "Find NEET lectures by chapter", "/explore/neet"],
  ])("/tests/%s links to its chapter picker", (examId, name, href) => {
    const { container } = renderExam(examId);
    const link = within(container).getByRole("link", { name });
    expect(link.getAttribute("href")).toBe(href);
    // Internal navigation, not one more hand-off to a third-party site.
    expect(link.getAttribute("target")).toBeNull();
    expect(link.closest("p").textContent).toContain("Lost marks in a chapter?");
  });

  it.each(["class-10", "class-12", "olympiad"])("/tests/%s shows no lecture link", (examId) => {
    const { container } = renderExam(examId);
    expect(container.querySelector('a[href^="/explore/"]')).toBeNull();
    expect(container.textContent).not.toContain("Lost marks in a chapter?");
  });
});
