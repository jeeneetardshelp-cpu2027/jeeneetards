import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RELEASE_CAPABILITIES,
  RELEASE_FEATURES,
} from "./releaseCapabilities.js";

const root = resolve(import.meta.dirname, "..");
const readme = readFileSync(resolve(root, "README.md"), "utf8");

describe("repository onboarding contract", () => {
  it("documents a reproducible safe local setup", () => {
    for (const text of [
      "Node.js 24",
      "Copy-Item .env.example .env",
      "npm ci",
      "npm run dev",
      "npm test",
      "npm run build",
      "npm run verify:frontend-release",
    ]) {
      expect(readme).toContain(text);
    }
  });

  it("documents the enabled and disabled release capabilities", () => {
    expect(RELEASE_CAPABILITIES).toMatchObject({
      universalSearch: true,
      comparison: true,
      facultyRegistry: true,
      boardClassification: true,
      studyMaterials: true,
    });
    for (const label of [
      "Universal search",
      "Course comparison",
      "Faculty profiles and filtering",
      "School-board classification",
      "Study-material library",
    ]) {
      expect(readme).toMatch(new RegExp(`\\| ${label} \\| Enabled \\|`));
    }
  });

  it("documents which public write features are enabled and which remain disabled", () => {
    expect(RELEASE_FEATURES).toEqual({
      studentAccounts: true,
      courseRatingSubmission: true,
      reviewDisplay: true,
      contentReporting: true,
    });
    for (const label of [
      "Public student accounts", "Rating submission", "Review display", "Content reporting",
    ]) {
      expect(readme).toMatch(new RegExp(`\\| ${label} \\| Enabled \\|`));
    }
  });

  it("keeps privileged keys out of frontend guidance", () => {
    expect(readme).toContain(
      "Never configure `SUPABASE_SERVICE_ROLE_KEY`",
    );
    expect(readme).toMatch(
      /Never put a\s+service-role key, server key or other secret in a `VITE_` variable\./,
    );
    expect(readme).not.toMatch(/sb_secret_[A-Za-z0-9_-]{8,}/);
    expect(readme).not.toMatch(/AIza[A-Za-z0-9_-]{30,}/);
  });

  it("records the unresolved license decision honestly", () => {
    expect(readme).toContain("No open-source license has been selected.");
  });

  it("does not send new contributors to missing local documentation", () => {
    const targets = [...readme.matchAll(/\]\((?!https?:)([^)#]+)(?:#[^)]+)?\)/g)]
      .map((match) => match[1]);
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(existsSync(resolve(root, target)), target).toBe(true);
    }
  });
});
