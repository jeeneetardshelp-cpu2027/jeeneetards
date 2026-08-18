// verifyIngestionReview.js — offline integrity verifier for ingestion review bundles.
//
// Reads one local JSON artifact, validates its read-only contract, recomputes
// snapshot hashes, and checks every proposed taxonomy id against the embedded
// taxonomy. It has no network, database, import, or output-file path.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Json } from "./reviewIngestion.js";

const PROJECT_REF = /^[a-z0-9]{20}$/u;
const REQUIRED_READ_TABLES = [
  "app_environment",
  "subjects",
  "learning_goals",
  "chapters",
  "teachers",
  "teacher_aliases",
];

export function parseVerifyArgs(argv = []) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--bundle") args.bundle = argv[++index];
    else if (arg.startsWith("--bundle=")) args.bundle = arg.slice("--bundle=".length);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!args.bundle || !args.bundle.toLowerCase().endsWith(".json")) {
    throw new Error("--bundle must name a review JSON file.");
  }
  return args;
}

function countStatuses(entries = []) {
  const counts = { auto: 0, review: 0, manual: 0, unmatched: 0 };
  for (const entry of entries) {
    if (Object.hasOwn(counts, entry?.status)) counts[entry.status] += 1;
  }
  return counts;
}

function duplicateValues(rows, valueOf) {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows) {
    const value = valueOf(row);
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function verifyReviewBundle(bundle) {
  const errors = [];
  const fail = (message) => errors.push(message);
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    return { valid: false, errors: ["bundle must be a JSON object."], summary: null };
  }

  if (bundle.schema_version !== 2) fail("schema_version must equal 2.");
  if (bundle.kind !== "ingestion-human-review") fail("kind must be ingestion-human-review.");
  const safety = bundle.safety ?? {};
  if (safety.runner_mode !== "read-only") fail("runner_mode must be read-only.");
  if (safety.database_key !== "anonymous") fail("database_key must be anonymous.");
  if (safety.writes_attempted !== false) fail("writes_attempted must be false.");
  if (safety.importable !== false) fail("importable must be false.");
  if (safety.human_review_required !== true) fail("human_review_required must be true.");
  if (Object.hasOwn(bundle, "assignments")) fail("top-level assignments are forbidden.");

  const database = bundle.database ?? {};
  if (!PROJECT_REF.test(database.expected_project_ref ?? "")
      || database.expected_project_ref !== database.project_ref) {
    fail("expected and actual project refs must be present and equal.");
  }
  const readTables = Array.isArray(database.read_tables) ? database.read_tables : [];
  for (const table of REQUIRED_READ_TABLES) {
    if (!readTables.includes(table)) fail(`database read table is missing: ${table}.`);
  }
  if (!new Set(["production", "staging"]).has(database.requested_environment)) {
    fail("requested_environment must be production or staging.");
  } else if (database.requested_environment === "staging" && database.marker !== "staging") {
    fail('staging bundle marker must equal "staging".');
  } else if (database.requested_environment === "production" && database.marker === "staging") {
    fail("production bundle must not carry a staging marker.");
  }

  const source = bundle.source ?? {};
  const sourceVideos = Array.isArray(source.videos) ? source.videos : [];
  if (!source.owner?.playlistId) fail("source owner playlist identity is missing.");
  if (!sourceVideos.length) fail("source videos must be a non-empty array.");
  if (source.sha256 !== sha256Json({ owner: source.owner, videos: sourceVideos })) {
    fail("source snapshot SHA-256 mismatch.");
  }
  for (const duplicate of duplicateValues(sourceVideos, (video) => video?.youtube_video_id)) {
    fail(`duplicate source video id: ${duplicate}.`);
  }
  for (const duplicate of duplicateValues(sourceVideos, (video) => video?.position)) {
    fail(`duplicate source position: ${duplicate}.`);
  }

  const taxonomy = bundle.taxonomy ?? {};
  const subjects = Array.isArray(taxonomy.subjects) ? taxonomy.subjects : [];
  const learningGoals = Array.isArray(taxonomy.learningGoals) ? taxonomy.learningGoals : [];
  const chapters = Array.isArray(taxonomy.chapters) ? taxonomy.chapters : [];
  const teachers = Array.isArray(taxonomy.teachers) ? taxonomy.teachers : [];
  if (taxonomy.sha256 !== sha256Json({ subjects, learningGoals, chapters, teachers })) {
    fail("taxonomy snapshot SHA-256 mismatch.");
  }
  const byId = (rows) => new Map(
    rows.filter((row) => row && typeof row === "object").map((row) => [row.id, row]),
  );
  const subjectById = byId(subjects);
  const goalById = byId(learningGoals);
  const chapterById = byId(chapters);
  const teacherById = byId(teachers);
  for (const [label, rows] of [
    ["subject", subjects],
    ["learning goal", learningGoals],
    ["chapter", chapters],
    ["teacher", teachers],
  ]) {
    if (rows.some((row) => !row || typeof row !== "object" || row.id == null)) {
      fail(`${label} taxonomy contains an invalid row.`);
    }
    for (const duplicate of duplicateValues(rows, (row) => row?.id)) {
      fail(`duplicate ${label} id: ${duplicate}.`);
    }
  }

  const decisions = bundle.proposal?.decisions ?? {};
  const taxonomyDecisions = [
    ["subject_id", subjectById],
    ["learning_goal_id", goalById],
    ["teacher_id", teacherById],
  ];
  for (const [field, registry] of taxonomyDecisions) {
    const value = decisions[field]?.value;
    if (value != null && !registry.has(value)) fail(`${field} value ${value} is absent from taxonomy.`);
  }
  const decisionEntries = Object.entries(decisions).map(([field, decision]) => ({ field, ...decision }));
  const decisionCounts = countStatuses(decisionEntries);
  const proposalSummary = bundle.proposal?.summary ?? {};
  if (proposalSummary.total !== decisionEntries.length) fail("proposal total does not match decisions.");
  for (const status of ["auto", "review", "manual"]) {
    if (proposalSummary[status] !== decisionCounts[status]) {
      fail(`proposal ${status} count does not match decisions.`);
    }
  }
  const expectedReviewFields = decisionEntries
    .filter((decision) => decision.status !== "auto")
    .map((decision) => decision.field)
    .sort();
  const reviewItems = Array.isArray(bundle.human_review?.items) ? bundle.human_review.items : [];
  if (!Array.isArray(bundle.human_review?.items)) fail("human-review items must be an array.");
  const actualReviewFields = reviewItems
    .map((item) => item.field)
    .sort();
  if (JSON.stringify(actualReviewFields) !== JSON.stringify(expectedReviewFields)) {
    fail("human-review items do not match non-automatic proposal fields.");
  }

  const chapterReview = bundle.chapter_review ?? {};
  const chapterRows = Array.isArray(chapterReview.rows) ? chapterReview.rows : [];
  if (chapterRows.length !== sourceVideos.length) fail("chapter rows must cover every source video.");
  for (let index = 0; index < Math.min(chapterRows.length, sourceVideos.length); index += 1) {
    const row = chapterRows[index] ?? {};
    const sourceVideo = sourceVideos[index] ?? {};
    if (row.youtube_video_id !== sourceVideo.youtube_video_id || row.position !== sourceVideo.position) {
      fail(`chapter row ${index + 1} does not match source video order and identity.`);
    }
    const chapter = row.chapter_id == null ? null : chapterById.get(row.chapter_id);
    if (row.chapter_id != null && !chapter) fail(`chapter row ${index + 1} uses unknown chapter id.`);
    if (chapter && chapter.subject_id !== chapterReview.subject_id) {
      fail(`chapter row ${index + 1} belongs to a different subject.`);
    }
    if (chapter && row.chapter_name !== chapter.name) {
      fail(`chapter row ${index + 1} name does not match taxonomy.`);
    }
    if (new Set(["auto", "review"]).has(row.status) && !chapter) {
      fail(`chapter row ${index + 1} requires a live chapter id.`);
    }
    if (new Set(["manual", "unmatched"]).has(row.status) && row.chapter_id != null) {
      fail(`chapter row ${index + 1} must not carry a chapter id.`);
    }
    const alternatives = Array.isArray(row.alternatives) ? row.alternatives : [];
    if (!Array.isArray(row.alternatives)) fail(`chapter row ${index + 1} alternatives must be an array.`);
    for (const alternative of alternatives) {
      const alternativeChapter = chapterById.get(alternative.chapter_id);
      if (!alternativeChapter || alternativeChapter.name !== alternative.chapter_name) {
        fail(`chapter row ${index + 1} has an invalid alternative.`);
      }
    }
  }
  if (chapterReview.eligible === true) {
    const subject = subjectById.get(chapterReview.subject_id);
    if (!subject || subject.name !== chapterReview.subject_name) {
      fail("chapter-review subject does not match taxonomy.");
    }
    const expectedCount = chapters
      .filter((chapter) => chapter?.subject_id === chapterReview.subject_id)
      .length;
    if (chapterReview.taxonomy_chapter_count !== expectedCount) {
      fail("chapter taxonomy count does not match embedded taxonomy.");
    }
  } else if (chapterRows.some((row) => row.status !== "manual")) {
    fail("ineligible chapter review must keep every row manual.");
  }
  const chapterCounts = countStatuses(chapterRows);
  const chapterSummary = chapterReview.summary ?? {};
  if (chapterSummary.total !== chapterRows.length) fail("chapter total does not match rows.");
  for (const status of ["auto", "review", "manual", "unmatched"]) {
    if (chapterSummary[status] !== chapterCounts[status]) {
      fail(`chapter ${status} count does not match rows.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      playlist: source.owner?.playlistId ?? null,
      project_ref: database.project_ref ?? null,
      source_videos: sourceVideos.length,
      proposal_review: decisionCounts.review,
      proposal_manual: decisionCounts.manual,
      chapter_review: chapterCounts.review,
      chapter_unmatched: chapterCounts.unmatched,
      chapter_manual: chapterCounts.manual,
    },
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseVerifyArgs(argv);
  const bundlePath = resolve(process.cwd(), args.bundle);
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const result = verifyReviewBundle(bundle);
  console.log(JSON.stringify({ bundle: bundlePath, ...result }, null, 2));
  if (!result.valid) process.exitCode = 1;
  return result;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error(`ingestion review verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
