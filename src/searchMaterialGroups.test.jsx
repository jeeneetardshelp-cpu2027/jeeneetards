// searchMaterialGroups.test.jsx — /search covers all three pillars.
//
// Two things are being pinned here.
//
//   1. The study-material groups render like every other group: their own
//      heading, their own type chip, rows that lead somewhere real, and rows
//      that join the SAME arrow-key listbox as the video groups. A section
//      only students can reach with a mouse would be a half-shipped feature.
//
//   2. THE CLIENT SHIPS BEFORE THE MIGRATION. Until
//      supabase/migrations/20260901160000_universal_search_materials.sql is
//      pushed, the deployed universal_search knows nothing about 'material' or
//      'paper' and simply returns no rows for them. The page must then look
//      EXACTLY as it does today: no empty section, no dangling chip, no error.
//      That is not a hope about React — it is asserted below.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";

let RPC_ROWS = [];
const rpcCalls = [];

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (fn, args) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: RPC_ROWS, error: null });
    },
    from: () => {
      const builder = { select: () => builder, in: () => Promise.resolve({ data: [], error: null }) };
      return builder;
    },
  },
}));

const { default: UniversalSearch } = await import("./UniversalSearch.jsx");
const { DEBOUNCE_MS, GROUPS, groupRows } = await import("./useUniversalSearch.js");

const row = (over = {}) => ({
  group_key: "chapter", entity_id: 1, title: "Kinematics", subtitle: "Physics",
  aka: null, slug: null, match_type: "exact", match_rank: 1,
  matched_on: "Kinematics", is_ambiguous: false, group_total: 1, extra: {}, ...over,
});

const NOTE_ROW = row({
  group_key: "material", entity_id: 21, title: "Kinematics Short Notes",
  subtitle: "Short notes · Physics · Kinematics", match_type: "partial", match_rank: 4,
  extra: {
    material_type: "short_notes", goal_slug: "jee", class_slug: "class-11",
    subject_slug: "physics", chapter_slug: "kinematics",
  },
});

const PAPER_ROW = row({
  group_key: "paper", entity_id: 31,
  title: "JEE Main 2024 Session 1 Shift 1 Question Paper",
  subtitle: "2024 · NTA", match_type: "partial", match_rank: 4,
  extra: { material_type: "previous_year_paper", jee_main_landing: true },
});

const LEGACY_ROWS = [
  row(),
  row({ group_key: "playlist", entity_id: 5, title: "Complete Kinematics" }),
  row({ group_key: "lecture", entity_id: 9, title: "Relative motion" }),
  row({ group_key: "institute", entity_id: 3, title: "Competishun" }),
];

function Probe() {
  const location = useLocation();
  return <div data-testid="loc">{location.pathname + location.search}</div>;
}

const renderSearch = (url = "/search") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Probe />
      <Routes>
        <Route path="/search" element={<UniversalSearch />} />
        <Route path="*" element={<div data-testid="landed" />} />
      </Routes>
    </MemoryRouter>,
  );

const type = (value) =>
  fireEvent.change(screen.getByRole("combobox"), { target: { value } });

const settle = async () => {
  await act(async () => { vi.advanceTimersByTime(DEBOUNCE_MS + 20); });
  await act(async () => { await Promise.resolve(); });
};

const headings = () =>
  screen.queryAllByRole("heading").map((node) => node.textContent.trim());

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  RPC_ROWS = [];
  rpcCalls.length = 0;
});
afterEach(() => { vi.useRealTimers(); });

describe("the group list itself", () => {
  it("keeps the five video groups in their existing positions", () => {
    expect(GROUPS.slice(0, 5).map((g) => g.key))
      .toEqual(["faculty", "chapter", "playlist", "lecture", "institute"]);
  });

  it("adds the two study-material groups after them", () => {
    expect(GROUPS.slice(5)).toEqual([
      { key: "material", label: "Notes & sheets" },
      { key: "paper", label: "Previous-year papers" },
    ]);
  });
});

describe("study material appears in the main search", () => {
  it("draws a heading for each new group", async () => {
    RPC_ROWS = [row(), NOTE_ROW, PAPER_ROW];
    renderSearch();
    type("kinematics notes");
    await settle();
    expect(headings()).toContain("Notes & sheets");
    expect(headings()).toContain("Previous-year papers");
  });

  it("shows the material's type and syllabus place under its title", async () => {
    RPC_ROWS = [NOTE_ROW];
    renderSearch();
    type("kinematics notes");
    await settle();
    expect(await screen.findByText("Kinematics Short Notes")).toBeTruthy();
    expect(screen.getByText("Short notes · Physics · Kinematics")).toBeTruthy();
  });

  it("opens a note on /materials, filtered to the chapter it belongs to", async () => {
    RPC_ROWS = [NOTE_ROW];
    renderSearch();
    type("kinematics notes");
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByText("Kinematics Short Notes"));
    });
    expect(screen.getByTestId("loc").textContent)
      .toBe("/materials?goal=jee&class=class-11&subject=physics&chapter=kinematics&type=short_notes");
  });

  it("opens a JEE Main paper on the papers landing", async () => {
    RPC_ROWS = [PAPER_ROW];
    renderSearch();
    type("jee main 2024 paper");
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByText("JEE Main 2024 Session 1 Shift 1 Question Paper"));
    });
    expect(screen.getByTestId("loc").textContent)
      .toBe("/materials/jee-main/previous-year-papers");
  });

  it("offers the new groups as type filters, with their counts", async () => {
    RPC_ROWS = [
      { ...NOTE_ROW, group_total: 12 },
      { ...PAPER_ROW, group_total: 40 },
    ];
    renderSearch();
    type("kinematics");
    await settle();
    expect(screen.getByRole("button", { name: "Notes & sheets (12)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous-year papers (40)" })).toBeTruthy();
  });
});

describe("the appended rows join the same listbox", () => {
  it("arrows walk from a video group into the material groups", async () => {
    RPC_ROWS = [row(), NOTE_ROW, PAPER_ROW];
    renderSearch();
    type("kinematics");
    await settle();

    const input = screen.getByRole("combobox");
    // One listbox, one running index: chapter 0, material 1, paper 2.
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe("usr-opt-0");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe("usr-opt-1");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe("usr-opt-2");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[2].getAttribute("aria-selected")).toBe("true");
  });

  it("Enter opens the highlighted paper, same as any other row", async () => {
    RPC_ROWS = [row(), NOTE_ROW, PAPER_ROW];
    renderSearch();
    type("kinematics");
    await settle();

    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "End" });
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    expect(screen.getByTestId("loc").textContent)
      .toBe("/materials/jee-main/previous-year-papers");
  });
});

describe("degrades to today's behaviour until the migration is applied", () => {
  // The deployed RPC returns only the five video groups. Nothing about the
  // client may notice.
  it("draws no heading for a group the server did not send", async () => {
    RPC_ROWS = LEGACY_ROWS;
    renderSearch();
    type("kinematics");
    await settle();
    expect(headings()).toEqual(["Chapters", "Playlists", "Lectures", "Institutes"]);
  });

  it("offers no type filter for a group with no results", async () => {
    RPC_ROWS = LEGACY_ROWS;
    renderSearch();
    type("kinematics");
    await settle();
    expect(screen.queryByRole("button", { name: /Notes & sheets/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Previous-year papers/ })).toBeNull();
  });

  it("reports no error and no empty section", async () => {
    RPC_ROWS = LEGACY_ROWS;
    const { container } = renderSearch();
    type("kinematics");
    await settle();
    expect(screen.queryByText(/Search is unavailable/)).toBeNull();
    expect(screen.queryByText(/Nothing matches/)).toBeNull();
    // Four groups sent, four sections drawn — no placeholder for the missing two.
    expect(container.querySelectorAll("#usr-listbox section")).toHaveLength(4);
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("still asks the server for everything, so the groups light up on push", async () => {
    RPC_ROWS = LEGACY_ROWS;
    renderSearch();
    type("kinematics");
    await settle();
    // p_types null = "every group you know about". The client never enumerates
    // the groups in the request, so an older RPC is never sent a type it
    // cannot handle.
    expect(rpcCalls.at(-1).args.p_types).toBeNull();
  });

  it("groupRows invents no bucket for a group with no rows", () => {
    const grouped = groupRows(LEGACY_ROWS);
    expect(Object.keys(grouped).sort())
      .toEqual(["chapter", "institute", "lecture", "playlist"]);
    expect(grouped.material).toBeUndefined();
    expect(grouped.paper).toBeUndefined();
  });
});
