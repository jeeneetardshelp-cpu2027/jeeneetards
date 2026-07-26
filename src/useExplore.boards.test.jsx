import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const calls = [];
const responses = new Map();

function builder(call) {
  const query = {
    select(columns) {
      call.select = columns;
      return query;
    },
    order(column) {
      call.order = column;
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(
        responses.get(call.table) ?? { data: [], error: null },
      ).then(resolve, reject);
    },
  };
  return query;
}

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from(table) {
      const call = { table };
      calls.push(call);
      return builder(call);
    },
  },
}));

import { useBoards } from "./useExplore.js";

function Probe({ enabled }) {
  const state = useBoards(enabled);
  return <output data-testid="boards">{JSON.stringify(state)}</output>;
}

const renderedState = () => JSON.parse(screen.getByTestId("boards").textContent);

beforeEach(() => {
  calls.length = 0;
  responses.clear();
});

describe("useBoards request scope", () => {
  it("does not request board tables outside the School journey", async () => {
    render(<Probe enabled={false} />);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).toEqual([]);
  });

  it("loads board course counts in one server-aggregated request", async () => {
    responses.set("boards", {
      data: [{
        id: 7,
        name: "CBSE",
        slug: "cbse",
        playlist_boards: [{ count: 1201 }],
      }],
      error: null,
    });

    render(<Probe enabled />);

    await waitFor(() => {
      expect(renderedState().boards).toEqual([{
        id: 7,
        name: "CBSE",
        slug: "cbse",
        courseCount: 1201,
      }]);
    });
    expect(calls).toEqual([{
      table: "boards",
      select: "id, name, slug, playlist_boards(count)",
      order: "display_order",
    }]);
  });

  it("treats a missing board relationship as an unavailable capability", async () => {
    responses.set("boards", {
      data: null,
      error: { code: "PGRST200", message: "Relationship unavailable" },
    });

    render(<Probe enabled />);

    await waitFor(() => {
      expect(renderedState()).toEqual({
        boards: [],
        loading: false,
        error: null,
        unavailable: true,
      });
    });
  });

  it("starts requesting board data when navigation enters the School journey", async () => {
    const view = render(<Probe enabled={false} />);
    expect(calls).toEqual([]);

    view.rerender(<Probe enabled />);

    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0].table).toBe("boards");
  });
});
