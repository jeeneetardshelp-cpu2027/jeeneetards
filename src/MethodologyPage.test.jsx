import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import MethodologyPage from "./MethodologyPage.jsx";
import { ThemeProvider } from "./theme.jsx";

describe("curation methodology page", () => {
  it("explains verification, commercial influence, and corrections", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <MethodologyPage />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "How JEENEETARD curates courses" }))
      .toBeTruthy();
    expect(screen.getByRole("heading", { name: "What verified means" }))
      .toBeTruthy();
    expect(screen.getByText(/does not currently sell placement or accept sponsored rankings/i))
      .toBeTruthy();
    expect(screen.getByRole("link", { name: "jeeneetardshelp@gmail.com" }).getAttribute("href"))
      .toBe("mailto:jeeneetardshelp@gmail.com");
  });
});
