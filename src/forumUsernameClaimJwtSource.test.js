import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/scripts/verifyForumUsernameClaimJwtStaging.js", "utf8");

describe("forum username JWT staging verifier source", () => {
  it("is fail-closed to the disposable staging project", () => {
    expect(source).toContain('const expectedProjectRef = "essmxonestbrgmgrtywn"');
    expect(source).toContain('TEST_ALLOW") !== "1"');
    expect(source).toContain("--confirm-forum-username-jwt-staging");
    expect(source).toContain("staging URL matches production");
    expect(source).toContain('data?.name === "staging"');
  });

  it("uses only staging.invalid fixtures and always tears them down", () => {
    expect(source).toContain("@staging.invalid");
    expect(source).toContain("finally {");
    expect(source).toContain("auth.admin.deleteUser");
    expect(source).toContain("profile_count");
  });

  it("records response shapes without serialising token values", () => {
    expect(source).toContain("raw_response_shape: responseShape(response)");
    expect(source).toContain("session_present");
    expect(source).not.toMatch(/access_token\s*:/);
    expect(source).not.toMatch(/refresh_token\s*:/);
  });

  it("covers collision, reserved-name, missing-profile and bypass cases", () => {
    for (const phrase of [
      "concurrent case-insensitive claims produce one winner",
      "reserved staff-like username is rejected",
      "claim safely creates a missing legacy profile",
      "direct browser username update is denied",
    ]) expect(source).toContain(phrase);
  });
});
