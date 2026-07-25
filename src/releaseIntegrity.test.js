import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = dirname(fileURLToPath(import.meta.url));

function relativeSourceFiles() {
  return [
    "adminUI.jsx",
    "AppShell.jsx",
    "CourseOverview.jsx",
    "CourseRating.jsx",
    "CourseVideoPage.jsx",
    "Dashboard.jsx",
    "Explore.jsx",
    "FilterPanel.jsx",
    "Home.jsx",
    "LegalPage.jsx",
    "MinimalUI.jsx",
    "PlaylistBrowse.jsx",
    "PrivacyPolicy.jsx",
    "StudentAuth.jsx",
    "UniversalSearch.jsx",
    "VideoReport.jsx",
  ];
}

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => (
    value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

describe("frontend release-file integrity", () => {
  it("keeps Compare.jsx free of raw NUL bytes", () => {
    const source = readFileSync(resolve(sourceRoot, "Compare.jsx"));
    expect(source.includes(0)).toBe(false);
  });

  it("uses a teal that passes WCAG AA under white button text everywhere", async () => {
    const { BRAND_TEAL } = await import("./brandColors.js");
    const contrast = 1.05 / (relativeLuminance(BRAND_TEAL) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);

    for (const file of relativeSourceFiles()) {
      const source = readFileSync(resolve(sourceRoot, file), "utf8");
      expect(source, `${file} still contains the inaccessible legacy teal`)
        .not.toContain("#13919B");
    }
  });
});
