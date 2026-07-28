import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path = "src/migrations/faculty_registry_neet_batch1_prepared.sql";
const sql = readFileSync(path, "utf8");

describe("NEET faculty batch-1 prepared artifact", () => {
  it("is pinned to the reviewed two-person identity batch", () => {
    expect(sql).toContain("'diksha-sharma'");
    expect(sql).toContain("'yashika-singh'");
    expect(sql).toContain("Diksha Sharma Ma''am");
    expect(sql).toContain("Yashika Singh Ma''am");
    expect(sql).toContain("Yashika Ma''am");
    expect(sql).toContain("'Yashika Ma''am', 'short'");
    expect(sql).not.toContain("'short-name'");
  });

  it("fails closed on the exact 45-course and 8/8 production baseline", () => {
    expect(sql).toContain("expected exactly 45 NEET courses");
    expect(sql).toContain("reviewed 8/8 split");
    expect(sql).toContain(
      "array[105,106,107,123,124,125,126,127,128,129,130,131,132,133,134,135]::bigint[]",
    );
  });

  it("creates only additive, idempotent normalized records", () => {
    expect(sql).toMatch(/on conflict \(slug\) do nothing/i);
    expect(sql).toMatch(/on conflict \(teacher_id, normalized_alias\) do nothing/i);
    expect(sql).toMatch(/on conflict \(playlist_id, teacher_id\) do nothing/i);
    expect(sql).not.toMatch(/\b(update|delete|alter|drop|truncate)\b/i);
  });

  it("never rewrites legacy teacher text or links the batch to JEE", () => {
    expect(sql).not.toMatch(/update\s+public\.playlists/i);
    expect(sql).toContain("NEET batch unexpectedly linked a JEE course");
    expect(sql).toContain("d7aae3ce7635401ebeffe97e627048bc");
  });

  it("matches its checked-in SHA-256 manifest", () => {
    const expected = readFileSync(`${path}.sha256.txt`, "utf8").trim().split(/\s+/)[0];
    const actual = createHash("sha256").update(sql).digest("hex");
    expect(actual).toBe(expected);
  });
});
