import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme.jsx";

const { signOut, adminData, rpc, reportsState, setStatus } = vi.hoisted(() => ({
  signOut: vi.fn(),
  adminData: {
    channels: [], categories: [], subjects: [], chapters: [], videos: [],
    classLevelRows: [], learningGoals: [], boards: [], error: null, reload: vi.fn(),
  },
  rpc: vi.fn(),
  reportsState: {
    reports: [
      {
        id: 7, target_type: "video", target_id: 101, reason: "broken",
        note: "Player shows an error at 2:30.", status: "pending",
        created_at: "2026-07-31T00:00:00Z", title: "Rectilinear Motion — Lecture 3",
      },
    ],
    loading: false, error: null,
  },
  setStatus: vi.fn(),
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
  },
}));

vi.mock("./useAdminData", () => ({ useAdminData: () => adminData }));
vi.mock("./useReports.js", () => ({ useReports: () => ({ ...reportsState, setStatus }) }));
vi.mock("./ImportPlaylistForm.jsx", () => ({ default: () => <div>Import form</div> }));

import AdminPanel from "./AdminPanel.jsx";

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockImplementation((fn) =>
    fn === "is_admin" ? Promise.resolve({ data: true, error: null }) : Promise.resolve({ data: null, error: null }),
  );
  reportsState.reports = [
    {
      id: 7, target_type: "video", target_id: 101, reason: "broken",
      note: "Player shows an error at 2:30.", status: "pending",
      created_at: "2026-07-31T00:00:00Z", title: "Rectilinear Motion — Lecture 3",
    },
  ];
  reportsState.loading = false;
  reportsState.error = null;
  setStatus.mockResolvedValue(null);
});

async function openReportsTab() {
  render(
    <ThemeProvider>
      <AdminPanel />
    </ThemeProvider>,
  );
  const tab = await screen.findByRole("button", { name: "Reports" });
  fireEvent.click(tab);
}

describe("AdminPanel Reports tab", () => {
  it("shows an empty state when there are no open reports", async () => {
    reportsState.reports = [];
    await openReportsTab();
    await waitFor(() => {
      expect(screen.getByText("No open reports")).toBeTruthy();
    });
  });

  it("lists a pending report with its reason, target and note", async () => {
    await openReportsTab();
    await waitFor(() => {
      expect(screen.getByText("Video won't play")).toBeTruthy();
      expect(screen.getByText(/Rectilinear Motion — Lecture 3/)).toBeTruthy();
      expect(screen.getByText(/Player shows an error at 2:30/)).toBeTruthy();
    });
  });

  it("resolves a report as Reviewed and disables the buttons while busy", async () => {
    let resolveSetStatus;
    setStatus.mockReturnValue(new Promise((resolve) => { resolveSetStatus = resolve; }));
    await openReportsTab();

    const reviewedButton = await screen.findByRole("button", { name: "Reviewed" });
    const dismissButton = screen.getByRole("button", { name: "Dismiss" });
    fireEvent.click(reviewedButton);

    // Both buttons for this row disable while an action is in flight — not
    // just the one clicked, so a slow request can't be raced by the other.
    expect(reviewedButton.disabled).toBe(true);
    expect(dismissButton.disabled).toBe(true);

    resolveSetStatus(null);
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith(7, "reviewed"));
  });

  it("surfaces an error instead of failing silently when resolving a report fails", async () => {
    setStatus.mockResolvedValue({ message: "network unavailable" });
    await openReportsTab();

    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.getByText(/Couldn't update that report: network unavailable/)).toBeTruthy();
    });
  });
});
