import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checker = readFileSync(
  "src/scripts/checkForumSuspensionAdminStagingReadiness.js",
  "utf8",
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const evidence = JSON.parse(readFileSync(
  "docs/forum/forum_suspension_admin_staging_readiness_2026-08-16.json",
  "utf8",
));

describe("forum suspension-admin staging readiness checker", () => {
  it("fails closed on authorization, project identity, and forum mode", () => {
    expect(checker).toContain('setting("TEST_ALLOW") !== "1"');
    expect(checker).toContain("--confirm-forum-suspension-staging-readonly");
    expect(checker).toContain('expectedProjectRef = "essmxonestbrgmgrtywn"');
    expect(checker).toContain('productionProjectRef = "kezelafqhgqrprpadmlf"');
    expect(checker).toContain("staging URL matches the configured production URL");
    expect(checker).toContain('settings[0]?.mode !== "off"');
    expect(packageJson.scripts["check:forum-suspension-admin-staging-readiness"])
      .toContain("node --use-system-ca");
  });

  it("checks an empty disposable clone without reading user values", () => {
    for (const table of [
      "profiles", "forum_posts", "forum_comments", "forum_reports",
      "forum_suspensions", "forum_moderation_log", "forum_rate_events",
    ]) expect(checker).toContain(`"${table}"`);
    expect(checker).toContain("auth.admin.listUsers");
    expect(checker).toContain("authUsers.users.length");
    expect(checker).not.toMatch(/\.select\([^)]*(email|username|full_name|reason)/);
  });

  it("contains no database or Auth mutation path", () => {
    const executable = checker.split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(executable).not.toMatch(/\.(insert|update|upsert|delete)\s*\(/);
    expect(executable).not.toMatch(/auth\.admin\.(createUser|deleteUser|updateUserById)/);
    expect(executable).not.toMatch(/rpc\(["']forum_admin_(set|moderate|dismiss)/);
    expect(executable).not.toMatch(/rpc\(["']forum_(create|edit|delete|cast|submit)/);
    expect(checker).toContain('writes_attempted: false');
  });

  it("records only counts, fixed project metadata, and redacted failures", () => {
    expect(checker).toContain("safeMessage");
    expect(checker).toContain('join("[REDACTED]")');
    expect(checker).toContain("report.counts.auth_users = authUsers.users.length");
    expect(checker).not.toContain("authUsers.users[");
    expect(checker).toContain("PGRST202");
    expect(checker).toContain("writeEvidence");
  });

  it("records the successful counts-only staging evidence", () => {
    expect(evidence).toMatchObject({
      project_ref: "essmxonestbrgmgrtywn",
      operation: "read-only staging readiness",
      writes_attempted: false,
      environment: "staging",
      forum_mode: "off",
      passed: true,
      fatal: null,
    });
    expect(Object.values(evidence.counts).every((count) => count === 0)).toBe(true);
    expect(Object.values(evidence.rpc_absence).every((code) => code === "PGRST202"))
      .toBe(true);
  });
});
