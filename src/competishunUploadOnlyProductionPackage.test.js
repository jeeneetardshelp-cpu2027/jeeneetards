import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reviewPath =
  "docs/reviews/competishun-upload-only-candidate-batch-2026-08-03.json";
const jahnPath =
  "docs/sql/competishun_upload_only_jahn_teller_2026-08-03.sql";
const ioqcPath =
  "docs/sql/competishun_upload_only_ioqc_2021_2022_2026-08-03.sql";

const reviewRaw = readFileSync(reviewPath);
const jahn = readFileSync(jahnPath, "utf8");
const ioqc = readFileSync(ioqcPath, "utf8");
const sqlFiles = [jahn, ioqc];

describe("Competishun upload-only production package", () => {
  it("pins the exact owner-reviewed evidence package", () => {
    expect(createHash("sha256").update(reviewRaw).digest("hex")).toBe(
      "62277b6f2378d448f87b1ea7578682b426cfa2c9b4b0f87712b67d8cef1cd850",
    );
    for (const sql of sqlFiles) {
      expect(sql).toContain(
        "Attribution decision: 1c06eb34-fbdc-4d3b-a239-39f256f889e8",
      );
      expect(sql).toContain(
        "62277b6f2378d448f87b1ea7578682b426cfa2c9b4b0f87712b67d8cef1cd850",
      );
    }
  });

  it("keeps both transactions create-only and source-ID-null", () => {
    for (const sql of sqlFiles) {
      expect(sql).toMatch(/^-- CREATE-ONLY production artifact:/);
      expect(sql).toContain("youtube_playlist_id is intentionally NULL");
      expect(sql).not.toMatch(/\b(update|delete|alter|drop|truncate)\b/i);
      expect(sql.match(/\binsert into\b/gi)?.length).toBeGreaterThan(4);
      expect(sql).toContain("begin;");
      expect(sql).toContain("commit;");
    }
  });

  it("serializes the exact baseline and expected deltas", () => {
    expect(jahn).toContain("from public.playlists) <> 292");
    expect(jahn).toContain("from public.videos) <> 3088");
    expect(jahn).toContain("from public.playlist_videos) <> 3094");
    expect(jahn).toContain("from public.playlists) <> 293");
    expect(jahn).toContain("from public.videos) <> 3090");
    expect(jahn).toContain("from public.playlist_videos) <> 3096");

    expect(ioqc).toContain("from public.playlists) <> 293");
    expect(ioqc).toContain("from public.videos) <> 3090");
    expect(ioqc).toContain("from public.playlist_videos) <> 3096");
    expect(ioqc).toContain("from public.playlists) <> 294");
    expect(ioqc).toContain("from public.videos) <> 3093");
    expect(ioqc).toContain("from public.playlist_videos) <> 3099");
  });

  it("rejects every reviewed video reuse and keeps natural order", () => {
    expect(jahn).toContain("array['NW0wDF6acgQ', 'BJlj2EAGLw8']");
    expect(jahn.indexOf("NW0wDF6acgQ")).toBeLessThan(
      jahn.lastIndexOf("BJlj2EAGLw8"),
    );

    expect(ioqc).toContain(
      "array['lAwzadMpkSE', '0DopkpuIfC0', 'xnnuW1XaSEg']",
    );
    expect(ioqc.indexOf("lAwzadMpkSE")).toBeLessThan(
      ioqc.lastIndexOf("0DopkpuIfC0"),
    );
    expect(ioqc.indexOf("0DopkpuIfC0")).toBeLessThan(
      ioqc.lastIndexOf("xnnuW1XaSEg"),
    );
  });

  it("pins the protected v14 boundary after each transaction", () => {
    for (const sql of sqlFiles) {
      expect(sql).toContain("where lg.slug = 'jee' and p.id < 167");
      expect(sql).toContain(
        "c742fabf93ff8dd33d6ecd5eb4793db0",
      );
      expect(sql).toContain("protected JEE fingerprint changed");
    }
    expect(jahn).toContain("'Jahn–Teller Distortion'");
    expect(ioqc).toContain("'IOQC 2021–2022 Solutions'");
    expect(ioqc).toContain("required Jahn-Teller predecessor is missing");
  });
});
