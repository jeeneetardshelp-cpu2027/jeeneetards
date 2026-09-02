// The suite must keep an explicit per-test timeout.
//
// Vitest's default is 5s. The heaviest component tests here normally take
// 2.1-2.4s, so only a ~2x slowdown blows that budget -- and with 130+ files
// sharing 12 cores, that happened: one full run failed CourseSequence,
// BrowsePage.goal, ManageCatalogPanel and shellSafety; the very next run failed
// a different single test; every one of them passed in isolation.
//
// A suite that fails somewhere different on each run teaches people to re-run
// instead of reading the failure, which is exactly how a real regression gets
// waved through. Hence an explicit budget with real headroom.
//
// This test guards the setting rather than the symptom: if someone removes
// testTimeout, the flakiness returns silently and nothing else would notice.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const config = readFileSync("vite.config.js", "utf8");

// Slowest observed component test, measured not guessed (CourseSequence's
// full-course paging at ~2.4s). The budget must leave real room above it.
const SLOWEST_OBSERVED_MS = 2405;

function configuredMs(key) {
  const match = config.match(new RegExp(`${key}:\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
}

describe("test timeout budget", () => {
  it("sets an explicit per-test timeout instead of relying on the 5s default", () => {
    expect(configuredMs("testTimeout")).not.toBeNull();
  });

  it("leaves at least 4x headroom over the slowest component test", () => {
    expect(configuredMs("testTimeout")).toBeGreaterThanOrEqual(SLOWEST_OBSERVED_MS * 4);
  });

  it("still bounds a genuine hang rather than waiting forever", () => {
    // A budget this large would stop a hung test from ever surfacing.
    expect(configuredMs("testTimeout")).toBeLessThanOrEqual(60000);
  });

  it("gives hooks the same budget, since setup work is what usually stalls", () => {
    expect(configuredMs("hookTimeout")).toBe(configuredMs("testTimeout"));
  });

  it("explains why the budget exists, so it is not trimmed back later", () => {
    expect(config).toMatch(/Vitest defaults to a 5s per-test timeout/);
  });
});
