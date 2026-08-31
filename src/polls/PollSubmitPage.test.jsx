import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import PollSubmitPage, { imageLinkProblem } from "./PollSubmitPage.jsx";

const TOPICS = [
  { slug: "physics", name: "Physics", kind: "academic", description: null },
  { slug: "strategy", name: "Strategy", kind: "non_academic", description: null },
];

function apiWith(overrides = {}) {
  return {
    getMode: vi.fn().mockResolvedValue("open"),
    getTopics: vi.fn().mockResolvedValue(TOPICS),
    getMySubmissions: vi.fn().mockResolvedValue([]),
    submitPoll: vi.fn().mockResolvedValue(31),
    ...overrides,
  };
}

const signedIn = { session: { user: { id: "u1" } }, loading: false };
const signedOut = { session: null, loading: false };

function renderPage(api, authState = signedIn) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/polls/new"]}>
        <PollSubmitPage api={api} authState={authState} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

// Fill in the minimum a valid submission needs.
async function fillValidPoll() {
  fireEvent.change(await screen.findByLabelText("Subject"), { target: { value: "physics" } });
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: "Which chapter feels hardest in mechanics?" },
  });
  fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "Rotational motion" } });
  fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "Simple harmonic motion" } });
}

describe("imageLinkProblem", () => {
  it("accepts the approved hosts", () => {
    expect(imageLinkProblem("https://i.ytimg.com/vi/abc/hqdefault.jpg")).toBeNull();
    expect(imageLinkProblem("https://upload.wikimedia.org/w/x.png")).toBeNull();
  });

  it("accepts an empty value, because a picture is optional", () => {
    expect(imageLinkProblem("")).toBeNull();
    expect(imageLinkProblem(null)).toBeNull();
  });

  it("refuses http, an unknown host, and a look-alike host", () => {
    expect(imageLinkProblem("http://i.ytimg.com/x.jpg")).toMatch(/https/);
    expect(imageLinkProblem("https://evil.example/x.png")).toMatch(/can only come from/);
    // A host that merely CONTAINS an approved name is still refused.
    expect(imageLinkProblem("https://i.ytimg.com.evil.example/x.png")).toMatch(/can only come from/);
  });

  it("mirrors the SQL host rule: rejects userinfo, ports and an uppercase host", () => {
    // These are exactly the forms the server's regex rejects; the client must
    // agree so the student is told BEFORE submitting, not after a raw 500.
    expect(imageLinkProblem("https://i.ytimg.com:80@evil.com/x.png")).toBeTruthy();
    expect(imageLinkProblem("https://i.ytimg.com@evil.com/x.png")).toBeTruthy();
    expect(imageLinkProblem("HTTPS://I.YTIMG.COM/x.png")).toMatch(/https/);
    // A lowercase-scheme but uppercase-host URL that new URL() would have
    // silently normalized-and-accepted is now refused, matching the server.
    expect(imageLinkProblem("https://I.YTIMG.COM/x.png")).toBeTruthy();
  });

  it("refuses something that is not a link at all", () => {
    expect(imageLinkProblem("https://")).toMatch(/unusual host/);
  });
});

describe("suggesting a poll", () => {
  it("tells the student an admin reviews it before the first field, not after", async () => {
    renderPage(apiWith());
    expect(await screen.findByRole("heading", { name: "Suggest a poll" })).toBeTruthy();
    expect(screen.getByText(/An admin checks it before it goes live/)).toBeTruthy();
  });

  it("keeps the submit button disabled until the poll is actually valid", async () => {
    renderPage(apiWith());
    const submit = await screen.findByRole("button", { name: /Send for review/ });
    expect(submit.hasAttribute("disabled")).toBe(true);

    // A question alone is not enough — options are still empty.
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "physics" } });
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "Which chapter feels hardest in mechanics?" },
    });
    expect(submit.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "Rotational motion" } });
    fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "SHM" } });
    expect(submit.hasAttribute("disabled")).toBe(false);
  });

  it("sends trimmed values, and a null picture rather than an empty string", async () => {
    const api = apiWith();
    renderPage(api);
    await fillValidPoll();
    fireEvent.click(screen.getByRole("button", { name: /Send for review/ }));

    await waitFor(() => expect(api.submitPoll).toHaveBeenCalledTimes(1));
    expect(api.submitPoll).toHaveBeenCalledWith({
      topic: "physics",
      question: "Which chapter feels hardest in mechanics?",
      detail: null,
      options: [
        { label: "Rotational motion", image_url: null },
        { label: "Simple harmonic motion", image_url: null },
      ],
    });
  });

  it("confirms the poll is queued rather than published", async () => {
    renderPage(apiWith());
    await fillValidPoll();
    fireEvent.click(screen.getByRole("button", { name: /Send for review/ }));
    expect(await screen.findByRole("heading", { name: "Sent for review" })).toBeTruthy();
  });

  it("blocks a picture from an unapproved host before it ever reaches the server", async () => {
    const api = apiWith();
    renderPage(api);
    await fillValidPoll();

    fireEvent.click(screen.getAllByRole("button", { name: "Add a picture" })[0]);
    fireEvent.change(screen.getByLabelText("Picture link for option 1"), {
      target: { value: "https://evil.example/bait.png" },
    });

    expect(screen.getByText(/can only come from/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Send for review/ }).hasAttribute("disabled")).toBe(true);
    expect(api.submitPoll).not.toHaveBeenCalled();
  });

  it("does not silently drop an image option that is missing its label", async () => {
    // An option with a picture but no label must block submission with a clear
    // message — not be quietly discarded (which is what filtering by label
    // alone used to do), and not be sent as a labelless option the server
    // would then reject.
    const api = apiWith();
    renderPage(api);
    // Fill only the FIRST option's label; give the second a picture but no label.
    fireEvent.change(await screen.findByLabelText("Subject"), { target: { value: "physics" } });
    fireEvent.change(screen.getByLabelText("Your question"), {
      target: { value: "Which diagram is correct here?" },
    });
    fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "The left one" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add a picture" })[1]);
    fireEvent.change(screen.getByLabelText("Picture link for option 2"), {
      target: { value: "https://i.ytimg.com/vi/abc/hqdefault.jpg" },
    });

    // A per-option hint appears, and submit stays disabled.
    expect(screen.getByText(/a picture alone cannot be published/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Send for review/ }).hasAttribute("disabled")).toBe(true);
    expect(api.submitPoll).not.toHaveBeenCalled();
  });

  it("drops the picture link when the student removes the picture", async () => {
    const api = apiWith();
    renderPage(api);
    await fillValidPoll();

    fireEvent.click(screen.getAllByRole("button", { name: "Add a picture" })[0]);
    fireEvent.change(screen.getByLabelText("Picture link for option 1"), {
      target: { value: "https://i.ytimg.com/vi/abc/hqdefault.jpg" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove picture" }));

    fireEvent.click(screen.getByRole("button", { name: /Send for review/ }));
    await waitFor(() => expect(api.submitPoll).toHaveBeenCalled());
    expect(api.submitPoll.mock.calls[0][0].options[0].image_url).toBeNull();
  });

  it("explains the daily limit in words rather than showing the raw error", async () => {
    const api = apiWith({
      submitPoll: vi.fn().mockRejectedValue({
        code: "P0001", cause: { message: "submit daily rate limit exceeded" },
      }),
    });
    renderPage(api);
    await fillValidPoll();
    fireEvent.click(screen.getByRole("button", { name: /Send for review/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/two polls a day/);
  });

  it("adds and removes options within the 2 to 6 range", async () => {
    renderPage(apiWith());
    await screen.findByLabelText("Option 1");
    // Two options to start, and no way to drop below that.
    expect(screen.queryByRole("button", { name: "Remove option" })).toBeNull();

    const add = screen.getByRole("button", { name: /Add option/ });
    for (let index = 0; index < 4; index += 1) fireEvent.click(add);
    expect(screen.getByLabelText("Option 6")).toBeTruthy();
    // Six is the ceiling, so the control goes away.
    expect(screen.queryByRole("button", { name: /Add option/ })).toBeNull();
  });
});

describe("your own submissions", () => {
  it("shows the reviewer's reason, which is the only place a student can read it", async () => {
    const api = apiWith({
      getMySubmissions: vi.fn().mockResolvedValue([
        {
          id: 4, slug: "a-rejected-poll-4", question: "A rejected poll",
          status: "rejected", review_note: "Not about exam preparation.",
          created_at: "2026-08-20T10:00:00.000Z", reviewed_at: "2026-08-21T10:00:00.000Z",
        },
        {
          id: 5, slug: "a-waiting-poll-5", question: "A waiting poll",
          status: "pending", review_note: null,
          created_at: "2026-08-22T10:00:00.000Z", reviewed_at: null,
        },
      ]),
    });
    renderPage(api);

    expect(await screen.findByText("A rejected poll")).toBeTruthy();
    expect(screen.getByText("Not approved")).toBeTruthy();
    expect(screen.getByText(/Not about exam preparation\./)).toBeTruthy();
    expect(screen.getByText("Waiting for review")).toBeTruthy();
  });

  it("links only to a poll that is actually published", async () => {
    const api = apiWith({
      getMySubmissions: vi.fn().mockResolvedValue([
        { id: 6, slug: "live-one-6", question: "Live one", status: "live", review_note: null, created_at: "", reviewed_at: "" },
        { id: 7, slug: "pending-one-7", question: "Pending one", status: "pending", review_note: null, created_at: "", reviewed_at: null },
      ]),
    });
    renderPage(api);

    expect(await screen.findByRole("link", { name: "Live one" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Pending one" })).toBeNull();
  });
});

describe("gates", () => {
  it("asks a signed-out student to sign in instead of showing a form that cannot submit", async () => {
    renderPage(apiWith(), signedOut);
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByLabelText("Your question")).toBeNull();
  });

  it("says polls are unavailable when submissions are not open", async () => {
    renderPage(apiWith({ getMode: vi.fn().mockResolvedValue("read_only") }));
    expect(await screen.findByText("Polls are temporarily unavailable")).toBeTruthy();
    expect(screen.queryByLabelText("Your question")).toBeNull();
  });
});
