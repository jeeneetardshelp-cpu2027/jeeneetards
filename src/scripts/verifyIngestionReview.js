// verifyIngestionReview.js — offline integrity verifier for ingestion review bundles.
//
// Reads one local JSON artifact, validates its read-only contract, recomputes
// snapshot hashes, and checks every proposed taxonomy id against the embedded
// taxonomy. It has no network, database, import, or output-file path.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildVideoReview, sha256Json } from "./reviewIngestion.js";

const PROJECT_REF = /^[a-z0-9]{20}$/u;
const REQUIRED_READ_TABLES = [
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
];
const CLASS_SLUG_BY_LABEL = Object.freeze({
  "10th": "class-10",
  "11th": "class-11",
  "12th": "class-12",
  Dropper: "dropper",
});

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

  if (bundle.schema_version !== 5) fail("schema_version must equal 5.");
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
  const categories = Array.isArray(taxonomy.categories) ? taxonomy.categories : [];
  const subjects = Array.isArray(taxonomy.subjects) ? taxonomy.subjects : [];
  const learningGoals = Array.isArray(taxonomy.learningGoals) ? taxonomy.learningGoals : [];
  const categoryLearningGoals = Array.isArray(taxonomy.categoryLearningGoals)
    ? taxonomy.categoryLearningGoals
    : [];
  const boards = Array.isArray(taxonomy.boards) ? taxonomy.boards : [];
  const classLevels = Array.isArray(taxonomy.classLevels) ? taxonomy.classLevels : [];
  const learningGoalClassLevels = Array.isArray(taxonomy.learningGoalClassLevels)
    ? taxonomy.learningGoalClassLevels
    : [];
  const chapters = Array.isArray(taxonomy.chapters) ? taxonomy.chapters : [];
  const teachers = Array.isArray(taxonomy.teachers) ? taxonomy.teachers : [];
  if (taxonomy.sha256 !== sha256Json({
    categories,
    subjects,
    learningGoals,
    categoryLearningGoals,
    boards,
    classLevels,
    learningGoalClassLevels,
    chapters,
    teachers,
  })) {
    fail("taxonomy snapshot SHA-256 mismatch.");
  }
  const byId = (rows) => new Map(
    rows.filter((row) => row && typeof row === "object").map((row) => [row.id, row]),
  );
  const categoryById = byId(categories);
  const subjectById = byId(subjects);
  const goalById = byId(learningGoals);
  const boardById = byId(boards);
  const classById = byId(classLevels);
  const chapterById = byId(chapters);
  const teacherById = byId(teachers);
  for (const [label, rows] of [
    ["category", categories],
    ["subject", subjects],
    ["learning goal", learningGoals],
    ["board", boards],
    ["class level", classLevels],
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
  const mappingKeys = new Set();
  for (const mapping of categoryLearningGoals) {
    const key = `${mapping?.category_id}:${mapping?.learning_goal_id}`;
    if (mappingKeys.has(key)) fail(`duplicate category-learning-goal mapping: ${key}.`);
    mappingKeys.add(key);
    if (!categoryById.has(mapping?.category_id) || !goalById.has(mapping?.learning_goal_id)) {
      fail(`category-learning-goal mapping references missing taxonomy: ${key}.`);
    }
  }
  const goalClassMappingKeys = new Set();
  for (const mapping of learningGoalClassLevels) {
    const key = `${mapping?.learning_goal_id}:${mapping?.class_level_id}`;
    if (goalClassMappingKeys.has(key)) fail(`duplicate learning-goal-class mapping: ${key}.`);
    goalClassMappingKeys.add(key);
    if (!goalById.has(mapping?.learning_goal_id) || !classById.has(mapping?.class_level_id)) {
      fail(`learning-goal-class mapping references missing taxonomy: ${key}.`);
    }
  }

  const decisions = bundle.proposal?.decisions ?? {};
  const taxonomyDecisions = [
    ["category_id", categoryById],
    ["subject_id", subjectById],
    ["learning_goal_id", goalById],
    ["teacher_id", teacherById],
  ];
  for (const [field, registry] of taxonomyDecisions) {
    const value = decisions[field]?.value;
    if (value != null && !registry.has(value)) fail(`${field} value ${value} is absent from taxonomy.`);
  }
  const categoryId = decisions.category_id?.value;
  const learningGoalId = decisions.learning_goal_id?.value;
  if (categoryId != null && learningGoalId != null
      && !mappingKeys.has(`${categoryId}:${learningGoalId}`)) {
    fail("category_id is not legal for the proposed learning_goal_id.");
  }
  const boardIds = decisions.board_ids?.value;
  if (!Array.isArray(boardIds)) {
    fail("board_ids proposal must be an array.");
  } else {
    for (const boardId of boardIds) {
      if (!boardById.has(boardId)) fail(`board_ids value ${boardId} is absent from taxonomy.`);
    }
    const goal = goalById.get(learningGoalId);
    if (goal?.slug !== "school" && boardIds.length) {
      fail("non-School learning goals must not propose board ids.");
    }
    if (goal?.slug === "school" && decisions.board_ids?.status === "auto" && !boardIds.length) {
      fail("automatic School board decisions require at least one board id.");
    }
  }
  const classLabels = decisions.class_labels?.value;
  if (!Array.isArray(classLabels)) {
    fail("class_labels proposal must be an array.");
  } else {
    for (const duplicate of duplicateValues(classLabels, (label) => label)) {
      fail(`duplicate class label: ${duplicate}.`);
    }
    const classBySlug = new Map(classLevels.map((classLevel) => [classLevel.slug, classLevel]));
    for (const label of classLabels) {
      const classLevel = classBySlug.get(CLASS_SLUG_BY_LABEL[label]);
      if (!classLevel) {
        fail(`class label ${label} is absent from taxonomy.`);
      } else if (learningGoalId != null
          && !goalClassMappingKeys.has(`${learningGoalId}:${classLevel.id}`)) {
        fail(`class label ${label} is incompatible with the proposed learning goal.`);
      }
    }
    if (decisions.class_labels?.status === "auto" && !classLabels.length) {
      fail("automatic class_labels decision must not be empty.");
    }
    const audienceFocus = decisions.audience_focus?.value;
    if (audienceFocus != null && !classLabels.includes(audienceFocus)) {
      fail("audience_focus must be one of the proposed class_labels.");
    }
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

  const videoReview = bundle.video_review ?? {};
  const expectedVideoReview = buildVideoReview({ sourceVideos, taxonomy });
  if (sha256Json(videoReview) !== sha256Json(expectedVideoReview)) {
    fail("video review evidence does not match the source metadata and taxonomy.");
  }
  const teacherEvidence = videoReview.teacher_evidence ?? {};
  const teacherRows = Array.isArray(teacherEvidence.rows) ? teacherEvidence.rows : [];
  if (!Array.isArray(teacherEvidence.rows)) fail("video teacher-evidence rows must be an array.");
  if (teacherRows.length !== sourceVideos.length) {
    fail("video teacher-evidence rows must cover every source video.");
  }
  let singleCandidate = 0;
  let ambiguousTeachers = 0;
  let unmatchedTeachers = 0;
  for (let index = 0; index < teacherRows.length; index += 1) {
    const row = teacherRows[index] ?? {};
    const sourceVideo = sourceVideos[index] ?? {};
    if (row.youtube_video_id !== sourceVideo.youtube_video_id || row.position !== sourceVideo.position
        || row.title !== sourceVideo.title) {
      fail(`video teacher-evidence row ${index + 1} does not match source order and identity.`);
    }
    const candidates = Array.isArray(row.proposal?.candidates) ? row.proposal.candidates : [];
    if (!Array.isArray(row.proposal?.candidates)) {
      fail(`video teacher-evidence row ${index + 1} candidates must be an array.`);
    }
    if (candidates.length === 0) unmatchedTeachers += 1;
    else if (candidates.length === 1) singleCandidate += 1;
    else ambiguousTeachers += 1;
    for (const candidate of candidates) {
      if (!teacherById.has(candidate?.teacher_id)) {
        fail(`video teacher-evidence row ${index + 1} uses an unknown teacher candidate.`);
      }
    }
    const proposedTeacherId = row.proposal?.value;
    if (proposedTeacherId != null && !teacherById.has(proposedTeacherId)) {
      fail(`video teacher-evidence row ${index + 1} proposes an unknown teacher id.`);
    }
    if (proposedTeacherId != null
        && !candidates.some((candidate) => candidate?.teacher_id === proposedTeacherId)) {
      fail(`video teacher-evidence row ${index + 1} proposal is absent from its candidates.`);
    }
  }
  const teacherSummary = teacherEvidence.summary ?? {};
  if (teacherSummary.total !== teacherRows.length) fail("video teacher total does not match rows.");
  if (teacherSummary.single_candidate !== singleCandidate) {
    fail("video teacher single-candidate count does not match rows.");
  }
  if (teacherSummary.ambiguous !== ambiguousTeachers) {
    fail("video teacher ambiguous count does not match rows.");
  }
  if (teacherSummary.unmatched !== unmatchedTeachers) {
    fail("video teacher unmatched count does not match rows.");
  }

  const scopeReview = videoReview.scope_review ?? {};
  const scopeRows = Array.isArray(scopeReview.rows) ? scopeReview.rows : [];
  if (!Array.isArray(scopeReview.rows)) fail("video scope-review rows must be an array.");
  const sourceByPosition = new Map(sourceVideos.map((video) => [video.position, video]));
  const teacherByPosition = new Map(teacherRows.map((row) => [row.position, row]));
  for (const duplicate of duplicateValues(scopeRows, (row) => row?.position)) {
    fail(`duplicate video scope-review position: ${duplicate}.`);
  }
  for (let index = 0; index < scopeRows.length; index += 1) {
    const row = scopeRows[index] ?? {};
    const sourceVideo = sourceByPosition.get(row.position);
    if (!sourceVideo || row.youtube_video_id !== sourceVideo.youtube_video_id
        || row.title !== sourceVideo.title) {
      fail(`video scope-review row ${index + 1} does not match a source video.`);
    }
    const signals = Array.isArray(row.signals) ? row.signals : [];
    if (!signals.length || signals.some((signal) => !signal?.code || !signal?.label)) {
      fail(`video scope-review row ${index + 1} must carry valid review signals.`);
    }
    const teacherCandidateIds = Array.isArray(row.teacher_candidate_ids)
      ? row.teacher_candidate_ids
      : [];
    if (!Array.isArray(row.teacher_candidate_ids)) {
      fail(`video scope-review row ${index + 1} teacher candidate ids must be an array.`);
    }
    for (const teacherId of teacherCandidateIds) {
      if (!teacherById.has(teacherId)) {
        fail(`video scope-review row ${index + 1} uses an unknown teacher candidate id.`);
      }
    }
    const expectedTeacherIds = (teacherByPosition.get(row.position)?.proposal?.candidates ?? [])
      .map((candidate) => candidate.teacher_id);
    if (sha256Json(teacherCandidateIds) !== sha256Json(expectedTeacherIds)) {
      fail(`video scope-review row ${index + 1} teacher candidates do not match evidence.`);
    }
    if (Object.hasOwn(row, "reviewer_action")) {
      fail(`video scope-review row ${index + 1} must not contain a reviewer action.`);
    }
  }
  const scopeSummary = scopeReview.summary ?? {};
  if (scopeSummary.total_source_videos !== sourceVideos.length) {
    fail("video scope source count does not match source videos.");
  }
  if (scopeSummary.flagged !== scopeRows.length) {
    fail("video scope flagged count does not match rows.");
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
      video_scope_review: scopeRows.length,
      video_teacher_ambiguous: ambiguousTeachers,
      video_teacher_unmatched: unmatchedTeachers,
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
