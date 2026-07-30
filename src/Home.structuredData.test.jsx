// Home.jsx's structured-data wiring: proves the homepage writes the site's
// own WebSite + Organization identity once, unconditionally — these do not
// depend on search state, so a static empty deps array is correct and this
// is the one real thing worth pinning at the wiring layer (the nodes
// themselves are already covered by structuredData.test.js).
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("./usePlaylistBrowse.js", () => ({
  usePlaylistBrowse: () => ({ items: [], loading: false, error: null }),
}));
vi.mock("./useUniversalSearch.js", () => ({
  useUniversalSearch: () => ({
    groups: {}, loading: false, error: null, tooShort: false, retry: () => {},
  }),
  MIN_QUERY: 3,
}));
vi.mock("./progress.js", () => ({ getContinueWatching: () => [] }));
vi.mock("./useExplore.js", () => ({
  useLearningGoals: () => ({ goals: [], loading: false, error: null }),
}));

import Home from "./Home.jsx";
import { ThemeProvider } from "./theme.jsx";

function schemaFor(key) {
  const el = document.head.querySelector(
    `script[type="application/ld+json"][data-schema-key="${key}"]`,
  );
  return el ? JSON.parse(el.textContent) : null;
}

describe("Home structured data wiring", () => {
  it("writes the site's own WebSite and Organization identity, not a course's", async () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Home />
        </MemoryRouter>
      </ThemeProvider>,
    );
    await screen.findByRole("heading", { name: /Find the right lecture/i });

    const website = schemaFor("WebSite");
    expect(website.url).toBe("https://www.jeeneetard.com/");
    expect(website.potentialAction.target.urlTemplate).toBe(
      "https://www.jeeneetard.com/?q={search_term_string}",
    );

    const organization = schemaFor("Organization");
    expect(organization.name).toBe("JEENEETARD");
    expect(organization.url).toBe("https://www.jeeneetard.com/");
  });
});
