import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "../theme.jsx";
import ForumFeatureUnavailable from "./ForumFeatureUnavailable.jsx";

describe("disabled forum route", () => {
  it("explains the release gate without mounting an invisible Reveal block", () => {
    const { container } = render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/forum"]}>
          <ForumFeatureUnavailable />
        </MemoryRouter>
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Student forum is not available yet" }))
      .toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse available courses" }).getAttribute("href"))
      .toBe("/browse");
    expect(container.querySelector(".reveal")).toBeNull();
  });
});
