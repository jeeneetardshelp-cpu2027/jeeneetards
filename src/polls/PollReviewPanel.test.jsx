import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import PollReviewPanel from "./PollReviewPanel.jsx";

const PENDING = [
  {
    id: 12,
    slug: "which-diagram-is-correct-12",
    question: "Which free body diagram is correct?",
    detail: "From the Class 11 mechanics chapter.",
    topic_slug: "physics",
    topic_name: "Physics",
    author_username: "ravi_2027",
    created_at: "2026-08-25T10:00:00.000Z",
    options: [
      { id: 101, position: 1, label: "Diagram A", image_url: "https://i.ytimg.com/vi/aaa/hqdefault.jpg" },
      { id: 102, position: 2, label: "Diagram B", image_url: "https://i.ytimg.com/vi/bbb/hqdefault.jpg" },
      { id: 103, position: 3, label: "Neither", image_url: null },
    ],
  },
];

const REPORTS = [
  {
    id: 71,
    target_type: "comment",
    poll_id: 12,
    poll_slug: "which-diagram-is-correct-12",
    poll_question: "Which free body diagram is correct?",
    comment_id: 900,
    comment_body: "You are all idiots.",
    comment_removed: false,
    reporter_username: "meera_neet",
    reason: "abuse",
    detail: "Name calling.",
    status: "open",
    created_at: "2026-08-25T12:00:00.000Z",
  },
  {
    id: 72,
    target_type: "poll",
    poll_id: 12,
    poll_slug: "which-diagram-is-correct-12",
    poll_question: "Which free body diagram is correct?",
    comment_id: null,
    comment_body: null,
    comment_removed: null,
    reporter_username: "another_student",
    reason: "off_topic",
    detail: null,
    status: "open",
    created_at: "2026-08-25T13:00:00.000Z",
  },
];

function apiWith(overrides = {}) {
  return {
    getMode: vi.fn().mockResolvedValue("off"),
    adminSetMode: vi.fn().mockImplementation(async (mode) => mode),
    adminListPending: vi.fn().mockResolvedValue(PENDING),
    adminListReports: vi.fn().mockResolvedValue(REPORTS),
    adminReview: vi.fn().mockResolvedValue("approve"),
    adminSetStatus: vi.fn().mockResolvedValue("hidden"),
    adminSetCommentRemoved: vi.fn().mockResolvedValue(undefined),
    adminResolveReport: vi.fn().mockResolvedValue(undefined),
    adminCloseExpired: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function renderPanel(api) {
  return render(
    <ThemeProvider>
      <PollReviewPanel api={api} />
    </ThemeProvider>,
  );
}

// A report about a poll repeats that poll's question, so an unscoped query for
// it matches the queue AND every report row. Scoping to the labelled section
// is what an admin's eye does anyway, and it checks the sections really are
// labelled landmarks.
const queue = async () =>
  within(await screen.findByRole("region", { name: /Waiting for review/ }));
const reports = async () =>
  within(await screen.findByRole("region", { name: /Reported poll content/ }));

describe("the review queue", () => {
  it("shows the question, who wrote it, and every option", async () => {
    renderPanel(apiWith());
    const q = await queue();
    expect(q.getByText("Which free body diagram is correct?")).toBeTruthy();
    expect(q.getByText(/by ravi_2027/)).toBeTruthy();
    expect(q.getByText(/1\. Diagram A/)).toBeTruthy();
    expect(q.getByText(/3\. Neither/)).toBeTruthy();
    expect(screen.getByText("Waiting for review (1)")).toBeTruthy();
  });

  it("RENDERS each submitted picture, because checking a link means looking at it", async () => {
    renderPanel(apiWith());
    const q = await queue();
    const images = q.getAllByRole("img");
    // Two, not three: the text-only option has nothing to look at.
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute("src")).toBe("https://i.ytimg.com/vi/aaa/hqdefault.jpg");
    expect(images[0].getAttribute("alt")).toBe("Option 1: Diagram A");
    expect(q.getByText(/Look at each picture before approving/)).toBeTruthy();
  });

  it("approves with no note and no closing date by default", async () => {
    const api = apiWith();
    renderPanel(api);
    fireEvent.click(await screen.findByRole("button", { name: /Approve and publish/ }));
    await waitFor(() => expect(api.adminReview).toHaveBeenCalledWith(12, "approve", null, null));
    // The queue is re-read, so an approved poll leaves the list.
    expect(api.adminListPending).toHaveBeenCalledTimes(2);
  });

  it("passes a closing date through as an ISO timestamp", async () => {
    const api = apiWith();
    renderPanel(api);
    await queue();
    fireEvent.change(screen.getByLabelText(/Close voting at/), {
      target: { value: "2026-09-01T18:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Approve and publish/ }));

    await waitFor(() => expect(api.adminReview).toHaveBeenCalled());
    const [, , , closesAt] = api.adminReview.mock.calls[0];
    expect(closesAt).toBe(new Date("2026-09-01T18:30").toISOString());
  });

  it("sends the rejection note the student will read", async () => {
    const api = apiWith();
    renderPanel(api);
    await queue();
    fireEvent.change(screen.getByLabelText(/Note to the student/), {
      target: { value: "Not about exam preparation." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Reject/ }));

    await waitFor(() => expect(api.adminReview).toHaveBeenCalledWith(
      12, "reject", "Not about exam preparation.", null,
    ));
  });

  it("surfaces the server's refusal to reject silently, in plain words", async () => {
    const api = apiWith({
      adminReview: vi.fn().mockRejectedValue({
        code: "22023", cause: { message: "a rejection needs a short reason" },
      }),
    });
    renderPanel(api);
    fireEvent.click(await screen.findByRole("button", { name: /Reject/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/short reason/);
  });

  it("says so plainly when there is nothing waiting", async () => {
    renderPanel(apiWith({ adminListPending: vi.fn().mockResolvedValue([]) }));
    expect(await screen.findByText(/Nothing waiting/)).toBeTruthy();
  });
});

describe("the poll mode switch", () => {
  it("opens polls and explains what the chosen mode means", async () => {
    const api = apiWith();
    renderPanel(api);
    expect(await screen.findByText(/Nothing is readable/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => expect(api.adminSetMode).toHaveBeenCalledWith("open"));
    expect(await screen.findByText(/Voting, comments and submissions are live/)).toBeTruthy();
  });

  it("says the flag is not the real switch", async () => {
    renderPanel(apiWith());
    expect(await screen.findByText(/The release flag only decides whether the pages are routed/)).toBeTruthy();
  });
});

describe("expired polls", () => {
  it("says plainly when there is nothing to close, rather than implying it acted", async () => {
    const api = apiWith();
    renderPanel(api);
    fireEvent.click(await screen.findByRole("button", { name: /Close expired polls/ }));
    await waitFor(() => expect(api.adminCloseExpired).toHaveBeenCalled());
    expect(await screen.findByText(/Nothing to close/)).toBeTruthy();
  });

  it("reports how many it closed, and which", async () => {
    const api = apiWith({
      adminCloseExpired: vi.fn().mockResolvedValue([
        { id: 3, question: "Which chapter is hardest?", closed_at: "2026-08-30T10:00:00.000Z" },
        { id: 4, question: "How many hours do you study?", closed_at: "2026-08-30T11:00:00.000Z" },
      ]),
    });
    renderPanel(api);
    fireEvent.click(await screen.findByRole("button", { name: /Close expired polls/ }));
    expect(await screen.findByText(/Closed 2 polls/)).toBeTruthy();
    expect(screen.getByText(/Which chapter is hardest\?/)).toBeTruthy();
  });

  it("explains that closing is only housekeeping, not what stops the voting", async () => {
    renderPanel(apiWith());
    expect(await screen.findByText(/already stops taking votes/)).toBeTruthy();
  });

  it("surfaces a refusal instead of silently doing nothing", async () => {
    const api = apiWith({
      adminCloseExpired: vi.fn().mockRejectedValue({
        code: "42501", cause: { message: "admin only" },
      }),
    });
    renderPanel(api);
    fireEvent.click(await screen.findByRole("button", { name: /Close expired polls/ }));
    expect(await screen.findByText(/session may have expired|Could not close/)).toBeTruthy();
  });
});

describe("reported content", () => {
  it("shows the reported comment and the poll it sits under", async () => {
    renderPanel(apiWith());
    const r = await reports();
    expect(r.getByText(/You are all idiots\./)).toBeTruthy();
    expect(r.getByText(/Note: Name calling\./)).toBeTruthy();
    expect(r.getAllByText("Which free body diagram is correct?")).toHaveLength(2);
    expect(screen.getByText("Reported poll content (2)")).toBeTruthy();
  });

  it("hides a comment and resolves its report in one action", async () => {
    const api = apiWith();
    renderPanel(api);
    fireEvent.click(await screen.findByRole("button", { name: /Hide comment/ }));

    await waitFor(() => expect(api.adminSetCommentRemoved).toHaveBeenCalledWith(900, true));
    expect(api.adminResolveReport).toHaveBeenCalledWith(71, "actioned");
  });

  it("takes a reported poll down and resolves its report in one action", async () => {
    const api = apiWith();
    renderPanel(api);
    fireEvent.click(await screen.findByRole("button", { name: /Take poll down/ }));

    await waitFor(() => expect(api.adminSetStatus).toHaveBeenCalledWith(12, "hidden"));
    expect(api.adminResolveReport).toHaveBeenCalledWith(72, "actioned");
  });

  it("dismisses a report without touching the content", async () => {
    const api = apiWith();
    renderPanel(api);
    await screen.findByText(/You are all idiots\./);
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);

    await waitFor(() => expect(api.adminResolveReport).toHaveBeenCalledWith(71, "dismissed"));
    expect(api.adminSetCommentRemoved).not.toHaveBeenCalled();
    expect(api.adminSetStatus).not.toHaveBeenCalled();
  });

  it("offers no Hide control for a comment already hidden", async () => {
    const api = apiWith({
      adminListReports: vi.fn().mockResolvedValue([{ ...REPORTS[0], comment_removed: true }]),
    });
    renderPanel(api);
    await screen.findByText(/You are all idiots\./);
    expect(screen.queryByRole("button", { name: /Hide comment/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
  });
});
