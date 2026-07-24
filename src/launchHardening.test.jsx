import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppErrorBoundary from "./AppErrorBoundary.jsx";
import { ThemeProvider } from "./theme.jsx";
import { hasAdminAccess } from "./adminAccess.js";

describe("launch hardening", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fails closed unless a profile is explicitly marked as admin", () => {
    expect(hasAdminAccess({ is_admin: true })).toBe(true);
    expect(hasAdminAccess({ is_admin: false })).toBe(false);
    expect(hasAdminAccess({})).toBe(false);
    expect(hasAdminAccess(null)).toBe(false);
  });

  it("contains an unexpected render failure and offers recovery", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function BrokenPage() {
      throw new Error("unexpected render failure");
    }

    render(
      <ThemeProvider>
        <AppErrorBoundary><BrokenPage /></AppErrorBoundary>
      </ThemeProvider>,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "This page could not be displayed" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse courses" }).getAttribute("href")).toBe("/browse");
  });
});
