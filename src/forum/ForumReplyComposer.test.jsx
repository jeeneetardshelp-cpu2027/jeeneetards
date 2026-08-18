import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import { ForumApiError } from "./forumApi.js";
import ForumReplyComposer from "./ForumReplyComposer.jsx";

const mocks = vi.hoisted(() => ({
  auth: { session: { user: { id: "answerer-1" } }, loading: false },
}));
vi.mock("../useSession.js", () => ({ useSession: () => mocks.auth }));
vi.mock("../StudentAuth.jsx", () => ({ default: () => <div>Student auth form</div> }));

beforeEach(() => localStorage.clear());

describe("forum answer composer", () => {
  it("retains worked maths locally after a failed answer", async () => {
    const api = {
      getMyIdentity: vi.fn().mockResolvedValue({ username: "answerer", needs_username: false }),
      createComment: vi.fn().mockRejectedValue(new ForumApiError("Could not publish", {
        cause: { message: "Failed to fetch" },
      })),
    };
    render(
      <ThemeProvider><MemoryRouter>
        <ForumReplyComposer postId={42} mode="open" locked={false} api={api} />
      </MemoryRouter></ThemeProvider>,
    );
    await screen.findByText(/answering publicly as/i);
    const workedMaths = "First use $$L_i=L_f$$, then substitute the two moments of inertia.";
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: workedMaths } });
    fireEvent.click(screen.getByRole("button", { name: "Publish answer" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/draft is saved/i);
    expect(screen.getByDisplayValue(workedMaths)).toBeTruthy();
    expect([...Array(localStorage.length)].some((_, index) => localStorage.getItem(localStorage.key(index))?.includes("L_i=L_f")))
      .toBe(true);
  });

  it("shows the answer composer to a beta member and a read-only notice to a non-member", async () => {
    const memberApi = {
      getMyIdentity: vi.fn().mockResolvedValue({ username: "answerer", needs_username: false }),
      getBetaMembership: vi.fn().mockResolvedValue(true),
      createComment: vi.fn().mockResolvedValue(1),
    };
    const member = render(
      <ThemeProvider><MemoryRouter>
        <ForumReplyComposer postId={42} mode="beta" locked={false} api={memberApi} />
      </MemoryRouter></ThemeProvider>,
    );
    expect(await screen.findByRole("button", { name: "Publish answer" })).toBeTruthy();
    member.unmount();

    const outsiderApi = {
      getMyIdentity: vi.fn().mockResolvedValue({ username: "outsider", needs_username: false }),
      getBetaMembership: vi.fn().mockResolvedValue(false),
    };
    render(
      <ThemeProvider><MemoryRouter>
        <ForumReplyComposer postId={42} mode="beta" locked={false} api={outsiderApi} />
      </MemoryRouter></ThemeProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Answers are in closed beta" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish answer" })).toBeNull();
  });
});
