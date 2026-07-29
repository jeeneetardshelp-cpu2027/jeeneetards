import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import { GlobalHeader } from "./AppShell.jsx";
import { ThemeProvider } from "./theme.jsx";

function renderHeader() {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={["/course/4?v=lesson"]}>
        <GlobalHeader crumbs={[
          { label: "Browse courses", to: "/browse?goal=jee" },
          { label: "Complete Kinematics" },
          { label: "Relative motion" },
        ]} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

describe("shared shell accessibility and theme", () => {
  it("names the icon-only mobile brand and does not make inert crumbs focusable", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "JEENEETARD home" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Complete Kinematics" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Relative motion" })).toBeNull();
    expect(screen.getByText("Relative motion").getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("navigation", { name: "Primary navigation" })).toHaveLength(2);
  });

  it("persists the selected theme and exposes the current action", async () => {
    const first = renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Use dark theme" }));

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(window.localStorage.getItem("lecture-library-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Use light theme" }).getAttribute("aria-pressed")).toBe("true");

    first.unmount();
    renderHeader();
    expect(screen.getByRole("button", { name: "Use light theme" })).toBeTruthy();
  });
});
