import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import ForumBetaAdminPanel from "./ForumBetaAdminPanel.jsx";

const member = {
  username: "student-one",
  added_at: "2026-08-08T05:00:00.000Z",
  added_by_username: "forum-admin",
};

function renderPanel(api) {
  return render(<ThemeProvider><ForumBetaAdminPanel api={api} /></ThemeProvider>);
}

function apiWith({ mode = "off", members = [] } = {}) {
  return {
    getMode: vi.fn().mockResolvedValue(mode),
    listBetaMembers: vi.fn().mockResolvedValue(members),
    setBetaMember: vi.fn().mockResolvedValue(true),
    setMode: vi.fn().mockImplementation((nextMode) => Promise.resolve(nextMode)),
  };
}

describe("forum closed-beta admin controls", () => {
  it("requires a real member and typed confirmation before activation", async () => {
    const api = apiWith();
    renderPanel(api);
    const activate = await screen.findByRole("button", { name: "Activate closed beta" });
    expect(activate.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Activation confirmation"), { target: { value: "BETA" } });
    expect(activate.disabled).toBe(true);
    expect(api.setMode).not.toHaveBeenCalled();
  });

  it("enrolls by existing username, reloads the list and activates only after BETA confirmation", async () => {
    const api = apiWith({ members: [member] });
    renderPanel(api);
    await screen.findByText("@student-one");

    fireEvent.change(screen.getByLabelText("Existing forum username"), { target: { value: "  student-two  " } });
    fireEvent.click(screen.getByRole("button", { name: "Add tester" }));
    await waitFor(() => expect(api.setBetaMember).toHaveBeenCalledWith({ username: "student-two", enabled: true }));

    fireEvent.change(screen.getByLabelText("Activation confirmation"), { target: { value: "BETA" } });
    fireEvent.click(screen.getByRole("button", { name: "Activate closed beta" }));
    await waitFor(() => expect(api.setMode).toHaveBeenCalledWith("beta"));
    expect(screen.getByText(/current mode:/i).textContent).toContain("beta");
  });

  // forum_username_is_allowed() accepts `^[A-Za-z0-9_-]{3,30}$`, so a student
  // can claim `rohit_` or `-deep`. The panel used to require an alphanumeric
  // first and last character and refuse to enrol them, blaming the length.
  it("enrols usernames that start or end with an underscore or hyphen", async () => {
    const api = apiWith();
    renderPanel(api);
    const field = await screen.findByLabelText("Existing forum username");

    for (const username of ["rohit_", "-deep", "a_b-"]) {
      fireEvent.change(field, { target: { value: username } });
      fireEvent.click(screen.getByRole("button", { name: "Add tester" }));
      await waitFor(() => expect(api.setBetaMember)
        .toHaveBeenCalledWith({ username, enabled: true }));
    }
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("still refuses usernames the database would reject on length or characters", async () => {
    const api = apiWith();
    renderPanel(api);
    const field = await screen.findByLabelText("Existing forum username");

    for (const username of ["ab", "a", "has space", "emoji🙂"]) {
      fireEvent.change(field, { target: { value: username } });
      fireEvent.click(screen.getByRole("button", { name: "Add tester" }));
      expect((await screen.findByRole("alert")).textContent).toMatch(/3 to 30/);
    }
    expect(api.setBetaMember).not.toHaveBeenCalled();
  });

  it("removes a member and can stop beta without deleting the membership list", async () => {
    const api = apiWith({ mode: "beta", members: [member] });
    renderPanel(api);
    await screen.findByText("@student-one");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(api.setBetaMember).toHaveBeenCalledWith({ username: "student-one", enabled: false }));

    fireEvent.click(screen.getByRole("button", { name: "Stop closed beta" }));
    await waitFor(() => expect(api.setMode).toHaveBeenCalledWith("off"));
  });

  it("refuses to offer an unreviewed open or read-only mode transition", async () => {
    renderPanel(apiWith({ mode: "open", members: [member] }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/mode changes are locked/i);
    expect(screen.queryByRole("button", { name: /activate|stop closed beta/i })).toBeNull();
  });
});
