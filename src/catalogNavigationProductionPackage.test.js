import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");

const core = read("src/migrations/catalog_navigation_v9.sql");
const delta = read("production/catalog_navigation_v9/production_delta.sql");
const rollback = read("production/catalog_navigation_v9/rollback.sql");
const evidence = read("production/catalog_navigation_v9/evidence.sql");
const manifest = read("production/catalog_navigation_v9/production_delta.sha256.txt");
const report = JSON.parse(read("catalog-navigation-test-report.json"));
const wrapperReport = JSON.parse(read("catalog-navigation-v9-wrapper-test-report.json"));
const dryRun = read("catalog_navigation_v9_production_wrapper_staging_dry_run_v3.sql");
const dryRunHash = read("catalog_navigation_v9_production_wrapper_staging_dry_run_v3.sha256.txt");

describe("catalog navigation v9 production package", () => {
  it("pins the exact core that passed staging", () => {
    expect(hash(core)).toBe("1609de029bc1d94e07ec021fff6499f3203e669bbca0887d1013453ff7425140");
    expect(delta).toContain(core);
    expect(report).toMatchObject({
      run: "50bee2", passed: 10, failed: 0,
      fatal: null, guard_failed: false, cleanup_ran: true,
    });
  });

  it("requires a green rollback rehearsal of the production wrapper", () => {
    expect(wrapperReport).toMatchObject({
      artifact_sha256: "0e639d0a102b25477d0c6f292b07ecdf14ab1a1fb470e3c65bf809013ce8c8bc",
      transaction_ended_with: "rollback",
      production_touched: false,
      final_result: {
        environment_after: "staging",
        curriculum_function_restored: true,
        facet_function_restored: true,
        goal_index_restored: true,
        class_index_restored: true,
      },
    });
  });

  it("wraps preflight, core and postflight in one explicit bounded transaction", () => {
    expect(delta.indexOf("catalog_navigation_v9_production_preflight.sql"))
      .toBeLessThan(delta.indexOf("catalog_navigation_v9.sql"));
    expect(delta.indexOf("catalog_navigation_v9.sql"))
      .toBeLessThan(delta.indexOf("catalog_navigation_v9_production_postflight.sql"));
    expect(delta).toContain("begin;\nset local lock_timeout = '5s';");
    expect(delta).toContain("set local statement_timeout = '60s';");
    expect(delta.trim().endsWith("commit;")).toBe(true);
  });

  it("contains DDL only and no privileged function body", () => {
    expect(delta).not.toMatch(/\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate|alter\s+table|drop\s+table|create\s+table)\b/i);
    expect(delta).not.toMatch(/security\s+definer/i);
    expect(delta).not.toMatch(/\b(?:DRIFTFX|__fixture|staging_test_helpers)\b/i);
  });

  it("fails closed on incompatible targets and unknown existing functions", () => {
    expect(delta).toContain("non-production environment");
    expect(delta).toContain("required columns are missing");
    expect(delta).toContain("already exists; review before replacing it");
    expect(delta).toContain("anon lacks SELECT");
  });

  it("asserts invoker rights, role grants and both indexes after creation", () => {
    expect(delta).toContain("must remain SECURITY INVOKER");
    expect(delta).toContain("has_function_privilege('anon'");
    expect(delta).toContain("grantee = 'PUBLIC'");
    expect(delta).toContain("idx_plg_goal_playlist");
    expect(delta).toContain("idx_pcl_class_playlist");
  });

  it("rollback removes only functions and retains the additive indexes", () => {
    expect(rollback).toMatch(/drop function if exists public\.browse_facet_counts/i);
    expect(rollback).toMatch(/drop function if exists public\.get_browse_curriculum/i);
    expect(rollback).not.toMatch(/drop\s+index/i);
    expect(rollback.trim().endsWith("commit;")).toBe(true);
  });

  it("evidence exercises the anonymous boundary without writing data", () => {
    expect(evidence).toContain("begin read only;");
    expect(evidence).toContain("set local role anon;");
    expect(evidence).not.toMatch(/\b(?:insert|update|delete|truncate)\b/i);
  });

  it("the manifest hashes every delivered artifact and outputs contain no credential shapes", () => {
    for (const name of [
      "production_delta.sql", "rollback.sql", "evidence.sql",
      "wrapper_staging_test_report.json", "README.md",
    ]) {
      const value = read(`production/catalog_navigation_v9/${name}`);
      expect(manifest).toContain(`${hash(value)}  ${name}`);
      expect(value).not.toMatch(/(?:sb_secret_|eyJhbGciOi|AIza)[A-Za-z0-9_.-]{10,}/);
    }
  });

  it("the wrapper rehearsal is staging-guarded, exact-core and rollback-always", () => {
    expect(dryRun).toContain("DISPOSABLE STAGING ONLY. NEVER RUN ON PRODUCTION");
    expect(dryRun).toContain("this rehearsal requires the staging marker");
    expect(dryRun).toContain("set name = 'production'");
    expect(dryRun).not.toContain("production-wrapper-dry-run");
    expect(dryRun).toContain(core);
    expect(dryRun).toContain("set local role anon;");
    expect(dryRun).toContain("CONTENT CHECK: a content or junction count changed");
    expect(dryRun).toContain("catalog_v9.baseline_playlists");
    expect(dryRun).not.toMatch(/create\s+(?:temporary|temp)\s+table/i);
    expect(dryRun).toContain("rollback;");
    expect(dryRun).not.toMatch(/^commit;$/m);
    expect(dryRun).toContain("as curriculum_function_restored");
    expect(dryRunHash).toContain(`${hash(dryRun)}  catalog_navigation_v9_production_wrapper_staging_dry_run_v3.sql`);
  });
});
