import { fireEvent, render, screen } from "@testing-library/react";
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

function renderPost(api, entry = "/forum/post/42") {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/forum/post/:postId" element={<ForumPostPage api={api} />} />
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
});
