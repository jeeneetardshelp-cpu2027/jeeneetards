import { describe, expect, it } from "vitest";
import {
  parseEnv,
  resolveReleaseEnvironment,
} from "./releaseEnv.js";

describe("frontend release environment", () => {
  it("reads a local ignored env file", () => {
    expect(parseEnv(`
      # comment
      VITE_SUPABASE_URL=https://local.supabase.co
      VITE_SUPABASE_ANON_KEY=local-public-key
    `)).toEqual({
      VITE_SUPABASE_URL: "https://local.supabase.co",
      VITE_SUPABASE_ANON_KEY: "local-public-key",
    });
  });

  it("supports explicit non-secret CI values without a .env file", () => {
    expect(resolveReleaseEnvironment("", {
      VITE_SUPABASE_URL: "https://ci-placeholder.supabase.co",
      VITE_SUPABASE_ANON_KEY: "ci-public-anon-key",
      VITE_YOUTUBE_API_KEY: "ci-public-youtube-key",
    })).toMatchObject({
      VITE_SUPABASE_URL: "https://ci-placeholder.supabase.co",
      VITE_SUPABASE_ANON_KEY: "ci-public-anon-key",
      VITE_YOUTUBE_API_KEY: "ci-public-youtube-key",
    });
  });

  it("lets an explicit runtime value override a local value", () => {
    expect(resolveReleaseEnvironment(
      "VITE_SUPABASE_URL=https://local.supabase.co",
      { VITE_SUPABASE_URL: "https://ci-placeholder.supabase.co" },
    ).VITE_SUPABASE_URL).toBe("https://ci-placeholder.supabase.co");
  });
});
