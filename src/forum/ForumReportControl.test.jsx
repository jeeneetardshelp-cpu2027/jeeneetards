import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import { ForumApiError } from "./forumApi.js";
import ForumReportControl, { forumReportError } from "./ForumReportControl.jsx";

const signedIn = { session: { user: { id: "student-1" } }, loading: false };

function renderControl(api, authState = signedIn) {
  return render(
    <ThemeProvider>
      <ForumReportControl targetType="post" targetId={42} api={api} authState={authState} />
    </ThemeProvider>,
  );
}

describe("forum report control", () => {
  it("separates self-harm from ordinary reasons and confirms urgent routing distinctly", async () => {
    const api = { submitReport: vi.fn().mockResolvedValue(9) };
    renderControl(api);
    fireEvent.click(screen.getByRole("button", { name: "Report this discussion" }));

    expect(screen.getByText("Immediate safety concern")).toBeTruthy();
    expect(screen.getByText(/goes to urgent human review and is excluded from automatic hiding/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Self-harm or suicide concern"));
    expect(screen.getByRole("note").textContent).toMatch(/not an emergency service/i);
    fireEvent.change(screen.getByLabelText(/Additional details/i), { target: { value: "Please review quickly" } });
    fireEvent.click(screen.getByRole("button", { name: "Send urgent concern" }));

    await waitFor(() => expect(api.submitReport).toHaveBeenCalledWith({
      targetType: "post", targetId: 42, reason: "self_harm", note: "Please review quickly",
    }));
    expect(await screen.findByText("Sent for urgent human review")).toBeTruthy();
    expect(screen.getByText(/does not automatically hide the discussion/i)).toBeTruthy();
  });

  it("uses the generic outcome for ordinary reports", async () => {
    const api = { submitReport: vi.fn().mockResolvedValue(10) };
    renderControl(api);
    fireEvent.click(screen.getByRole("button", { name: "Report this discussion" }));
    fireEvent.click(screen.getByLabelText("Spam or promotion"));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(await screen.findByText("Report received")).toBeTruthy();
    expect(screen.getByText(/do not disclose moderation outcomes/i)).toBeTruthy();
    expect(screen.queryByText("Sent for urgent human review")).toBeNull();
  });

  it("reuses the existing student sign-in surface", () => {
    renderControl({ submitReport: vi.fn() }, { session: null, loading: false });
    fireEvent.click(screen.getByRole("button", { name: "Report this discussion" }));
    expect(screen.getByRole("heading", { name: "Sign in to report this discussion" })).toBeTruthy();
  });

  it("keeps database errors student-safe", async () => {
    const api = { submitReport: vi.fn().mockRejectedValue(new ForumApiError("Could not send", {
      code: "P0001", cause: { message: "report hourly rate limit exceeded" },
    })) };
    renderControl(api);
    fireEvent.click(screen.getByRole("button", { name: "Report this discussion" }));
    fireEvent.click(screen.getByLabelText("Off topic"));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/several reports recently/i);
  });

  it("maps duplicate, target, session and length failures", () => {
    expect(forumReportError({ cause: { message: "already pending" } })).toMatch(/already reported/i);
    expect(forumReportError({ cause: { message: "report target is unavailable" } })).toMatch(/no longer available/i);
    expect(forumReportError({ cause: { message: "permission denied" } })).toMatch(/session expired/i);
    expect(forumReportError({ cause: { message: "limited to 1000 characters" } })).toMatch(/1000/i);
  });
});
