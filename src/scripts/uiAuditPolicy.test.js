import { describe, expect, it } from "vitest";
import { collectUiAuditFailures } from "./uiAuditPolicy.js";

function passingReport() {
  return {
    matrix: [
      {
        width: 390,
        step: "browse",
        overflowingEls: 0,
        headers: 1,
        tapTargetsUnder44: 0,
      },
      {
        width: 1440,
        step: "course",
        overflowingEls: 0,
        headers: 1,
        tapTargetsUnder44: 0,
      },
    ],
    titleStress: {
      english: { overflowPx: 0 },
      hindi: { overflowPx: 0 },
    },
    reflow200: {
      zoom100: { overflowPx: 0, overflowingEls: 0, headerVisible: true },
      zoom200: { overflowPx: 0, overflowingEls: 0, headerVisible: true },
    },
    focusOrder: Array.from({ length: 8 }, (_, index) => ({
      el: "BUTTON",
      label: `Control ${index + 1}`,
      ring: true,
    })),
    restoration: {
      clicked: "View course",
      afterClick: { url: "/course/5" },
      filtersRestored: true,
      scrollRestored: true,
    },
  };
}

describe("responsive UI audit policy", () => {
  it("accepts a report with all objective gates passing", () => {
    expect(collectUiAuditFailures(passingReport())).toEqual([]);
  });

  it("rejects layout, accessibility, and navigation regressions", () => {
    const report = passingReport();
    report.matrix[0].overflowingEls = 2;
    report.matrix[0].headers = 2;
    report.matrix[0].tapTargetsUnder44 = 1;
    report.titleStress.hindi.overflowPx = 12;
    report.reflow200.zoom200.overflowingEls = 1;
    report.focusOrder[2].ring = false;
    report.restoration.filtersRestored = false;
    report.restoration.scrollRestored = false;

    expect(collectUiAuditFailures(report)).toEqual(expect.arrayContaining([
      expect.stringContaining("overflow"),
      expect.stringContaining("header"),
      expect.stringContaining("tap target"),
      expect.stringContaining("Hindi"),
      expect.stringContaining("200% reflow"),
      expect.stringContaining("focus ring"),
      expect.stringContaining("filter state"),
      expect.stringContaining("scroll position"),
    ]));
  });
});
