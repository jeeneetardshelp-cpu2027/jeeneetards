// LANGUAGE IS VISIBLE ON /browse AT PHONE WIDTH.
//
// FilterPanel promotes language out of the checkbox list and leads with it as a
// chip row. On a desktop that row is on screen the moment /browse loads, in the
// sidebar. On a phone the panel lives inside the Filters bottom sheet, so the
// row was one tap away behind a button — and the Hindi-medium student it was
// promoted for is exactly the student who does not know to make that tap.
//
// These tests pin the row on /browse itself, and pin that it is the SAME
// filter: same URL parameter, same active-filter chip, same honesty rule about
// which languages are offered.
//
// Run: npx vitest run --project app src/BrowsePage.mobileLanguage.test.jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";

let FACET_ROWS = [];

function builder() {
  const b = {
    select() { return b; },
    order() { return b; },
    limit() { return b; },
    range() { return b; },
    eq() { return b; },
    ilike() { return b; },
    in() { return b; },
    maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) {
      return Promise.resolve({ data: [], error: null, count: 0 }).then(resolve);
    },
  };
  return b;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => builder(),
    rpc: (fn) => Promise.resolve({
      data: fn === "browse_facet_counts" ? FACET_ROWS : [],
      error: null,
    }),
  },
}));

import BrowsePage from "./BrowsePage.jsx";

function LocationProbe() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
}

const renderAt = (url) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/browse" element={<><LocationProbe /><BrowsePage /></>} />
      </Routes>
    </MemoryRouter>,
  );

/** The row surfaced on the page itself, as opposed to FilterPanel's copy. */
const row = () =>
  document.querySelector("section[aria-labelledby='browse-language-heading']");

const chips = () => [...(row()?.querySelectorAll("button") ?? [])];

/** Chip labels without the trailing count badge. */
const chipLabels = () => chips().map((b) => b.textContent.replace(/\d+$/, "").trim());

const chip = (label) => chips().find((b) => b.textContent.replace(/\d+$/, "").trim() === label);

beforeEach(() => {
  FACET_ROWS = [
    { facet: "language", value: "hindi", n: 12 },
    { facet: "language", value: "english", n: 4 },
    { facet: "language", value: "hinglish", n: 0 },
  ];
});

describe("the language row on /browse", () => {
  it("is on the page itself, not only inside the Filters sheet", async () => {
    renderAt("/browse");
    await waitFor(() => expect(row()).toBeTruthy());
    expect(row().querySelector("#browse-language-heading").textContent).toBe("Language");
    // A phone tap target, same as every other chip on this page.
    await waitFor(() => expect(chips().length).toBeGreaterThan(0));
    for (const button of chips()) expect(button.className).toContain("min-h-11");
  });

  it("does not duplicate FilterPanel's row on desktop", async () => {
    renderAt("/browse");
    await waitFor(() => expect(row()).toBeTruthy());
    // Hidden from lg up — which is exactly the width at which the sidebar's
    // own copy appears, so only ever one of the two is on screen.
    expect(row().className).toContain("lg:hidden");
    expect(row().closest("aside")).toBeNull();
    const sidebar = await screen.findByTestId("filter-panel-sidebar");
    expect(sidebar.closest("aside").className).toContain("lg:block");
    expect(sidebar.querySelector("#filter-language-sidebar")).toBeTruthy();
  });

  it("writes the same ?language= parameter, and the removable chip follows", async () => {
    renderAt("/browse");
    await waitFor(() => expect(chip("Hindi")).toBeTruthy());

    fireEvent.click(chip("Hindi"));

    await waitFor(() =>
      expect(screen.getByTestId("loc").textContent).toBe("/browse?language=hindi"));
    expect(chip("Hindi").getAttribute("aria-pressed")).toBe("true");
    // buildChips already knows about language, so the active-filter row picks
    // the selection up without a second model of what is selected.
    expect(screen.getByRole("button", { name: "Remove filter Hindi" })).toBeTruthy();
  });

  it("toggles back off, clearing the parameter", async () => {
    renderAt("/browse?language=hindi");
    await waitFor(() => expect(chip("Hindi")?.getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(chip("Hindi"));
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe("/browse"));
  });

  it("offers only the languages this view actually has", async () => {
    // hinglish counts 0 here, so it is not offered at all — a chip at the top
    // of the results reads as "what this catalogue has".
    renderAt("/browse");
    await waitFor(() => expect(chipLabels()).toEqual(["Hindi", "English"]));
  });

  it("keeps an already-selected language even when the view has none of it", async () => {
    // A shared or stale link must stay clearable rather than trapping the
    // student behind a filter with no control for it.
    renderAt("/browse?language=hinglish");
    await waitFor(() => expect(chipLabels()).toContain("Hinglish"));
    expect(chip("Hinglish").getAttribute("aria-pressed")).toBe("true");
  });
});
