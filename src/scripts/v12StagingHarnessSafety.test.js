import { describe, expect, it } from "vitest";
import {
  V12_STAGING_CONFIRMATION,
  normalizeSupabaseUrl,
  redactV12StagingConfig,
  sameSupabaseUrl,
  validateV12RunId,
  validateV12StagingConfig,
  v12FixtureTokens,
} from "./v12StagingHarnessSafety.js";

const validConfig = {
  allow: "1",
  v12Allow: "1",
  url: "https://test-project.supabase.co/",
  productionUrls: ["https://production-project.supabase.co"],
  serviceKey: "staging-service-secret",
  anonKey: "staging-anon-secret",
  argv: [V12_STAGING_CONFIRMATION],
};

describe("v12 staging harness configuration safety", () => {
  it("normalizes root Supabase URLs and compares equivalent spellings", () => {
    expect(normalizeSupabaseUrl(" HTTPS://TEST-PROJECT.SUPABASE.CO/ "))
      .toBe("https://test-project.supabase.co");
    expect(sameSupabaseUrl(
      "https://test-project.supabase.co/",
      "HTTPS://TEST-PROJECT.SUPABASE.CO",
    )).toBe(true);
  });

  it.each([
    "",
    "http://test-project.supabase.co",
    "https://example.com",
    "https://test-project.supabase.co/rest/v1",
    "https://test-project.supabase.co?secret=value",
    "https://user:pass@test-project.supabase.co",
  ])("rejects a non-project Supabase URL: %s", (url) => {
    expect(() => normalizeSupabaseUrl(url)).toThrow(/Supabase URL/);
  });

  it("returns normalized validated configuration only after every gate", () => {
    expect(validateV12StagingConfig(validConfig)).toEqual({
      allow: "1",
      v12Allow: "1",
      url: "https://test-project.supabase.co",
      productionUrls: ["https://production-project.supabase.co"],
      serviceKey: "staging-service-secret",
      anonKey: "staging-anon-secret",
      confirmation: V12_STAGING_CONFIRMATION,
    });
  });

  it.each([
    [{ allow: "0" }, /TEST_ALLOW=1/],
    [{ v12Allow: "" }, /V12_TEST_ALLOW=1/],
    [{ argv: [] }, /exact --confirm-disposable-v12-staging/],
    [{ argv: ["--confirm-disposable-v12-staging=yes"] }, /exact --confirm/],
    [{ serviceKey: " " }, /TEST_SERVICE_KEY/],
    [{ anonKey: "" }, /TEST_ANON_KEY/],
    [{ productionUrls: [] }, /at least one known production/],
    [{
      productionUrls: ["HTTPS://TEST-PROJECT.SUPABASE.CO/"],
    }, /matches a known production URL/],
  ])("refuses unsafe configuration override %o", (override, message) => {
    expect(() => validateV12StagingConfig({
      ...validConfig,
      ...override,
    })).toThrow(message);
  });

  it("redacts keys and project references while retaining safe evidence", () => {
    const report = redactV12StagingConfig(validConfig);
    const serialized = JSON.stringify(report);

    expect(report).toMatchObject({
      allow: "1",
      v12Allow: "1",
      url: "https://<redacted-project-ref>.supabase.co",
      productionUrls: ["https://<redacted-project-ref>.supabase.co"],
      productionTargetCount: 1,
      serviceKey: "[REDACTED]",
      anonKey: "[REDACTED]",
      confirmationPresent: true,
      targetsDiffer: true,
    });
    expect(serialized).not.toContain("staging-service-secret");
    expect(serialized).not.toContain("staging-anon-secret");
    expect(serialized).not.toContain("test-project");
    expect(serialized).not.toContain("production-project");
  });

  it("rejects a target matching any configured production URL", () => {
    expect(() => validateV12StagingConfig({
      ...validConfig,
      url: "https://second-production.supabase.co",
      productionUrls: [
        "https://production-project.supabase.co",
        "https://second-production.supabase.co/",
      ],
    })).toThrow(/matches a known production URL/);
  });
});

describe("v12 staging harness fixture identity safety", () => {
  it.each([
    "",
    "abc12",
    "abc1234",
    "ABC123",
    " abc123",
    "xyz123",
  ])("rejects invalid run id %j", (runId) => {
    expect(() => validateV12RunId(runId)).toThrow(
      /six lowercase hexadecimal/,
    );
  });

  it("builds deterministic, unique, collision-resistant fixture identifiers", () => {
    const tokens = v12FixtureTokens("a1b2c3");
    const repeat = v12FixtureTokens("a1b2c3");
    const otherRun = v12FixtureTokens("a1b2c4");

    expect(repeat).toEqual(tokens);
    expect(otherRun).not.toEqual(tokens);
    const identifiersFor = (fixture) => [
      ...Object.values(fixture.channels),
      ...Object.values(fixture.playlists),
      ...fixture.videos.success,
      ...fixture.videos.anonymousDenied,
      ...fixture.videos.userDenied,
      ...Object.values(fixture.videos.concurrency),
      ...Object.values(fixture.videos.conflict),
      ...Object.values(fixture.videos.failure),
      ...fixture.chapterSlugs,
      ...Object.values(fixture.requestIds),
    ];
    const otherIdentifiers = new Set(identifiersFor(otherRun));
    expect(identifiersFor(tokens).some((id) => otherIdentifiers.has(id)))
      .toBe(false);

    const videoIds = [
      ...tokens.videos.success,
      ...tokens.videos.anonymousDenied,
      ...tokens.videos.userDenied,
      ...Object.values(tokens.videos.concurrency),
      ...Object.values(tokens.videos.conflict),
      ...Object.values(tokens.videos.failure),
    ];
    expect(new Set(videoIds).size).toBe(videoIds.length);
    expect(videoIds.every((id) => id.length === 11)).toBe(true);
    expect([
      ...tokens.videos.success,
      ...tokens.videos.anonymousDenied,
      ...tokens.videos.userDenied,
      ...Object.values(tokens.videos.concurrency),
      ...Object.values(tokens.videos.conflict),
      tokens.videos.failure.safe,
    ].every((id) => !id.startsWith("V12FX"))).toBe(true);
    expect(tokens.videos.failure.trigger.startsWith("V12FX")).toBe(true);

    expect(Object.values(tokens.playlists).every(
      (id) => id.startsWith("TESTV12"),
    )).toBe(true);
    expect(Object.values(tokens.channels).every(
      (id) => id.startsWith("TESTV12"),
    )).toBe(true);
    expect(new Set(tokens.chapterSlugs).size)
      .toBe(tokens.chapterSlugs.length);

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const requestIds = Object.values(tokens.requestIds);
    expect(new Set(requestIds).size).toBe(requestIds.length);
    expect(requestIds.every((id) => uuidPattern.test(id))).toBe(true);
  });
});
