// reviewIngestion.js — read-only, end-to-end ingestion review runner.
//
// Fetches one real YouTube playlist, reads the live public taxonomy through the
// Supabase anon client, runs proposeTaxonomy(), and writes a human-review bundle
// OUTSIDE the repository. It has no import/RPC/mutation path and the bundle is
// deliberately not shaped like an import manifest.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { allExact, client, must, readEnv } from "./dbProbe.js";
import { getPlaylistOwner, getPlaylistVideos } from "./youtubeNode.js";
import { draftAssignments } from "./classify/mapChapters.js";
import { proposeTaxonomy } from "./classify/proposeTaxonomy.js";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(here, "../..");
const SAFE_PLAYLIST_ID = /^[A-Za-z0-9_-]+$/u;
const SAFE_PROJECT_REF = /^[a-z0-9]{20}$/u;

export function parseArgs(argv = []) {
  const args = { environment: "production", overwrite: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--playlist") args.playlist = argv[++index];
    else if (arg.startsWith("--playlist=")) args.playlist = arg.slice("--playlist=".length);
    else if (arg === "--env") args.environment = argv[++index];
    else if (arg.startsWith("--env=")) args.environment = arg.slice("--env=".length);
    else if (arg === "--expected-project-ref") args.expectedProjectRef = argv[++index];
    else if (arg.startsWith("--expected-project-ref=")) {
      args.expectedProjectRef = arg.slice("--expected-project-ref=".length);
    }
    else if (arg === "--out") args.out = argv[++index];
    else if (arg.startsWith("--out=")) args.out = arg.slice("--out=".length);
    else if (arg === "--overwrite") args.overwrite = true;
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (!args.playlist || !SAFE_PLAYLIST_ID.test(args.playlist)) {
    throw new Error("--playlist must be a valid YouTube playlist ID.");
  }
  if (!new Set(["production", "staging"]).has(args.environment)) {
    throw new Error("--env must be production or staging.");
  }
  if (!args.expectedProjectRef || !SAFE_PROJECT_REF.test(args.expectedProjectRef)) {
    throw new Error("--expected-project-ref must be the exact 20-character Supabase project ref.");
  }
  return args;
}

function isInside(root, target) {
  const pathFromRoot = relative(resolve(root), resolve(target));
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

export function resolveReviewOutputPath({
  playlist,
  out,
  cwd = process.cwd(),
  repoRoot = defaultRepoRoot,
} = {}) {
  const outputPath = out
    ? resolve(cwd, out)
    : resolve(repoRoot, "..", "outputs", "ingestion-review", `${playlist}.review.json`);
  if (!outputPath.toLowerCase().endsWith(".json")) {
    throw new Error("review output must use a .json filename.");
  }
  if (isInside(repoRoot, outputPath)) {
    throw new Error("review output must stay outside the repository.");
  }
  return outputPath;
}

export function assertReviewOutputAvailable(
  outputPath,
  overwrite = false,
  pathExists = existsSync,
) {
  if (!overwrite && pathExists(outputPath)) {
    throw new Error(
      `refusing to overwrite existing review bundle: ${outputPath}. ` +
      "Choose another --out path or pass --overwrite explicitly.",
    );
  }
}

function cleanEnvValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const first = trimmed[0];
  const last = trimmed.at(-1);
  if ((first === '"' || first === "'") && last === first) {
    return trimmed.slice(1, -1).trim() || null;
  }
  return trimmed;
}

function runtimeValue(runtime, name) {
  return cleanEnvValue(runtime?.[name]);
}

export function loadRunnerEnvironment({
  environment,
  cwd = process.cwd(),
  runtime = process.env,
  readEnvironment = readEnv,
} = {}) {
  const fileName = environment === "staging" ? ".env.staging" : ".env";
  const fileValues = readEnvironment(resolve(cwd, fileName));
  const value = (name) => runtimeValue(runtime, name) ?? cleanEnvValue(fileValues[name]);
  const databaseUrl = environment === "staging"
    ? value("TEST_SUPABASE_URL") ?? value("VITE_SUPABASE_URL")
    : value("VITE_SUPABASE_URL");
  const anonKey = environment === "staging"
    ? value("TEST_ANON_KEY") ?? value("VITE_SUPABASE_ANON_KEY")
    : value("VITE_SUPABASE_ANON_KEY");
  const youtubeKey = value("YOUTUBE_API_KEY");

  if (!databaseUrl || !anonKey) {
    throw new Error(`read-only Supabase URL/anon key missing from ${fileName}.`);
  }
  if (!youtubeKey) throw new Error(`YOUTUBE_API_KEY missing from ${fileName}.`);
  return { databaseUrl, anonKey, youtubeKey };
}

function selectAllExact(
  db,
  table,
  columns,
  configure = (query) => query,
  orderColumns = ["id"],
  stableKey = (row) => row?.id,
) {
  return allExact(
    table,
    (countMode) => {
      let query = db.from(table).select(columns, countMode ? { count: countMode } : {});
      for (const column of orderColumns) query = query.order(column);
      return configure(query);
    },
    { key: stableKey },
  );
}

export async function loadLiveTaxonomy(db) {
  const [
    markerResponse,
    categories,
    subjects,
    learningGoals,
    categoryLearningGoals,
    boards,
    classLevels,
    learningGoalClassLevels,
    chapters,
    teachers,
    aliases,
  ] = await Promise.all([
    db.from("app_environment").select("name").maybeSingle(),
    selectAllExact(db, "categories", "id,name,slug,display_order"),
    selectAllExact(db, "subjects", "id,name,slug"),
    selectAllExact(db, "learning_goals", "id,name,slug"),
    selectAllExact(
      db,
      "category_learning_goals",
      "category_id,learning_goal_id",
      (query) => query,
      ["category_id", "learning_goal_id"],
      (row) => `${row?.category_id}:${row?.learning_goal_id}`,
    ),
    selectAllExact(db, "boards", "id,name,slug,display_order"),
    selectAllExact(db, "class_levels", "id,name,slug,display_order"),
    selectAllExact(
      db,
      "learning_goal_class_levels",
      "learning_goal_id,class_level_id",
      (query) => query,
      ["learning_goal_id", "class_level_id"],
      (row) => `${row?.learning_goal_id}:${row?.class_level_id}`,
    ),
    selectAllExact(db, "chapters", "id,subject_id,name,slug,display_order"),
    selectAllExact(db, "teachers", "id,display_name,verified"),
    selectAllExact(
      db,
      "teacher_aliases",
      "id,teacher_id,alias,status",
      (query) => query.eq("status", "verified"),
    ),
  ]);
  const marker = must("app_environment", markerResponse).data?.name ?? null;
  const teachersById = new Map(teachers.map((teacher) => [teacher.id, { ...teacher, aliases: [] }]));
  for (const alias of aliases) {
    const teacher = teachersById.get(alias.teacher_id);
    if (!teacher) {
      throw new Error(`verified alias ${alias.id} references missing teacher ${alias.teacher_id}.`);
    }
    teacher.aliases.push({ alias: alias.alias, status: alias.status });
  }

  return {
    marker,
    categories,
    subjects,
    learningGoals,
    categoryLearningGoals,
    boards,
    classLevels,
    learningGoalClassLevels,
    chapters,
    teachers: [...teachersById.values()],
  };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  );
}

export function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

export function databaseProjectRef(databaseUrl) {
  try {
    const hostname = new URL(databaseUrl).hostname;
    if (!hostname.endsWith(".supabase.co")) return null;
    const projectRef = hostname.slice(0, -".supabase.co".length);
    return SAFE_PROJECT_REF.test(projectRef) ? projectRef : null;
  } catch {
    return null;
  }
}

export function assertDatabaseProject(databaseUrl, expectedProjectRef) {
  if (!SAFE_PROJECT_REF.test(expectedProjectRef ?? "")) {
    throw new Error("expected Supabase project ref is missing or invalid.");
  }
  const actualProjectRef = databaseProjectRef(databaseUrl);
  if (!actualProjectRef) {
    throw new Error("Supabase URL does not expose a valid project ref.");
  }
  if (actualProjectRef !== expectedProjectRef) {
    throw new Error(
      `Supabase project mismatch: expected ${expectedProjectRef}, received ${actualProjectRef}.`,
    );
  }
  return actualProjectRef;
}

export function assertEnvironmentMarker(environment, marker) {
  if (environment === "staging" && marker !== "staging") {
    throw new Error('staging reads require app_environment marker "staging".');
  }
  if (environment === "production" && marker != null && marker !== "production") {
    throw new Error(`production reads reject app_environment marker "${marker}".`);
  }
}

function sourceVideo(video, index) {
  return {
    position: Number.isInteger(video.sourcePosition) ? video.sourcePosition + 1 : index + 1,
    youtube_video_id: video.videoId,
    title: video.title ?? "",
    description: video.description ?? "",
    tags: Array.isArray(video.tags) ? video.tags : [],
    duration_seconds: video.durationSeconds ?? null,
    caption_status: video.captionStatus ?? null,
    embedding_status: video.embeddingStatus ?? null,
  };
}

function manualChapterRows(sourceVideos, reason) {
  return sourceVideos.map((video) => ({
    position: video.position,
    youtube_video_id: video.youtube_video_id,
    title: video.title,
    chapter_id: null,
    chapter_name: null,
    confidence: 0,
    status: "manual",
    reason,
    alternatives: [],
  }));
}

export function buildChapterReview({ sourceVideos, taxonomy, subjectDecision } = {}) {
  const videos = Array.isArray(sourceVideos) ? sourceVideos : [];
  const unavailable = (reason) => ({
    eligible: false,
    subject_id: subjectDecision?.value ?? null,
    subject_name: subjectDecision?.subjectName ?? null,
    taxonomy_chapter_count: 0,
    reason,
    summary: { total: videos.length, auto: 0, review: 0, unmatched: 0, manual: videos.length },
    rows: manualChapterRows(videos, reason),
  });

  if (subjectDecision?.status !== "auto" || subjectDecision.value == null) {
    return unavailable("subject must be auto-resolved before chapter matching");
  }
  const subject = (taxonomy?.subjects ?? []).find((row) => row.id === subjectDecision.value);
  if (!subject) throw new Error(`proposed subject ${subjectDecision.value} is absent from taxonomy.`);
  const chapters = (taxonomy?.chapters ?? []).filter((row) => row.subject_id === subject.id);
  if (!chapters.length) return unavailable(`subject "${subject.name}" has no live chapters`);

  const chaptersByName = new Map();
  for (const chapter of chapters) {
    if (chaptersByName.has(chapter.name)) {
      throw new Error(`subject "${subject.name}" has duplicate chapter name "${chapter.name}".`);
    }
    chaptersByName.set(chapter.name, chapter);
  }
  const mapped = draftAssignments(
    videos.map((video) => ({
      videoId: video.youtube_video_id,
      title: video.title,
      position: video.position,
    })),
    chapters.map((chapter) => chapter.name),
  );
  const rows = mapped.rows.map((row) => {
    const chapter = row.chapter ? chaptersByName.get(row.chapter) : null;
    if (row.chapter && !chapter) {
      throw new Error(`chapter mapper returned non-taxonomy value "${row.chapter}".`);
    }
    return {
      position: row.position,
      youtube_video_id: row.youtube_video_id,
      title: row.title,
      chapter_id: chapter?.id ?? null,
      chapter_name: chapter?.name ?? null,
      confidence: row.confidence,
      status: !chapter ? "unmatched" : row.review ? "review" : "auto",
      reason: row.reason,
      alternatives: row.alternatives.map((name) => ({
        chapter_id: chaptersByName.get(name)?.id ?? null,
        chapter_name: name,
      })),
    };
  });
  return {
    eligible: true,
    subject_id: subject.id,
    subject_name: subject.name,
    taxonomy_chapter_count: chapters.length,
    reason: "rules-only mapping against live chapters",
    summary: { ...mapped.summary, manual: 0 },
    rows,
  };
}

export function buildReviewBundle({
  environment,
  expectedProjectRef,
  databaseUrl,
  taxonomy,
  owner,
  videos,
  generatedAt = new Date().toISOString(),
} = {}) {
  const actualProjectRef = assertDatabaseProject(databaseUrl, expectedProjectRef);
  assertEnvironmentMarker(environment, taxonomy?.marker ?? null);
  if (!owner?.playlistId) throw new Error("playlist owner metadata is missing.");
  if (!Array.isArray(videos) || !videos.length) {
    throw new Error("playlist returned no usable videos.");
  }
  const sourceVideos = videos.map(sourceVideo);
  const classifierMetadata = {
    playlistTitle: owner.playlistTitle,
    playlistDescription: owner.playlistDescription,
    channelTitle: owner.channelTitle,
    videoTitles: sourceVideos.map((video) => video.title),
    videoDescriptions: sourceVideos.map((video) => video.description),
    videoTags: sourceVideos.map((video) => video.tags),
  };
  const proposal = proposeTaxonomy(classifierMetadata, taxonomy);
  const chapterReview = buildChapterReview({
    sourceVideos,
    taxonomy,
    subjectDecision: proposal.decisions.subject_id,
  });
  const reviewItems = Object.entries(proposal.decisions)
    .filter(([, decision]) => decision.status !== "auto")
    .map(([field, decision]) => ({ field, ...decision }));
  const warnings = [];
  if (Number(owner.videoCount) !== videos.length) {
    warnings.push(
      `YouTube advertises ${owner.videoCount} item(s), but ${videos.length} usable video(s) were returned.`,
    );
  }
  const missingDetails = sourceVideos.filter((video) => video.duration_seconds == null).length;
  if (missingDetails) warnings.push(`${missingDetails} video(s) lack duration metadata.`);
  const blockedEmbeds = sourceVideos.filter((video) => video.embedding_status === "blocked").length;
  if (blockedEmbeds) warnings.push(`${blockedEmbeds} video(s) disallow embedding.`);

  const sourceSnapshot = { owner, videos: sourceVideos };
  const taxonomySnapshot = {
    categories: taxonomy.categories,
    subjects: taxonomy.subjects,
    learningGoals: taxonomy.learningGoals,
    categoryLearningGoals: taxonomy.categoryLearningGoals,
    boards: taxonomy.boards,
    classLevels: taxonomy.classLevels,
    learningGoalClassLevels: taxonomy.learningGoalClassLevels,
    chapters: taxonomy.chapters,
    teachers: taxonomy.teachers,
  };
  return {
    schema_version: 4,
    kind: "ingestion-human-review",
    generated_at: generatedAt,
    safety: {
      runner_mode: "read-only",
      database_key: "anonymous",
      writes_attempted: false,
      importable: false,
      human_review_required: true,
    },
    database: {
      requested_environment: environment,
      expected_project_ref: expectedProjectRef,
      project_ref: actualProjectRef,
      marker: taxonomy.marker,
      read_tables: [
        "app_environment",
        "categories",
        "subjects",
        "learning_goals",
        "category_learning_goals",
        "boards",
        "class_levels",
        "learning_goal_class_levels",
        "chapters",
        "teachers",
        "teacher_aliases",
      ],
    },
    source: {
      ...sourceSnapshot,
      sha256: sha256Json(sourceSnapshot),
    },
    taxonomy: {
      ...taxonomySnapshot,
      sha256: sha256Json(taxonomySnapshot),
    },
    proposal,
    chapter_review: chapterReview,
    human_review: {
      warnings,
      items: reviewItems,
    },
  };
}

export async function collectIngestionReview({
  playlist,
  environment,
  expectedProjectRef,
  databaseUrl,
  youtubeKey,
  db,
  fetchOwner = getPlaylistOwner,
  fetchVideos = getPlaylistVideos,
  fetchTaxonomy = loadLiveTaxonomy,
  generatedAt,
} = {}) {
  assertDatabaseProject(databaseUrl, expectedProjectRef);
  const [owner, videos, taxonomy] = await Promise.all([
    fetchOwner(youtubeKey, playlist),
    fetchVideos(youtubeKey, playlist),
    fetchTaxonomy(db),
  ]);
  if (owner.playlistId !== playlist) {
    throw new Error("YouTube owner response does not match the requested playlist.");
  }
  return buildReviewBundle({
    environment,
    expectedProjectRef,
    databaseUrl,
    taxonomy,
    owner,
    videos,
    generatedAt,
  });
}

export function writeReviewBundle(outputPath, bundle) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const outputPath = resolveReviewOutputPath({ playlist: args.playlist, out: args.out });
  assertReviewOutputAvailable(outputPath, args.overwrite);
  const env = loadRunnerEnvironment({ environment: args.environment });
  assertDatabaseProject(env.databaseUrl, args.expectedProjectRef);
  const db = client({
    service: false,
    env: {
      VITE_SUPABASE_URL: env.databaseUrl,
      VITE_SUPABASE_ANON_KEY: env.anonKey,
    },
  });
  const bundle = await collectIngestionReview({
    playlist: args.playlist,
    environment: args.environment,
    expectedProjectRef: args.expectedProjectRef,
    databaseUrl: env.databaseUrl,
    youtubeKey: env.youtubeKey,
    db,
  });
  writeReviewBundle(outputPath, bundle);
  console.log(JSON.stringify({
    output: outputPath,
    playlist: args.playlist,
    environment: args.environment,
    usable_videos: bundle.source.videos.length,
    auto_fields: bundle.proposal.summary.auto,
    review_fields: bundle.proposal.summary.review,
    manual_fields: bundle.proposal.summary.manual,
    chapter_auto: bundle.chapter_review.summary.auto,
    chapter_review: bundle.chapter_review.summary.review,
    chapter_unmatched: bundle.chapter_review.summary.unmatched,
    chapter_manual: bundle.chapter_review.summary.manual,
    warnings: bundle.human_review.warnings.length,
    writes_attempted: false,
  }, null, 2));
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(`ingestion review failed: ${error.message}`);
    process.exitCode = 1;
  });
}
