// notFound.test.jsx — unknown URLs render an honest 404, not a redirect.
//
// The wildcard route used to silently Navigate to "/", which served every
// mistyped or stale link as a 200 homepage (a soft-404 for crawlers, a
// mystery for students). It now renders NotFound with noindex metadata.

import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

beforeEach(() => {
  window.scrollTo = vi.fn();
});

describe("unknown URLs", () => {
  it("renders the 404 page with noindex metadata instead of redirecting home", async () => {
    render(
      <MemoryRouter initialEntries={["/no-such-page"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeTruthy();
    await waitFor(() =>
      expect(document.title).toBe("Page not found | JEENEETARD"),
    );
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe(
      "noindex, nofollow",
    );

    // Recovery paths are real crawlable anchors (scoped to main — the header
    // and footer carry links with the same names).
    const main = within(document.querySelector("main"));
    expect(
      main.getByRole("link", { name: "Find a course" }).getAttribute("href"),
    ).toBe("/explore");
    expect(
      main.getByRole("link", { name: "Browse courses" }).getAttribute("href"),
    ).toBe("/browse");
    expect(
      main.getByRole("link", { name: "Search the library" }).getAttribute("href"),
    ).toBe("/search");
  });
});
