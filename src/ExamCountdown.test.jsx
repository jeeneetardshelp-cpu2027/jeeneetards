// ExamCountdown band: the provenance line always accompanies the number, the
// share text carries a link home, and the band disappears rather than showing
// a stale or negative countdown once every exam has passed.
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme.jsx";
import ExamCountdown, { shareMessage } from "./ExamCountdown.jsx";
import { findExam, examCountdown } from "./examCalendar.js";

const renderBand = () => render(<ThemeProvider><ExamCountdown /></ThemeProvider>);

beforeEach(() => {
  // Fixed "today" well before the seeded 2027 exams, so the band has content.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-01T09:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

describe("ExamCountdown", () => {
  it("shows the soonest exam with its number and, always, its provenance", () => {
    renderBand();
    expect(screen.getByRole("heading", { name: "Days to go" })).toBeTruthy();
    expect(screen.getByText(/to JEE Main 2027 \(Session 1\)/)).toBeTruthy();
    // Approximate today, so the band must say so and name the authority.
    expect(screen.getByText("about")).toBeTruthy();
    expect(screen.getByText(/NTA has not announced dates yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Official NTA site/ }).getAttribute("href"))
      .toBe("https://jeemain.nta.nic.in/");
  });

  it("switches lane when another exam is chosen", () => {
    renderBand();
    fireEvent.click(screen.getByRole("button", { name: "NEET" }));
    expect(screen.getByText(/to NEET UG 2027/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "NEET" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("copies a share message carrying the exam and a link home", async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    renderBand();

    // writeText is invoked synchronously inside the click handler (the await
    // is on its result), so no waitFor â€” which deadlocks under fake timers.
    fireEvent.click(screen.getByRole("button", { name: /Share countdown/ }));
    expect(writeText).toHaveBeenCalled();
    const text = writeText.mock.calls[0][0];
    expect(text).toContain("JEE Main 2027 (Session 1)");
    expect(text).toMatch(/^About \d+ days to /);
    expect(text).toContain("localhost");
  });

  it("renders nothing once every seeded exam is in the past", () => {
    vi.setSystemTime(new Date("2030-01-01T09:00:00Z"));
    const { container } = renderBand();
    expect(container.querySelector("section")).toBeNull();
  });
});

describe("shareMessage", () => {
  const exam = findExam("neet-ug-2027");

  it("carries the not-announced caveat with the number", () => {
    const text = shareMessage(exam, examCountdown(exam, new Date("2026-09-01T09:00:00Z")), "https://x.test");
    // The on-page band prints "not announced yet". A number shared into a batch
    // group without it is a guess wearing the clothes of a fact.
    expect(text).toMatch(/has not announced dates yet/);
    expect(text).toContain(exam.expectedLabel);
  });

  it("adds no caveat to an announced exam", () => {
    const announced = { ...exam, status: "announced", date: "2027-05-02" };
    const text = shareMessage(announced, examCountdown(announced, new Date("2027-05-01T09:00:00Z")), "https://x.test");
    expect(text).not.toMatch(/has not announced dates yet/);
  });

  it("marks an approximate count and never claims precision it lacks", () => {
    const text = shareMessage(exam, examCountdown(exam, new Date("2026-09-01T09:00:00Z")), "https://x.test");
    expect(text).toMatch(/^About \d+ days to NEET UG 2027\./);
    expect(text).toContain("https://x.test/");
  });

  it("drops the hedge for an announced exam and handles exam day", () => {
    const announced = { ...exam, status: "announced", date: "2027-05-02" };
    const text = shareMessage(announced, examCountdown(announced, new Date("2027-05-01T09:00:00Z")), "https://x.test");
    expect(text).toMatch(/^1 day to /);
    expect(text).not.toMatch(/^About/);
    const today = shareMessage(announced, examCountdown(announced, new Date("2027-05-02T09:00:00Z")), "https://x.test");
    expect(today).toMatch(/^Today to /);
  });
});

