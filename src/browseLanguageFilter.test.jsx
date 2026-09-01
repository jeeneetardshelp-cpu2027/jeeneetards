// Language, promoted out of the checkbox list.
//
// The catalogue has always had a language filter — hindi / english / hinglish,
// backed by playlists.language. It was the sixth collapsible group in a
// sidebar, which on a phone means "behind a Filters button, then a scroll".
// For a Hindi-medium student that is the same as not having it.
//
// These tests pin the promotion down: the chips are a change of PROMINENCE,
// not a second filter model. They must write through the same URL parameter
// and the same cascade as the group they replaced, appear identically in both
// panel variants, and stay honest about which languages the current view
// actually has.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import FilterPanel from "./FilterPanel.jsx";
import { ThemeProvider } from "./theme.jsx";
import { LANGUAGES } from "./filterModel.js";

const P = (qs = "") => new URLSearchParams(qs);

const OPTIONS = {
  goal: [
    { id: 1, value: "jee", label: "JEE" },
    { id: 2, value: "neet", label: "NEET" },
  ],
  class: [{ value: "11", label: "Class 11" }],
  subject: [{ value: "physics", label: "Physics" }],
};

const show = (props = {}) => {
  const onChange = vi.fn();
  render(
    <MemoryRouter>
      <ThemeProvider>
        <FilterPanel
          variant="sidebar"
          options={OPTIONS}
          params={P()}
          onChange={onChange}
          {...props}
        />
      </ThemeProvider>
    </MemoryRouter>,
  );
  return { onChange };
};

describe("the language filter is visible without opening anything", () => {
  it("offers every catalogue language as a chip, with no disclosure to open", () => {
    show();
    for (const language of LANGUAGES)
      expect(screen.getByRole("button", { name: language.label }).tagName).toBe("BUTTON");
  });

  it("is no longer a collapsible checkbox group", () => {
    show();
    // The Group header is a button carrying aria-expanded. Course type and
    // Difficulty still have one; Language must not.
    expect(screen.getByRole("button", { name: "Course type" }).getAttribute("aria-expanded"))
      .toBe("true");
    expect(screen.queryByRole("button", { name: "Language", expanded: true })).toBeNull();
    expect(screen.queryByRole("button", { name: "Language", expanded: false })).toBeNull();
  });

  it("leads the panel — it is the first filter in reading order", () => {
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider>
          <FilterPanel variant="sidebar" options={OPTIONS} params={P()} onChange={() => {}} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    const firstHeading = container.querySelector("h3, button[aria-expanded]");
    expect(firstHeading.textContent).toContain("Language");
  });

  it("gives every chip a 44px touch target", () => {
    show();
    for (const language of LANGUAGES)
      expect(screen.getByRole("button", { name: language.label }).className)
        .toContain("min-h-11");
  });
});

describe("the chips write through the existing filter model", () => {
  it("adds the language to the same URL parameter the group used", () => {
    const { onChange } = show();
    fireEvent.click(screen.getByRole("button", { name: "Hindi" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].get("language")).toBe("hindi");
  });

  it("is multi-select, exactly as the checkbox group was", () => {
    const { onChange } = show({ params: P("language=hindi") });
    fireEvent.click(screen.getByRole("button", { name: "Hinglish" }));
    expect(onChange.mock.calls[0][0].get("language")).toBe("hindi,hinglish");
  });

  it("toggles a chosen language back off", () => {
    const { onChange } = show({ params: P("language=hindi") });
    fireEvent.click(screen.getByRole("button", { name: "Hindi" }));
    expect(onChange.mock.calls[0][0].get("language")).toBeNull();
  });

  it("resets paging, so a filter change never lands on an empty page 7", () => {
    const { onChange } = show({ params: P("language=hindi&page=7") });
    fireEvent.click(screen.getByRole("button", { name: "Hinglish" }));
    expect(onChange.mock.calls[0][0].get("page")).toBeNull();
  });

  it("shows the selection that is already in the URL", () => {
    show({ params: P("language=hindi") });
    expect(screen.getByRole("button", { name: "Hindi" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("the chips stay honest about what the catalogue has", () => {
  const counts = { counts: { language: { hindi: 12, hinglish: 3 } } };

  it("does not offer a language this view has no courses in", () => {
    show(counts);
    // english is absent from the count rows, so offering it would be a
    // dead end dressed up as a choice.
    expect(screen.queryByRole("button", { name: /^English/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Hindi, 12 courses" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hinglish, 3 courses" })).toBeTruthy();
  });

  it("still offers a selected language with no courses, so the URL can be cleared", () => {
    show({ ...counts, params: P("language=english") });
    const english = screen.getByRole("button", { name: "English, 0 courses" });
    expect(english.getAttribute("aria-pressed")).toBe("true");
  });

  it("offers every language while the counts are still loading", () => {
    show({ ...counts, countsLoading: true });
    expect(screen.getByRole("button", { name: /^English/ })).toBeTruthy();
  });

  it("offers every language when counts are unavailable altogether", () => {
    show({ counts: null });
    expect(screen.getByRole("button", { name: "English" })).toBeTruthy();
  });
});

describe("desktop and mobile show the same row", () => {
  const renderVariant = (variant) => render(
    <MemoryRouter>
      <ThemeProvider>
        <FilterPanel variant={variant} options={OPTIONS} params={P()} onChange={() => {}} />
      </ThemeProvider>
    </MemoryRouter>,
  );

  it("offers the same chips in the sidebar and the sheet", () => {
    const sidebar = renderVariant("sidebar");
    const inSidebar = within(sidebar.container).getAllByRole("button")
      .map((b) => b.textContent).filter((text) => LANGUAGES.some((l) => l.label === text));
    const sheet = renderVariant("sheet");
    const inSheet = within(sheet.container).getAllByRole("button")
      .map((b) => b.textContent).filter((text) => LANGUAGES.some((l) => l.label === text));
    expect(inSheet).toEqual(inSidebar);
    expect(inSheet.length).toBe(LANGUAGES.length);
  });

  it("gives each variant its own heading id — both are mounted at once", () => {
    const { container: sidebar } = renderVariant("sidebar");
    const { container: sheet } = renderVariant("sheet");
    const sidebarId = sidebar.querySelector("h3").getAttribute("id");
    const sheetId = sheet.querySelector("h3").getAttribute("id");
    expect(sidebarId).toBe("filter-language-sidebar");
    expect(sheetId).toBe("filter-language-sheet");
    expect(sidebarId).not.toBe(sheetId);
  });
});

describe("the row disappears rather than offering nothing", () => {
  it("renders no Language heading when the view has no language at all", () => {
    // Every language counts zero and none is selected: an empty chip row under
    // a "Language" heading would claim a choice that does not exist.
    show({ counts: { language: {} } });
    expect(screen.queryByText("Language")).toBeNull();
    for (const language of LANGUAGES)
      expect([language.label, screen.queryByRole("button", { name: language.label })])
        .toEqual([language.label, null]);
  });
});
