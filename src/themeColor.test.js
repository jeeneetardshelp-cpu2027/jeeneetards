// The browser-chrome colour must match the page that is actually painted.
//
// The bug: index.html carried two <meta name="theme-color"> tags gated on
// prefers-color-scheme, while public/theme-init.js forces DARK for anyone with
// no stored choice. A first-time visitor on a light OS therefore got a dark
// page under a white address bar.
//
// public/theme-init.js is a classic script served from /public, so it is not
// importable. It is read from disk and evaluated the way the browser runs it.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { waitFor } from "@testing-library/react";

// Paths are repo-root relative: vitest runs from the repo root (see
// canonicalHost.test.js, which reads vercel.json the same way).
const THEME_INIT = readFileSync("public/theme-init.js", "utf8");
const INDEX_HTML = readFileSync("index.html", "utf8");

// Evaluated the way the browser runs it: a classic script, no module scope.
const runThemeInit = () => new Function(THEME_INIT)();
const chrome = () =>
  document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? null;

beforeEach(async () => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
  // Every evaluation above leaves its own live MutationObserver on <html>, and
  // deleting data-theme is itself a mutation — so let those callbacks settle
  // BEFORE clearing the tag, or one of them re-creates it mid-cleanup. An
  // artefact of running the script repeatedly in one document, not a product
  // behaviour: a browser loads it once.
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
});

describe("theme-init paints the chrome to match the page", () => {
  it("gives a first-time visitor the dark chrome the dark default renders", () => {
    // No stored choice, whatever the OS prefers. This is the case the two
    // media-gated tags got wrong.
    runThemeInit();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(chrome()).toBe("#0a0a0a");
  });

  it("honours a stored light choice in both the page and the chrome", () => {
    window.localStorage.setItem("lecture-library-theme", "light");
    runThemeInit();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(chrome()).toBe("#ffffff");
  });

  it("follows the header toggle afterwards", async () => {
    runThemeInit();
    expect(chrome()).toBe("#0a0a0a");

    // Exactly what src/theme.jsx does when the student presses the toggle.
    document.documentElement.dataset.theme = "light";
    await waitFor(() => expect(chrome()).toBe("#ffffff"));

    document.documentElement.dataset.theme = "dark";
    await waitFor(() => expect(chrome()).toBe("#0a0a0a"));
  });

  it("reuses the tag already in the document instead of stacking new ones", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", "#ffffff");
    document.head.appendChild(meta);

    runThemeInit();
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(chrome()).toBe("#0a0a0a");
  });
});

describe("index.html no longer guesses the theme from the OS", () => {
  it("ships exactly one theme-color tag, with no prefers-color-scheme gate", () => {
    const tags = INDEX_HTML.match(/<meta[^>]*name="theme-color"[^>]*>/g) ?? [];
    expect(tags).toHaveLength(1);
    expect(tags[0]).not.toContain("prefers-color-scheme");
    // The static fallback must be the product default, so a blocked
    // theme-init.js still leaves the chrome matching the dark first paint.
    expect(tags[0]).toContain('content="#0a0a0a"');
  });
});
