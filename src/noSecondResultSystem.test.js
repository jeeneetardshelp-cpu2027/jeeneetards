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

/**
 * Source with comments removed but string literals KEPT, for checks on what
 * lives in strings: module paths and RPC names. One left-to-right alternation,
 * for the reason given above: a string is consumed whole, so an "image/*" or a
 * URL inside it cannot open a phantom comment that blanks the real code after
 * it. Double- and single-quoted strings stop at a line end, so an apostrophe in
 * JSX prose cannot swallow the lines below. Regex literals are not lexed.
 */
function withStrings(file) {
  return readFileSync(resolve(SRC, file), "utf8").replace(
    /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g,
    (match, string, before) => string ?? `${before ?? ""} `,
  );
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
    expect(code("App.jsx")).not.toMatch(/useChapterCourses/);
    // An RPC name lives in a string literal, which code() blanks.
    expect(withStrings("App.jsx")).not.toMatch(/["'`]get_chapter_courses["'`]/);
  });
});

describe("exactly one playlist card implementation", () => {
  it("only PlaylistCard.jsx defines a playlist card", () => {
    // The card moved to its own module so the homepage can import it without
    // pulling the whole browse page into its bundle. Still exactly ONE definer.
    const definers = withCode
      .filter(([, c]) => /(function|const)\s+\w*(PlaylistCard|CourseCard)\b/.test(c))
      .map(([f]) => f);
    expect(definers).toEqual(["PlaylistCard.jsx"]);
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

describe("mock-test and paper pages link to lectures, never list them", () => {
  // They send a student to the guided chapter picker (examLectureLinks.js), and
  // Explore hands off to /browse. A course list here would be a second result
  // system growing out of a link.
  const PAGES = ["ExamTestsPage.jsx", "PaperYearPage.jsx"];

  it.each(PAGES)("%s uses the shared lecture link", (file) => {
    expect(code(file)).toMatch(/\blectureLinkForExam\(/);
  });

  it.each(PAGES)("%s does not fetch or render courses", (file) => {
    const src = code(file);
    for (const banned of ["usePlaylistBrowse", "PlaylistCard", "useChapterCourses", "CourseCard"])
      expect([banned, new RegExp(`\\b${banned}\\b`).test(src)]).toEqual([banned, false]);
  });
});

// The name checks above miss the real thing. Rendering <PlaylistBrowse />, the
// whole /browse course list, or calling useVideos passed them, and
// "get_chapter_courses" could never match at all, because code() blanks the
// string literal an RPC name lives in. So the pages that hand off to /browse are
// also checked, in their own source, for importing a module /browse's results
// are built from, under any local name, and for running the queries those
// modules run.
//
// It is a tripwire, not a proof. It does not follow imports, so a wrapper module
// or another component that renders course cards gets through, and it does not
// see a course or lecture list reached through a join table, an embed, a
// different RPC, or a table name held in a variable.
describe("pages that hand off to /browse do not build results themselves", () => {
  const HANDOFF_PAGES = ["Explore.jsx", "ExamTestsPage.jsx", "PaperYearPage.jsx"];
  // BrowsePage.jsx also exports VideoCard, and useBrowse.js exports useVideos.
  // Two plain helpers live in these modules too, useDebouncedValue (useBrowse.js)
  // and formatDuration (usePlaylistBrowse.js). A hand-off page that needs one
  // should move it to a neutral module, not shorten this list.
  const RESULT_MODULES = [
    "BrowsePage", "PlaylistBrowse", "PlaylistCard", "usePlaylistBrowse", "useBrowse", "useBrowseFacets",
  ];
  const RESULT_RPCS = ["search_playlist_ids", "search_video_ids", "browse_facet_counts"];
  const RESULT_TABLES = ["playlists", "videos"];

  const oneOf = (names) => `(?:${names.join("|")})`;
  const QUOTE = "[\"'`]";
  const IMPORTS_RESULT_MODULE = new RegExp(
    `(?:\\bfrom|\\bimport)\\s*\\(?\\s*${QUOTE}\\./${oneOf(RESULT_MODULES)}(?:\\.jsx?)?${QUOTE}`,
  );
  // One shape for a query, used by the ban and by the staleness check below, so
  // the two cannot disagree about quote style or line breaks.
  const rpcCall = (names) => new RegExp(`\\.rpc\\(\\s*${QUOTE}${oneOf(names)}${QUOTE}`);
  const tableQuery = (names) => new RegExp(`\\.from\\(\\s*${QUOTE}${oneOf(names)}${QUOTE}`);
  // An RPC name is banned wherever it appears as a string, so holding it in a
  // variable first does not get it through.
  const RUNS_RESULT_QUERY = new RegExp(
    `${QUOTE}${oneOf([...RESULT_RPCS, "get_chapter_courses"])}${QUOTE}|${tableQuery(RESULT_TABLES).source}`,
  );
  const moduleFile = (name) => files.find((f) => f.replace(/\.jsx?$/, "") === name);

  it.each(HANDOFF_PAGES)("%s imports nothing /browse's results are built from", (file) => {
    const found = withStrings(file).match(IMPORTS_RESULT_MODULE)?.[0] ?? null;
    expect(found, "for useDebouncedValue or formatDuration, move the helper out instead").toBeNull();
  });

  it.each(HANDOFF_PAGES)("%s runs none of the queries behind them", (file) => {
    expect(withStrings(file).match(RUNS_RESULT_QUERY)?.[0] ?? null).toBeNull();
  });

  // A renamed module or query would leave these lists guarding nothing, silently.
  it.each(RESULT_MODULES)("%s is still a module in src", (name) => {
    expect(moduleFile(name)).toBeDefined();
  });

  it("every banned query is still one the result modules run", () => {
    const run = RESULT_MODULES.map((name) => withStrings(moduleFile(name))).join("\n");
    for (const rpc of RESULT_RPCS) expect([rpc, rpcCall([rpc]).test(run)]).toEqual([rpc, true]);
    for (const table of RESULT_TABLES) expect([table, tableQuery([table]).test(run)]).toEqual([table, true]);
  });
});
