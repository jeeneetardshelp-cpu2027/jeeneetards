// Home.jsx's structured-data wiring: proves the homepage writes the site's
// own WebSite + Organization identity once, unconditionally — these do not
// depend on search state, so a static empty deps array is correct and this
// is the one real thing worth pinning at the wiring layer (the nodes
// themselves are already covered by structuredData.test.js).
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("./usePlaylistBrowse.js", () => ({
  usePlaylistBrowse: () => ({ items: [], loading: false, error: null }),
}));
vi.mock("./useUniversalSearch.js", () => ({
  GROUPS: [
    { key: "faculty", label: "Faculty" },
    { key: "chapter", label: "Chapters" },
    { key: "playlist", label: "Playlists" },
    { key: "lecture", label: "Lectures" },
    { key: "institute", label: "Institutes" },
    { key: "material", label: "Notes & sheets" },
    { key: "paper", label: "Previous-year papers" },
  ],
  useUniversalSearch: () => ({
    groups: {}, loading: false, error: null, tooShort: false, retry: () => {},
    page: 0, setPage: () => {},
  }),
  MIN_QUERY: 3,
}));
// countLessonsStudiedToday feeds the PrepToday band, also on the homepage;
// zero keeps it hidden so it cannot disturb these assertions.
vi.mock("./progress.js", () => ({
  getContinueWatching: () => [],
  countLessonsStudiedToday: () => 0,
}));
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

// The schema scripts are written by an effect that has not necessarily flushed
// by the time the heading is queryable, so waiting on the heading is not enough
// — wait on the script itself.
async function findSchemaFor(key) {
  let schema = null;
  await waitFor(() => {
    schema = schemaFor(key);
    expect(schema).not.toBeNull();
  });
  return schema;
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
    const website = await findSchemaFor("WebSite");
    expect(website.url).toBe("https://www.jeeneetard.com/");
    expect(website.potentialAction.target.urlTemplate).toBe(
      "https://www.jeeneetard.com/?q={search_term_string}",
    );

    const organization = await findSchemaFor("Organization");
    expect(organization.name).toBe("JEENEETARD");
    expect(organization.url).toBe("https://www.jeeneetard.com/");
  });
});
