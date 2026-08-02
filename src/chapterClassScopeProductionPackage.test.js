import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(root, "production/chapter_class_scopes_v13_production");
const read = (name) => readFileSync(resolve(outputDir, name), "utf8");
const sha256 = (value) =>
  createHash("sha256").update(value, "utf8").digest("hex");

beforeAll(() => {
  execFileSync(
    process.execPath,
    [resolve(root, "src/scripts/buildChapterClassScopeProductionApply.js")],
    { cwd: root, stdio: "pipe" },
  );
});

describe("chapter class scope v13 production package", () => {
  it("derives from the exact rehearsed artifact and targets production", () => {
    const sql = read("production_apply.sql");
    expect(sql).toContain("3a36b1f0681ce8c2ba181a042e6d68086009c00bdcf1d7db5a7f80b00dc7f28f");
    expect(sql).toContain("kezelafqhgqrprpadmlf");
    expect(sql).toContain("02 Aug 2026, 00:07:09 UTC+05:30");
    expect(sql).toContain("persistent production apply verified");
  });

  it("refuses staging, clone, function, ACL, catalogue, and JEE drift", () => {
    const sql = read("production_apply.sql");
    expect(sql).toContain("app_environment is not production-empty");
    expect(sql).toContain("restore-clone authorization marker exists");
    expect(sql).toContain("pre-v13 browse function definition drift");
    expect(sql).toContain("pre-v13 browse function grant drift");
    expect(sql).toContain("clone catalogue differs from the reviewed snapshot");
    expect(sql).toContain("6829fcb6eae22479db7b82b7b3da654d");
  });

  it("keeps one guarded transaction and the two pinned migration sources", () => {
    const sql = read("production_apply.sql");
    expect(sql.match(/^begin;$/gm)).toHaveLength(1);
    expect(sql.match(/^commit;$/gm)).toHaveLength(1);
    expect(sql.match(/^rollback;$/gm)).toBeNull();
    expect(sql).toContain("89e2de12ccfd3916403ca093a6f6af4a248aac1631ad0fef66c25d9becd5b2a9");
    expect(sql).toContain("c6961481247c74a36cb449aa6bfab45627ccc2fe2fb876f3701bc0c129ca7315");
  });

  it("publishes the exact production checksum", () => {
    const [digest, name] = read("production_apply.sha256.txt").trim().split(/\s{2}/);
    expect(name).toBe("production_apply.sql");
    expect(digest).toBe(sha256(read(name)));
  });
});
