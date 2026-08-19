// SignInPage and the header's Sign-in entry point.
//
// Audit finding (2026-08-10): no "Sign in" existed anywhere; the only auth
// control was "Sign out", shown once a session already existed, and the form
// lived buried inside the rating and report panels. A student could not
// deliberately create an account to carry progress across devices.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

const sessionMock = vi.hoisted(() => ({ session: null, loading: false }));
vi.mock("./useSession.js", () => ({ useSession: () => sessionMock }));

const navigateMock = vi.hoisted(() => vi.fn());
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

import SignInPage, { safeNext } from "./SignInPage.jsx";
import { GlobalHeader } from "./AppShell.jsx";
import { ThemeProvider } from "./theme.jsx";

describe("safeNext", () => {
  it("keeps an in-app path", () => {
    expect(safeNext("/course/5/chapter/1")).toBe("/course/5/chapter/1");
    expect(safeNext("/browse?goal=jee")).toBe("/browse?goal=jee");
  });
  it("refuses anything that could leave the site (open-redirect guard)", () => {
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
  });
});

const showPage = (entry = "/signin") => render(
  <ThemeProvider>
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/signin" element={<SignInPage />} /></Routes>
    </MemoryRouter>
  </ThemeProvider>,
);

describe("SignInPage", () => {
  it("renders the account form and explains why an account is optional", () => {
    sessionMock.session = null;
    sessionMock.loading = false;
    showPage();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
    // The StudentAuth form is mounted (email + password fields).
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByText(/carries your watch progress across/i)).toBeTruthy();
    // An escape hatch back to browsing without an account.
    expect(screen.getByRole("link", { name: /Back to browsing/i })).toBeTruthy();
  });

  it("redirects an already-signed-in student to ?next, never off-site", () => {
    sessionMock.session = { user: { id: "u1" } };
    sessionMock.loading = false;
    navigateMock.mockClear();
    showPage("/signin?next=%2Fcourse%2F5%2Fchapter%2F1");
    expect(navigateMock).toHaveBeenCalledWith("/course/5/chapter/1", { replace: true });
  });

  it("ignores an off-site ?next on redirect", () => {
    sessionMock.session = { user: { id: "u1" } };
    navigateMock.mockClear();
    showPage("/signin?next=https%3A%2F%2Fevil.example");
    expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
  });
});

const showHeader = (entry, session) => {
  sessionMock.session = session;
  sessionMock.loading = false;
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <GlobalHeader />
      </MemoryRouter>
    </ThemeProvider>,
  );
};

describe("the header's Sign-in entry point", () => {
  it("offers Sign in when signed out, carrying the current path in ?next", () => {
    showHeader("/browse?goal=jee", null);
    const link = screen.getByRole("link", { name: "Sign in" });
    // encodeURIComponent of the pathname only (query is dropped by useLocation's
    // pathname), so the return lands on the page the student was on.
    expect(link.getAttribute("href")).toBe("/signin?next=%2Fbrowse");
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("shows Sign out, not Sign in, when a session exists", () => {
    showHeader("/browse", { user: { id: "u1" } });
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Forum username" }).getAttribute("href"))
      .toBe("/forum/username");
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("does not repeat the Forum username link on its own page", () => {
    showHeader("/forum/username", { user: { id: "u1" } });
    expect(screen.queryByRole("link", { name: "Forum username" })).toBeNull();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("does not offer Sign in on the sign-in page itself (no self-loop)", () => {
    showHeader("/signin", null);
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });
});
