import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import ForumUsernamePage from "./ForumUsernamePage.jsx";

const mocks = vi.hoisted(() => ({
  auth: { session: null, loading: false },
}));

vi.mock("../useSession.js", () => ({ useSession: () => mocks.auth }));
vi.mock("../StudentAuth.jsx", () => ({
  default: () => <div data-testid="student-auth">Student auth form</div>,
}));

function apiWith(overrides = {}) {
  return {
    getMyIdentity: vi.fn().mockResolvedValue({ username: null, needs_username: true }),
    getBetaMembership: vi.fn().mockResolvedValue(false),
    claimUsername: vi.fn().mockResolvedValue("physics-helper"),
    ...overrides,
  };
}

function showPage(api) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/forum/username"]}>
        <ForumUsernamePage api={api} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  mocks.auth = { session: null, loading: false };
});

describe("standalone forum username page", () => {
  it("offers the existing sign-in form without opening the forum", () => {
    showPage(apiWith());
    expect(screen.getByRole("heading", { name: "Choose your public username" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sign in to choose your forum username" })).toBeTruthy();
    expect(screen.getByTestId("student-auth")).toBeTruthy();
  });

  it("lets a signed-in student accept the rules and claim a username", async () => {
    mocks.auth = { session: { user: { id: "student-1" } }, loading: false };
    const api = apiWith();
    showPage(api);

    await screen.findByRole("heading", { name: "Choose your public forum username" });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "physics-helper" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I have reviewed and agree/i }));
    fireEvent.click(screen.getByRole("button", { name: "Claim username" }));

    await waitFor(() => expect(api.claimUsername).toHaveBeenCalledWith("physics-helper"));
    expect(await screen.findByRole("heading", { name: "Your forum username is ready" })).toBeTruthy();
    expect(screen.getByText("@physics-helper")).toBeTruthy();
  });

  it("shows an already-claimed immutable username", async () => {
    mocks.auth = { session: { user: { id: "student-1" } }, loading: false };
    showPage(apiWith({
      getMyIdentity: vi.fn().mockResolvedValue({ username: "math-guide", needs_username: false }),
    }));

    expect(await screen.findByText("@math-guide")).toBeTruthy();
    expect(screen.getByText(/cannot be changed/i)).toBeTruthy();
  });
});
