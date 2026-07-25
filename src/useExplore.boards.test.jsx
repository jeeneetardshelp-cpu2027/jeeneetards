import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const calls = [];

function builder() {
  const query = {
    select() { return query; },
    order() { return query; },
    then(resolve) {
      return Promise.resolve({ data: [], error: null }).then(resolve);
    },
  };
  return query;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from(table) {
      calls.push(table);
      return builder();
    },
  },
}));

import { useBoards } from "./useExplore.js";

function Probe({ enabled }) {
  useBoards(enabled);
  return null;
}

beforeEach(() => {
  calls.length = 0;
});

describe("useBoards request scope", () => {
  it("does not request board tables outside the School journey", async () => {
    render(<Probe enabled={false} />);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).toEqual([]);
  });

  it("requests board data for the School journey", async () => {
    render(<Probe enabled />);

    await waitFor(() => {
      expect(calls).toEqual(["boards", "playlist_boards"]);
    });
  });

  it("starts requesting board data when navigation enters the School journey", async () => {
    const view = render(<Probe enabled={false} />);
    expect(calls).toEqual([]);

    view.rerender(<Probe enabled />);

    await waitFor(() => {
      expect(calls).toEqual(["boards", "playlist_boards"]);
    });
  });
});
