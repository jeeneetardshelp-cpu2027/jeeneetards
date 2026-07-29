import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path = "src/migrations/faculty_registry_neet_batch23_prepared.sql";
const sql = readFileSync(path, "utf8");

describe("NEET faculty batches 2-3 prepared artifact", () => {
  it("is pinned to all 18 reviewed identities and 26 exact courses", () => {
    for (const slug of [
      "vipin-sharma",
      "pankaj-sijariya",
      "amit-mahajan",
      "manish-raj",
      "pawan-kumar-pandey",
      "mohit-dadheech",
      "nikhil-saini",
      "pratham-nahata",
      "swagata-mukherjee",
      "tulika-jha",
      "saleem-ahmad",
      "shubh-karan-choudhary",
      "aayudh-yashlaha",
      "abhishek-verma",
      "sudhanshu-kumar",
      "siddharth-sharma",
      "harshit-thakuria",
      "samapti-sinha",
    ]) {
      expect(sql).toContain(`'${slug}'`);
    }
    expect(sql).toContain("expected exactly 26 reviewed NEET faculty links");
  });

  it("fails closed on the exact production baseline and mappings", () => {
    expect(sql).toContain("expected exactly 45 NEET courses");
    expect(sql).toContain("(92,  'Manish Raj')");
    expect(sql).toContain("(122, 'Samapti Ma''am')");
    expect(sql).toContain("reviewed NEET course IDs or teacher values changed");
  });

  it("keeps all three mixed-teacher courses outside the package", () => {
    expect(sql).not.toMatch(/\(91,\s*'/);
    expect(sql).not.toMatch(/\(118,\s*'/);
    expect(sql).not.toMatch(/\(119,\s*'/);
  });

  it("creates only additive, idempotent normalized records", () => {
    expect(sql).toContain("'Vipin Sir', 'short'");
    expect(sql).toContain("'Samapti Ma''am', 'short'");
    expect(sql).toContain("'Manish Raj Sir', 'full-name'");
    expect(sql).not.toContain("'MR Sir'");
    expect(sql).toContain("'SKC Sir', 'initials'");
    expect(sql).not.toContain("'Skc Sir'");
    expect(sql).not.toContain("'short-name'");
    expect(sql).toMatch(/on conflict \(slug\) do nothing/i);
    expect(sql).toMatch(/on conflict \(teacher_id, normalized_alias\) do nothing/i);
    expect(sql).toMatch(/on conflict \(playlist_id, teacher_id\) do nothing/i);
    expect(sql).not.toMatch(/\b(update|delete|alter|drop|truncate)\b/i);
  });

  it("never rewrites legacy text and protects JEE integrity", () => {
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
