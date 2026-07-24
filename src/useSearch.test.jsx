import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const calls = [];
let responses = {};

function builder(table) {
  const value = responses[table] ?? { data: [], error: null };
  const chain = {
    select() { return chain; },
    limit() { return chain; },
    ilike() { return chain; },
    or() { return chain; },
    in() { return chain; },
    order() { return chain; },
    then(resolve) { return Promise.resolve(value).then(resolve); },
  };
  calls.push(table);
  return chain;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { from: (table) => builder(table) },
}));

import { useSearch } from "./useSearch.js";

function Probe() {
  const state = useSearch("kinematics");
  return (
    <div>
      <span data-testid="status">
        {state.loading ? "loading" : state.error ?? `total:${state.total}`}
      </span>
      <button onClick={state.retry}>Retry</button>
    </div>
  );
}

beforeEach(() => {
  calls.length = 0;
  responses = {
    chapters: { data: [], error: null },
    videos: { data: [], error: null },
    playlists: { data: [], error: null },
    institutes_channels: { data: [], error: null },
  };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("homepage search integrity", () => {
  it("reports a real empty result only when every query succeeded", async () => {
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("total:0"));
    expect(calls).toEqual(expect.arrayContaining([
      "chapters", "videos", "playlists", "institutes_channels",
    ]));
  });

  it("does not turn a failed database query into 'no results'", async () => {
    responses.chapters = { data: null, error: { code: "500", message: "failed" } };
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("status").textContent)
      .toBe("Search is unavailable. Please try again."));
  });

  it("retry actually issues a new search generation", async () => {
    responses.chapters = { data: null, error: { code: "500", message: "failed" } };
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId("status").textContent)
      .toBe("Search is unavailable. Please try again."));
    const before = calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(calls.length).toBeGreaterThan(before));
  });
});

