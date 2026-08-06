import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import ForumPostPage from "./ForumPostPage.jsx";

const forumPost = {
  id: 42,
  topic_slug: "mathematics",
  topic_name: "Mathematics",
  author_username: "student_two",
  title: "Why does this integral converge?",
  body: "Use the comparison test:\n\n$$\\int_1^\\infty \\frac{1}{x^2} dx$$",
  is_solved: true,
  is_locked: false,
  score: 12,
  comment_count: 3,
  created_at: "2026-08-01T10:00:00.000Z",
  edited_at: null,
};

const comments = [
  { id: 1, post_id: 42, parent_id: null, depth: 0, author_username: "helper", body: "Compare it with $1/x^2$.", is_tombstone: false, score: 4, created_at: "2026-08-01T11:00:00.000Z" },
  { id: 2, post_id: 42, parent_id: 1, depth: 1, author_username: "student_two", body: "That makes sense.", is_tombstone: false, score: 1, created_at: "2026-08-01T11:05:00.000Z" },
  { id: 3, post_id: 42, parent_id: 999, depth: 2, author_username: "orphan_helper", body: "The missing parent does not hide this reply.", is_tombstone: false, score: 0, created_at: "2026-08-01T11:10:00.000Z" },
];

function apiWith(post = forumPost, rows = comments) {
  return {
    getMode: vi.fn().mockResolvedValue("read_only"),
    getPost: vi.fn().mockResolvedValue(post),
    getComments: vi.fn().mockResolvedValue(rows),
  };
}

function renderPost(api, entry = "/forum/post/42", authState = null) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/forum/post/:postId" element={<ForumPostPage api={api} authState={authState} />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("signed-out forum thread", () => {
  it("renders safe maths, nesting and missing-parent replies without write controls", async () => {
    const { container } = renderPost(apiWith());
    expect(await screen.findByRole("heading", { name: forumPost.title })).toBeTruthy();
    expect(container.querySelector(".katex-display")).toBeTruthy();
    expect(screen.getByText("The missing parent does not hide this reply.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /reply|vote|report/i })).toBeNull();
    expect(container.querySelector(".reveal")).toBeNull();
  });

  it("collapses a whole reply subtree and reports the hidden count", async () => {
    renderPost(apiWith());
    const collapse = await screen.findByRole("button", { name: "Collapse replies" });
    fireEvent.click(collapse);
    expect(screen.queryByText("That makes sense.")).toBeNull();
    expect(screen.getByRole("button", { name: "Show 1 hidden reply" }).getAttribute("aria-expanded"))
      .toBe("false");
  });

  it("shows honest missing and empty states", async () => {
    const missing = renderPost(apiWith(null, []));
    expect(await screen.findByRole("heading", { name: "Discussion not found" })).toBeTruthy();
    missing.unmount();

    renderPost(apiWith(forumPost, []));
    expect(await screen.findByRole("heading", { name: "No answers yet" })).toBeTruthy();
  });

  it("does not call the API for an invalid id", () => {
    const api = apiWith();
    renderPost(api, "/forum/post/not-a-number");
    expect(screen.getByRole("heading", { name: "Discussion not found" })).toBeTruthy();
    expect(api.getMode).not.toHaveBeenCalled();
  });

  it("votes independently on the discussion and an answer when identity is ready", async () => {
    const api = apiWith();
    api.getMode.mockResolvedValue("open");
    api.getMyIdentity = vi.fn().mockResolvedValue({ username: "student-one", needs_username: false });
    api.castVote = vi.fn(({ targetType }) => Promise.resolve({
      viewer_vote: 1,
      score: targetType === "post" ? 13 : 5,
      upvote_count: 1,
      downvote_count: 0,
    }));
    api.createComment = vi.fn();
    renderPost(api, "/forum/post/42", {
      session: { user: { id: "student-1" } }, loading: false,
    });

    await screen.findByRole("heading", { name: forumPost.title });
    await waitFor(() => expect(api.getMyIdentity).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Upvote this discussion" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Upvote this answer" })[0]);

    await waitFor(() => expect(api.castVote).toHaveBeenCalledWith({
      targetType: "post", targetId: 42, value: 1,
    }));
    await waitFor(() => expect(api.castVote).toHaveBeenCalledWith({
      targetType: "comment", targetId: 1, value: 1,
    }));
    expect(await screen.findByLabelText("13 score")).toBeTruthy();
    expect(await screen.findByLabelText("5 score")).toBeTruthy();
  });

  it("reuses the answer composer auth surface for a signed-out vote", async () => {
    const api = apiWith();
    api.getMode.mockResolvedValue("open");
    api.createComment = vi.fn();
    renderPost(api, "/forum/post/42", { session: null, loading: false });

    fireEvent.click(await screen.findByRole("button", { name: "Upvote this discussion" }));
    expect(screen.getByRole("status").textContent).toMatch(/answer panel below/i);
    expect(screen.getAllByRole("heading", { name: "Sign in to publish this answer" })).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Sign in to vote on discussions" })).toBeNull();
    expect(api.castVote).toBeUndefined();
  });
});
