import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme.jsx";

const { signOut, adminData } = vi.hoisted(() => ({
  signOut: vi.fn(),
  adminData: {
    channels: [{ id: 3, name: "Competishun" }],
    categories: [],
    subjects: [],
    chapters: [{ id: 6, name: "Newton's Laws of Motion", subject_id: 1 }],
    videos: [],
    classLevelRows: [{ id: 11, slug: "class-11" }],
    learningGoals: [{ id: 1, name: "JEE", slug: "jee" }],
    boards: [],
    error: null,
    reload: vi.fn(),
  },
}));

vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: { id: "admin-1", email: "admin@example.test" },
          },
        },
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { is_admin: true },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

vi.mock("./useAdminData", () => ({
  useAdminData: () => adminData,
}));

vi.mock("./ImportPlaylistForm.jsx", () => ({
  default: () => <div>Import form</div>,
}));

vi.mock("./ManageCatalogPanel.jsx", () => ({
  default: (props) => (
    <div data-testid="manage-catalog">
      {props.channels[0].name}
      {" / "}
      {props.learningGoals[0].name}
      {" / "}
      {props.classLevelRows[0].slug}
      {" / "}
      {props.chapters[0].name}
    </div>
  ),
}));

import AdminPanel from "./AdminPanel.jsx";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminPanel Manage tab", () => {
  it("makes the catalog-management screen reachable with admin reference data", async () => {
    render(
      <ThemeProvider>
        <AdminPanel />
      </ThemeProvider>,
    );

    const manageTab = await screen.findByRole("button", { name: "Manage" });
    fireEvent.click(manageTab);

    await waitFor(() => {
      expect(screen.getByTestId("manage-catalog").textContent).toContain("Competishun");
      expect(screen.getByTestId("manage-catalog").textContent).toContain("JEE");
      expect(screen.getByTestId("manage-catalog").textContent).toContain("class-11");
      expect(screen.getByTestId("manage-catalog").textContent)
        .toContain("Newton's Laws of Motion");
    });
  });
});
