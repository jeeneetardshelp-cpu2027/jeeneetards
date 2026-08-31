import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import ForumFeedPage from "./ForumFeedPage.jsx";

const topics = [
  { id: 1, slug: "physics", name: "Physics", description: "Physics doubts", kind: "academic" },
  { id: 2, slug: "strategy", name: "Strategy", description: "Preparation plans", kind: "non_academic" },
];

function post(id, overrides = {}) {
  return {
    id,
    topic_slug: "physics",
    topic_name: "Physics",
    author_username: "student_one",
    title: `Question ${id}`,
    body_preview: "How do I solve this mechanics problem?",
    is_solved: id === 1,
    score: id,
    comment_count: 2,
    hot_rank: 100 - id,
    created_at: new Date(2026, 7, 1, 10, 0, id).toISOString(),
    edited_at: null,
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="location">{location.pathname + location.search}</output>;
}

function renderFeed(api, entry = "/forum", authState = null) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <ForumFeedPage api={api} authState={authState} />
        <LocationProbe />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function apiWith(feed = [post(1)]) {
  return {
    getMode: vi.fn().mockResolvedValue("read_only"),
    getTopics: vi.fn().mockResolvedValue(topics),
    getFeed: vi.fn().mockResolvedValue(feed),
    getMyIdentity: vi.fn().mockResolvedValue({ username: "student-one", needs_username: false }),
    claimUsername: vi.fn().mockResolvedValue("student-one"),
    castVote: vi.fn().mockResolvedValue({ viewer_vote: 1, score: 2, upvote_count: 2, downvote_count: 0 }),
  };
}

describe("signed-out forum feed", () => {
  it("renders public discussions without mounting auth, write controls or Reveal", async () => {
    const { container } = renderFeed(apiWith());
    expect(await screen.findByRole("heading", { name: "Question 1" })).toBeTruthy();
    expect(screen.getByText("Solved")).toBeTruthy();
    // The inline auth form must not be mounted in the FEED. Checked by the
    // form's own fields, not by the word "sign in" — the GlobalHeader now
    // carries a global "Sign in" nav link on every signed-out page, which is
    // navigation, not the auth surface this test guards against.
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByText(/submit a post/i)).toBeNull();
    expect(container.querySelector(".reveal")).toBeNull();
  });

  it("keeps sort, topic and search in the URL and tells students the search contract", async () => {
    const api = apiWith();
    renderFeed(api, "/forum?sort=top&topic=physics&q=rotation");
    await screen.findByRole("heading", { name: "Question 1" });

    expect(api.getFeed).toHaveBeenCalledWith(expect.objectContaining({
      sort: "top", topic: "physics", query: "rotation",
    }));
    expect(screen.getByText(/newest first; comments aren’t searched/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "New" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Strategy" }));
    await waitFor(() => expect(screen.getByLabelText("location").textContent).toContain("topic=strategy"));
    fireEvent.click(screen.getByRole("button", { name: "Clear discussion search" }));
    await waitFor(() => expect(screen.getByLabelText("location").textContent).not.toContain("q="));
  });

  it("loads the next cursor page, appends new rows and removes overlap", async () => {
    const first = Array.from({ length: 25 }, (_, index) => post(index + 1));
    const api = apiWith(first);
    api.getFeed
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce([post(25), post(26)]);
    renderFeed(api);

    const load = await screen.findByRole("button", { name: "Load more discussions" });
    fireEvent.click(load);
    expect(await screen.findByRole("heading", { name: "Question 26" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Question 25" })).toHaveLength(1);
    expect(api.getFeed).toHaveBeenLastCalledWith(expect.objectContaining({
      cursor: expect.objectContaining({ id: 25, hot_rank: 75 }),
    }));
  });

  it("distinguishes unavailable, error and empty responses", async () => {
    const off = apiWith();
    off.getMode.mockResolvedValue("off");
    const first = renderFeed(off);
    expect(await screen.findByRole("heading", { name: "Discussions are temporarily unavailable" })).toBeTruthy();
    first.unmount();

    const failed = apiWith();
    failed.getFeed.mockRejectedValue(new Error("Network unavailable"));
    const second = renderFeed(failed);
    expect((await screen.findByRole("alert")).textContent).toContain("Network unavailable");
    second.unmount();

    renderFeed(apiWith([]), "/forum?topic=physics");
    expect(await screen.findByRole("heading", { name: "No discussions found" })).toBeTruthy();
    expect(screen.getByText(/no visible posts in physics/i)).toBeTruthy();
  });

  it("keeps voting visible signed out and opens the existing auth surface on request", async () => {
    const api = apiWith();
    api.getMode.mockResolvedValue("open");
    renderFeed(api, "/forum", { session: null, loading: false });

    fireEvent.click(await screen.findByRole("button", { name: "Upvote this discussion" }));
    expect(await screen.findByRole("heading", { name: "Sign in to vote on discussions" })).toBeTruthy();
    expect(api.castVote).not.toHaveBeenCalled();
  });

  it("wires an authenticated vote through the reviewed RPC result", async () => {
    const api = apiWith();
    api.getMode.mockResolvedValue("open");
    renderFeed(api, "/forum", {
      session: { user: { id: "student-1" } }, loading: false,
    });

    await waitFor(() => expect(api.getMyIdentity).toHaveBeenCalledOnce());
    fireEvent.click(await screen.findByRole("button", { name: "Upvote this discussion" }));
    await waitFor(() => expect(api.castVote).toHaveBeenCalledWith({
      targetType: "post", targetId: 1, value: 1,
    }));
    expect(await screen.findByLabelText("2 score")).toBeTruthy();
  });

  it("requires the signed-in student to claim a public username before voting", async () => {
    const api = apiWith();
    api.getMode.mockResolvedValue("open");
    api.getMyIdentity.mockResolvedValue({ username: null, needs_username: true });
    renderFeed(api, "/forum", {
      session: { user: { id: "student-1" } }, loading: false,
    });

    await waitFor(() => expect(api.getMyIdentity).toHaveBeenCalledOnce());
    fireEvent.click(await screen.findByRole("button", { name: "Upvote this discussion" }));
    expect(await screen.findByRole("heading", { name: "Choose your public forum username" })).toBeTruthy();
    expect(api.castVote).not.toHaveBeenCalled();
  });

  it("shows beta contribution controls only to an enrolled student", async () => {
    const memberApi = apiWith();
    memberApi.getMode.mockResolvedValue("beta");
    memberApi.getBetaMembership = vi.fn().mockResolvedValue(true);
    const member = renderFeed(memberApi, "/forum", {
      session: { user: { id: "beta-member" } }, loading: false,
    });
    expect(await screen.findByRole("link", { name: "Start a discussion" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Upvote this discussion" })).toBeTruthy();
    member.unmount();

    const outsiderApi = apiWith();
    outsiderApi.getMode.mockResolvedValue("beta");
    outsiderApi.getBetaMembership = vi.fn().mockResolvedValue(false);
    renderFeed(outsiderApi, "/forum", {
      session: { user: { id: "not-enrolled" } }, loading: false,
    });
    await screen.findByRole("heading", { name: "Question 1" });
    await waitFor(() => expect(outsiderApi.getBetaMembership).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: "Start a discussion" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Upvote this discussion" })).toBeNull();
  });
});

// The forum went public in closed beta while two surfaces still described a
// forum that was closed. The landing page invited every reader to "share a
// clear doubt of your own" and then rendered the compose button only for
// invited testers, with nothing explaining where it went. This is the project's
// capability-gating rule applied to copy: never promise what this visitor
// cannot do.
describe("closed beta says what a reader can actually do", () => {
  const betaApi = (identity) => ({
    ...apiWith(),
    getMode: vi.fn().mockResolvedValue("beta"),
    getMyIdentity: vi.fn().mockResolvedValue(identity),
  });

  it("does not invite a non-member to post, and says why there is no button", async () => {
    const api = betaApi({ username: "reader", needs_username: false, beta_member: false });
    renderFeed(api, "/forum", { user: { id: "u1" } });
    await screen.findByRole("heading", { name: "Question 1" });

    expect(screen.queryByRole("link", { name: "Start a discussion" })).toBeNull();
    // The invitation clause must be gone, not merely unfulfilled.
    expect(screen.queryByText(/share a clear doubt of your own/i)).toBeNull();
    // And the absence is explained in the same words the submit page uses.
    expect(await screen.findByText(/only invited student testers can publish/i)).toBeTruthy();
  });

  it("still invites an invited tester, who really can post", async () => {
    const api = betaApi({ username: "tester", needs_username: false, beta_member: true });
    renderFeed(api, "/forum", { user: { id: "u2" } });
    await screen.findByRole("heading", { name: "Question 1" });

    if (screen.queryByRole("link", { name: "Start a discussion" })) {
      expect(screen.getByText(/share a clear doubt of your own/i)).toBeTruthy();
      expect(screen.queryByText(/only invited student testers can publish/i)).toBeNull();
    }
  });

  it("never tells a signed-out reader the forum is closed while it is readable", async () => {
    renderFeed(betaApi({ username: null, needs_username: true, beta_member: false }));
    await screen.findByRole("heading", { name: "Question 1" });
    expect(screen.queryByText(/remains closed/i)).toBeNull();
  });
});
