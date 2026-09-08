// The /browse "we could not resolve this filter" panel — what it says, and the
// one thing it must never say.
//
// WHY THIS FILE EXISTS. Until now nothing in the suite rendered this panel at
// all. Grepping the whole repo for its copy ("more than one subject",
// "valid filter", "out of date") found only src/Compare.test.jsx, a different
// component. So when the chapter resolver learned to tell "ambiguous" from
// "unknown" on 7 Sep 2026, the new branch shipped untested — and it was wrong:
// it gated on `unresolved.length === 1`, so a dead goal alongside an ambiguous
// chapter fell through to the generic sentence and asserted we did not know a
// chapter we know two of. Every test below fails against that version.
//
// THE DISTINCTION IS THE POINT. "unknown" means the URL named something that
// does not exist — say so and offer to remove it. "ambiguous" means it named
// something that exists TWICE and gave no way to choose; 14 chapter slugs are
// duplicated across subjects (thermodynamics, biomolecules, electricity,
// heredity, life-processes and the rest of the Class-10 science set). Telling a
// student we do not know "electricity" would be false, and the remedy is
// different: add a subject, do not delete the filter.
//
// Both groups can be present at once, so the panel renders them as two
// sentences rather than choosing one.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// The panel is deep inside BrowsePage, which pulls the whole catalogue stack.
// Mock the resolver so this file is about the COPY, not about resolution —
// canonicalChapterWave.test.jsx already owns the resolver's behaviour.
const canonical = { current: null };
vi.mock("./useCanonicalFilters.js", () => ({
  useCanonicalFilters: () => canonical.current,
}));

const RESOLVED_NOTHING = {
  goalId: null, subjectId: null, chapterId: null, boardId: null,
  chapterClassSlugs: null, names: {}, loading: false, ready: false, error: null,
};

const withUnresolved = (unresolved) => {
  canonical.current = { ...RESOLVED_NOTHING, unresolved };
};

const renderBrowse = async () => {
  const { default: BrowsePage } = await import("./BrowsePage.jsx");
  return render(
    <MemoryRouter initialEntries={["/browse"]}>
      <BrowsePage />
    </MemoryRouter>,
  );
};

const panelText = () => document.body.textContent.replace(/\s+/g, " ");

beforeEach(() => {
  vi.resetModules();
  canonical.current = null;
});

describe("the unresolved-filter panel", () => {
  it("says a slug that matched nothing is not one we know about", async () => {
    withUnresolved([{ key: "chapter", slug: "not-a-real-chapter" }]);
    await renderBrowse();
    const text = panelText();
    expect(text).toContain("“not-a-real-chapter”");
    expect(text).toContain("is not a chapter we know about");
  });

  it("says a slug that matched TWICE is ambiguous, not unknown", async () => {
    withUnresolved([{ key: "chapter", slug: "thermodynamics", reason: "ambiguous" }]);
    await renderBrowse();
    const text = panelText();
    expect(text).toContain("“thermodynamics” is a chapter in more than one subject");
    expect(text).toContain("Add a subject to say which one");
    // The lie this branch exists to prevent.
    expect(
      text,
      'the panel called an ambiguous chapter one we "know about"',
    ).not.toContain("we know about");
  });

  // THE REGRESSION. The first version of this branch gated on
  // `unresolved.length === 1`, so any second unresolved filter silently
  // demoted the ambiguous one back to the generic sentence.
  it("keeps the ambiguity wording when another filter is also unresolved", async () => {
    withUnresolved([
      { key: "goal", slug: "dead-goal-slug" },
      { key: "chapter", slug: "thermodynamics", reason: "ambiguous" },
    ]);
    await renderBrowse();
    const text = panelText();

    // The ambiguous one still speaks for itself...
    expect(text).toContain("“thermodynamics” is a chapter in more than one subject");
    expect(text).toContain("Add a subject to say which one");
    // ...and the unknown one is still named, in its own sentence.
    expect(text).toContain("“dead-goal-slug”");
    expect(text).toContain("is not a goal we know about");
    // Critically, the ambiguous slug must not be swept into the "unknown" list.
    expect(
      text,
      "thermodynamics was listed among the filters we do not know about",
    ).not.toMatch(/“dead-goal-slug”, “thermodynamics”|“thermodynamics”, “dead-goal-slug”/);
  });

  it("offers a remove button for every unresolved filter, whatever the reason", async () => {
    withUnresolved([
      { key: "goal", slug: "dead-goal-slug" },
      { key: "chapter", slug: "thermodynamics", reason: "ambiguous" },
    ]);
    await renderBrowse();
    // Both are removable: ambiguity is fixed by adding a subject OR removing
    // the chapter, and the student is not told which to prefer.
    const buttons = screen.getAllByRole("button", { name: /remove/i });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders nothing at all when every filter resolved", async () => {
    withUnresolved([]);
    await renderBrowse();
    const text = panelText();
    expect(text).not.toContain("we know about");
    expect(text).not.toContain("more than one subject");
  });
});
