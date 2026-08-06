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

  it("uses bounded identity and contribution RPCs without client-owned author fields", async () => {
    const calls = [];
    const api = createForumApi(clientWith((name, params) => {
      calls.push({ name, params });
      if (name === "forum_get_my_identity") {
        return { single: async () => ({ data: { username: null, needs_username: true }, error: null }) };
      }
      return Promise.resolve({ data: name === "forum_create_post" ? 44 : "student-name", error: null });
    }));

    await expect(api.getMyIdentity()).resolves.toEqual({ username: null, needs_username: true });
    await expect(api.claimUsername("student-name")).resolves.toBe("student-name");
    await expect(api.createPost({ topic: "physics", title: "A real question", body: "Worked maths" }))
      .resolves.toBe(44);
    await api.createComment({ postId: 44, body: "An answer" });

    expect(calls).toEqual([
      { name: "forum_get_my_identity", params: undefined },
      { name: "forum_claim_username", params: { p_username: "student-name" } },
      { name: "forum_create_post", params: { p_topic_slug: "physics", p_title: "A real question", p_body: "Worked maths" } },
      { name: "forum_create_comment", params: { p_post_id: 44, p_parent_id: null, p_body: "An answer" } },
    ]);
    expect(JSON.stringify(calls)).not.toContain("author_id");
  });
});
