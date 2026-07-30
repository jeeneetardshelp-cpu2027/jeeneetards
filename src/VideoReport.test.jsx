import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authState: { session: null, loading: false },
  insert: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("./useSession.js", () => ({ useSession: () => mocks.authState }));
vi.mock("./supabaseClient", () => ({
  supabase: {
    from: () => ({ insert: mocks.insert }),
    auth: { signInWithPassword: mocks.signIn, signUp: mocks.signUp },
  },
}));

import { ThemeProvider } from "./theme.jsx";
import { reportErrorMessage, reportUiEnabled, VideoReportForm } from "./VideoReport.jsx";

const show = () => render(
  <ThemeProvider><VideoReportForm videoId={42} videoTitle="Kinematics lecture" /></ThemeProvider>,
);
const open = () => fireEvent.click(screen.getByRole("button", { name: "Report an issue" }));

beforeEach(() => {
  mocks.authState = { session: null, loading: false };
  mocks.insert.mockReset().mockResolvedValue({ error: null });
  mocks.signIn.mockReset().mockResolvedValue({ data: { session: null }, error: null });
  mocks.signUp.mockReset().mockResolvedValue({ data: { session: null }, error: null });
});

describe("signed-in content reporting", () => {
  it("never offers an anonymous submission and explains why sign-in is required", () => {
    show();
    open();
    expect(screen.getByRole("heading", { name: "Sign in to report this lecture" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit report" })).toBeNull();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("shows an honest auth-loading state instead of briefly exposing the form", () => {
    mocks.authState = { session: null, loading: true };
    show();
    open();
    expect(screen.getByRole("status").textContent).toMatch(/checking sign-in/i);
    expect(screen.queryByText("Video won't play")).toBeNull();
  });

  it("requires a reason before writing", () => {
    mocks.authState = { session: { user: { id: "student-1" } }, loading: false };
    show();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    expect(screen.getByRole("alert").textContent).toBe("Pick a reason.");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("submits the authenticated reporter id and accessible selected reason", async () => {
    mocks.authState = { session: { user: { id: "student-1" } }, loading: false };
    show();
    open();
    const reason = screen.getByRole("button", { name: "Video won't play" });
    fireEvent.click(reason);
    expect(reason.getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByLabelText("Additional details (optional)"), {
      target: { value: "Player shows an error." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    expect(mocks.insert).toHaveBeenCalledWith({
      target_type: "video",
      target_id: 42,
      reason: "broken",
      note: "Player shows an error.",
      reporter_id: "student-1",
    });
    expect((await screen.findByRole("status")).textContent).toMatch(/we'll review this lecture/i);
  });

  it("does not expose raw database errors to students", async () => {
    mocks.authState = { session: { user: { id: "student-1" } }, loading: false };
    // The real text raised by enforce_content_report_submission() (see
    // content_reports_hardening_v10.sql) — not a unique-constraint message,
    // since the trigger dedupes via an explicit RAISE EXCEPTION.
    mocks.insert.mockResolvedValue({
      error: { message: "an equivalent report is already pending" },
    });
    show();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Something else" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/already reported/i);
    expect(alert.textContent).not.toMatch(/duplicate key|content_reports/i);
  });

  it("caps notes at the same 1000-character backend limit", () => {
    mocks.authState = { session: { user: { id: "student-1" } }, loading: false };
    show();
    open();
    expect(screen.getByLabelText("Additional details (optional)").maxLength).toBe(1000);
    expect(screen.getByText("0/1000")).toBeTruthy();
  });
});

describe("report error translation", () => {
  it("maps authorization, rate and unknown-target errors to student-safe text", () => {
    expect(reportErrorMessage({ message: "permission denied" })).toMatch(/session expired/i);
    expect(reportErrorMessage({ message: "hourly report limit reached" })).toMatch(/try again later/i);
    // Real trigger text: "unknown video target" / "unknown playlist target"
    // (content_reports_hardening_v10.sql) — always has video/playlist between
    // the two words, so a bare "unknown target" would never actually occur.
    expect(reportErrorMessage({ message: "unknown video target" })).toMatch(/no longer available/i);
    expect(reportErrorMessage({ message: "unknown playlist target" })).toMatch(/no longer available/i);
    expect(reportErrorMessage({ message: "relation details" })).toBe("Couldn't send your report. Please try again.");
  });

  it("maps the real duplicate-pending-report trigger text", () => {
    expect(reportErrorMessage({ message: "an equivalent report is already pending" }))
      .toMatch(/already reported/i);
  });
});

describe("report preview gate", () => {
  it("permits only an exact local-development preview or an explicit release", () => {
    expect(reportUiEnabled({ released: false, development: false, search: "?previewReports=1" })).toBe(false);
    expect(reportUiEnabled({ released: false, development: true, search: "?previewReports=1" })).toBe(true);
    expect(reportUiEnabled({ released: false, development: true, search: "?previewReports=true" })).toBe(false);
    expect(reportUiEnabled({ released: true, development: false, search: "" })).toBe(true);
  });
});
