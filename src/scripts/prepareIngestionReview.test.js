import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildReviewBundle } from "./reviewIngestion.js";
import {
  buildPreparationReceipt,
  preparationArtifactTexts,
  verifyPreparationReceipt,
} from "./ingestionPreparationReceipt.js";
import {
  assertPreparationOutputsAvailable,
  assertReusedBundleTarget,
  collectLivePreparationBundle,
  main,
  parsePreparationArgs,
  prepareIngestionReviewArtifacts,
  resolvePreparationPaths,
} from "./prepareIngestionReview.js";

const projectRef = "abcdefghijklmnopqrst";
const playlistId = "PL_review";

function reviewBundle() {
  return buildReviewBundle({
    environment: "production",
    expectedProjectRef: projectRef,
    databaseUrl: `https://${projectRef}.supabase.co`,
    taxonomy: {
      marker: null,
      categories: [{ id: 20, name: "JEE", slug: "jee" }],
      subjects: [{ id: 1, name: "Physics", slug: "physics" }],
      learningGoals: [{ id: 10, name: "JEE", slug: "jee" }],
      categoryLearningGoals: [{ category_id: 20, learning_goal_id: 10 }],
      boards: [],
      classLevels: [{ id: 40, name: "Class 11", slug: "class-11" }],
      learningGoalClassLevels: [{ learning_goal_id: 10, class_level_id: 40 }],
      chapters: [{ id: 101, subject_id: 1, name: "Kinematics", slug: "kinematics" }],
      teachers: [{
        id: 34,
        display_name: "Alakh Pandey",
        verified: true,
        aliases: [{ alias: "ALK", status: "verified" }],
      }],
    },
    owner: {
      channelId: "UC_owner",
      channelTitle: "Example Academy",
      playlistId,
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
    generatedAt: "2026-08-19T01:00:00.000Z",
  });
}

describe("one-command read-only ingestion review preparation", () => {
  it("requires explicit source, project, and outside output directory", () => {
    expect(parsePreparationArgs([
      `--playlist=${playlistId}`,
      `--expected-project-ref=${projectRef}`,
      "--env=production",
      "--out-dir=../outputs/run-1",
      "--bundle=source.review.json",
      "--prior-manifest=prior.json",
      "--check",
    ])).toEqual({
      playlist: playlistId,
      expectedProjectRef: projectRef,
      environment: "production",
      outDir: "../outputs/run-1",
      bundle: "source.review.json",
      priorManifest: "prior.json",
      check: true,
    });
    expect(() => parsePreparationArgs([
      `--playlist=${playlistId}`,
      `--expected-project-ref=${projectRef}`,
    ])).toThrow("--out-dir");
    expect(() => parsePreparationArgs([
      `--playlist=${playlistId}`,
      `--expected-project-ref=${projectRef}`,
      "--out-dir=../outputs/run-1",
      "--overwrite",
    ])).toThrow("unknown argument");
  });

  it("runs reused-bundle check mode without creating output artifacts", async () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), "ingestion-review-check-"));
    const bundlePath = resolve(tempRoot, "source.review.json");
    const outputDir = resolve(tempRoot, "planned-output");
    writeFileSync(bundlePath, `${JSON.stringify(reviewBundle(), null, 2)}\n`, "utf8");
    const originalLog = console.log;
    let summary;
    let outputExists;
    console.log = (value) => { summary = JSON.parse(value); };
    try {
      await main([
        `--playlist=${playlistId}`,
        `--expected-project-ref=${projectRef}`,
        "--env=production",
        `--out-dir=${outputDir}`,
        `--bundle=${bundlePath}`,
        "--check",
      ]);
      outputExists = existsSync(outputDir);
    } finally {
      console.log = originalLog;
      rmSync(tempRoot, { recursive: true, force: true });
    }
    expect(summary).toMatchObject({
      output_directory: null,
      bundle: null,
      decisions: null,
      packet: null,
      response: null,
      receipt: null,
      check_only: true,
      output_written: false,
      live_reads_performed: false,
      reused_verified_bundle: true,
      writes_attempted: false,
    });
    expect(outputExists).toBe(false);
  });

  it("binds reused real-review input to the explicit target", () => {
    const bundle = reviewBundle();
    const args = {
      playlist: playlistId,
      expectedProjectRef: projectRef,
      environment: "production",
    };
    expect(() => assertReusedBundleTarget(bundle, args)).not.toThrow();
    expect(() => assertReusedBundleTarget(bundle, { ...args, playlist: "PL_other" }))
      .toThrow("playlist");
    expect(() => assertReusedBundleTarget(bundle, {
      ...args,
      expectedProjectRef: "zyxwvutsrqponmlkjihg",
    })).toThrow("project");
    expect(() => assertReusedBundleTarget(bundle, { ...args, environment: "staging" }))
      .toThrow("environment");
  });

  it("composes live collection with an anonymous client and exact target", async () => {
    const expectedBundle = reviewBundle();
    const fakeDb = { kind: "anonymous-test-client" };
    let clientOptions;
    let collectorOptions;
    const result = await collectLivePreparationBundle({
      playlist: playlistId,
      expectedProjectRef: projectRef,
      environment: "production",
    }, {
      generatedAt: "2026-08-19T03:00:00.000Z",
      loadEnvironment: () => ({
        databaseUrl: `https://${projectRef}.supabase.co`,
        anonKey: "anon-test-key",
        youtubeKey: "youtube-test-key",
      }),
      createClient: (options) => {
        clientOptions = options;
        return fakeDb;
      },
      collectReview: async (options) => {
        collectorOptions = options;
        return expectedBundle;
      },
    });
    expect(result).toBe(expectedBundle);
    expect(clientOptions).toEqual({
      service: false,
      env: {
        VITE_SUPABASE_URL: `https://${projectRef}.supabase.co`,
        VITE_SUPABASE_ANON_KEY: "anon-test-key",
      },
    });
    expect(collectorOptions).toMatchObject({
      playlist: playlistId,
      environment: "production",
      expectedProjectRef: projectRef,
      databaseUrl: `https://${projectRef}.supabase.co`,
      youtubeKey: "youtube-test-key",
      db: fakeDb,
      generatedAt: "2026-08-19T03:00:00.000Z",
    });
  });

  it("keeps all artifacts outside the repository and refuses any overwrite", () => {
    const repoRoot = resolve("C:/workspace/repo");
    const outputDir = resolve(repoRoot, "..", "outputs", "run-1");
    const paths = resolvePreparationPaths({
      playlist: playlistId,
      outDir: outputDir,
      repoRoot,
    });
    expect(paths.bundlePath).toBe(resolve(outputDir, `${playlistId}.review.json`));
    expect(paths.decisionsPath).toBe(resolve(outputDir, `${playlistId}.decisions.json`));
    expect(paths.packetPath).toBe(resolve(outputDir, `${playlistId}.review.md`));
    expect(paths.responsePath).toBe(resolve(outputDir, `${playlistId}.response.json`));
    expect(paths.receiptPath).toBe(resolve(outputDir, `${playlistId}.receipt.json`));
    expect(() => assertPreparationOutputsAvailable(
      paths,
      (path) => path === paths.responsePath,
    )).toThrow("Choose a new --out-dir");
    expect(() => resolvePreparationPaths({
      playlist: playlistId,
      outDir: resolve(repoRoot, "artifacts"),
      repoRoot,
    })).toThrow("outside the repository");
  });

  it("builds and verifies the complete blank review set before writing", () => {
    const bundle = reviewBundle();
    const artifacts = prepareIngestionReviewArtifacts(bundle, {
      generatedAt: "2026-08-19T02:00:00.000Z",
    });
    expect(artifacts.verification.bundle.valid).toBe(true);
    expect(artifacts.verification.worksheet.valid).toBe(true);
    expect(artifacts.verification.worksheet.complete).toBe(false);
    expect(artifacts.worksheet.completion.completed_decisions).toBe(0);
    expect(artifacts.response.proposal_responses.every(
      (entry) => entry.reviewer_action == null,
    )).toBe(true);
    expect(artifacts.response.video_scope_responses.every(
      (entry) => entry.reviewer_action == null,
    )).toBe(true);
    expect(artifacts.packet).toContain("Human review complete: **No**");
    expect(artifacts.packet).toContain("Database writes allowed: **No**");
  });

  it("binds all prepared files into a tamper-evident blank-review receipt", () => {
    const artifacts = prepareIngestionReviewArtifacts(reviewBundle(), {
      generatedAt: "2026-08-19T04:00:00.000Z",
    });
    const options = {
      ...artifacts,
      generatedAt: "2026-08-19T04:00:00.000Z",
      liveReadsPerformed: false,
      reusedVerifiedBundle: true,
      fileNames: {
        review_bundle: `${playlistId}.review.json`,
        decision_worksheet: `${playlistId}.decisions.json`,
        review_packet: `${playlistId}.review.md`,
        reviewer_response: `${playlistId}.response.json`,
      },
    };
    const receipt = buildPreparationReceipt(options);
    const texts = preparationArtifactTexts(artifacts);
    expect(verifyPreparationReceipt(receipt, texts)).toMatchObject({
      valid: true,
      errors: [],
      summary: { artifact_count: 4, completed_decisions: 0 },
    });
    expect(verifyPreparationReceipt(receipt, {
      ...texts,
      review_packet: `${texts.review_packet}\ntampered\n`,
    }).errors).toContain("receipt artifact review_packet hash does not match.");

    const contradictoryReceipt = structuredClone(receipt);
    contradictoryReceipt.preparation.live_reads_performed = true;
    expect(verifyPreparationReceipt(contradictoryReceipt, texts).errors)
      .toContain("receipt must identify exactly one live or reused-bundle preparation mode.");
    const extendedReceipt = structuredClone(receipt);
    extendedReceipt.database_write_override = true;
    expect(verifyPreparationReceipt(extendedReceipt, texts).errors)
      .toContain("receipt has unexpected fields.");

    const decidedArtifacts = structuredClone(artifacts);
    decidedArtifacts.response.reviewer.name = "Reviewer";
    const decidedReceipt = buildPreparationReceipt({ ...options, ...decidedArtifacts });
    expect(verifyPreparationReceipt(
      decidedReceipt,
      preparationArtifactTexts(decidedArtifacts),
    ).errors).toContain("initial reviewer response must remain blank.");
  });

  it("contains no database mutation, importer, or child-process path", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/scripts/prepareIngestionReview.js"),
      "utf8",
    );
    expect(source).not.toMatch(/\.(?:insert|upsert|delete)\s*\(/u);
    expect(source).not.toMatch(/(?:db|query)\s*\.\s*update\s*\(/iu);
    expect(source).not.toMatch(/\.rpc\s*\(|service\s*:\s*true|importChannel|child_process/iu);
  });
});
