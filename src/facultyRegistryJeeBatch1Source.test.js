import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "src/migrations/faculty_registry_jee_batch1_clone_rehearsal.sql",
);
const sql = readFileSync(migrationPath, "utf8");

describe("JEE faculty batch 1 clone-rehearsal source", () => {
  it("is additive, transactional, and explicitly clone-only", () => {
    expect(sql).toMatch(/CLONE REHEARSAL ONLY/i);
    expect(sql).toMatch(/^\s*begin;/m);
    expect(sql).toMatch(/^\s*commit;/m);
    expect(sql).not.toMatch(/^\s*(update|delete|truncate|alter|drop)\b/im);
  });

  it("matches the reviewed artifact hash", () => {
    const manifest = readFileSync(
      resolve(
        root,
        "src/migrations/faculty_registry_jee_batch1_clone_rehearsal.sha256.txt",
      ),
      "utf8",
    ).trim();
    const digest = createHash("sha256").update(sql).digest("hex");
    expect(manifest).toBe(`${digest}  faculty_registry_jee_batch1_clone_rehearsal.sql`);
  });

  it("uses only the four reviewed identities and aliases", () => {
    for (const value of [
      "Amit Bijarnia", "ABJ Sir",
      "Alok Kumar", "ALK Sir",
      "Neeraj Saini", "NS Sir",
      "Mohit Tyagi", "MT Sir",
    ]) {
      expect(sql).toContain(value);
    }
    expect(sql).toContain("docs/faculty_identity_review_batch_1_2026-07-28.md");
  });

  it("fails closed on the exact 83-course 33/23/4/23 baseline", () => {
    expect(sql).toMatch(/expected exactly 83 JEE courses/i);
    expect(sql).toMatch(/33\/23\/4\/23/);
    expect(sql).toMatch(/expected exactly 83 reviewed JEE faculty links/i);
    expect(sql).toMatch(/every JEE course must have exactly one faculty link/i);
  });

  it("never rewrites the legacy teacher field or links NEET courses", () => {
    expect(sql).not.toMatch(/update\s+public\.playlists/i);
    expect(sql).toMatch(/JEE batch unexpectedly linked a NEET course/i);
    expect(sql).toMatch(/on conflict \(playlist_id, teacher_id\) do nothing/i);
  });
});
