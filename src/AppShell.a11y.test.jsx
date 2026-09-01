// Keyboard and screen-reader access to the shared shell.
//
// Two gaps the September accessibility review found, both on every page:
//
//  1. No skip link. On a phone the header stacks three rows (brand +
//     controls, the scrollable nav rail, breadcrumbs), so reaching the page
//     body meant tabbing past a dozen controls — every single route.
//  2. Devanagari course and chapter titles rendered under the document's
//     lang="en", which makes a screen reader mispronounce them.
//
// Both JEE and NEET have PwD categories, so these are real students.
import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { GlobalHeader, MAIN_CONTENT_ID, Page } from "./AppShell.jsx";
import { ThemeProvider } from "./theme.jsx";

// Everything the browser will stop on with Tab, in document order.
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// The shape almost every page in this repo actually uses: GlobalHeader as a
// sibling of the page's own <main>, not AppShell's <Page> wrapper. The page
// carries the id itself — that is now true of every routed page, and
// mainLandmark.test.jsx is what keeps it true.
function renderPage({ crumbs = [], mainProps = { id: MAIN_CONTENT_ID } } = {}) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/browse"]}>
        <div>
          <GlobalHeader crumbs={crumbs} />
          <main {...mainProps}>
            <h1>Courses</h1>
          </main>
        </div>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const skipLink = () => screen.getByRole("link", { name: "Skip to main content" });

describe("skip to main content", () => {
  it("is present on the page and points at the main-content anchor", () => {
    renderPage();
    expect(skipLink().getAttribute("href")).toBe(`#${MAIN_CONTENT_ID}`);
  });

  it("is the FIRST focusable element — ahead of the brand, nav and crumbs", () => {
    const { container } = renderPage({
      crumbs: [{ label: "Courses", to: "/browse" }, { label: "Class 12 Physics" }],
    });
    const order = Array.from(container.querySelectorAll(FOCUSABLE));
    expect(order[0]).toBe(skipLink());
    // Sanity check that this page really is the crowded one the link exists
    // for: the brand, both nav rails and the crumb link are all behind it.
    expect(order.length).toBeGreaterThan(8);
  });

  it("targets a real element: the page's own <main> carries the id", () => {
    renderPage();
    const main = document.querySelector("main");
    expect(main.id).toBe(MAIN_CONTENT_ID);
    expect(document.getElementById(MAIN_CONTENT_ID)).toBe(main);
  });

  it("moves keyboard focus into the main landmark, not just the viewport", () => {
    renderPage();
    const main = document.querySelector("main");

    fireEvent.click(skipLink());

    // A bare hash jump scrolls but leaves focus in the header, so the next Tab
    // goes straight back into the nav. Focus has to land on <main> itself, and
    // <main> is not focusable without this tabindex.
    expect(main.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(main);
  });

  it("never writes to a <main> the shell does not own", () => {
    // The shell used to reach into the page on mount and assign the id itself.
    // That is retired: every page sets it, so the header must leave the
    // landmark exactly as the page rendered it — including a page that gave
    // its <main> a different id for its own reasons.
    renderPage({ mainProps: { id: "faculty-directory" } });
    const main = document.querySelector("main");
    expect(main.id).toBe("faculty-directory");
  });

  it("still reaches a page that has not been given the id yet", () => {
    // Fail safe, not broken: a page whose <main> carries no id at all is the
    // one case the retired effect used to cover. The click handler's fallback
    // has to keep that page working.
    renderPage({ mainProps: {} });
    const main = document.querySelector("main");
    // Nothing added the id behind the page's back...
    expect(main.hasAttribute("id")).toBe(false);
    expect(document.getElementById(MAIN_CONTENT_ID)).toBeNull();

    // ...and the link still lands focus in the landmark.
    fireEvent.click(skipLink());
    expect(main.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(main);
  });

  it("also works for pages built on AppShell's own <Page> frame", () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/tests"]}>
          <Page crumbs={[{ label: "Mock tests" }]}>
            <p>Papers</p>
          </Page>
        </MemoryRouter>
      </ThemeProvider>,
    );
    // <Page> carries the id itself, so nothing has to be adopted.
    expect(document.querySelector("main").id).toBe(MAIN_CONTENT_ID);
    fireEvent.click(skipLink());
    expect(document.activeElement).toBe(document.querySelector("main"));
  });
});

describe("breadcrumbs name the language of Devanagari titles", () => {
  it("marks a Devanagari crumb as Hindi and leaves English crumbs alone", () => {
    renderPage({
      crumbs: [
        { label: "Courses", to: "/browse" },
        { label: "कबीर की साखी" },
      ],
    });

    expect(screen.getByText("कबीर की साखी").getAttribute("lang")).toBe("hi");
    // The crumb link, not the identically-named nav pill.
    const crumbNav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const english = crumbNav.querySelector('a[href="/browse"]');
    expect(english.textContent).toBe("Courses");
    expect(english.getAttribute("lang")).toBeNull();
  });

  it("marks a clickable crumb too — the watch page returns through one", () => {
    renderPage({ crumbs: [{ label: "हिंदी दसवीं", onClick: () => {} }] });
    expect(screen.getByRole("button", { name: "हिंदी दसवीं" }).getAttribute("lang"))
      .toBe("hi");
  });
});

// jsdom does not apply src/index.css, so these assert that the rule the skip
// link depends on exists and keeps its two load-bearing properties. Whether it
// LOOKS right in each theme was not verified here — that needs a browser.
describe("the skip link's stylesheet contract", () => {
  const css = readFileSync("src/index.css", "utf8");

  it("hides the control until it is focused", () => {
    expect(css).toContain(".skip-link {");
    expect(css).toContain(".skip-link:focus {");
    const hidden = css.slice(css.indexOf(".skip-link {"), css.indexOf(".skip-link:focus {"));
    expect(hidden).toContain("clip-path: inset(50%)");
  });

  it("keeps the focused control at the 44px tap target the header uses", () => {
    const focused = css.slice(css.indexOf(".skip-link:focus {"));
    expect(focused.slice(0, focused.indexOf("}"))).toContain("min-height: 2.75rem");
  });
});
