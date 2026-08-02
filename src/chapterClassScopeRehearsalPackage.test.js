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
  "production/chapter_class_scopes_v13_clone_rehearsal",
);
const read = (name) => readFileSync(resolve(outputDir, name), "utf8");
const sha256 = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

beforeAll(() => {
  execFileSync(
    process.execPath,
    [resolve(root, "src/scripts/buildChapterClassScopeRehearsal.js")],
    { cwd: root, stdio: "pipe" },
  );
});

describe("chapter class scope clone rehearsal package", () => {
  it("builds deterministically from the two pinned review sources", () => {
    const rehearsal = read("rollback_rehearsal.sql");
    expect(rehearsal).toContain(
      "89e2de12ccfd3916403ca093a6f6af4a248aac1631ad0fef66c25d9becd5b2a9",
    );
    expect(rehearsal).toContain(
      "c6961481247c74a36cb449aa6bfab45627ccc2fe2fb876f3701bc0c129ca7315",
    );
    expect(rehearsal).toContain("create table if not exists public.chapter_class_levels");
    expect(rehearsal).toContain("create or replace function public.chapter_matches_class_scope");
  });

  it("keeps the preflight anonymous-read compatible and mutation free", () => {
    const preflight = read("read_only_preflight.sql");
    expect(preflight).toContain("READ-ONLY CLONE PREFLIGHT");
    expect(preflight).toContain("to_regclass('public.chapter_class_levels')");
    expect(preflight).toContain("protected_fingerprint");
    expect(preflight).not.toMatch(
      /^\s*(?:insert|update|delete|truncate|create|alter|drop|grant|revoke|commit|rollback)\b/gim,
    );
  });

  it("refuses an unexpected snapshot before DDL", () => {
    const rehearsal = read("rollback_rehearsal.sql");
    for (const expected of ["<> 292", "<> 3088", "<> 3094", "<> 241", "<> 9", "<> 4"]) {
      expect(rehearsal).toContain(expected);
    }
    expect(rehearsal).toContain("protected_courses <> 83");
    expect(rehearsal).toContain("protected_memberships <> 1350");
    expect(rehearsal).toContain("6829fcb6eae22479db7b82b7b3da654d");
    expect(rehearsal.indexOf("$baseline_guard$;")).toBeLessThan(
      rehearsal.indexOf("create table if not exists public.chapter_class_levels"),
    );
  });

  it("has one change transaction, no commit, and an explicit rollback", () => {
    const rehearsal = read("rollback_rehearsal.sql");
    expect(rehearsal.match(/^begin;$/gm)).toHaveLength(1);
    expect(rehearsal.match(/^rollback;$/gm)).toHaveLength(1);
    expect(rehearsal.match(/^commit;$/gm)).toBeNull();
    expect(rehearsal).not.toContain("$not_approved$");
    expect(rehearsal).not.toContain("Fail closed even if this file");
    expect(rehearsal).not.toContain("set_config(");
    expect(rehearsal).not.toContain("current_setting(");
    expect(rehearsal).toContain("set local lock_timeout = '5s'");
    expect(rehearsal).toContain("set local statement_timeout = '60s'");
  });

  it("builds a separately guarded persistent-clone package", () => {
    const authorization = read("authorize_persistent_clone.sql");
    const persistent = read("persistent_clone_apply.sql");

    expect(authorization).toContain("nusprumijjthmrthaitp");
    expect(authorization).toContain("chapter_scope_v13_clone_authorization");
    expect(persistent).toContain("approved restore-clone marker is absent");
    expect(persistent).toContain("nusprumijjthmrthaitp");
    expect(persistent).toContain(
      "89e2de12ccfd3916403ca093a6f6af4a248aac1631ad0fef66c25d9becd5b2a9",
    );
    expect(persistent).toContain(
      "c6961481247c74a36cb449aa6bfab45627ccc2fe2fb876f3701bc0c129ca7315",
    );
    expect(persistent.match(/^begin;$/gm)).toHaveLength(1);
    expect(persistent.match(/^commit;$/gm)).toHaveLength(1);
    expect(persistent.match(/^rollback;$/gm)).toBeNull();
    expect(persistent).toContain("persistent clone apply verified");
  });

  it("verifies restoration of data, function definitions, and grants", () => {
    const rehearsal = read("rollback_rehearsal.sql");
    const rollbackIndex = rehearsal.indexOf("\nrollback;\n");
    expect(rollbackIndex).toBeGreaterThan(0);
    const afterRollback = rehearsal.slice(rollbackIndex);
    expect(afterRollback).toContain("chapter_class_levels still exists");
    expect(afterRollback).toContain("browse function definition drift");
    expect(afterRollback).toContain("browse function grant drift");
    expect(afterRollback).toContain("protected original-83 JEE fingerprint drift");
    expect(afterRollback).toContain("b71d62cc849eec7a72d1607ce205186e");
    expect(afterRollback).toContain("48f982ef788b570def824aa770ae892b");
    expect(afterRollback).toContain("37a7ab878ddb3c8de2877e90e7224b7e");
    expect(afterRollback).toContain(
      "rollback verified; no persistent database change",
    );
  });

  it("publishes a correct checksum manifest and clone-only instructions", () => {
    const manifest = read("chapter_class_scope_rehearsal.sha256.txt")
      .trim()
      .split("\n");
    expect(manifest).toHaveLength(5);
    for (const line of manifest) {
      const [digest, name] = line.split(/\s{2}/);
      expect(digest).toBe(sha256(read(name)));
    }

    const readme = read("README.md");
    expect(readme).toContain("Never run either SQL file on production");
    expect(readme).toContain("pinned function and ACL");
    expect(readme).toMatch(/browser QA\s+cannot be evidence/);
  });

  it("does not contain a database client or remote target in the builder", () => {
    const builder = readFileSync(
      resolve(root, "src/scripts/buildChapterClassScopeRehearsal.js"),
      "utf8",
    );
    expect(builder).not.toContain("@supabase/supabase-js");
    expect(builder).not.toMatch(/https:\/\/[^'"`\s]+\.supabase\.co/i);
    expect(builder).not.toContain("service_role");
  });
});
