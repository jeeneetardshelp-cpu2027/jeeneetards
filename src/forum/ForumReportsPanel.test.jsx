import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import ForumReportsPanel from "./ForumReportsPanel.jsx";

const urgentReport = {
  id: 8, target_type: "comment", target_id: 91, reason: "self_harm", priority: "urgent",
  note: "Please check this now", post_id: 42, topic_slug: "physics",
  post_title: "A discussion moderators can understand", target_author_username: "student-one",
  content_preview: "The exact reported answer preview.", target_exists: true,
  target_is_hidden: false, target_is_deleted: false, post_is_locked: false,
};

const renderPanel = (api) => render(<ThemeProvider><ForumReportsPanel api={api} /></ThemeProvider>);
const apiFor = (overrides = {}) => ({
  listReports: vi.fn().mockResolvedValue([]),
  listSuspensions: vi.fn().mockResolvedValue([]),
  moderate: vi.fn().mockResolvedValue(null),
  dismissReport: vi.fn().mockResolvedValue(null),
  setSuspension: vi.fn().mockResolvedValue(null),
  ...overrides,
});

describe("forum moderation queue", () => {
  it("shows actionable content context and urgent self-harm handling", async () => {
    const api = apiFor({ listReports: vi.fn().mockResolvedValue([urgentReport]) });
    renderPanel(api);
    expect(await screen.findByText("The exact reported answer preview.")).toBeTruthy();
    expect(screen.getByText(/post #42/)).toBeTruthy();
    expect(screen.getByText("Urgent human review")).toBeTruthy();
    expect(screen.getByText(/never auto-hides content/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hide and resolve" }));
    await waitFor(() => expect(api.moderate).toHaveBeenCalledWith({
      targetType: "comment", targetId: 91, action: "hide",
      reason: "Reviewed forum report", reportId: 8,
    }));
    expect(screen.getByText("No open forum reports")).toBeTruthy();
  });

  it("requires a reason and typed confirmation before permanent removal", async () => {
    const api = apiFor({ listReports: vi.fn().mockResolvedValue([urgentReport]) });
    renderPanel(api);
    fireEvent.click(await screen.findByRole("button", { name: "Permanently remove…" }));
    const confirm = screen.getByRole("button", { name: "Confirm permanent removal" });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Removal reason"), { target: { value: "Personal information" } });
    fireEvent.change(screen.getByLabelText("Type REMOVE to confirm"), { target: { value: "REMOVE" } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(api.moderate).toHaveBeenCalledWith(expect.objectContaining({
      action: "remove", reason: "Personal information", reportId: 8,
    })));
  });

  it("dismisses a missing-target report without inventing a content action", async () => {
    const api = apiFor({
      listReports: vi.fn().mockResolvedValue([{ ...urgentReport, target_exists: false, content_preview: null }]),
    });
    renderPanel(api);
    expect(await screen.findByText(/without changing discussion content/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /resolve|remove/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss report without changing content" }));
    await waitFor(() => expect(api.dismissReport).toHaveBeenCalledWith({ reportId: 8 }));
    expect(screen.getByText("No open forum reports")).toBeTruthy();
  });

  it("does not force an admin to undo an existing hide or lock to resolve a report", async () => {
    const restricted = {
      ...urgentReport, target_type: "post", target_id: 42,
      target_is_hidden: true, post_is_locked: true,
    };
    const api = apiFor({ listReports: vi.fn().mockResolvedValue([restricted]) });
    renderPanel(api);
    const keepHidden = await screen.findByRole("button", { name: "Keep hidden and resolve" });
    expect(screen.getByRole("button", { name: "Restore and resolve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep locked and resolve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unlock and resolve" })).toBeTruthy();
    fireEvent.click(keepHidden);
    await waitFor(() => expect(api.moderate).toHaveBeenCalledWith(expect.objectContaining({
      action: "hide", reportId: 8,
    })));
  });

  it("requires an audit reason before suspending a reported author", async () => {
    const api = apiFor({
      listReports: vi.fn().mockResolvedValue([urgentReport]),
      setSuspension: vi.fn().mockResolvedValue({
        username: "student-one",
        suspended_until: "2026-09-18T00:00:00Z",
        reason: "Repeated bullying",
      }),
    });
    renderPanel(api);
    fireEvent.click(await screen.findByRole("button", { name: "Suspend author…" }));
    const confirm = screen.getByRole("button", { name: "Confirm suspension" });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Moderation reason/), {
      target: { value: "Repeated bullying" },
    });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(api.setSuspension).toHaveBeenCalledWith({
      username: "student-one", days: 7, reason: "Repeated bullying",
    }));
    expect(await screen.findByText(/student-one is suspended for 7 days/i)).toBeTruthy();
  });

  it("keeps a lift control available after the original report leaves the queue", async () => {
    const active = {
      username: "student-one",
      suspended_until: "2026-09-18T00:00:00Z",
      reason: "Repeated bullying",
      created_at: "2026-08-19T00:00:00Z",
      created_by_username: "forum-admin",
      is_active: true,
    };
    const api = apiFor({
      listSuspensions: vi.fn().mockResolvedValue([active]),
      setSuspension: vi.fn().mockResolvedValue({
        username: "student-one", suspended_until: null, reason: null,
      }),
    });
    renderPanel(api);
    expect(await screen.findByText("@student-one")).toBeTruthy();
    expect(screen.getByText("No open forum reports")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Manage suspension…" }));
    fireEvent.change(screen.getByLabelText(/Moderation reason/), {
      target: { value: "Appeal reviewed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lift suspension" }));
    await waitFor(() => expect(api.setSuspension).toHaveBeenCalledWith({
      username: "student-one", days: null, reason: "Appeal reviewed",
    }));
    expect(await screen.findByText("No forum suspensions.")).toBeTruthy();
  });
});
