// The lesson-description fetch is bounded to ONE row, on demand.
//
// The bulk lesson query used to ship every lesson's description on every
// course load, although the only consumer is the ACTIVE lesson's VideoObject
// structured data. These tests pin the new contract: the bulk select carries
// no description column, and useLessonDescription reads exactly one row.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";

const calls = [];
const state = { result: { data: { description: "Motion in one dimension." }, error: null } };
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table) => {
      const rec = { table, cols: null, eq: {}, single: false };
      calls.push(rec);
      const b = {
        select(cols) { rec.cols = cols; return b; },
        eq(k, v) { rec.eq[k] = v; return b; },
        maybeSingle() { rec.single = true; return Promise.resolve(state.result); },
      };
      return b;
    },
  },
}));

import { useLessonDescription } from "./usePlaylistVideos.js";

function Probe({ id, enabled = true }) {
  const description = useLessonDescription(id, { enabled });
  return <output aria-label="Description">{String(description)}</output>;
}

beforeEach(() => {
  calls.length = 0;
  state.result = { data: { description: "Motion in one dimension." }, error: null };
});

describe("useLessonDescription", () => {
  it("fetches exactly one row, by the video's database id", async () => {
    render(<Probe id={101} />);
    await waitFor(() =>
      expect(screen.getByLabelText("Description").textContent).toBe("Motion in one dimension."));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      table: "videos",
      cols: "description",
      eq: { id: 101 },
      single: true,
    });
  });

  it("does not query at all while disabled or without a valid id", () => {
    render(<Probe id={101} enabled={false} />);
    render(<Probe id={null} />);
    expect(calls).toHaveLength(0);
    for (const el of screen.getAllByLabelText("Description")) {
      expect(el.textContent).toBe("null");
    }
  });

  it("stays null on a failed fetch — the schema omits the field instead", async () => {
    state.result = { data: null, error: { message: "boom" } };
    render(<Probe id={101} />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(screen.getByLabelText("Description").textContent).toBe("null");
  });

  it("keeps the bulk lesson select free of description", () => {
    const src = readFileSync("src/usePlaylistVideos.js", "utf8");
    const selectLiteral = src.match(/const LESSON_SELECT =[\s\S]*?;\n/)[0];
    expect(selectLiteral).not.toContain("description");
  });
});
