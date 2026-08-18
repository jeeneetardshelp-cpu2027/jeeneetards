import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  assertDatabaseProject,
  assertEnvironmentMarker,
  assertReviewOutputAvailable,
  buildReviewBundle,
  collectIngestionReview,
  loadRunnerEnvironment,
  parseArgs,
  resolveReviewOutputPath,
} from "./reviewIngestion.js";

const here = dirname(fileURLToPath(import.meta.url));
const projectRef = "abcdefghijklmnopqrst";
const databaseUrl = `https://${projectRef}.supabase.co`;

const taxonomy = {
  marker: null,
  subjects: [{ id: 1, name: "Physics", slug: "physics" }],
  learningGoals: [{ id: 10, name: "JEE", slug: "jee" }],
  teachers: [{
    id: 34,
    display_name: "Alakh Pandey",
    verified: true,
    aliases: [{ alias: "ALK", status: "verified" }],
  }],
};

const owner = {
  channelId: "UC_owner",
  channelTitle: "Example Academy",
  playlistId: "PL_review",
  playlistTitle: "JEE Class 11 Physics Complete Course",
  playlistDescription: "Faculty: Alakh Pandey",
  videoCount: 1,
};

const videos = [{
  videoId: "abcdefghijk",
  title: "Kinematics Lecture 1",
  description: "Taught by Alakh Pandey Sir",
  tags: ["JEE", "Physics"],
  sourcePosition: 0,
  durationSeconds: 120,
  captionStatus: "available",
  embeddingStatus: "embeddable",
}];

describe("read-only ingestion review CLI", () => {
  it("parses an explicit playlist and defaults to production reads", () => {
    expect(parseArgs([
      "--playlist",
      "PL_review",
      `--expected-project-ref=${projectRef}`,
    ])).toEqual({
      playlist: "PL_review",
      environment: "production",
      expectedProjectRef: projectRef,
      overwrite: false,
    });
  });

  it("rejects unknown arguments and invalid environments", () => {
    expect(() => parseArgs([
      "--playlist", "PL_review", `--expected-project-ref=${projectRef}`, "--write",
    ])).toThrow("unknown argument");
    expect(() => parseArgs([
      "--playlist", "PL_review", "--env=test", `--expected-project-ref=${projectRef}`,
    ])).toThrow(
      "production or staging",
    );
    expect(() => parseArgs(["--playlist", "PL_review"])).toThrow("expected-project-ref");
  });

  it("keeps review artifacts outside the repository", () => {
    const repoRoot = resolve("C:/workspace/repo");
    const output = resolveReviewOutputPath({ playlist: "PL_review", repoRoot });
    expect(output).toBe(resolve(repoRoot, "..", "outputs", "ingestion-review", "PL_review.review.json"));
    expect(() => resolveReviewOutputPath({
      playlist: "PL_review",
      out: "docs/review.json",
      cwd: repoRoot,
      repoRoot,
    })).toThrow("outside the repository");
  });

  it("refuses to overwrite an existing review unless explicitly allowed", () => {
    expect(() => assertReviewOutputAvailable("review.json", false, () => true))
      .toThrow("refusing to overwrite");
    expect(() => assertReviewOutputAvailable("review.json", true, () => true)).not.toThrow();
  });

  it("loads only the server YouTube key and Supabase anonymous key", () => {
    const env = loadRunnerEnvironment({
      environment: "production",
      runtime: {},
      readEnvironment: () => ({
        VITE_SUPABASE_URL: `"${databaseUrl}"`,
        VITE_SUPABASE_ANON_KEY: "'anon'",
        SUPABASE_SERVICE_ROLE_KEY: "must-not-be-used",
        YOUTUBE_API_KEY: '"youtube-server-key"',
      }),
    });
    expect(env).toEqual({
      databaseUrl,
      anonKey: "anon",
      youtubeKey: "youtube-server-key",
    });
    expect(JSON.stringify(env)).not.toContain("must-not-be-used");
  });

  it("fails closed on project or environment-marker mismatch", () => {
    expect(assertDatabaseProject(databaseUrl, projectRef)).toBe(projectRef);
    expect(() => assertDatabaseProject(databaseUrl, "zyxwvutsrqponmlkjihg"))
      .toThrow("project mismatch");
    expect(() => assertDatabaseProject("https://example.com", projectRef))
      .toThrow("valid project ref");
    expect(() => assertEnvironmentMarker("staging", null)).toThrow("staging reads require");
    expect(() => assertEnvironmentMarker("staging", "staging")).not.toThrow();
    expect(() => assertEnvironmentMarker("production", "staging")).toThrow("production reads reject");
  });
});

describe("human-review bundle", () => {
  it("connects real-shaped source metadata and taxonomy to proposeTaxonomy", () => {
    const bundle = buildReviewBundle({
      environment: "production",
      expectedProjectRef: projectRef,
      databaseUrl,
      taxonomy,
      owner,
      videos,
      generatedAt: "2026-08-18T12:00:00.000Z",
    });

    expect(bundle).toMatchObject({
      schema_version: 1,
      kind: "ingestion-human-review",
      safety: {
        runner_mode: "read-only",
        database_key: "anonymous",
        writes_attempted: false,
        importable: false,
        human_review_required: true,
      },
      database: { expected_project_ref: projectRef, project_ref: projectRef },
    });
    expect(bundle.source.videos[0]).toMatchObject({
      position: 1,
      youtube_video_id: "abcdefghijk",
      description: "Taught by Alakh Pandey Sir",
    });
    expect(bundle.proposal.decisions.teacher_id).toMatchObject({
      value: 34,
      status: "review",
      requiresReview: true,
    });
    expect(bundle.human_review.items.map((item) => item.field)).toContain("teacher_id");
    expect(bundle.source.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(bundle.taxonomy.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(bundle).not.toHaveProperty("assignments");
  });

  it("orchestrates YouTube and taxonomy reads without accepting mismatched source identity", async () => {
    const fetchOwner = vi.fn().mockResolvedValue(owner);
    const fetchVideos = vi.fn().mockResolvedValue(videos);
    const fetchTaxonomy = vi.fn().mockResolvedValue(taxonomy);
    const bundle = await collectIngestionReview({
      playlist: "PL_review",
      environment: "production",
      expectedProjectRef: projectRef,
      databaseUrl,
      youtubeKey: "youtube-key",
      db: { readOnly: true },
      fetchOwner,
      fetchVideos,
      fetchTaxonomy,
      generatedAt: "2026-08-18T12:00:00.000Z",
    });

    expect(fetchOwner).toHaveBeenCalledWith("youtube-key", "PL_review");
    expect(fetchVideos).toHaveBeenCalledWith("youtube-key", "PL_review");
    expect(fetchTaxonomy).toHaveBeenCalledWith({ readOnly: true });
    expect(bundle.safety.writes_attempted).toBe(false);

    await expect(collectIngestionReview({
      playlist: "PL_other",
      environment: "production",
      expectedProjectRef: projectRef,
      databaseUrl,
      youtubeKey: "youtube-key",
      db: {},
      fetchOwner,
      fetchVideos,
      fetchTaxonomy,
    })).rejects.toThrow("does not match");
  });

  it("rejects a wrong project before any network read begins", async () => {
    const fetchOwner = vi.fn();
    const fetchVideos = vi.fn();
    const fetchTaxonomy = vi.fn();
    await expect(collectIngestionReview({
      playlist: "PL_review",
      environment: "production",
      expectedProjectRef: "zyxwvutsrqponmlkjihg",
      databaseUrl,
      youtubeKey: "youtube-key",
      db: {},
      fetchOwner,
      fetchVideos,
      fetchTaxonomy,
    })).rejects.toThrow("project mismatch");
    expect(fetchOwner).not.toHaveBeenCalled();
    expect(fetchVideos).not.toHaveBeenCalled();
    expect(fetchTaxonomy).not.toHaveBeenCalled();
  });
});

describe("read-only source contract", () => {
  const source = readFileSync(resolve(here, "reviewIngestion.js"), "utf8");

  it("contains no Supabase mutation or RPC call", () => {
    expect(source).not.toMatch(/\.(?:insert|upsert|delete|rpc)\s*\(/u);
    expect(source).not.toMatch(/\.from\([^)]*\)\s*\.update\s*\(/u);
    expect(source).toContain("service: false");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("registers a system-CA-enabled review command", () => {
    const packageJson = JSON.parse(readFileSync(resolve(here, "../../package.json"), "utf8"));
    expect(packageJson.scripts["review:ingestion"]).toBe(
      "node --use-system-ca src/scripts/reviewIngestion.js",
    );
  });
});
