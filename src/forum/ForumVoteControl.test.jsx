import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ForumVoteControl from "./ForumVoteControl.jsx";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

describe("forum vote control", () => {
  it("keeps signed-out voting visible but delegates to the auth gate", () => {
    const onBlocked = vi.fn();
    const api = { castVote: vi.fn() };
    render(<ForumVoteControl targetType="post" targetId={42} score={3} api={api} onBlocked={onBlocked} />);

    fireEvent.click(screen.getByRole("button", { name: "Upvote this discussion" }));
    expect(onBlocked).toHaveBeenCalledOnce();
    expect(api.castVote).not.toHaveBeenCalled();
    expect(screen.getByLabelText("3 score")).toBeTruthy();
  });

  it("updates optimistically, toggles by the requested value and reconciles to the server", async () => {
    const pending = deferred();
    const api = { castVote: vi.fn(() => pending.promise) };
    render(<ForumVoteControl
      targetType="comment"
      targetId={7}
      score={4}
      upvoteCount={5}
      downvoteCount={1}
      viewerVote={0}
      canVote
      api={api}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Upvote this answer" }));
    expect(screen.getByLabelText("5 score")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upvote this answer" }).getAttribute("aria-pressed"))
      .toBe("true");

    pending.resolve({ viewer_vote: 1, score: 6, upvote_count: 7, downvote_count: 1 });
    await waitFor(() => expect(screen.getByLabelText("6 score")).toBeTruthy());
    expect(api.castVote).toHaveBeenCalledWith({ targetType: "comment", targetId: 7, value: 1 });
  });

  it("rolls back and explains a failed vote", async () => {
    const api = { castVote: vi.fn().mockRejectedValue(new Error("network timeout")) };
    render(<ForumVoteControl targetType="post" targetId={42} score={3} canVote api={api} />);

    fireEvent.click(screen.getByRole("button", { name: "Downvote this discussion" }));
    expect(screen.getByLabelText("2 score")).toBeTruthy();
    expect((await screen.findByRole("alert")).textContent).toMatch(/not changed/i);
    expect(screen.getByLabelText("3 score")).toBeTruthy();
  });
});
