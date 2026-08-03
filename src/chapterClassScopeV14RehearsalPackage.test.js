import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(
  root,
  "production/chapter_class_scopes_v14_clone_rehearsal",
);
const read = (name) => readFileSync(resolve(outputDir, name), "utf8");
const sha256 = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

beforeAll(() => {
  execFileSync(
    process.execPath,
    [resolve(root, "src/scripts/buildChapterClassScopeV14Rehearsal.js")],
    { cwd: root, stdio: "pipe" },
  );
});

describe("chapter class scope v14 clone rehearsal package", () => {
  it("builds from the exact approved review hash", () => {
    const rehearsal = read("rollback_rehearsal.sql");
    expect(rehearsal).toContain(
      "6334faeae27575df323a0e8b4561fb4fd471985a5e9978cf1f26bd6d0b4f1459",
    );
    expect(rehearsal).toContain("expected 90 total rows and 85 v14 rows");
    expect(rehearsal).not.toContain("$not_approved$");
  });

  it("keeps preflight read-only and requires the v13 scope table", () => {
    const preflight = read("read_only_preflight.sql");
    expect(preflight).toContain("READ-ONLY CLONE PREFLIGHT");
    expect(preflight).toContain("scope_rows");
    expect(preflight).toContain("protected_fingerprint");
    expect(preflight).not.toMatch(
      /^\s*(?:insert|update|delete|truncate|create|alter|drop|grant|revoke|commit|rollback)\b/gim,
    );
  });

  it("pins catalogue, v13 scope, and protected-JEE baselines before insert", () => {
    const rehearsal = read("rollback_rehearsal.sql");
    for (const value of ["<> 292", "<> 3088", "<> 3094", "<> 241", "<> 9", "<> 4"]) {
      expect(rehearsal).toContain(value);
    }
    expect(rehearsal).toContain("chapter_class_levels) <> 5");
    expect(rehearsal).toContain("protected_courses <> 83");
    expect(rehearsal).toContain("protected_memberships <> 1307");
    expect(rehearsal).toContain("c742fabf93ff8dd33d6ecd5eb4793db0");
    expect(rehearsal.indexOf("$baseline_guard$;")).toBeLessThan(
      rehearsal.indexOf("insert into public.chapter_class_levels"),
    );
  });

  it("has one transaction, one rollback, and no commit or persistent apply", () => {
    const rehearsal = read("rollback_rehearsal.sql");
    expect(rehearsal.match(/^begin;$/gm)).toHaveLength(1);
    expect(rehearsal.match(/^rollback;$/gm)).toHaveLength(1);
    expect(rehearsal.match(/^commit;$/gm)).toBeNull();
    expect(rehearsal).toContain("set local lock_timeout = '5s'");
    expect(rehearsal).toContain("set local statement_timeout = '90s'");
    expect(rehearsal).not.toContain("persistent clone apply verified");
    expect(rehearsal).not.toContain("production apply");
  });

  it("checks the projected browse deltas and preserves School Probability", () => {
    const rehearsal = read("rollback_rehearsal.sql");
    expect(rehearsal).toContain("projected overlap counts differ");
    expect(rehearsal).toContain("projected class chapter totals differ");
    expect(rehearsal).toContain("shared School Class 10 Probability disappeared");
    expect(rehearsal).toContain("get_browse_curriculum('school', 'class-10', 'mathematics')");
    expect(rehearsal).toContain("get_browse_curriculum('neet', 'class-11', 'biology')");
  });

  it("verifies rollback to the five-row v13 and original browse state", () => {
    const rehearsal = read("rollback_rehearsal.sql");
    const rollbackIndex = rehearsal.indexOf("\nrollback;\n");
    expect(rollbackIndex).toBeGreaterThan(0);
    const afterRollback = rehearsal.slice(rollbackIndex);
    expect(afterRollback).toContain("v13 canonical rows were not restored");
    expect(afterRollback).toContain("protected original-83 JEE fingerprint drift");
    expect(afterRollback).toContain("restored_browse_guard");
    expect(afterRollback).toContain(
      "v14 rollback verified; no persistent database change",
    );
  });

  it("publishes a correct three-file checksum manifest", () => {
    const manifest = read("chapter_class_scope_v14_rehearsal.sha256.txt")
      .trim()
      .split("\n");
    expect(manifest).toHaveLength(3);
    for (const line of manifest) {
      const [digest, name] = line.split(/\s{2}/);
      expect(digest).toBe(sha256(read(name)));
    }
  });

  it("documents the clone-only boundary and all four deferrals", () => {
    const readme = read("README.md");
    expect(readme).toContain("Never run it on production");
    expect(readme).toContain("no production authorization");
    for (const deferred of [
      "probability",
      "p-block-elements",
      "surface-chemistry",
      "qualitative-analysis",
    ]) {
      expect(readme).toContain(deferred);
    }
  });

  it("does not contain a database client or remote Supabase target", () => {
    const builder = readFileSync(
      resolve(root, "src/scripts/buildChapterClassScopeV14Rehearsal.js"),
      "utf8",
    );
    expect(builder).not.toContain("@supabase/supabase-js");
    expect(builder).not.toMatch(/https:\/\/[^'"`\s]+\.supabase\.co/i);
    expect(builder).not.toContain("service_role");
  });
});
