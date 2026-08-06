import { describe, expect, it } from "vitest";
import { createForumApi, ForumApiError } from "./forumApi.js";

function clientWith(handler) {
  return { rpc: (name, params) => handler(name, params) };
}

describe("forum read API", () => {
  it("maps feed filters and a complete cursor onto the reviewed RPC", async () => {
    const calls = [];
    const api = createForumApi(clientWith(async (name, params) => {
      calls.push({ name, params });
      return { data: [{ id: 7 }], error: null };
    }));

    await expect(api.getFeed({
      sort: "top",
      topic: "physics",
      query: "rotation",
      cursor: { id: 9, score: 4, hot_rank: 12.5, created_at: "2026-08-06T00:00:00Z" },
    })).resolves.toEqual([{ id: 7 }]);
    expect(calls).toEqual([{
      name: "get_forum_feed",
      params: {
        p_sort: "top",
        p_topic_slug: "physics",
        p_query: "rotation",
        p_cursor_hot: 12.5,
        p_cursor_score: 4,
        p_cursor_created_at: "2026-08-06T00:00:00Z",
        p_cursor_id: 9,
        p_limit: 25,
      },
    }]);
  });

  it("uses maybeSingle for the zero-or-one post contract", async () => {
    let maybeSingleCalls = 0;
    const api = createForumApi(clientWith((name, params) => ({
      maybeSingle: async () => {
        maybeSingleCalls += 1;
        expect(name).toBe("get_forum_post");
        expect(params).toEqual({ p_post_id: 42 });
        return { data: null, error: null };
      },
    })));

    await expect(api.getPost(42)).resolves.toBeNull();
    expect(maybeSingleCalls).toBe(1);
  });

  it("turns PostgREST errors into stable, student-safe errors", async () => {
    const api = createForumApi(clientWith(async () => ({
      data: null,
      error: { code: "PGRST500", message: "internal database detail" },
    })));

    await expect(api.getTopics()).rejects.toMatchObject({
      name: "ForumApiError",
      code: "PGRST500",
      message: "Could not load forum topics.",
    });
  });

  it("fails locally when Supabase is not configured", async () => {
    const api = createForumApi(null);
    await expect(api.getMode()).rejects.toBeInstanceOf(ForumApiError);
  });
});
