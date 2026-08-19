import { describe, expect, it } from "vitest";
import {
  parseEnv,
  resolveReleaseEnvironment,
  PUBLIC_BROWSER_ENV,
  PRIVATE_SERVER_ENV,
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
    })).toMatchObject({
      VITE_SUPABASE_URL: "https://ci-placeholder.supabase.co",
      VITE_SUPABASE_ANON_KEY: "ci-public-anon-key",
    });
  });

  it("no longer requires a browser YouTube key", () => {
    // VITE_YOUTUBE_API_KEY was removed on 2026-08-10: Vite inlines VITE_* into
    // the public bundle, so shipping one published the key. The admin calls now
    // go through api/youtube.js with the server-only YOUTUBE_API_KEY.
    expect(PUBLIC_BROWSER_ENV).not.toContain("VITE_YOUTUBE_API_KEY");
    expect(PRIVATE_SERVER_ENV).toContain("YOUTUBE_API_KEY");

    // Note what this does NOT claim. resolveReleaseEnvironment passes through
    // every key it finds in the .env source, so a stale VITE_YOUTUBE_API_KEY=
    // line would still reach Vite -- that is Vite's inlining behaviour, not
    // something this function gates. The durable guarantees are that no source
    // file reads the variable (src/scripts.envkeys.test.js) and that the built
    // bundle carries no AIza… string. An earlier version of this test asserted
    // the wrong thing here and failed.
    expect(resolveReleaseEnvironment("", {
      VITE_YOUTUBE_API_KEY: "should-not-be-required",
    })).not.toHaveProperty("VITE_YOUTUBE_API_KEY");
  });

  it("lets an explicit runtime value override a local value", () => {
    expect(resolveReleaseEnvironment(
      "VITE_SUPABASE_URL=https://local.supabase.co",
      { VITE_SUPABASE_URL: "https://ci-placeholder.supabase.co" },
    ).VITE_SUPABASE_URL).toBe("https://ci-placeholder.supabase.co");
  });
});
