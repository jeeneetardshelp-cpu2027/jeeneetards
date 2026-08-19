import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  assertDatabaseProject,
  assertEnvironmentMarker,
  assertReviewOutputAvailable,
  buildChapterReview,
  buildReviewBundle,
  buildVideoReview,
  collectIngestionReview,
  loadLiveTaxonomy,
  loadRunnerEnvironment,
  parseArgs,
  resolveReviewOutputPath,
} from "./reviewIngestion.js";

const here = dirname(fileURLToPath(import.meta.url));
const projectRef = "abcdefghijklmnopqrst";
const databaseUrl = `https://${projectRef}.supabase.co`;

const taxonomy = {
  marker: null,
  categories: [{ id: 20, name: "JEE", slug: "jee", display_order: 1 }],
  subjects: [{ id: 1, name: "Physics", slug: "physics" }],
  learningGoals: [{ id: 10, name: "JEE", slug: "jee" }],
  categoryLearningGoals: [{ category_id: 20, learning_goal_id: 10 }],
  boards: [{ id: 30, name: "CBSE", slug: "cbse", display_order: 1 }],
  classLevels: [
    { id: 39, name: "Class 10", slug: "class-10", display_order: 1 },
    { id: 40, name: "Class 11", slug: "class-11", display_order: 2 },
    { id: 41, name: "Class 12", slug: "class-12", display_order: 3 },
    { id: 42, name: "Dropper", slug: "dropper", display_order: 4 },
  ],
  learningGoalClassLevels: [
    { learning_goal_id: 10, class_level_id: 40 },
    { learning_goal_id: 10, class_level_id: 41 },
    { learning_goal_id: 10, class_level_id: 42 },
  ],
  chapters: [
    { id: 101, subject_id: 1, name: "Kinematics", slug: "kinematics", display_order: 1 },
    { id: 102, subject_id: 1, name: "Laws of Motion", slug: "laws-of-motion", display_order: 2 },
  ],
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
  it("loads composite-key category mappings with exact public taxonomy reads", async () => {
    const rowsByTable = {
      categories: taxonomy.categories,
      subjects: taxonomy.subjects,
      learning_goals: taxonomy.learningGoals,
      category_learning_goals: taxonomy.categoryLearningGoals,
      boards: taxonomy.boards,
      class_levels: taxonomy.classLevels,
      learning_goal_class_levels: taxonomy.learningGoalClassLevels,
      chapters: taxonomy.chapters,
      teachers: taxonomy.teachers.map((teacher) => ({
        id: teacher.id,
        display_name: teacher.display_name,
        verified: teacher.verified,
      })),
      teacher_aliases: [{ id: 40, teacher_id: 34, alias: "ALK", status: "verified" }],
    };
    const db = {
      from(table) {
        const rows = rowsByTable[table] ?? [];
        let exactCount = false;
        return {
          select(_columns, options = {}) {
            exactCount = options.count === "exact";
            return this;
          },
          order() { return this; },
          eq() { return this; },
          maybeSingle() {
            return Promise.resolve({ data: { name: null }, error: null });
          },
          range(from, to) {
            return Promise.resolve({
              data: rows.slice(from, to + 1),
              count: exactCount ? rows.length : null,
              error: null,
            });
          },
        };
      },
    };

    const live = await loadLiveTaxonomy(db);
    expect(live.categoryLearningGoals).toEqual([
      { category_id: 20, learning_goal_id: 10 },
    ]);
    expect(live.boards).toEqual(taxonomy.boards);
    expect(live.learningGoalClassLevels).toEqual(taxonomy.learningGoalClassLevels);
    expect(live.teachers[0].aliases).toEqual([{ alias: "ALK", status: "verified" }]);
  });

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
      schema_version: 5,
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
    expect(bundle.proposal.decisions.category_id).toMatchObject({ value: 20, status: "auto" });
    expect(bundle.proposal.decisions.board_ids).toMatchObject({ value: [], status: "auto" });
    expect(bundle.human_review.items.map((item) => item.field)).toContain("teacher_id");
    expect(bundle.chapter_review).toMatchObject({
      eligible: true,
      subject_id: 1,
      subject_name: "Physics",
      taxonomy_chapter_count: 2,
      summary: { total: 1, auto: 1, review: 0, unmatched: 0, manual: 0 },
    });
    expect(bundle.chapter_review.rows[0]).toMatchObject({
      youtube_video_id: "abcdefghijk",
      chapter_id: 101,
      chapter_name: "Kinematics",
      status: "auto",
    });
    expect(bundle.video_review).toMatchObject({
      teacher_evidence: {
        summary: { total: 1, single_candidate: 1, ambiguous: 0, unmatched: 0 },
      },
      scope_review: { summary: { total_source_videos: 1, flagged: 0 }, rows: [] },
    });
    expect(bundle.source.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(bundle.taxonomy.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(bundle).not.toHaveProperty("assignments");
  });

  it("keeps every chapter manual until the subject is safely resolved", () => {
    const chapterReview = buildChapterReview({
      sourceVideos: [{ position: 1, youtube_video_id: "abcdefghijk", title: "Kinematics" }],
      taxonomy,
      subjectDecision: { value: 1, subjectName: "Physics", status: "review" },
    });
    expect(chapterReview).toMatchObject({
      eligible: false,
      summary: { total: 1, auto: 0, review: 0, unmatched: 0, manual: 1 },
      rows: [{ chapter_id: null, status: "manual" }],
    });
  });

  it("fails closed if the live subject has duplicate chapter names", () => {
    expect(() => buildChapterReview({
      sourceVideos: [{ position: 1, youtube_video_id: "abcdefghijk", title: "Kinematics" }],
      taxonomy: {
        ...taxonomy,
        chapters: [...taxonomy.chapters, { id: 103, subject_id: 1, name: "Kinematics" }],
      },
      subjectDecision: { value: 1, subjectName: "Physics", status: "auto" },
    })).toThrow("duplicate chapter name");
  });

  it("flags supplemental videos with per-video teacher candidates but no automatic exclusion", () => {
    const review = buildVideoReview({
      sourceVideos: [{
        position: 12,
        youtube_video_id: "abcdefghijk",
        title: "Work Energy & Power | DPP-2 | Physics quiz | Alakh Pandey Sir",
        description: "",
        tags: [],
      }],
      taxonomy,
    });
    expect(review.scope_review.rows[0]).toMatchObject({
      position: 12,
      signals: [{ code: "dpp" }, { code: "quiz" }],
      teacher_candidate_ids: [34],
    });
    expect(review.scope_review.rows[0]).not.toHaveProperty("reviewer_action");
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

  it("registers system-CA-enabled ingestion network commands", () => {
    const packageJson = JSON.parse(readFileSync(resolve(here, "../../package.json"), "utf8"));
    expect(packageJson.scripts.import).toBe(
      "node --use-system-ca src/scripts/importChannel.js",
    );
    expect(packageJson.scripts["review:ingestion"]).toBe(
      "node --use-system-ca src/scripts/reviewIngestion.js",
    );
  });
});
