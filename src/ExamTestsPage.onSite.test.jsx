// The on-site papers card on /tests/:examId.
//
// The site curates JEE Main papers at /materials/jee-main/previous-year-papers,
// but until this card existed nothing on the tests pages said so — a student
// on /tests/jee-main saw four outbound links and no hint that the papers they
// wanted were one internal click away. The card must stay honest in both
// directions: clearly marked as on-site (never dressed as another third-party
// source), and NEVER invented for an exam whose on-site shelf has not been
// verified to exist.
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import ExamTestsPage from "./ExamTestsPage.jsx";
import { JEE_MAIN_PAPERS_PATH, ON_SITE_TEST_RESOURCES } from "./studyMaterialLandings.js";
import { TEST_SECTIONS, findTestSection } from "./testPlatforms.js";
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

describe("/tests/:examId on-site papers card", () => {
  it("shows ONE internal card on /tests/jee-main, pointing at the paper landing", () => {
    const { container } = renderExam("jee-main");

    const internal = [...container.querySelectorAll(`li a[href="${JEE_MAIN_PAPERS_PATH}"]`)];
    expect(internal).toHaveLength(1);
    // Internal navigation, not an external hand-off.
    expect(internal[0].getAttribute("target")).toBeNull();
    // Marked as on-site where the external cards show their destination host,
    // and honest that these are papers to read rather than a timed test.
    expect(internal[0].textContent).toContain("On JEENEETARD");
    expect(internal[0].textContent).toContain("not a timed test");
  });

  it("keeps every external source alongside the internal card", () => {
    const jeeMain = findTestSection("jee-main");
    const { container } = renderExam("jee-main");

    const external = [...container.querySelectorAll("li a[target='_blank']")];
    expect(external.map((a) => a.getAttribute("href")).sort()).toEqual(
      jeeMain.resources.map((r) => r.url).sort(),
    );
  });

  it.each(TEST_SECTIONS.filter((s) => s.id !== "jee-main").map((s) => s.id))(
    "does not invent an on-site card on /tests/%s",
    (examId) => {
      const { container } = renderExam(examId);
      expect(container.querySelectorAll(`a[href="${JEE_MAIN_PAPERS_PATH}"]`).length).toBe(0);
      expect(container.textContent).not.toContain("On JEENEETARD");
    },
  );

  it("only maps exams that really have a /tests page", () => {
    for (const examId of Object.keys(ON_SITE_TEST_RESOURCES)) {
      expect(findTestSection(examId), `${examId} has no /tests/${examId} page`).not.toBeNull();
      expect(ON_SITE_TEST_RESOURCES[examId].to).toMatch(/^\/materials\//);
    }
  });
});
