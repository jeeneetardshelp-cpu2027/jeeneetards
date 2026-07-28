import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path = "src/migrations/faculty_registry_neet_batch4_course91_prepared.sql";
const sql = readFileSync(path, "utf8");

describe("NEET faculty batch-4 course-91 prepared artifact", () => {
  it("is pinned to the reviewed mixed-teacher identity", () => {
    expect(sql).toContain("p.id = 91");
    expect(sql).toContain("Tarun Sir & Samapti Ma''am");
    expect(sql).toContain("'tarun-kumar'");
    expect(sql).toContain("'samapti-sinha'");
  });

  it("preserves two ordered instructors", () => {
    expect(sql).toContain("('tarun-kumar', 1)");
    expect(sql).toContain("('samapti-sinha', 2)");
    expect(sql).toContain("exactly two ordered reviewed teachers");
  });

  it("fails closed on the exact production baseline", () => {
    expect(sql).toContain("expected exactly 45 NEET courses");
    expect(sql).toContain("reviewed NEET course 91 or teacher value changed");
    expect(sql).toContain("course 91 has a conflicting faculty link");
  });

  it("creates only additive, idempotent normalized records", () => {
    expect(sql).toContain("'Tarun Sir', 'short'");
    expect(sql).toContain("'Samapti Ma''am', 'short'");
    expect(sql).not.toContain("'short-name'");
    expect(sql).toMatch(/on conflict \(slug\) do nothing/i);
    expect(sql).toMatch(/on conflict \(teacher_id, normalized_alias\) do nothing/i);
    expect(sql).toMatch(/on conflict \(playlist_id, teacher_id\) do nothing/i);
    expect(sql).not.toMatch(/\b(update|delete|alter|drop|truncate)\b/i);
  });

  it("never rewrites legacy text and protects JEE integrity", () => {
    expect(sql).not.toMatch(/update\s+public\.playlists/i);
    expect(sql).toContain("course 91 unexpectedly belongs to JEE");
    expect(sql).toContain("d7aae3ce7635401ebeffe97e627048bc");
  });

  it("matches its checked-in SHA-256 manifest", () => {
    const expected = readFileSync(`${path}.sha256.txt`, "utf8").trim().split(/\s+/)[0];
    const actual = createHash("sha256").update(sql).digest("hex");
    expect(actual).toBe(expected);
  });
});
