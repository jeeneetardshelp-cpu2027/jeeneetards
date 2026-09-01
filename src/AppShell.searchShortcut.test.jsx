// The global search shortcut, and reaching the header search on a phone.
//
// Two gaps this covers, both in the one file allowed to own the header:
//
//  1. There was no keyboard route to search at all. "/" and Ctrl-K / Cmd-K are
//     what students already expect from every other site they use, and a
//     keyboard-only user otherwise had to Tab past the skip link, the brand,
//     the streak chip and the whole nav rail to reach the magnifier.
//  2. Below 640px the header search was simply hidden. On /browse that left
//     the catalogue's search box reachable ONLY from inside the Filters bottom
//     sheet — two taps and a scroll away from a control sitting in plain sight
//     on a laptop. It now folds onto its own line, opened by a magnifier that
//     is itself a 44px target.
//
// The shortcut must never steal a keystroke aimed at a text field: "and/or" in
// the notes panel, a chapter name in the browse filter, a "/" in a forum reply.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { GlobalHeader, HeaderSearch, isSearchShortcut, isTypingTarget } from "./AppShell.jsx";
import { ThemeProvider } from "./theme.jsx";

function Probe() {
  const location = useLocation();
  return <output aria-label="route">{location.pathname}</output>;
}

/** A page shaped like Explore or Browse: a header that carries a search box. */
function WithHeaderSearch() {
  return (
    <GlobalHeader
      search={<HeaderSearch value="" onChange={() => {}} placeholder="Search the library" />}
    />
  );
}

/** A page shaped like the watch page or Faculty: no header search at all. */
function WithoutHeaderSearch() {
  return <GlobalHeader crumbs={[{ label: "Faculty" }]} />;
}

const renderShell = (element, url = "/faculty") =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="*" element={<>{element}<Probe /></>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

const route = () => screen.getByLabelText("route").textContent;

describe("which keystrokes count as 'open search'", () => {
  it("accepts / and Ctrl-K and Cmd-K", () => {
    expect(isSearchShortcut({ key: "/" })).toBe(true);
    expect(isSearchShortcut({ key: "k", ctrlKey: true })).toBe(true);
    expect(isSearchShortcut({ key: "k", metaKey: true })).toBe(true);
    // Caps Lock on is still the same request.
    expect(isSearchShortcut({ key: "K", metaKey: true })).toBe(true);
  });

  it("ignores a bare k, a modified slash, and an event someone already handled", () => {
    expect(isSearchShortcut({ key: "k" })).toBe(false);
    expect(isSearchShortcut({ key: "/", ctrlKey: true })).toBe(false);
    expect(isSearchShortcut({ key: "k", ctrlKey: true, altKey: true })).toBe(false);
    expect(isSearchShortcut({ key: "/", defaultPrevented: true })).toBe(false);
  });
});

describe("a keystroke aimed at a text field is never stolen", () => {
  it("recognises inputs, textareas, selects and contenteditable", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const nested = document.createElement("span");
    editable.appendChild(nested);
    document.body.appendChild(editable);

    for (const el of [input, textarea, select, editable, nested])
      expect([el.tagName, isTypingTarget(el)]).toEqual([el.tagName, true]);

    editable.remove();
  });

  it("leaves ordinary elements alone", () => {
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    const off = document.createElement("div");
    off.setAttribute("contenteditable", "false");
    expect(isTypingTarget(off)).toBe(false);
  });

  it("does not navigate when '/' is typed into the header's own search box", () => {
    renderShell(<WithHeaderSearch />, "/browse");
    const field = screen.getByPlaceholderText("Search the library");
    fireEvent.keyDown(field, { key: "/" });
    expect(route()).toBe("/browse");
  });
});

describe("where the shortcut lands", () => {
  it("focuses the header's search box when the page supplies one", () => {
    renderShell(<WithHeaderSearch />, "/browse");
    const field = screen.getByPlaceholderText("Search the library");
    expect(document.activeElement).not.toBe(field);

    fireEvent.keyDown(window, { key: "/" });
    expect(document.activeElement).toBe(field);
    expect(route()).toBe("/browse");     // no navigation needed
  });

  it("Ctrl-K does the same thing as /", () => {
    renderShell(<WithHeaderSearch />, "/browse");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Search the library"));
  });

  it("goes to /search — the one search surface — when the page has no box", () => {
    renderShell(<WithoutHeaderSearch />, "/faculty");
    fireEvent.keyDown(window, { key: "/" });
    expect(route()).toBe("/search");
  });

  it("prefers a search field the PAGE marked, over navigating away", () => {
    // Home's hero and /search's own input both carry data-search-input, so the
    // shortcut puts the cursor in the box already on screen instead of
    // reloading the student onto another route.
    const hero = document.createElement("input");
    hero.setAttribute("data-search-input", "hero");
    document.body.appendChild(hero);

    renderShell(<WithoutHeaderSearch />, "/");
    fireEvent.keyDown(window, { key: "/" });

    expect(document.activeElement).toBe(hero);
    expect(route()).toBe("/");
    hero.remove();
  });
});

describe("the header search is reachable on a phone", () => {
  it("offers a magnifier that opens the box, and a way to close it again", () => {
    renderShell(<WithHeaderSearch />, "/browse");
    const toggle = screen.getByRole("button", { name: "Show the search box" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(toggle);
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Search the library"));
    expect(screen.getByRole("button", { name: "Hide the search box" })
      .getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Hide the search box" }));
    expect(screen.getByRole("button", { name: "Show the search box" })).toBeTruthy();
  });

  it("renders the search box ONCE, so nothing is read out twice", () => {
    renderShell(<WithHeaderSearch />, "/browse");
    fireEvent.click(screen.getByRole("button", { name: "Show the search box" }));
    expect(screen.getAllByPlaceholderText("Search the library")).toHaveLength(1);
  });

  it("offers no toggle on a page that passes no search box", () => {
    renderShell(<WithoutHeaderSearch />, "/faculty");
    expect(screen.queryByRole("button", { name: /the search box/ })).toBeNull();
    // The persistent library-search icon is still there for those pages.
    expect(screen.getByRole("link", { name: "Search the library" })
      .getAttribute("href")).toBe("/search");
  });

  it("keeps the toggle at the 44px target the rest of the header uses", () => {
    renderShell(<WithHeaderSearch />, "/browse");
    const toggle = screen.getByRole("button", { name: "Show the search box" });
    expect(toggle.className).toContain("min-h-11");
    expect(toggle.className).toContain("min-w-11");
    // Hidden from 640px up, where the box sits inline in the top row already.
    expect(toggle.className).toContain("sm:hidden");
  });
});
