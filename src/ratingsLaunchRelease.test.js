import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";

const root = resolve(import.meta.dirname, "..");

describe("ratings-launch production release evidence", () => {
  it("enables accounts and rating submission", () => {
    expect(RELEASE_FEATURES).toMatchObject({
      studentAccounts: true,
      courseRatingSubmission: true,
      reviewDisplay: true,
    });
  });

  it("records the pre-decision production Auth controls (2026-07-23, before the ratings launch)", () => {
    const evidence = JSON.parse(
      readFileSync(resolve(root, "docs/browse_only_auth_evidence.json"), "utf8"),
    );
    expect(evidence).toMatchObject({
      environment: "production",
      project_name: "youtube",
      allow_new_users_to_sign_up: false,
      allow_anonymous_sign_ins: false,
      email_provider_enabled: true,
      production_writes_during_verification: 0,
    });
  });
});
