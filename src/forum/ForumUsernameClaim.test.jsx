import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import { ForumApiError } from "./forumApi.js";
import ForumUsernameClaim from "./ForumUsernameClaim.jsx";

describe("forum username claim", () => {
  it("checks the public format before calling the claim RPC", () => {
    const api = { claimUsername: vi.fn() };
    render(<ThemeProvider><ForumUsernameClaim api={api} onClaimed={vi.fn()} /></ThemeProvider>);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "bad name" } });
    fireEvent.click(screen.getByRole("button", { name: "Claim username" }));
    expect(api.claimUsername).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/3–30/);
  });

  it("shows a friendly collision and succeeds without exposing database detail", async () => {
    const onClaimed = vi.fn();
    const api = {
      claimUsername: vi.fn()
        .mockRejectedValueOnce(new ForumApiError("Could not claim", {
          code: "23505", cause: { message: "duplicate key profiles_username_key secret" },
        }))
        .mockResolvedValueOnce("physics-helper"),
    };
    render(<ThemeProvider><ForumUsernameClaim api={api} onClaimed={onClaimed} /></ThemeProvider>);
    const input = screen.getByLabelText("Username");
    fireEvent.change(input, { target: { value: "physics-helper" } });
    fireEvent.click(screen.getByRole("button", { name: "Claim username" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already taken/i);
    expect(screen.getByRole("alert").textContent).not.toMatch(/profiles_username|secret/i);

    fireEvent.click(screen.getByRole("button", { name: "Claim username" }));
    await waitFor(() => expect(onClaimed).toHaveBeenCalledWith("physics-helper"));
  });
});
