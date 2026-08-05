import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import Footer from "./Footer.jsx";

describe("Footer contact and feedback", () => {
  it("provides the help email and invites feature suggestions", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Contact us" }).getAttribute("href"),
    ).toBe("mailto:jeeneetardshelp@gmail.com");
    expect(
      screen
        .getByRole("link", { name: "jeeneetardshelp@gmail.com" })
        .getAttribute("href"),
    ).toBe("mailto:jeeneetardshelp@gmail.com");
    expect(document.body.textContent).toContain(
      "Have feedback or an idea for a feature that would make the website better?",
    );
  });
});
