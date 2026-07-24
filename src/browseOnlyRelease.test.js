import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";

const root = resolve(import.meta.dirname, "..");

describe("browse-only production release evidence", () => {
  it("keeps every public student-owned write feature disabled", () => {
    expect(RELEASE_FEATURES).toEqual({
      studentAccounts: false,
      courseRatingSubmission: false,
      contentReporting: false,
    });
  });

  it("records the production Auth controls that were verified read-only", () => {
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
