import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import PollPage from "./PollPage.jsx";

const SLUG = "which-chapter-feels-hardest-7";

// The shape get_poll() returns. Note vote_count/share are null on every
// option: that is what the server sends to somebody who has not voted.
const unvoted = {
  id: 7,
  slug: SLUG,
  question: "Which chapter feels hardest in mechanics?",
  detail: "Pick the one you keep putting off.",
  topic_slug: "physics",
  topic_name: "Physics",
  author_username: "ravi_student",
  status: "live",
  published_at: "2026-08-20T10:00:00.000Z",
  closes_at: null,
  vote_count: 128,
  comment_count: 2,
  viewer_option_id: null,
  results_visible: false,
  can_vote: true,
  options: [
    { id: 11, position: 1, label: "Rotational motion", image_url: null, vote_count: null, share: null, viewer_choice: false },
    { id: 12, position: 2, label: "Simple harmonic motion", image_url: null, vote_count: null, share: null, viewer_choice: false },
  ],
};

const voted = {
  ...unvoted,
  vote_count: 129,
  viewer_option_id: 11,
  results_visible: true,
  options: [
    { id: 11, position: 1, label: "Rotational motion", image_url: null, vote_count: 90, share: 69.8, viewer_choice: true },
    { id: 12, position: 2, label: "Simple harmonic motion", image_url: null, vote_count: 39, share: 30.2, viewer_choice: false },
  ],
};

const comments = [
  { id: 1, author_username: "meera_student", body: "Rotation, easily.", created_at: "2026-08-21T10:00:00.000Z", edited_at: null, is_mine: false },
  { id: 2, author_username: "ravi_student", body: "SHM once you see the\nspring analogy.", created_at: "2026-08-21T11:00:00.000Z", edited_at: null, is_mine: true },
];

function apiWith(overrides = {}) {
  return {
    getMode: vi.fn().mockResolvedValue("open"),
    getPoll: vi.fn().mockResolvedValue(unvoted),
    getComments: vi.fn().mockResolvedValue(comments),
    castVote: vi.fn().mockResolvedValue(undefined),
    clearVote: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(9),
    deleteComment: vi.fn().mockResolvedValue(undefined),
    report: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const signedIn = { session: { user: { id: "u1" } }, loading: false };
const signedOut = { session: null, loading: false };

function renderPoll(api, authState = signedOut) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[`/polls/${SLUG}`]}>
        <Routes>
          <Route path="/polls/:slug" element={<PollPage api={api} authState={authState} />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("poll page, before voting", () => {
  it("shows the question and options but no percentages", async () => {
    renderPoll(apiWith());
    expect(await screen.findByRole("heading", { name: unvoted.question })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Rotational motion/ })).toBeTruthy();
    expect(screen.queryByText(/%$/)).toBeNull();
    expect(screen.getByText(/Pick an option to see how everyone else answered/)).toBeTruthy();
  });

  it("still shows the total, because how many people answered is not the result", async () => {
    renderPoll(apiWith());
    expect(await screen.findByText("128 votes")).toBeTruthy();
  });

  it("asks a signed-out visitor to sign in instead of silently doing nothing", async () => {
    const api = apiWith();
    renderPoll(api, signedOut);
    fireEvent.click(await screen.findByRole("button", { name: /Rotational motion/ }));
    expect(await screen.findByText(/to vote\./)).toBeTruthy();
    expect(api.castVote).not.toHaveBeenCalled();
  });
});

describe("poll page, voting", () => {
  it("casts the vote and re-reads the poll rather than guessing the new shares", async () => {
    const api = apiWith();
    api.getPoll.mockResolvedValueOnce(unvoted).mockResolvedValue(voted);
    renderPoll(api, signedIn);

    fireEvent.click(await screen.findByRole("button", { name: /Rotational motion/ }));

    await waitFor(() => expect(api.castVote).toHaveBeenCalledWith(7, 11));
    expect(await screen.findByText("70%")).toBeTruthy();
    expect(screen.getByText("30%")).toBeTruthy();
    // The chosen option is marked, and the count came from the reload.
    expect(screen.getByRole("button", { name: /Rotational motion/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("129 votes")).toBeTruthy();
  });

  it("offers to clear a vote once one exists", async () => {
    const api = apiWith({ getPoll: vi.fn().mockResolvedValue(voted) });
    renderPoll(api, signedIn);
    fireEvent.click(await screen.findByRole("button", { name: "Clear my vote" }));
    await waitFor(() => expect(api.clearVote).toHaveBeenCalledWith(7));
  });

  it("explains a refused vote in words a student can act on", async () => {
    const api = apiWith({
      castVote: vi.fn().mockRejectedValue({ code: "P0001", cause: { message: "vote hourly rate limit exceeded" } }),
    });
    renderPoll(api, signedIn);
    fireEvent.click(await screen.findByRole("button", { name: /Rotational motion/ }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("several times just now"),
    );
  });
});

describe("poll page, closed", () => {
  it("shows results to everyone and stops accepting votes", async () => {
    const closed = { ...voted, status: "closed", closes_at: "2026-08-22T10:00:00.000Z" };
    const api = apiWith({ getPoll: vi.fn().mockResolvedValue(closed) });
    renderPoll(api, signedIn);
    expect(await screen.findByText("Closed")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Rotational motion/ }).hasAttribute("disabled")).toBe(true);
  });
});

describe("poll comments", () => {
  it("renders every comment as plain text, keeping the student's line breaks", async () => {
    renderPoll(apiWith());
    expect(await screen.findByText("Rotation, easily.")).toBeTruthy();
    const mine = screen.getByText(/spring analogy/);
    expect(mine.className).toContain("whitespace-pre-line");
  });

  it("offers Delete only on your own comment", async () => {
    renderPoll(apiWith(), signedIn);
    await screen.findByText("Rotation, easily.");
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
  });

  it("posts a comment and refreshes the thread", async () => {
    const api = apiWith();
    renderPoll(api, signedIn);
    const box = await screen.findByLabelText("Add your reasoning");
    fireEvent.change(box, { target: { value: "Rotation, but only the pulley problems." } });
    fireEvent.click(screen.getByRole("button", { name: /Post comment/ }));
    await waitFor(() => expect(api.addComment).toHaveBeenCalledWith(7, "Rotation, but only the pulley problems."));
  });

  it("counts comments from the poll, not from the capped list it loaded", async () => {
    // The poll says 2; pretend the server returned only one row (as it would
    // on a poll with more than 100). The heading must still agree with the
    // number the feed card shows.
    const api = apiWith({ getComments: vi.fn().mockResolvedValue([comments[0]]) });
    renderPoll(api);
    expect(await screen.findByRole("heading", { name: "2 comments" })).toBeTruthy();
    expect(screen.getByText("Showing the 1 most recent.")).toBeTruthy();
  });

  it("asks a signed-out reader to sign in rather than showing a box that cannot submit", async () => {
    renderPoll(apiWith(), signedOut);
    await screen.findByText("Rotation, easily.");
    expect(screen.queryByLabelText("Add your reasoning")).toBeNull();
    expect(screen.getAllByRole("link", { name: "Sign in" }).length).toBeGreaterThan(0);
  });
});

describe("poll page states", () => {
  it("says polls are unavailable rather than erroring when the mode is off", async () => {
    renderPoll(apiWith({ getMode: vi.fn().mockResolvedValue("off") }));
    expect(await screen.findByText("Polls are temporarily unavailable")).toBeTruthy();
  });

  it("explains a missing poll instead of rendering an empty shell", async () => {
    renderPoll(apiWith({ getPoll: vi.fn().mockResolvedValue(null) }));
    expect(await screen.findByRole("heading", { name: "Poll not found" })).toBeTruthy();
  });
});

describe("poll page breadcrumb", () => {
  // The current-page crumb, not the h1: both hold the question once the poll
  // loads, so a plain text query would pass against the old generic "Poll".
  const currentCrumb = () =>
    document.querySelector('[aria-label="Breadcrumb"] [aria-current="page"]');

  it("names the poll once it loads instead of a generic Poll", async () => {
    renderPoll(apiWith());
    await screen.findByRole("heading", { name: unvoted.question });
    expect(currentCrumb().textContent).toBe(unvoted.question);
  });

  it("says Not found for a missing poll", async () => {
    renderPoll(apiWith({ getPoll: vi.fn().mockResolvedValue(null) }));
    await screen.findByRole("heading", { name: "Poll not found" });
    expect(currentCrumb().textContent).toBe("Not found");
  });
});
