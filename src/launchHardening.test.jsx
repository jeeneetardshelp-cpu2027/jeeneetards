import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppErrorBoundary from "./AppErrorBoundary.jsx";
import { ThemeProvider } from "./theme.jsx";
import { hasAdminAccess } from "./adminAccess.js";
import { slugify } from "./adminUI.jsx";

describe("launch hardening", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fails closed unless a profile is explicitly marked as admin", () => {
    expect(hasAdminAccess({ is_admin: true })).toBe(true);
    expect(hasAdminAccess({ is_admin: false })).toBe(false);
    expect(hasAdminAccess({})).toBe(false);
    expect(hasAdminAccess(null)).toBe(false);
  });

  it("creates stable chapter slugs for ASCII and Unicode names", () => {
    expect(slugify("Laws of Motion")).toBe("laws-of-motion");
    expect(slugify("कबीर की साखी")).toBe("कबीर-की-साखी");
    expect(slugify("मीरा के पद")).toBe("मीरा-के-पद");
  });

  it("normalizes compatibility variants before generating a chapter slug", () => {
    expect(slugify("Ｆｕｌｌ Ｗｉｄｔｈ")).toBe("full-width");
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
