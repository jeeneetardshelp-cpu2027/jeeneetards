// proposeTaxonomy.js — orchestrator that turns raw playlist metadata into a
// review-queue-shaped decision set, mapped onto the DB payload field names
// used by ingestionSafety.buildImportPayload.
//
// It classifies (via rules.js), then splits every field into one of:
//   auto    — high confidence, safe to accept without a human
//   review  — a proposal exists but must be confirmed
//   manual  — the classifier cannot propose this field safely yet.
//
// It NEVER writes anything and NEVER invents a value outside the live taxonomy
// it is given. Network/DB access is the caller's job — this stays pure.

import {
  CONFIDENCE,
  deriveAudienceFocus,
  isAutoAcceptable,
  proposePlaylistTags,
} from "./rules.js";
import { proposeTeacher } from "./proposeTeacher.js";

function decide(fieldStatus) {
  return isAutoAcceptable(fieldStatus) && !fieldStatus?.requiresReview ? "auto" : "review";
}

export function proposeCategory(learningGoal, categories = [], categoryLearningGoals = []) {
  if (learningGoal?.value == null) {
    return {
      value: null,
      confidence: CONFIDENCE.NONE,
      evidence: "learning goal must be resolved before category mapping",
      candidates: [],
    };
  }
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const candidates = categoryLearningGoals
    .filter((mapping) => mapping.learning_goal_id === learningGoal.value)
    .map((mapping) => categoryById.get(mapping.category_id))
    .filter(Boolean)
    .map((category) => ({ id: category.id, name: category.name, slug: category.slug }));
  if (candidates.length !== 1) {
    return {
      value: null,
      confidence: CONFIDENCE.NONE,
      evidence: candidates.length
        ? `learning goal has ${candidates.length} legal categories; human selection required`
        : "learning goal has no legal category in live taxonomy",
      candidates,
      requiresReview: true,
    };
  }
  return {
    value: candidates[0].id,
    categoryName: candidates[0].name,
    confidence: CONFIDENCE.HIGH,
    evidence: `unique live category mapping for ${learningGoal.slug ?? learningGoal.value}`,
    candidates,
  };
}

export function proposeBoards(learningGoal, boards = []) {
  if (learningGoal?.value == null || !learningGoal.slug) {
    return {
      value: [],
      confidence: CONFIDENCE.NONE,
      evidence: "learning goal must be resolved before board rules",
      candidates: [],
      requiresReview: true,
    };
  }
  if (learningGoal.slug !== "school") {
    return {
      value: [],
      confidence: CONFIDENCE.HIGH,
      evidence: `learning goal ${learningGoal.slug} forbids board ids`,
      candidates: [],
    };
  }
  return {
    value: [],
    confidence: CONFIDENCE.NONE,
    evidence: "School learning goal requires one or more reviewed boards",
    candidates: boards.map((board) => ({ id: board.id, name: board.name, slug: board.slug })),
    requiresReview: true,
  };
}

const CLASS_LABEL_BY_SLUG = Object.freeze({
  "class-10": "10th",
  "class-11": "11th",
  "class-12": "12th",
  dropper: "Dropper",
});

export function validateClassLabelsAgainstTaxonomy(
  proposal,
  learningGoal,
  classLevels = [],
  learningGoalClassLevels = [],
) {
  const classById = new Map(classLevels.map((classLevel) => [classLevel.id, classLevel]));
  const candidates = learningGoal?.value == null
    ? []
    : learningGoalClassLevels
      .filter((mapping) => mapping.learning_goal_id === learningGoal.value)
      .map((mapping) => classById.get(mapping.class_level_id))
      .filter(Boolean)
      .map((classLevel) => ({
        id: classLevel.id,
        name: classLevel.name,
        slug: classLevel.slug,
        label: CLASS_LABEL_BY_SLUG[classLevel.slug] ?? null,
      }))
      .filter((classLevel) => classLevel.label);
  const proposedLabels = Array.isArray(proposal?.value) ? proposal.value : [];
  if (learningGoal?.value == null) {
    return {
      value: [],
      confidence: CONFIDENCE.NONE,
      evidence: "learning goal must be resolved before class compatibility",
      candidates,
      requiresReview: true,
    };
  }
  if (!proposedLabels.length) {
    return {
      ...proposal,
      value: [],
      candidates,
      evidence: `${proposal?.evidence ?? "no class-level signal"}; choose from live-compatible classes`,
      requiresReview: true,
    };
  }
  const allowedLabels = new Set(candidates.map((candidate) => candidate.label));
  const incompatible = proposedLabels.filter((label) => !allowedLabels.has(label));
  if (incompatible.length) {
    return {
      value: [],
      confidence: CONFIDENCE.NONE,
      evidence: `incompatible class signal for learning goal: ${incompatible.join(", ")}`,
      candidates,
      requiresReview: true,
    };
  }
  return {
    ...proposal,
    candidates,
    evidence: `${proposal.evidence}; confirmed by live goal-class mapping`,
  };
}

// liveTaxonomy: { subjects, learningGoals, categories, categoryLearningGoals,
// boards, classLevels, learningGoalClassLevels,
// teachers:[{id,display_name,aliases}] }.
// Only ids present here can ever be proposed.
export function proposeTaxonomy(metadata, liveTaxonomy = {}) {
  const {
    subjects = [],
    learningGoals = [],
    categories = [],
    categoryLearningGoals = [],
    boards = [],
    classLevels = [],
    learningGoalClassLevels = [],
    teachers = [],
  } = liveTaxonomy;
  const p = proposePlaylistTags({ ...metadata, subjects });
  const teacher = proposeTeacher(metadata, teachers);

  // Resolve the learning-goal slug (jee/neet) to a real id from live taxonomy.
  const goalRow = p.learningGoal.value
    ? learningGoals.find((g) => g.slug === p.learningGoal.value)
    : null;
  const learningGoal = goalRow
    ? { ...p.learningGoal, value: goalRow.id, slug: p.learningGoal.value }
    : { value: null, confidence: CONFIDENCE.NONE, evidence: p.learningGoal.value
        ? `goal "${p.learningGoal.value}" not in live taxonomy` : p.learningGoal.evidence };
  const category = proposeCategory(learningGoal, categories, categoryLearningGoals);
  const boardIds = proposeBoards(learningGoal, boards);
  const classLabels = validateClassLabelsAgainstTaxonomy(
    p.classLabels,
    learningGoal,
    classLevels,
    learningGoalClassLevels,
  );
  const audienceFocus = deriveAudienceFocus(classLabels.value);

  const fields = {
    subject_id: p.subject,
    learning_goal_id: learningGoal,
    category_id: category,
    board_ids: boardIds,
    class_labels: classLabels,
    content_type: p.contentType,
    language: p.language,
    audience_focus: audienceFocus,
    difficulty: p.difficulty,
    teacher_id: teacher,
  };

  const decisions = {};
  for (const [name, proposal] of Object.entries(fields)) {
    decisions[name] = { ...proposal, status: decide(proposal) };
  }

  const auto = Object.entries(decisions).filter(([, d]) => d.status === "auto").map(([n]) => n);
  const review = Object.entries(decisions).filter(([, d]) => d.status === "review").map(([n]) => n);
  const manual = Object.entries(decisions).filter(([, d]) => d.status === "manual").map(([n]) => n);

  return {
    decisions,
    summary: {
      total: Object.keys(decisions).length,
      auto: auto.length,
      review: review.length,
      manual: manual.length,
      autoFields: auto,
      reviewFields: review,
      manualFields: manual,
    },
  };
}
