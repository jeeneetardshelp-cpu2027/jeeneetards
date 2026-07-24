import { describe, expect, it } from "vitest";
import {
  fixtureTokens,
  parseEnvText,
  validateFixtureConfig,
  validateFixtureState,
} from "./scripts/reportBrowserFixtureUtils.js";

const config = {
  allow: "1",
  url: "https://staging-ref.supabase.co",
  serviceKey: "service",
  anonKey: "anon",
  productionUrl: "https://production-ref.supabase.co",
};

describe("report browser fixture safety", () => {
  it("parses quoted local env values without treating comments as settings", () => {
    expect(parseEnvText("# X=bad\nTEST_ALLOW='1'\nTEST_ANON_KEY= value \n")).toEqual({
      TEST_ALLOW: "1", TEST_ANON_KEY: "value",
    });
  });

  it("requires explicit destructive-test consent", () => {
    expect(() => validateFixtureConfig({ ...config, allow: "0" })).toThrow(/TEST_ALLOW=1/);
  });

  it("refuses the production project even with a trailing slash", () => {
    expect(() => validateFixtureConfig({
      ...config,
      url: "https://production-ref.supabase.co/",
    })).toThrow(/production URL/);
  });

  it("requires all three staging credentials", () => {
    expect(() => validateFixtureConfig({ ...config, serviceKey: "" })).toThrow(/required/);
  });

  it("generates a valid eleven-character YouTube video id", () => {
    const tokens = fixtureTokens("a1b2c3");
    expect(tokens.videoYoutubeId).toHaveLength(11);
    expect(tokens.expectedNote).toContain("a1b2c3");
  });

  it("rejects fixture state copied from another staging project", () => {
    const state = {
      version: 1,
      runId: "a1b2c3",
      supabaseUrl: config.url,
      email: "student@example.invalid",
      password: "secret",
      userId: "12345678-1234-1234-1234-123456789abc",
      playlistId: 1,
      videoId: 2,
      channelId: 3,
    };
    expect(() => validateFixtureState(state, "https://another-ref.supabase.co"))
      .toThrow(/different Supabase project/);
  });

  it("allows partial state only for cleanup recovery", () => {
    const partial = {
      version: 1,
      runId: "a1b2c3",
      supabaseUrl: config.url,
      email: "student@example.invalid",
      password: "secret",
      userId: null,
      playlistId: null,
      videoId: null,
      channelId: null,
    };
    expect(() => validateFixtureState(partial, config.url)).toThrow(/invalid playlistId/);
    expect(validateFixtureState(partial, config.url, { requireComplete: false })).toBe(partial);
  });
});
