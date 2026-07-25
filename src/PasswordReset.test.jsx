import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { ThemeProvider } from "./theme.jsx";

const auth = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));

const sessionState = vi.hoisted(() => ({
  current: null,
}));

vi.mock("./supabaseClient.js", () => ({
  isSupabaseConfigured: true,
  supabase: { auth },
}));

vi.mock("./useSession.js", () => ({
  useSession: () => ({
    session: sessionState.current,
    loading: false,
  }),
}));

import PasswordReset from "./PasswordReset.jsx";

function renderReset(entry = "/reset") {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <PasswordReset />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  sessionState.current = null;
  auth.resetPasswordForEmail.mockReset();
  auth.updateUser.mockReset();
  auth.signOut.mockReset();
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
});

describe("password reset", () => {
  it("requests a recovery email that returns to the reset route", async () => {
    renderReset();

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: " student@example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
        "student@example.com",
        { redirectTo: `${window.location.origin}/reset` },
      );
    });
    expect(screen.getByRole("status").textContent).toContain("reset email");
  });

  it("updates a recovered account and signs it out from the shared device", async () => {
    sessionState.current = {
      user: { id: "student-1", email: "student@example.com" },
    };
    renderReset("/reset#type=recovery");

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(auth.updateUser).toHaveBeenCalledWith({ password: "correct-horse" });
      expect(auth.signOut).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("status").textContent).toContain("signed out");
  });
});
