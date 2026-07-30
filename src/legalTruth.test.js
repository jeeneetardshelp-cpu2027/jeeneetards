import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

describe("legal release truth", () => {
  it("keeps every owner-only legal fact in one explicit input checklist", () => {
    const inputs = read("docs/legal_release_inputs.md");
    for (const label of [
      "Legal entity or individual operator name",
      "Contact email",
      "Postal address and jurisdiction",
      "Hosting provider",
      "Effective date",
    ]) {
      expect(inputs).toContain(label);
    }
  });

  it("describes every personal-data path implemented by the frontend", () => {
    const privacy = read("src/PrivacyPolicy.jsx");
    for (const fact of [
      "Supabase Auth",
      "email address and Supabase user identifier",
      "overall, clarity, and question ratings",
      "free-text review",
      "report reason, optional free-text note, and reporter account identifier",
      "ll_progress_v1",
      "returnTo:",
      "scroll:",
      "YouTube",
      "Vercel and Supabase",
      "request and security logs",
      "aggregate, cookieless page-view analytics",
      "Vercel Speed Insights",
    ]) {
      expect(privacy).toContain(fact);
    }
  });
});
