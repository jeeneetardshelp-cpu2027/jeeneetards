import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import { ForumApiError } from "./forumApi.js";
import ForumSubmitPage from "./ForumSubmitPage.jsx";

const mocks = vi.hoisted(() => ({
  auth: { session: null, loading: false },
}));

vi.mock("../useSession.js", () => ({ useSession: () => mocks.auth }));
vi.mock("../StudentAuth.jsx", () => ({ default: () => <div data-testid="student-auth">Student auth form</div> }));

const topics = [{ id: 1, slug: "physics", name: "Physics", description: "Physics doubts", kind: "academic" }];

function apiWith(overrides = {}) {
  return {
    getMode: vi.fn().mockResolvedValue("open"),
    getTopics: vi.fn().mockResolvedValue(topics),
    getMyIdentity: vi.fn().mockResolvedValue({ username: "physics-helper", needs_username: false }),
    claimUsername: vi.fn().mockResolvedValue("physics-helper"),
    createPost: vi.fn().mockResolvedValue(77),
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="location">{location.pathname}</output>;
}

function renderPage(api) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/forum/submit"]}>
        <ForumSubmitPage api={api} />
        <LocationProbe />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function fillDraft() {
  fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "physics" } });
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Why does angular momentum stay constant?" } });
  fireEvent.change(screen.getByLabelText("Question and context"), { target: { value: "I tried taking moments about the hinge, but I am stuck at $L=I\\omega$." } });
}

beforeEach(() => {
  localStorage.clear();
  mocks.auth = { session: null, loading: false };
});

describe("forum discussion composer", () => {
  it("uses the shared safe renderer for draft preview", async () => {
    const { container } = renderPage(apiWith());
    await screen.findByRole("heading", { name: "Ask a clear question" });
    const hostile = '<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">';
    fireEvent.change(screen.getByLabelText("Question and context"), { target: { value: hostile } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it("preserves a signed-out draft through sign-in, username claim and successful publishing", async () => {
    const api = apiWith({
      getMyIdentity: vi.fn().mockResolvedValue({ username: null, needs_username: true }),
    });
    const signedOut = renderPage(api);
    await screen.findByRole("heading", { name: "Ask a clear question" });
    fillDraft();
    fireEvent.click(screen.getByRole("button", { name: "Publish discussion" }));
    expect(screen.getByRole("alert").textContent).toMatch(/sign in/i);
    expect(screen.getByTestId("student-auth")).toBeTruthy();
    expect([...Array(localStorage.length)].some((_, index) => localStorage.getItem(localStorage.key(index)).includes("angular momentum")))
      .toBe(true);
    signedOut.unmount();

    mocks.auth = { session: { user: { id: "student-1" } }, loading: false };
    renderPage(api);
    expect(await screen.findByDisplayValue("Why does angular momentum stay constant?")).toBeTruthy();
    expect(screen.getByDisplayValue(/taking moments about the hinge/)).toBeTruthy();
    fireEvent.change(await screen.findByLabelText("Username"), { target: { value: "physics-helper" } });
    fireEvent.click(screen.getByRole("button", { name: "Claim username" }));
    expect(await screen.findByText(/publishing publicly as/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Publish discussion" }));
    await waitFor(() => expect(api.createPost).toHaveBeenCalledWith(expect.objectContaining({ topic: "physics" })));
    await waitFor(() => expect(screen.getByLabelText("location").textContent).toBe("/forum/post/77"));
    expect([...Array(localStorage.length)].some((_, index) => localStorage.getItem(localStorage.key(index))?.includes("angular momentum")))
      .toBe(false);
  });

  it("keeps the complete draft when the write RPC fails", async () => {
    mocks.auth = { session: { user: { id: "student-2" } }, loading: false };
    const api = apiWith({
      createPost: vi.fn().mockRejectedValue(new ForumApiError("Could not publish", {
        code: "55000", cause: { message: "forum is not open" },
      })),
    });
    renderPage(api);
    await screen.findByText(/publishing publicly as/i);
    fillDraft();
    fireEvent.click(screen.getByRole("button", { name: "Publish discussion" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/draft is saved/i);
    expect(screen.getByDisplayValue(/taking moments about the hinge/)).toBeTruthy();
    expect([...Array(localStorage.length)].some((_, index) => localStorage.getItem(localStorage.key(index))?.includes("angular momentum")))
      .toBe(true);
  });
});
