// proposeTaxonomy.js — orchestrator that turns raw playlist metadata into a
// review-queue-shaped decision set, mapped onto the DB payload field names
// used by ingestionSafety.buildImportPayload.
//
// It classifies (via rules.js), then splits every field into one of:
//   auto    — high confidence, safe to accept without a human
//   review  — a proposal exists but must be confirmed
//   manual  — Phase 1 cannot propose this yet (chapter/teacher/category/board);
//             left entirely to the human until Phases 2-4 land.
//
// It NEVER writes anything and NEVER invents a value outside the live taxonomy
// it is given. Network/DB access is the caller's job — this stays pure.

import { CONFIDENCE, isAutoAcceptable, proposePlaylistTags } from "./rules.js";

// Fields Phase 1 does not attempt. They stay the operator's job for now.
const MANUAL_FIELDS = Object.freeze({
  chapter_id: "per-video LLM mapping (Phase 2)",
  teacher: "extraction + canonicalization (Phase 3)",
  category_id: "no reliable title signal — map from learning goal by hand",
  board_ids: "empty for JEE/NEET; set only in the School journey",
});

function decide(fieldStatus) {
  return isAutoAcceptable(fieldStatus) ? "auto" : "review";
}

// liveTaxonomy: { subjects:[{id,name,slug}], learningGoals:[{id,slug}] }.
// Only ids present here can ever be proposed.
export function proposeTaxonomy(metadata, liveTaxonomy = {}) {
  const { subjects = [], learningGoals = [] } = liveTaxonomy;
  const p = proposePlaylistTags({ ...metadata, subjects });

  // Resolve the learning-goal slug (jee/neet) to a real id from live taxonomy.
  const goalRow = p.learningGoal.value
    ? learningGoals.find((g) => g.slug === p.learningGoal.value)
    : null;
  const learningGoal = goalRow
    ? { ...p.learningGoal, value: goalRow.id, slug: p.learningGoal.value }
    : { value: null, confidence: CONFIDENCE.NONE, evidence: p.learningGoal.value
        ? `goal "${p.learningGoal.value}" not in live taxonomy` : p.learningGoal.evidence };

  const fields = {
    subject_id: p.subject,
    learning_goal_id: learningGoal,
    class_labels: p.classLabels,
    content_type: p.contentType,
    language: p.language,
    audience_focus: p.audienceFocus,
    difficulty: p.difficulty,
  };

  const decisions = {};
  for (const [name, proposal] of Object.entries(fields)) {
    decisions[name] = { ...proposal, status: decide(proposal) };
  }
  for (const [name, reason] of Object.entries(MANUAL_FIELDS)) {
    decisions[name] = { value: null, confidence: CONFIDENCE.NONE, evidence: reason, status: "manual" };
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
