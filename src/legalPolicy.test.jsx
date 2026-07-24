import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import LegalPage from "./LegalPage.jsx";
import PrivacyPolicy from "./PrivacyPolicy.jsx";
import { ThemeProvider } from "./theme.jsx";

const show = (page) => render(
  <MemoryRouter>
    <ThemeProvider>{page}</ThemeProvider>
  </MemoryRouter>,
);

afterEach(cleanup);

describe("browse-only legal disclosures", () => {
  it("publishes product-specific terms with real contact and jurisdiction", () => {
    show(<LegalPage />);
    expect(screen.getByRole("heading", { name: "Terms of Service & Disclaimer" })).toBeTruthy();
    expect(screen.getByText("Effective: 23 July 2026")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "rajesh@gmail.com" })).toHaveLength(2);
    expect(document.body.textContent).toMatch(/governed by the laws of India/i);
    expect(document.body.textContent).toMatch(/current public release is browse-only/i);
  });

  it("accurately discloses providers, local storage, YouTube, and under-18 use", () => {
    show(<PrivacyPolicy />);
    const text = document.body.textContent;
    expect(screen.getByText("Effective: 23 July 2026")).toBeTruthy();
    expect(text).toMatch(/Vercel hosts the website/i);
    expect(text).toMatch(/Supabase provides database and API services/i);
    expect(text).toMatch(/local browser storage/i);
    expect(text).toMatch(/privacy-enhanced embed domain/i);
    expect(text).toMatch(/users who may be under 18/i);
    expect(text).toMatch(/does not offer student accounts or contribution forms/i);
    expect(screen.getByRole("link", { name: "rajesh@gmail.com" }).getAttribute("href"))
      .toBe("mailto:rajesh@gmail.com");
  });
});
