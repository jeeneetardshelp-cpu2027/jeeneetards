import { describe, expect, it } from "vitest";
import {
  cursorFromForumPost, effectiveForumSort, normalizeForumSort,
} from "./forumCursor.js";

describe("forum cursor contract", () => {
  const post = {
    id: 8, created_at: "2026-08-06T00:00:00Z", hot_rank: 7.5, score: 3,
  };

  it("normalizes unknown sorts to Hot", () => {
    expect(normalizeForumSort("TOP")).toBe("top");
    expect(normalizeForumSort("controversial")).toBe("hot");
  });

  it("uses New for searches because the RPC does the same", () => {
    expect(effectiveForumSort("top", "rotation")).toBe("new");
    expect(cursorFromForumPost(post, "top", "rotation")).toEqual({
      id: 8,
      created_at: post.created_at,
      hot_rank: null,
      score: null,
    });
  });

  it("includes only the matching stored sort field", () => {
    expect(cursorFromForumPost(post, "hot")).toMatchObject({ hot_rank: 7.5, score: null });
    expect(cursorFromForumPost(post, "top")).toMatchObject({ hot_rank: null, score: 3 });
  });
});
