import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildReviewBundle } from "./reviewIngestion.js";
import { parseVerifyArgs, verifyReviewBundle } from "./verifyIngestionReview.js";

const projectRef = "abcdefghijklmnopqrst";
const taxonomy = {
  marker: null,
  subjects: [{ id: 1, name: "Physics", slug: "physics" }],
  learningGoals: [{ id: 10, name: "JEE", slug: "jee" }],
  chapters: [{ id: 101, subject_id: 1, name: "Kinematics", slug: "kinematics" }],
  teachers: [{
    id: 34,
    display_name: "Alakh Pandey",
    verified: true,
    aliases: [{ alias: "ALK", status: "verified" }],
  }],
};

function sampleBundle() {
  return buildReviewBundle({
    environment: "production",
    expectedProjectRef: projectRef,
    databaseUrl: `https://${projectRef}.supabase.co`,
    taxonomy,
    owner: {
      channelId: "UC_owner",
      channelTitle: "Example Academy",
      playlistId: "PL_review",
      playlistTitle: "JEE Class 11 Physics Complete Course",
      playlistDescription: "Faculty: Alakh Pandey",
      videoCount: 1,
    },
    videos: [{
      videoId: "abcdefghijk",
      title: "Kinematics Lecture 1",
      description: "Taught by Alakh Pandey Sir",
      tags: ["JEE", "Physics"],
      sourcePosition: 0,
      durationSeconds: 120,
      captionStatus: "available",
      embeddingStatus: "embeddable",
    }],
    generatedAt: "2026-08-18T12:00:00.000Z",
  });
}

describe("offline ingestion-review verifier", () => {
  it("parses only an explicit JSON bundle path", () => {
    expect(parseVerifyArgs(["--bundle=review.json"])).toEqual({ bundle: "review.json" });
    expect(() => parseVerifyArgs([])).toThrow("--bundle");
    expect(() => parseVerifyArgs(["--bundle=review.txt"])).toThrow("JSON");
    expect(() => parseVerifyArgs(["--bundle=review.json", "--write"])).toThrow("unknown argument");
  });

  it("accepts an intact generated review bundle", () => {
    expect(verifyReviewBundle(sampleBundle())).toMatchObject({
      valid: true,
      errors: [],
      summary: {
        playlist: "PL_review",
        source_videos: 1,
        chapter_review: 0,
        chapter_unmatched: 0,
      },
    });
  });

  it("detects source tampering through the embedded hash", () => {
    const bundle = sampleBundle();
    bundle.source.videos[0].title = "Changed after generation";
    const result = verifyReviewBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("source snapshot SHA-256 mismatch.");
  });

  it("rejects an unknown chapter id even when snapshots are intact", () => {
    const bundle = sampleBundle();
    bundle.chapter_review.rows[0].chapter_id = 999;
    const result = verifyReviewBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("chapter row 1 uses unknown chapter id.");
  });

  it("rejects a weakened read-only contract or missing review item", () => {
    const bundle = sampleBundle();
    bundle.safety.importable = true;
    bundle.human_review.items = [];
    const result = verifyReviewBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "importable must be false.",
      "human-review items do not match non-automatic proposal fields.",
    ]));
  });

  it("reports malformed review arrays instead of crashing", () => {
    const bundle = sampleBundle();
    bundle.human_review.items = {};
    bundle.chapter_review.rows[0].alternatives = null;
    const result = verifyReviewBundle(bundle);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "human-review items must be an array.",
      "chapter row 1 alternatives must be an array.",
    ]));
  });

  it("keeps the verifier offline and without a file-writing path", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/scripts/verifyIngestionReview.js"),
      "utf8",
    );
    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/createClient|\.from\s*\(|writeFile/u);
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );
    expect(packageJson.scripts["verify:ingestion-review"])
      .toBe("node src/scripts/verifyIngestionReview.js");
  });
});
