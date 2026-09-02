// The skip link's target must exist in the markup, not be installed at runtime.
//
// HISTORY. AppShell renders one skip link for every route ("Skip to main
// content"), but the <main> landmark it points at is rendered by each PAGE, not
// by the shell. The first version closed that gap by reaching into the DOM on
// mount and assigning id="main-content" to whatever <main> it found — one
// component writing to an element another component owns. It was written as a
// stopgap and said so in its own comment.
//
// The id now lives in each page's JSX, so the shell mutates nothing. These are
// the guards that keep it that way:
//
//   1. Every <main> in the shipped source carries id={MAIN_CONTENT_ID}, and the
//      literal "main-content" is written down exactly once.
//   2. Every routed page either owns such a <main> or renders a component that
//      does (AppShell's <Page> frame, or MinimalUI's watch screen).
//   3. Rendered pages really do produce exactly one element with that id.
//   4. The shell no longer touches the landmark — asserted with a
//      MutationObserver, so an id assigned and then reverted would still fail.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import { GlobalHeader, MAIN_CONTENT_ID, Page } from "./AppShell.jsx";
import { ThemeProvider } from "./theme.jsx";
import ExamTestsPage from "./ExamTestsPage.jsx";
import FeatureUnavailable from "./FeatureUnavailable.jsx";
import LegalPage from "./LegalPage.jsx";
import MethodologyPage from "./MethodologyPage.jsx";
import NotFound from "./NotFound.jsx";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import TestsPage from "./TestsPage.jsx";

const SRC = "src";

/** Every .jsx file the app actually ships: no tests, no browser-only fixtures. */
function shippedComponents(dir = SRC) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.posix.join(dir.split(path.sep).join("/"), entry.name);
    if (entry.isDirectory()) {
      out.push(...shippedComponents(full));
      continue;
    }
    if (!entry.name.endsWith(".jsx")) continue;
    if (entry.name.includes(".test.")) continue;
    // Hand-driven harnesses opened in a browser during review. They are not
    // routed, never render the shell, and are excluded on purpose.
    if (entry.name.endsWith("BrowserFixture.jsx")) continue;
    out.push(full);
  }
  return out;
}

const read = (file) => readFileSync(file, "utf8");

/**
 * Source with comments removed. AppShell's own docblock talks about <main> in
 * prose; without this the scan below would read those sentences as markup and
 * report the file that fixed the problem as the file that broke it. The `//`
 * rule ignores a match preceded by ":" so that "https://…" inside a string is
 * left alone.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1");
}

/** The opening <main …> tag text at each occurrence, attributes included. */
function mainOpeningTags(source) {
  const tags = [];
  let from = 0;
  for (;;) {
    const at = source.indexOf("<main", from);
    if (at === -1) return tags;
    const end = source.indexOf(">", at);
    if (end === -1) return tags;
    tags.push(source.slice(at, end + 1));
    from = end + 1;
  }
}

const OWNS_LANDMARK = /<main[^>]*\bid=\{MAIN_CONTENT_ID\}/;

describe("the <main> landmark always carries the skip link's id", () => {
  it("is set in JSX on every <main> the app ships", () => {
    const offenders = [];
    for (const file of shippedComponents()) {
      for (const tag of mainOpeningTags(stripComments(read(file)))) {
        // Only real opening tags: <main>, <main …> or <main/>.
        if (!/^<main[\s/>]/.test(tag)) continue;
        if (tag.includes("id={MAIN_CONTENT_ID}")) continue;
        offenders.push(`${file}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
    // The scan has to have found something, or it proves nothing.
    const landmarks = shippedComponents().filter((file) =>
      OWNS_LANDMARK.test(stripComments(read(file))),
    );
    expect(landmarks.length).toBeGreaterThan(10);
  });

  it("is written down once, so a rename cannot half-apply", () => {
    const declared = shippedComponents().filter((file) =>
      read(file).includes('"main-content"'),
    );
    expect(declared).toEqual(["src/AppShell.jsx"]);
    expect(read("src/AppShell.jsx")).toContain(
      'export const MAIN_CONTENT_ID = "main-content";',
    );
  });
});

// ---------------------------------------------------------------------------
// Every routed page, read from App.jsx rather than listed here — a route added
// tomorrow is checked without anyone remembering to update this file.
// ---------------------------------------------------------------------------
const APP_SOURCE = read("src/App.jsx");

function routedPageModules() {
  const specs = new Set(
    [...APP_SOURCE.matchAll(/import\(\s*"(\.[^"]+\.jsx)"\s*\)/g)].map((m) => m[1]),
  );
  // Eagerly imported route elements (Home, NotFound) — matched by the name the
  // route actually renders, so Footer and PageMetadata are not swept in.
  const rendered = new Set(
    [...APP_SOURCE.matchAll(/element=\{<([A-Z]\w*)/g)].map((m) => m[1]),
  );
  for (const [, name, spec] of APP_SOURCE.matchAll(
    /^import\s+([A-Z]\w*)\s+from\s+"(\.[^"]+\.jsx)";/gm,
  )) {
    if (rendered.has(name)) specs.add(spec);
  }
  return [...specs].map((spec) => path.posix.normalize(`src/${spec.slice(2)}`));
}

/** Relative .jsx modules a file imports, as repo-relative paths. */
function jsxImportsOf(file) {
  const dir = path.posix.dirname(file);
  return [...read(file).matchAll(/from\s+"(\.[^"]+\.jsx)"/g)].map((m) =>
    path.posix.normalize(path.posix.join(dir, m[1])),
  );
}

describe("every routed page reaches the landmark", () => {
  const modules = routedPageModules();

  it("finds the route table (guards against this test quietly matching nothing)", () => {
    expect(modules.length).toBeGreaterThan(15);
    expect(modules).toContain("src/Home.jsx");
    expect(modules).toContain("src/BrowsePage.jsx");
    expect(modules).toContain("src/forum/ForumFeedPage.jsx");
  });

  it.each(modules)("%s owns or delegates a #main-content", (file) => {
    const source = read(file);

    // Shape 1: the page renders its own <main> and names the id on it.
    if (source.includes("<main")) {
      expect(source).toMatch(OWNS_LANDMARK);
      expect(source).toMatch(/import\s*\{[^}]*MAIN_CONTENT_ID[^}]*\}\s*from\s*"\.[^"]*AppShell\.jsx"/);
      return;
    }

    // Shape 2: the page is built on AppShell's <Page> frame, which carries it.
    if (/<Page[\s>]/.test(source)) {
      expect(source).toMatch(/import\s*\{[^}]*\bPage\b[^}]*\}\s*from\s*"\.[^"]*AppShell\.jsx"/);
      return;
    }

    // Shape 3: the page delegates its whole body to another component that
    // owns the landmark — CourseVideoPage renders MinimalUI's watch screen.
    // AppShell is excluded here on purpose: every page imports it, so allowing
    // it would make this assertion true of anything.
    const delegates = jsxImportsOf(file).filter(
      (dep) => !dep.endsWith("AppShell.jsx") && OWNS_LANDMARK.test(read(dep)),
    );
    expect(delegates.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Rendered, not just read. These are the routed pages that mount without any
// catalogue data, so they need no network and no mocks — one page of each
// shape: its own <main> (with and without a ref on it) and the <Page> frame.
// ---------------------------------------------------------------------------
const show = (ui, initialEntries = ["/"]) =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </ThemeProvider>,
  );

describe("a rendered page has exactly one main landmark", () => {
  const cases = [
    ["MethodologyPage", () => show(<MethodologyPage />, ["/methodology"])],
    ["LegalPage", () => show(<LegalPage />, ["/terms"])],
    ["PrivacyPolicy", () => show(<PrivacyPolicy />, ["/privacy"])],
    ["TestsPage", () => show(<TestsPage />, ["/tests"])],
    [
      "ExamTestsPage",
      () =>
        show(
          <Routes>
            <Route path="/tests/:examId" element={<ExamTestsPage />} />
          </Routes>,
          ["/tests/jee-main"],
        ),
    ],
    ["NotFound", () => show(<NotFound />, ["/no-such-page"])],
    [
      "FeatureUnavailable",
      () => show(<FeatureUnavailable title="Not yet" detail="Still being checked." />),
    ],
    ["AppShell's own Page frame", () => show(<Page crumbs={[{ label: "Mock tests" }]}><p>Papers</p></Page>, ["/tests"])],
  ];

  it.each(cases)("%s renders one <main>, and it is the skip target", (_name, mount) => {
    const { container } = mount();

    const mains = [...container.querySelectorAll("main")];
    expect(mains).toHaveLength(1);

    const targets = [...container.querySelectorAll(`[id="${MAIN_CONTENT_ID}"]`)];
    expect(targets).toEqual(mains);

    // And the skip link on that same page points at it.
    const link = container.querySelector("a.skip-link");
    expect(link.getAttribute("href")).toBe(`#${MAIN_CONTENT_ID}`);
  });
});

describe("the shell no longer writes to the page's landmark", () => {
  it("sets no attribute on a <main> it does not render", () => {
    // Watching document.body from BEFORE the render is what makes this a real
    // guard: the retired effect wrote the id during mount, so an observer
    // attached afterwards would have missed it. takeRecords() drains what the
    // mount produced without waiting for the microtask queue, and it records an
    // id that was set and then removed just as loudly as one that stuck.
    const seen = [];
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["id"],
      subtree: true,
    });

    const { container } = render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/browse"]}>
          <div>
            <GlobalHeader crumbs={[{ label: "Courses" }]} />
            {/* Deliberately WITHOUT the id: this is the case the retired
                adoption effect existed for. */}
            <main>
              <h1>Courses</h1>
            </main>
          </div>
        </MemoryRouter>
      </ThemeProvider>,
    );

    seen.push(
      ...observer
        .takeRecords()
        .filter((record) => record.target.tagName === "MAIN")
        .map((record) => `${record.attributeName} on <main>`),
    );
    observer.disconnect();

    expect(seen).toEqual([]);
    const main = container.querySelector("main");
    expect(main.hasAttribute("id")).toBe(false);
  });
});
