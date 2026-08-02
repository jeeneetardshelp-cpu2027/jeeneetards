import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { beforeAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const outputDir = resolve(root, "production/chapter_class_scopes_v14_production");
const read = (name) => readFileSync(resolve(outputDir, name), "utf8");
const sha256 = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

beforeAll(() => {
  execFileSync(
    process.execPath,
    [resolve(root, "src/scripts/buildChapterClassScopeV14ProductionApply.js")],
    { cwd: root, stdio: "pipe" },
  );
});

describe("chapter class scope v14 production package", () => {
  it("pins the approved source, rehearsal, target, and PITR evidence", () => {
    const sql = read("production_apply.sql");
    expect(sql).toContain(
      "6334faeae27575df323a0e8b4561fb4fd471985a5e9978cf1f26bd6d0b4f1459",
    );
    expect(sql).toContain(
      "dd46b3456c49c31d1d235e2e9ba3919cb1188a211c4eeb6821aa7a0966ce5dd0",
    );
    expect(sql).toContain("kezelafqhgqrprpadmlf");
    expect(sql).toContain("02 Aug 2026, 13:31:42 UTC+05:30");
  });

  it("retains the fail-closed production and baseline guards", () => {
    const sql = read("production_apply.sql");
    expect(sql).toContain("app_environment is not production-empty");
    expect(sql).toContain("restore-clone authorization marker exists");
    expect(sql).toContain("clone differs from the reviewed v13 snapshot");
    expect(sql).toContain("protected_memberships <> 1307");
    expect(sql).toContain("c742fabf93ff8dd33d6ecd5eb4793db0");
    expect(sql).toContain("current browse output differs from reviewed evidence");
  });

  it("commits only after the reviewed 90-row postflight", () => {
    const sql = read("production_apply.sql");
    expect(sql.match(/^begin;$/gm)).toHaveLength(1);
    expect(sql.match(/^commit;$/gm)).toHaveLength(1);
    expect(sql.match(/^rollback;$/gm)).toBeNull();
    expect(sql).toContain("expected 90 total rows and 85 v14 rows");
    expect(sql).toContain("projected class chapter totals differ");
    expect(sql.indexOf("$post_apply_guard$;")).toBeLessThan(sql.indexOf("commit;"));
    expect(sql).toContain("v14 persistent production apply verified");
  });

  it("contains no catalogue mutation or schema change", () => {
    const sql = read("production_apply.sql");
    expect(sql).not.toMatch(/^\s*(?:update|delete|alter|drop|truncate|create)\b/gim);
    expect(sql.match(/^insert into public\.chapter_class_levels/gm)).toHaveLength(1);
  });

  it("publishes the exact production checksum", () => {
    const [digest, name] = read("production_apply.sha256.txt").trim().split(/\s{2}/);
    expect(name).toBe("production_apply.sql");
    expect(digest).toBe(sha256(read(name)));
  });

  it("builds a separately checksummed read-only postflight", () => {
    const sql = read("read_only_postflight.sql");
    expect(sql).not.toMatch(/^\s*(?:insert|update|delete|alter|drop|truncate|create|begin|commit)\b/gim);
    expect(sql).toContain("protected_fingerprint");
    expect(sql).toContain("v14_scope_rows");
    expect(sql).toContain("neet_physics_overlap");
    expect(sql).toContain("school_probability_visible");
    expect(sql).toContain("authenticated_facets_execute");

    const [digest, name] = read("read_only_postflight.sha256.txt")
      .trim()
      .split(/\s{2}/);
    expect(name).toBe("read_only_postflight.sql");
    expect(digest).toBe(sha256(read(name)));
  });
});
