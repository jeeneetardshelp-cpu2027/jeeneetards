import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme.jsx";

const { signOut, adminData, rpc } = vi.hoisted(() => ({
  signOut: vi.fn(),
  adminData: {
    channels: [], categories: [], subjects: [], chapters: [], videos: [],
    classLevelRows: [], learningGoals: [], boards: [], error: null, reload: vi.fn(),
  },
  rpc: vi.fn(),
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
vi.mock("./ImportPlaylistForm.jsx", () => ({ default: () => <div>Import form</div> }));

import AdminPanel from "./AdminPanel.jsx";

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockImplementation((fn) => {
    if (fn === "is_admin") return Promise.resolve({ data: true, error: null });
    if (fn === "admin_list_reviews") {
      return Promise.resolve({
        data: [
          {
            id: 42, playlist_id: 5, playlist_title: "Rectilinear Motion (Kinematics)",
            user_id: "student-1", rating: 4, review: "Clear explanations, could use more practice problems.",
            review_hidden: false, review_hidden_at: null, created_at: "2026-07-30T00:00:00Z",
          },
        ],
        error: null,
      });
    }
    if (fn === "admin_set_review_hidden") return Promise.resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  });
});

async function openReviewsTab() {
  render(
    <ThemeProvider>
      <AdminPanel />
    </ThemeProvider>,
  );
  const tab = await screen.findByRole("button", { name: "Reviews" });
  fireEvent.click(tab);
}

describe("AdminPanel Reviews tab", () => {
  it("shows an empty state when there are no written reviews", async () => {
    rpc.mockImplementation((fn) =>
      fn === "is_admin"
        ? Promise.resolve({ data: true, error: null })
        : Promise.resolve({ data: [], error: null }),
    );
    await openReviewsTab();
    await waitFor(() => {
      expect(screen.getByText("No written reviews yet")).toBeTruthy();
    });
  });

  it("lists a written review with its course, score and text", async () => {
    await openReviewsTab();
    await waitFor(() => {
      expect(screen.getByText(/Rectilinear Motion \(Kinematics\)/)).toBeTruthy();
      expect(screen.getByText(/4\/5/)).toBeTruthy();
      expect(screen.getByText(/Clear explanations/)).toBeTruthy();
    });
    // Not yet hidden: no badge, and the toggle button offers to hide it.
    expect(screen.queryByText("Hidden")).toBeNull();
    expect(screen.getByRole("button", { name: "Hide" })).toBeTruthy();
  });

  it("hides a review through admin_set_review_hidden and reflects it immediately", async () => {
    await openReviewsTab();
    const hideButton = await screen.findByRole("button", { name: "Hide" });
    fireEvent.click(hideButton);

    await waitFor(() => {
      expect(rpc).toHaveBeenCalledWith("admin_set_review_hidden", {
        p_rating_id: 42,
        p_hidden: true,
      });
      expect(screen.getByText("Hidden")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Un-hide" })).toBeTruthy();
    });
  });
});
