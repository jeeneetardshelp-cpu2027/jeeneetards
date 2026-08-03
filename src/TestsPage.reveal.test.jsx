// The mock-test page must actually be VISIBLE.
//
// Regression guard for a defect introduced while restyling /tests onto the
// shared motion kit. Every block was wrapped in <Reveal>, which ships at
// `opacity: 0` and is only shown once a useReveal() root adds `.is-in`.
// TestsPage had no such root, so the whole page painted at zero opacity: the
// markup was complete, nothing threw, and every DOM-querying test passed —
// the page was simply blank to a human. It was caught by a screenshot, not
// by the suite. This is the second time this trap has bitten this codebase;
// see HomeSearchVisible.test.jsx for the first.
//
// Why this test works: jsdom has no IntersectionObserver, so useReveal's
// fallback marks everything `is-in` as soon as a root is mounted. If the root
// is MISSING, that fallback never runs and the `.reveal` elements keep their
// zero-opacity class with no `is-in` — exactly the production symptom.
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import TestsPage from "./TestsPage.jsx";
import { ThemeProvider } from "./theme.jsx";

function renderPage() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/tests"]}>
        <TestsPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("/tests visibility", () => {
  it("reveals every animated block, so the page is not blank", () => {
    const { container } = renderPage();
    const reveals = [...container.querySelectorAll(".reveal")];

    // If this is 0 the test is meaningless — fail loudly rather than pass.
    expect(reveals.length).toBeGreaterThan(0);

    const hidden = reveals.filter((el) => !el.classList.contains("is-in"));
    expect(
      hidden.map((el) => el.tagName + (el.id ? `#${el.id}` : "")),
      "these blocks would render at opacity 0",
    ).toEqual([]);
  });

  it("puts the sources on screen, not just in the DOM", () => {
    const { container } = renderPage();
    // A card sitting inside an un-revealed ancestor is invisible even though
    // it is queryable — assert the whole chain is revealed.
    const cards = [...container.querySelectorAll("li a[target='_blank']")];
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      let node = card.parentElement;
      while (node && node !== container) {
        if (node.classList?.contains("reveal")) {
          expect(
            node.classList.contains("is-in"),
            `"${card.querySelector("h3")?.textContent}" is inside a hidden block`,
          ).toBe(true);
        }
        node = node.parentElement;
      }
    }
  });
});
