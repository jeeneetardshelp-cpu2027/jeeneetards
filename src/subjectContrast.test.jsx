// Subject colours must be legible in the theme they are shown in.
//
// SUBJECT_COLORS are fixed hexes picked as BACKGROUNDS — the card spine, the
// avatar circle. Used as small text they failed WCAG AA in one theme or the
// other, all six of them, measured on production 2026-09-02:
//
//   physics 4.01:1 and mathematics 4.02:1 on the dark surface
//   chemistry 2.98:1, botany 3.38:1, biology 3.65:1 on the light surface
//   the teal fallback 3.15:1 on dark
//
// A fixed hex cannot swap with the theme, so each subject now has a token per
// theme. This test does not trust those values: it parses index.css and
// computes every ratio, so a later colour edit cannot quietly drop below AA.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { subjectColor, subjectInk, subjectTextColor } from "./brandColors.js";

const css = readFileSync(join(import.meta.dirname, "index.css"), "utf8");

const SUBJECTS = ["physics", "chemistry", "mathematics", "biology", "botany", "accent"];
const AA_NORMAL = 4.5;

const rgb = (hex) => {
  const s = hex.replace("#", "").trim();
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lum = ([r, g, b]) => {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [x, y] = [lum(rgb(a)), lum(rgb(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// The two theme blocks, split on the light selector.
const lightAt = css.indexOf('html[data-theme="light"]');
const blocks = {
  dark: css.slice(0, lightAt),
  light: css.slice(lightAt),
};
const varIn = (block, nameRe) => {
  const m = blocks[block].match(nameRe);
  return m ? m[1].trim() : null;
};

describe("the theme blocks were actually found", () => {
  // Guards the guard: if the split failed, every assertion below would read
  // null and the suite could pass while measuring nothing.
  it("locates a light block and a distinct surface per theme", () => {
    expect(lightAt).toBeGreaterThan(0);
    const darkSurface = varIn("dark", /--surface:\s*([^;]+);/);
    const lightSurface = varIn("light", /--surface:\s*([^;]+);/);
    expect(darkSurface).toBe("#131316");
    expect(lightSurface).toBe("#ffffff");
  });
});

describe("subject colours clear AA as small text in their own theme", () => {
  it.each(["dark", "light"])("%s theme", (theme) => {
    const surface = varIn(theme, /--surface:\s*([^;]+);/);
    const failures = [];
    for (const s of SUBJECTS) {
      const value = varIn(theme, new RegExp(`--subject-${s}:\\s*([^;]+);`));
      expect(value, `--subject-${s} missing from the ${theme} block`).toBeTruthy();
      const r = contrast(value, surface);
      if (r < AA_NORMAL) failures.push(`${s} ${value} on ${surface} = ${r.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });
});

describe("avatar initials are legible on the subject circle", () => {
  it.each(SUBJECTS.filter((s) => s !== "accent"))("%s", (s) => {
    const background = subjectColor(s);
    const r = contrast(subjectInk(s), background);
    expect(r, `${subjectInk(s)} on ${background}`).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("picks whichever of black or white is more legible, not always white", () => {
    // White was the hardcoded answer and it is wrong for the warm colours.
    expect(subjectInk("physics")).toBe("#ffffff");
    expect(subjectInk("chemistry")).not.toBe("#ffffff");
    expect(subjectInk("botany")).not.toBe("#ffffff");
  });

  it("resolves aliases to the colour they share", () => {
    expect(subjectInk("maths")).toBe(subjectInk("mathematics"));
    expect(subjectInk("zoology")).toBe(subjectInk("botany"));
    expect(subjectTextColor("maths")).toBe(subjectTextColor("mathematics"));
  });
});

describe("subjectTextColor is a theme token, not a fixed colour", () => {
  it.each(["physics", "chemistry", "biology"])("%s reads from a CSS variable", (s) => {
    expect(subjectTextColor(s)).toMatch(/^var\(--subject-/);
  });

  it("falls back to the accent token for an unmapped subject", () => {
    expect(subjectTextColor("astrology")).toBe("var(--subject-accent)");
    expect(subjectTextColor(null)).toBe("var(--subject-accent)");
  });
});

describe("the course card uses each value for its own job", () => {
  // Chemistry on purpose: it is the case a hardcoded white got wrong (2.98:1).
  const course = {
    id: 11, title: "Chemical Bonding in one shot", subject: "Chemistry",
    classLevels: ["11th"], teacher: "Dinesh Sharma", instituteId: 5,
    institute: "Allen",
  };

  it("colours the kicker from the token and the initials from the ink", async () => {
    // A named export, and the card needs a router and a theme around it.
    const { PlaylistCard } = await import("./PlaylistCard.jsx");
    const { ThemeProvider } = await import("./theme.jsx");
    const { MemoryRouter } = await import("react-router");
    render(
      <MemoryRouter>
        <ThemeProvider>
          <PlaylistCard course={course} to="/course/11" comparisonEnabled={false} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    const kicker = screen.getByText(/Chemistry · 11th/i);
    expect(kicker.getAttribute("style")).toContain("var(--subject-chemistry)");

    const initials = screen.getByText("DS");
    // The DOM normalises an inline hex to rgb(), so compare in that form
    // rather than against the hex string the source happens to use.
    const [r, g, b] = rgb(subjectInk("Chemistry"));
    // Chemistry is the case a hardcoded white got wrong: 2.98:1.
    expect(initials.getAttribute("style")).toContain(`color: rgb(${r}, ${g}, ${b})`);
    expect(initials.className).not.toContain("text-white");
  });
});
