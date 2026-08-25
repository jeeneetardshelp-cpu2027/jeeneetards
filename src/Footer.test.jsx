import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import Footer from "./Footer.jsx";

describe("Footer contact and feedback", () => {
  it("opens Gmail with the help address and feedback subject pre-filled", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    const expectedUrl =
      "https://mail.google.com/mail/?view=cm&fs=1&to=jeeneetardshelp%40gmail.com&su=JEENEETARD%20feedback";
    const contactLink = screen.getByRole("link", { name: "Contact us" });
    const emailLink = screen.getByRole("link", {
      name: "jeeneetardshelp@gmail.com",
    });

    expect(contactLink.getAttribute("href")).toBe(expectedUrl);
    expect(contactLink.getAttribute("target")).toBe("_blank");
    expect(contactLink.getAttribute("rel")).toBe("noreferrer");
    expect(emailLink.getAttribute("href")).toBe(expectedUrl);
    expect(emailLink.getAttribute("target")).toBe("_blank");
    expect(emailLink.getAttribute("rel")).toBe("noreferrer");
    expect(document.body.textContent).toContain(
      "Have feedback or an idea for a feature that would make the website better?",
    );
    expect(screen.getByRole("link", { name: "Student forum" }).getAttribute("href")).toBe("/forum");
  });
});
