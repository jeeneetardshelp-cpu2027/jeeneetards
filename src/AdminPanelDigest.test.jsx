// AdminPanelDigest.test.jsx — the one-glance "Pending" strip above the tabs.
//
// The digest is a read-only signpost over the four moderation queues. What
// matters here: each counter renders its own source's number, a broken
// source says "couldn't check" instead of lying with a 0, clicking a counter
// lands on the matching tab, and empty queues read as a quiet nothing.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme.jsx";

const { signOut, adminData, rpc, fromMock } = vi.hoisted(() => ({
  signOut: vi.fn(),
  adminData: {
    channels: [], categories: [], subjects: [], chapters: [], videos: [],
    classLevelRows: [], learningGoals: [], boards: [], error: null, reload: vi.fn(),
  },
  rpc: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "admin-1", email: "admin@example.test" } } },
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut,
    },
    rpc,
    from: fromMock,
  },
}));

vi.mock("./useAdminData", () => ({ useAdminData: () => adminData }));
vi.mock("./ImportPlaylistForm.jsx", () => ({ default: () => <div>Import form</div> }));
// The Reports tab's catalogue queue has its own tests; keep it inert here so
// this file exercises only the digest's own reads.
vi.mock("./useReports.js", () => ({
  useReports: () => ({
    reports: [], loading: false, error: null, reload: vi.fn(), setStatus: vi.fn(),
  }),
}));

import AdminPanel from "./AdminPanel.jsx";
import ModerationDigest from "./ModerationDigest.jsx";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";

// The digest's head-count over content_reports: from().select().eq() → result.
const headCount = (result) => ({
  select: () => ({ eq: () => Promise.resolve(result) }),
});

const forumReportRow = (id) => ({
  id, reporter_id: null, target_type: "post", target_id: id, reason: "spam",
  note: null, priority: "normal", status: "pending",
  created_at: "2026-08-30T00:00:00Z", post_id: id, topic_slug: "physics",
  post_title: "Doubt in kinematics", target_author_username: "student1",
  content_preview: "buy my course", target_exists: true,
  target_is_hidden: false, target_is_deleted: false, post_is_locked: false,
});

const reviewRow = (id, hidden) => ({
  id, playlist_id: 5, playlist_title: "Rectilinear Motion (Kinematics)",
  user_id: `student-${id}`, rating: 4, review: "Clear explanations.",
  review_hidden: hidden, review_hidden_at: hidden ? "2026-08-30T00:00:00Z" : null,
  created_at: "2026-08-30T00:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  fromMock.mockImplementation(() => headCount({ count: 3, error: null }));
  rpc.mockImplementation((fn) => {
    if (fn === "is_admin") return Promise.resolve({ data: true, error: null });
    if (fn === "forum_admin_list_reports")
      return Promise.resolve({ data: [forumReportRow(1), forumReportRow(2)], error: null });
    if (fn === "forum_admin_list_suspensions")
      return Promise.resolve({ data: [], error: null });
    if (fn === "poll_admin_list_pending")
      return Promise.resolve({
        data: [{ id: 9, slug: "best-book", question: "Best book?", detail: null,
                 topic_slug: "physics", topic_name: "Physics", author_username: "student1",
                 created_at: "2026-08-30T00:00:00Z", options: [] }],
        error: null,
      });
    if (fn === "admin_list_reviews")
      return Promise.resolve({
        data: [reviewRow(41, false), reviewRow(42, true), reviewRow(43, false)],
        error: null,
      });
    return Promise.resolve({ data: null, error: null });
  });
});

async function renderPanel() {
  render(
    <ThemeProvider>
      <AdminPanel />
    </ThemeProvider>,
  );
  // The digest strip mounts once the admin check passes.
  return await screen.findByRole("button", { name: /Content reports/ });
}

describe("AdminPanel moderation digest", () => {
  it("shows each queue's pending count from its own source", async () => {
    await renderPanel();

    const content = screen.getByRole("button", { name: /Content reports/ });
    const forum = screen.getByRole("button", { name: /Forum reports/ });
    const polls = screen.getByRole("button", { name: /Poll suggestions/ });
    const reviews = screen.getByRole("button", { name: /Written reviews/ });

    expect(await within(content).findByText("3")).toBeTruthy();
    expect(await within(forum).findByText("2")).toBeTruthy();
    expect(await within(polls).findByText("1")).toBeTruthy();
    // 3 written reviews, 1 already hidden → 2 still visible to students.
    expect(await within(reviews).findByText("2")).toBeTruthy();
  });

  it("shows a failed source as unavailable, never as 0", async () => {
    fromMock.mockImplementation(() =>
      headCount({ count: null, error: { message: "permission denied" } }),
    );
    await renderPanel();

    const content = screen.getByRole("button", { name: /Content reports/ });
    expect(await within(content).findByText(/Couldn't check/)).toBeTruthy();
    expect(within(content).queryByText("0")).toBeNull();

    // The other counters still report their own sources.
    const forum = screen.getByRole("button", { name: /Forum reports/ });
    expect(await within(forum).findByText("2")).toBeTruthy();
  });

  it("jumps to the Polls tab when the poll counter is clicked", async () => {
    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Poll suggestions/ }));
    expect(await screen.findByRole("heading", { name: "Student polls" })).toBeTruthy();
  });

  it("jumps to the Reports tab when the forum counter is clicked", async () => {
    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Forum reports/ }));
    expect(await screen.findByRole("heading", { name: "Forum reports" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Lecture and course reports" })).toBeTruthy();
  });

  it("jumps to the Reviews tab when the reviews counter is clicked", async () => {
    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Written reviews/ }));
    await waitFor(() => {
      expect(screen.getAllByText(/Rectilinear Motion \(Kinematics\)/).length).toBeGreaterThan(0);
    });
  });

  it("renders a quiet nothing-waiting state when every queue is empty", async () => {
    fromMock.mockImplementation(() => headCount({ count: 0, error: null }));
    rpc.mockImplementation((fn) =>
      fn === "is_admin"
        ? Promise.resolve({ data: true, error: null })
        : Promise.resolve({ data: [], error: null }),
    );
    await renderPanel();

    await waitFor(() => {
      expect(screen.getAllByText("Nothing waiting")).toHaveLength(4);
    });
  });

  it("marks an unreleased feature as not released instead of fetching a fake 0", async () => {
    render(
      <ThemeProvider>
        <ModerationDigest
          onOpenTab={vi.fn()}
          features={{ ...RELEASE_FEATURES, polls: false }}
        />
      </ThemeProvider>,
    );

    const polls = screen.getByRole("button", { name: /Poll suggestions/ });
    expect(await within(polls).findByText("Not released yet")).toBeTruthy();
    expect(rpc).not.toHaveBeenCalledWith("poll_admin_list_pending", expect.anything());
  });
});
