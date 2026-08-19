import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import { ForumApiError } from "./forumApi.js";
import ForumUsernameClaim from "./ForumUsernameClaim.jsx";

function showClaim(api, onClaimed = vi.fn()) {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <ForumUsernameClaim api={api} onClaimed={onClaimed} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("forum username claim", () => {
  it("checks the public format before calling the claim RPC", () => {
    const api = { claimUsername: vi.fn() };
    showClaim(api);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "bad name" } });
    fireEvent.submit(screen.getByRole("button", { name: "Claim username" }).closest("form"));
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
    showClaim(api, onClaimed);
    const input = screen.getByLabelText("Username");
    fireEvent.change(input, { target: { value: "physics-helper" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I have reviewed and agree/i }));
    fireEvent.click(screen.getByRole("button", { name: "Claim username" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/already taken/i);
    expect(screen.getByRole("alert").textContent).not.toMatch(/profiles_username|secret/i);

    fireEvent.click(screen.getByRole("button", { name: "Claim username" }));
    await waitFor(() => expect(onClaimed).toHaveBeenCalledWith("physics-helper"));
  });

  it("requires the approved Forum Rules acknowledgement before the RPC", () => {
    const api = { claimUsername: vi.fn() };
    showClaim(api);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "physics-helper" } });
    fireEvent.submit(screen.getByRole("button", { name: "Claim username" }).closest("form"));

    expect(api.claimUsername).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/accept the Forum Rules/i);
    expect(screen.getByRole("link", { name: "Terms of Service" }).getAttribute("href"))
      .toBe("/terms#forum-rules");
  });
});
