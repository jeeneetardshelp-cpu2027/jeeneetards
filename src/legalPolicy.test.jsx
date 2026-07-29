import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
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
  it("publishes product-specific terms without inventing owner-only facts", () => {
    show(<LegalPage />);
    expect(screen.getByRole("heading", { name: "Terms of Service & Disclaimer" })).toBeTruthy();
    expect(screen.getByText(/effective date: 25 July 2026/i)).toBeTruthy();
    expect(document.body.textContent).toMatch(/browsing does not require an account/i);
    expect(document.body.textContent).toMatch(/operated by JEENEETARD/i);
    expect(document.body.textContent).toMatch(/jeeneetardshelp@gmail\.com/i);
    expect(document.body.textContent).toMatch(/laws of India/i);
    expect(document.body.textContent).toMatch(/courts of Kota/i);
    expect(document.body.textContent).not.toMatch(/\bAmit\b/i);
    expect(document.body.textContent).not.toMatch(/\bJaipur\b/i);
  });

  it("accurately discloses accounts, submissions, storage, providers, and under-18 use", () => {
    show(<PrivacyPolicy />);
    const text = document.body.textContent;
    expect(screen.getByText(/effective date: 25 July 2026/i)).toBeTruthy();
    expect(text).toMatch(/Supabase Auth/i);
    expect(text).toMatch(/overall, clarity, and question ratings/i);
    expect(text).toMatch(/ll_progress_v1/i);
    expect(text).toMatch(/Vercel and Supabase deliver the site/i);
    expect(text).toMatch(/privacy-enhanced embed domain/i);
    expect(text).toMatch(/students under 18/i);
    expect(text).toMatch(/operated by JEENEETARD/i);
    expect(text).toMatch(/based in Kota/i);
    expect(text).not.toMatch(/\bAmit\b/i);
    expect(text).not.toMatch(/\bJaipur\b/i);
    expect(text).toMatch(/jeeneetardshelp@gmail\.com/i);
  });
});
