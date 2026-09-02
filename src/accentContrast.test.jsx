// The accent foreground must come from the theme, not from a fixed colour.
//
// index.css pairs --accent with --accent-ink per theme:
//   dark  (the product default)  #24d3c4 mint   with  #04191b near-black
//   light                        #0f6f78 teal   with  #ffffff white
//
// Hardcoding text-white keeps the LIGHT theme's foreground on the DARK theme's
// background. Measured on production 2026-09-02 at 375px in the dark default,
// the notes panel's primary action was white on #24d3c4: 1.88:1, against the
// 4.5:1 WCAG AA needs for normal text. The same class of mistake put three
// Explore links at 3.15:1 by setting a fixed BRAND.teal as TEXT colour, which
// cannot swap with the theme at all.
//
// These are source assertions on purpose: jsdom does not resolve CSS custom
// properties, so a rendered-contrast test here would measure nothing. The real
// ratios were measured in a browser; this stops the pattern coming back.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// import.meta.dirname, as middlewareSeo.test.js already uses. Deriving this
// from import.meta.url produced "C:\src" on Windows, so the file failed to
// import at all — which vitest reports as a FAIL with zero tests, a result
// that looks identical under every mutation and therefore proves nothing.
const SRC = import.meta.dirname;

const jsxFiles = readdirSync(SRC)
  .filter((f) => f.endsWith(".jsx") && !f.includes(".test."))
  .map((f) => ({ name: f, text: readFileSync(join(SRC, f), "utf8") }));

describe("accent foreground comes from the theme", () => {
  it("reads the source files it means to check", () => {
    // Guards the guard: a glob that matched nothing would pass every test below.
    expect(jsxFiles.length).toBeGreaterThan(30);
    expect(jsxFiles.map((f) => f.name)).toContain("NotesPanel.jsx");
  });

  it("never puts text-white on an accent background", () => {
    // text-accent-ink is the pair; it is white in light and near-black in dark.
    const offenders = jsxFiles
      .flatMap((f) => f.text.split("\n").map((line, i) => ({ f: f.name, i: i + 1, line })))
      .filter(({ line }) => /\bbg-accent\b/.test(line) && /\btext-white\b/.test(line))
      .map(({ f, i }) => `${f}:${i}`);

    expect(offenders).toEqual([]);
  });

  it("does not set a fixed brand colour as TEXT in the guided journey", () => {
    // A background stays legible because white is placed on it deliberately
    // and measured (brandColors.js records 5.89:1). As a text colour on the
    // dark default the same hex is 3.15:1, and being a fixed hex it cannot
    // swap. Explore is where this happened; the token is text-accent.
    const explore = jsxFiles.find((f) => f.name === "Explore.jsx");
    expect(explore).toBeTruthy();
    expect(explore.text).not.toMatch(/style=\{\{\s*color:\s*BRAND[._]/);
    expect(explore.text).toMatch(/text-accent/);
  });
});

vi.mock("./notes.js", async (importOriginal) => await importOriginal());

describe("the notes panel's primary action", () => {
  it("labels its save button with the theme's accent ink, not white", async () => {
    const { default: NotesPanel } = await import("./NotesPanel.jsx");
    const { ThemeProvider } = await import("./theme.jsx");
    render(
      <ThemeProvider>
        <NotesPanel playlistId={5} videoId="abc" />
      </ThemeProvider>,
    );

    const button = screen.getByRole("button", { name: /add note/i });
    expect(button.className).toContain("bg-accent");
    expect(button.className).toContain("text-accent-ink");
    expect(button.className).not.toContain("text-white");
  });
});
