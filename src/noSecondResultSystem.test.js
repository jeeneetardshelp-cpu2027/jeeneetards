// A source-level guard: there must be exactly ONE result system.
//
// WHAT THIS CHECKS, AND WHAT IT DELIBERATELY DOES NOT
//
// It checks EXECUTABLE duplication: component definitions, JSX that renders
// them, imports that wire them up, and routes that mount them.
//
// It does NOT fail because a name appears in prose. An earlier version matched
// raw text, so a comment explaining *why* a component was deleted tripped it —
// brittle text matching dressed up as protection. Comments are stripped before
// every check below, so documenting history stays free while re-introducing
// the code does not.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)));

/**
 * Source with comments and string literals removed, so only CODE is matched.
 *
 * Strings are blanked in ONE left-to-right alternation, not three sequential
 * passes. Running the single-quote pass first made the apostrophe in
 * `"Supabase isn't configured."` open a phantom string that ran to the next
 * apostrophe elsewhere in the file, blanking real code in between — which is
 * why this guard reported Compare.jsx's very-much-used `supabase` as dead.
 * One pass consumes each quote in the order it actually appears.
 */
function code(file) {
  return readFileSync(resolve(SRC, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")        // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")    // line comments (not "https://")
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');
}

const files = readdirSync(SRC).filter((f) => /\.jsx?$/.test(f) && !/\.test\.jsx?$/.test(f));
const withCode = files.map((f) => [f, code(f)]);

// The components and hooks that made up the deleted result systems.
const RETIRED = ["ChapterResults", "ChapterHub", "CourseCard", "useChapterCourses"];

describe("no retired component is defined or rendered", () => {
  it.each(RETIRED)("%s is not defined anywhere", (name) => {
    const re = new RegExp(`(function|const|class)\\s+${name}\\b`);
    expect(withCode.filter(([, c]) => re.test(c)).map(([f]) => f)).toEqual([]);
  });

  it.each(RETIRED)("%s is not rendered as JSX", (name) => {
    const re = new RegExp(`<${name}[\\s/>]`);
    expect(withCode.filter(([, c]) => re.test(c)).map(([f]) => f)).toEqual([]);
  });

  it.each(RETIRED)("%s is not imported", (name) => {
    const re = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`);
    expect(withCode.filter(([, c]) => re.test(c)).map(([f]) => f)).toEqual([]);
  });

  it("the retired modules are deleted from disk", () => {
    for (const f of ["PlaylistCompare.jsx", "PlaylistFilters.jsx", "useChapterCourses.js"])
      expect([f, existsSync(resolve(SRC, f))]).toEqual([f, false]);
  });

  it("nothing imports a deleted module path", () => {
    const re = /from\s*""/;   // string literals are blanked, so check the raw text
    const raw = files.filter((f) =>
      /from\s+["']\.\/(PlaylistCompare|PlaylistFilters|useChapterCourses)(\.jsx?)?["']/
        .test(readFileSync(resolve(SRC, f), "utf8")));
    expect(raw).toEqual([]);
    expect(re).toBeTruthy();
  });
});

describe("routes do not mount a second result system", () => {
  const appRaw = readFileSync(resolve(SRC, "App.jsx"), "utf8");

  it("the legacy chapter route is a redirect, not a results page", () => {
    // It must still EXIST — old bookmarks depend on it — but must resolve to a
    // redirect component, never to a page that queries and renders courses.
    expect(appRaw).toMatch(/path="\/chapter\/:chapterId"\s+element=\{<LegacyChapterRedirect/);
  });

  it("the redirect target is the canonical Browse system", () => {
    const fn = appRaw.slice(appRaw.indexOf("function LegacyChapterRedirect"));
    expect(fn).toMatch(/\/browse\?ch=/);
    expect(fn).toMatch(/replace/);          // must not pollute history
  });

  it("no route element performs a chapter-course query", () => {
    expect(code("App.jsx")).not.toMatch(/get_chapter_courses|useChapterCourses/);
  });
});

describe("exactly one playlist card implementation", () => {
  it("only PlaylistBrowse defines a playlist card", () => {
    const definers = withCode
      .filter(([, c]) => /(function|const)\s+\w*(PlaylistCard|CourseCard)\b/.test(c))
      .map(([f]) => f);
    expect(definers).toEqual(["PlaylistBrowse.jsx"]);
  });
});

describe("the guided journey does not grow its own results", () => {
  const explore = code("Explore.jsx");

  it("hands off to the canonical Browse URL", () => {
    expect(explore).toMatch(/canonicalBrowseUrl\(/);
    expect(explore).toMatch(/<Navigate\b/);
  });

  it("does not fetch or render courses itself", () => {
    for (const banned of ["useChapterCourses", "CourseCard", "usePlaylistBrowse"])
      expect([banned, new RegExp(`\\b${banned}\\b`).test(explore)]).toEqual([banned, false]);
  });
});

// NOTE: a project-wide "no unused imports" check was tried here and removed.
// Regex cannot lex JSX (apostrophes in prose open phantom strings; blanking
// template literals hides real uses inside ${...}), so it produced far more
// false positives than findings. That job belongs to ESLint no-unused-vars.

describe("one header for every student-facing route", () => {
  // Admin keeps its own shell deliberately; student routes may not. A local
  // <header> means arriving on that page drops the student out of the app's
  // navigation — no Home, no Browse, no breadcrumb.
  const ADMIN_SHELLS = ["AdminPanel.jsx", "adminUI.jsx"];

  it("no student-facing file renders its own <header>", () => {
    const offenders = withCode
      .filter(([f]) => f !== "AppShell.jsx" && !ADMIN_SHELLS.includes(f))
      .filter(([, c]) => /<header[\s/>]/.test(c))
      .map(([f]) => f);
    expect(offenders).toEqual([]);
  });

  it("AppShell is the only place a <header> element is defined", () => {
    const definers = withCode.filter(([, c]) => /<header[\s/>]/.test(c)).map(([f]) => f);
    expect(definers.filter((f) => !ADMIN_SHELLS.includes(f))).toEqual(["AppShell.jsx"]);
  });

  it("FacultyProfile uses the shared header", () => {
    expect(code("FacultyProfile.jsx")).toMatch(/<GlobalHeader\b/);
  });
});
