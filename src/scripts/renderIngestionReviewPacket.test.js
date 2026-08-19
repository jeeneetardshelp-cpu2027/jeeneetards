import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDecisionWorksheet } from "./prepareIngestionDecisions.js";
import { buildReviewBundle } from "./reviewIngestion.js";
import {
  assertReviewPacketOutputAvailable,
  parseReviewPacketArgs,
  renderReviewPacket,
  resolveReviewPacketPaths,
} from "./renderIngestionReviewPacket.js";

const projectRef = "abcdefghijklmnopqrst";
const taxonomy = {
  marker: null,
  categories: [{ id: 20, name: "JEE", slug: "jee" }],
  subjects: [{ id: 1, name: "Physics", slug: "physics" }],
  learningGoals: [{ id: 10, name: "JEE", slug: "jee" }],
  categoryLearningGoals: [{ category_id: 20, learning_goal_id: 10 }],
  boards: [],
  classLevels: [
    { id: 40, name: "Class 11", slug: "class-11" },
    { id: 41, name: "Class 12", slug: "class-12" },
    { id: 42, name: "Dropper", slug: "dropper" },
  ],
  learningGoalClassLevels: [
    { learning_goal_id: 10, class_level_id: 40 },
    { learning_goal_id: 10, class_level_id: 41 },
    { learning_goal_id: 10, class_level_id: 42 },
  ],
  chapters: [{ id: 101, subject_id: 1, name: "Kinematics", slug: "kinematics" }],
  teachers: [{
    id: 34,
    display_name: "Alakh Pandey",
    verified: true,
    aliases: [{ alias: "ALK", status: "verified" }],
  }],
};

function artifacts() {
  const bundle = buildReviewBundle({
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
      title: "Kinematics DPP Quiz 1",
      description: "Taught by Alakh Pandey Sir",
      tags: ["JEE", "Physics"],
      sourcePosition: 0,
      durationSeconds: 125,
      captionStatus: "available",
      embeddingStatus: "embeddable",
    }],
    generatedAt: "2026-08-18T12:00:00.000Z",
  });
  return { bundle, worksheet: buildDecisionWorksheet(bundle) };
}

describe("offline ingestion human-review packet", () => {
  it("parses only explicit JSON inputs and local output controls", () => {
    expect(parseReviewPacketArgs([
      "--bundle=review.json",
      "--decisions",
      "decisions.json",
      "--out=packet.md",
      "--overwrite",
    ])).toEqual({
      bundle: "review.json",
      decisions: "decisions.json",
      out: "packet.md",
      overwrite: true,
    });
    expect(() => parseReviewPacketArgs(["--bundle=review.json"])).toThrow("--decisions");
    expect(() => parseReviewPacketArgs([
      "--bundle=review.json",
      "--decisions=decisions.json",
      "--write",
    ])).toThrow("unknown argument");
  });

  it("keeps the Markdown packet outside the repository", () => {
    const repoRoot = resolve("C:/workspace/repo");
    const outputDir = resolve(repoRoot, "..", "outputs");
    expect(resolveReviewPacketPaths({
      bundle: resolve(outputDir, "playlist.review.json"),
      decisions: resolve(outputDir, "playlist.decisions.json"),
      repoRoot,
    })).toEqual({
      bundlePath: resolve(outputDir, "playlist.review.json"),
      decisionsPath: resolve(outputDir, "playlist.decisions.json"),
      outputPath: resolve(outputDir, "playlist.review.md"),
    });
    expect(() => resolveReviewPacketPaths({
      bundle: resolve(outputDir, "playlist.review.json"),
      decisions: resolve(outputDir, "playlist.decisions.json"),
      out: "docs/packet.md",
      cwd: repoRoot,
      repoRoot,
    })).toThrow("outside the repository");
  });

  it("refuses implicit overwrite", () => {
    expect(() => assertReviewPacketOutputAvailable("packet.md", false, () => true))
      .toThrow("refusing to overwrite");
    expect(() => assertReviewPacketOutputAvailable("packet.md", true, () => true)).not.toThrow();
  });

  it("renders hash-bound evidence without making recommendations or decisions", () => {
    const { bundle, worksheet } = artifacts();
    const markdown = renderReviewPacket(bundle, worksheet, {
      generatedAt: "2026-08-18T15:00:00.000Z",
    });
    expect(markdown).toContain("# Ingestion human-review packet");
    expect(markdown).toContain(worksheet.binding.review_bundle_sha256);
    expect(markdown).toContain("Position 1: Kinematics DPP Quiz 1");
    expect(markdown).toContain("https://www.youtube.com/playlist?list=PL_review");
    expect(markdown).toContain("https://www.youtube.com/watch?v=abcdefghijk");
    expect(markdown).toContain("Duration: 2:05");
    expect(markdown).toContain('Captions: `"available"`');
    expect(markdown).toContain('Observed source tags: `"JEE"`, `"Physics"`');
    expect(markdown).toContain("Per-video teacher candidates: Alakh Pandey");
    expect(markdown).toContain('Allowed controlled values: `"hindi"`, `"english"`, `"hinglish"`');
    expect(markdown).toContain("Human review complete: **No**");
    expect(markdown).toContain("Database writes allowed: **No**");
    expect(markdown).not.toMatch(/recommended action|we recommend|approved for import/iu);
  });

  it("rejects a worksheet that no longer matches its bundle", () => {
    const { bundle, worksheet } = artifacts();
    worksheet.binding.source_sha256 = "0".repeat(64);
    expect(() => renderReviewPacket(bundle, worksheet)).toThrow("failed verification");
  });

  it("has no network, database, importer, or child-process path", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/scripts/renderIngestionReviewPacket.js"),
      "utf8",
    );
    expect(source).not.toMatch(/\bfetch\s*\(|createClient|\.from\s*\(|service_role/iu);
    expect(source).not.toMatch(/execFile|execSync|spawn\s*\(|child_process/iu);
  });
});
