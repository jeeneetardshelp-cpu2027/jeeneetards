import { describe, expect, it } from "vitest";
import { forumVoteState, optimisticForumVote } from "./forumVoteState.js";

describe("forum vote state", () => {
  it.each([
    ["adds an upvote", 0, 1, 1, 1, 1],
    ["clears an upvote", 1, 1, 0, -1, -1],
    ["flips down to up", -1, 1, 1, 2, 1],
    ["adds a downvote", 0, -1, -1, -1, 0],
    ["clears a downvote", -1, -1, 0, 1, 0],
    ["flips up to down", 1, -1, -1, -2, -1],
  ])("%s", (_label, currentVote, requested, nextVote, scoreDelta, upDelta) => {
    const before = { viewerVote: currentVote, score: 10, upvoteCount: 6, downvoteCount: 2 };
    const next = optimisticForumVote(before, requested);
    expect(next.viewerVote).toBe(nextVote);
    expect(next.score).toBe(10 + scoreDelta);
    expect(next.upvoteCount).toBe(6 + upDelta);
    expect(next.downvoteCount).toBe(2 - scoreDelta + upDelta);
  });

  it("normalizes the server's snake-case vote row", () => {
    expect(forumVoteState({
      viewer_vote: -1, score: "4", upvote_count: "5", downvote_count: "1",
    })).toEqual({ viewerVote: -1, score: 4, upvoteCount: 5, downvoteCount: 1 });
  });
});
