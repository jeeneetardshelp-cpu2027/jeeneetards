import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";

const root = resolve(import.meta.dirname, "..");
const read = (name) => readFileSync(resolve(root, name), "utf8");
const production = read("content_reports_v10_production.sql");
const preflight = read("content_reports_v10_production_preflight.sql");
const rollback = read("content_reports_v10_production_rollback.sql");
const migration = read("src/migrations/content_reports_hardening_v10.sql").trim();

describe("content report production package", () => {
  it("wraps the exact staging-proven migration in one transaction", () => {
    expect(production).toContain(migration);
    expect(production.indexOf("begin;")).toBeLessThan(production.indexOf(migration));
    expect(production.indexOf("commit;")).toBeGreaterThan(production.indexOf(migration));
  });

  it("refuses an explicitly marked staging or test target", () => {
    expect(production).toContain("v_environment in ('staging', 'test')");
    expect(production).toContain("refusing: target identifies as staging/test");
  });

  it("does not directly query an environment table that production may omit", () => {
    const preflightResult = preflight.slice(preflight.indexOf("$$;") + 3);
    expect(preflightResult).not.toMatch(/from\s+public\.app_environment/i);
    const postflight = production.slice(production.lastIndexOf("commit;"));
    expect(postflight).not.toMatch(/from\s+public\.app_environment/i);
  });

  it("contains no operation that removes report data or tables", () => {
    expect(production).not.toMatch(/\b(?:delete\s+from|truncate|drop\s+table|drop\s+column)\b/i);
  });

  it("keeps preflight read-only and rollback data-preserving", () => {
    const executablePreflight = preflight
      .replace(/--[^\n]*/g, "")
      .replace(/'(?:''|[^'])*'/g, "''");
    expect(executablePreflight).not.toMatch(
      /(?:^|;)\s*(?:insert|update|delete|alter|drop|create|grant|revoke|truncate)\b/im,
    );
    expect(rollback).not.toMatch(/\b(?:delete\s+from|truncate|drop\s+table|drop\s+column)\b/i);
  });

  it("hash manifest matches every generated artifact", () => {
    const manifest = new Map(
      read("content_reports_v10_production.sha256.txt")
        .trim().split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/, 2).reverse()),
    );
    for (const name of [
      "content_reports_v10_production_preflight.sql",
      "content_reports_v10_production.sql",
      "content_reports_v10_production_rollback.sql",
    ]) {
      const actual = createHash("sha256").update(read(name)).digest("hex");
      expect(manifest.get(name)).toBe(actual);
    }
  });

  it("preserves durable backend evidence from before the UI went live", () => {
    // Historical record from the pre-launch verification run -- not re-edited
    // when contentReporting flipped on (2026-07-31, after an adversarial
    // security review found no exploitable path); it documents what was true
    // at the time it was captured, same convention as the other dated
    // evidence/runbook files in this repo.
    const evidence = JSON.parse(read("docs/report_browser_evidence.json"));
    expect(evidence.database_checks).toEqual({ passed: 7, failed: 0 });
    expect(evidence.browser_success_status).toBe(true);
    expect(evidence.browser_console_errors).toBe(0);
    expect(evidence.cleanup).toEqual({
      reports: 0,
      playlists: 0,
      videos: 0,
      channels: 0,
      authUsers: 0,
    });
    expect(evidence.local_credential_state_deleted).toBe(true);
    expect(RELEASE_FEATURES.contentReporting).toBe(true);
  });
});
