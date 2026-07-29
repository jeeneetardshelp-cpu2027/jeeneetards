import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path = "src/migrations/faculty_registry_neet_drona_prepared.sql";
const sql = readFileSync(path, "utf8");

describe("NEET Drona faculty prepared artifact", () => {
  it("is pinned to the exact 15 reviewed course identities", () => {
    for (let id = 136; id <= 150; id += 1) {
      expect(sql).toContain(`(${id},`);
    }
    expect(sql).toContain("expected exactly 15 Drona faculty links");
    expect(sql).toContain("expected exactly 60 NEET courses");
    expect(sql).toContain("reviewed Drona course identity changed");
  });

  it("creates only the four missing verified teachers", () => {
    for (const slug of [
      "tanuj-bansal",
      "dr-roopali",
      "agrim-jain",
      "ashima-gupta",
    ]) {
      expect(sql).toContain(`'${slug}'`);
    }
    expect(sql).toContain("'sudhanshu-kumar'");
    expect(sql).toContain("reviewed Sudhanshu Kumar identity is missing");
  });

  it("leaves unresolved Vardaan courses outside the package", () => {
    expect(sql).not.toMatch(/\(118,\s*'/);
    expect(sql).not.toMatch(/\(119,\s*'/);
  });

  it("contains only additive, idempotent row creation", () => {
    expect(sql).toMatch(/on conflict \(slug\) do nothing/i);
    expect(sql).toMatch(/on conflict \(teacher_id, institute_id\) do nothing/i);
    expect(sql).toMatch(/on conflict \(playlist_id, teacher_id\) do nothing/i);
    expect(sql).not.toMatch(/\b(update|delete|alter|drop|truncate)\b/i);
  });

  it("protects JEE integrity and never rewrites legacy labels", () => {
    expect(sql).not.toMatch(/update\s+public\.playlists/i);
    expect(sql).toContain("Drona faculty package unexpectedly linked a JEE course");
    expect(sql).toContain("d7aae3ce7635401ebeffe97e627048bc");
  });

  it("matches its checked-in SHA-256 manifest", () => {
    const expected = readFileSync(`${path}.sha256.txt`, "utf8").trim().split(/\s+/)[0];
    const actual = createHash("sha256").update(sql).digest("hex");
    expect(actual).toBe(expected);
  });
});
