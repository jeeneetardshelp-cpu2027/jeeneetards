// The shared ShareControl: one control, three paths (share sheet, WhatsApp,
// clipboard), used by both the polls and the course watch page. What matters
// and is guarded here: the wa.me link must carry the message AND the URL, the
// share sheet must be preferred when the device has one, a closed sheet must
// stay silent, and the polls wrapper must keep its original wording.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ShareControl from "./ShareControl.jsx";
import PollShareControl, { pollShareUrl } from "./polls/ShareControl.jsx";

const URL_ = "https://www.jeeneetard.com/course/374?ref=share";
const TEXT = "Watch Physics free on JEENEETARD";

afterEach(() => vi.unstubAllGlobals());

describe("<ShareControl>", () => {
  it("builds a wa.me link carrying the message and then the URL", () => {
    render(<ShareControl url={URL_} title="Physics" text={TEXT} />);
    const link = screen.getByRole("link", { name: "Share this page on WhatsApp" });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/?text=${encodeURIComponent(`${TEXT} ${URL_}`)}`,
    );
  });

  it("names its subject in the assistive labels", () => {
    render(<ShareControl url={URL_} text={TEXT} subject="this course" />);
    expect(screen.getByRole("link", { name: "Share this course on WhatsApp" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy a link to this course" })).toBeTruthy();
  });

  it("prefers the device share sheet when one exists", () => {
    const share = vi.fn(() => Promise.resolve());
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });

    render(<ShareControl url={URL_} title="Physics" text={TEXT} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(share).toHaveBeenCalledWith({ title: "Physics", text: TEXT, url: URL_ });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to copying the link, with visible confirmation", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    // No navigator.share in this environment — the desktop path.
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<ShareControl url={URL_} text={TEXT} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    expect(await screen.findByRole("button", { name: "Link copied" })).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(URL_);
  });

  it("stays silent when the student closes the share sheet", async () => {
    const abort = Object.assign(new Error("closed"), { name: "AbortError" });
    const share = vi.fn(() => Promise.reject(abort));
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });

    render(<ShareControl url={URL_} text={TEXT} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByRole("button", { name: "Share" });

    // A closed sheet is not a failure: no copy, no confirmation.
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Link copied" })).toBeNull();
  });
});

describe("polls wrapper", () => {
  beforeEach(() => vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } }));

  it("keeps the original poll wording", () => {
    render(<PollShareControl url={pollShareUrl("best-teacher-7")} text="Best teacher?" />);
    expect(screen.getByRole("link", { name: "Share this poll on WhatsApp" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy a link to this poll" })).toBeTruthy();
  });

  it("still builds the poll URL from the slug", () => {
    expect(pollShareUrl("best-teacher-7", "https://www.jeeneetard.com"))
      .toBe("https://www.jeeneetard.com/polls/best-teacher-7");
  });
});
