// PollOfTheDay: a homepage teaser that must stay COMPLETELY inert until the
// polls release flag flips. Today the flag is off, so the card renders
// nothing and — just as important — sends no request: a dormant teaser must
// not cost every homepage visit a doomed RPC.
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme.jsx";
import PollOfTheDay, { pickOpenPoll } from "./PollOfTheDay.jsx";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";

const OPEN_POLL = {
  id: 1, slug: "best-physics-teacher", question: "Which teacher explains rotation best?",
  status: "open", closes_at: null, vote_count: 12, comment_count: 3,
};

function fakeApi({ feed = [OPEN_POLL], mode = "open", fail = false } = {}) {
  return {
    getMode: vi.fn(async () => mode),
    getFeed: vi.fn(async () => {
      if (fail) throw new Error("Could not load polls.");
      return feed;
    }),
    getTopics: vi.fn(async () => []),
  };
}

const show = (props) => render(
  <ThemeProvider>
    <MemoryRouter>
      <PollOfTheDay {...props} />
    </MemoryRouter>
  </ThemeProvider>,
);

afterEach(() => cleanup());

describe("PollOfTheDay while the flag is off", () => {
  it("renders nothing and calls nothing", () => {
    // Injects the off state rather than asserting the LIVE flag value. The
    // original pinned `RELEASE_FEATURES.polls === false`, which made this test
    // fail the moment the flag was legitimately flipped on — a red test on a
    // correct system. What matters is the behaviour: flag off means inert.
    const api = fakeApi();
    const { container } = show({ features: { polls: false }, api });
    expect(container.querySelector("section")).toBeNull();
    expect(api.getMode).not.toHaveBeenCalled();
    expect(api.getFeed).not.toHaveBeenCalled();
  });

  it("uses the real release flag when none is injected", async () => {
    // The default really is RELEASE_FEATURES, so a future flip genuinely
    // changes the homepage — without this, every test could pass while the
    // component ignored the flag entirely.
    const api = fakeApi();
    show({ api });
    if (RELEASE_FEATURES.polls) {
      await waitFor(() => expect(api.getMode).toHaveBeenCalled());
    } else {
      expect(api.getMode).not.toHaveBeenCalled();
    }
  });
});

describe("PollOfTheDay once the flag flips", () => {
  it("shows the newest open poll as a link card", async () => {
    const api = fakeApi();
    show({ features: { polls: true }, api });

    expect(await screen.findByText("Which teacher explains rotation best?")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Today's poll" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Answer it/ }).getAttribute("href"))
      .toBe("/polls/best-physics-teacher");
  });

  it("renders nothing when every poll is closed", async () => {
    const api = fakeApi({ feed: [{ ...OPEN_POLL, status: "closed" }] });
    const { container } = show({ features: { polls: true }, api });
    await waitFor(() => expect(api.getFeed).toHaveBeenCalled());
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders nothing when the feed fails — no error state on a teaser", async () => {
    const api = fakeApi({ fail: true });
    const { container } = show({ features: { polls: true }, api });
    await waitFor(() => expect(api.getFeed).toHaveBeenCalled());
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders nothing while the database keeps polls switched off", async () => {
    const api = fakeApi({ mode: "off" });
    const { container } = show({ features: { polls: true }, api });
    await waitFor(() => expect(api.getMode).toHaveBeenCalled());
    expect(container.querySelector("section")).toBeNull();
    // Mode "off" short-circuits before the feed is ever requested.
    expect(api.getFeed).not.toHaveBeenCalled();
  });
});

describe("pickOpenPoll", () => {
  it("skips closed and expired polls, takes the first still open", () => {
    const expired = { ...OPEN_POLL, id: 2, slug: "old", closes_at: "2020-01-01T00:00:00Z" };
    const closed = { ...OPEN_POLL, id: 3, slug: "done", status: "closed" };
    const open = { ...OPEN_POLL, id: 4, slug: "live" };
    expect(pickOpenPoll([closed, expired, open])?.slug).toBe("live");
    expect(pickOpenPoll([closed, expired])).toBeNull();
    expect(pickOpenPoll([])).toBeNull();
    expect(pickOpenPoll(null)).toBeNull();
  });
});
