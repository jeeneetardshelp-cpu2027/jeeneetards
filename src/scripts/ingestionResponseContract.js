// Pure shapes shared by the local reviewer-response prepare/apply commands.

import { sha256Json } from "./reviewIngestion.js";

export const PROPOSAL_ACTIONS = Object.freeze(["accept", "replace", "reject"]);
export const SCOPE_ACTIONS = Object.freeze(["include", "exclude"]);

export function responseBinding(worksheet) {
  return {
    decision_worksheet_sha256: sha256Json(worksheet),
    review_bundle_sha256: worksheet.binding.review_bundle_sha256,
    source_sha256: worksheet.binding.source_sha256,
    taxonomy_sha256: worksheet.binding.taxonomy_sha256,
    playlist_id: worksheet.binding.playlist_id,
    project_ref: worksheet.binding.project_ref,
  };
}

export function buildResponseTemplate(
  worksheet,
  { generatedAt = new Date().toISOString() } = {},
) {
  return {
    schema_version: 1,
    kind: "ingestion-human-response",
    generated_at: generatedAt,
    safety: {
      local_only: true,
      database_writes_allowed: false,
      importable: false,
      human_decisions_required: true,
    },
    binding: responseBinding(worksheet),
    reviewer: {
      name: worksheet.reviewer.name,
      reviewed_at: worksheet.reviewer.reviewed_at,
      notes: worksheet.reviewer.notes,
    },
    allowed_reviewer_actions: [...PROPOSAL_ACTIONS],
    allowed_scope_actions: [...SCOPE_ACTIONS],
    proposal_responses: worksheet.proposal_decisions.map((decision) => ({
      field: decision.field,
      reviewer_action: decision.reviewer_action,
      reviewer_value: decision.reviewer_value,
      reviewer_notes: decision.reviewer_notes,
    })),
    chapter_responses: worksheet.chapter_decisions.map((decision) => ({
      position: decision.position,
      youtube_video_id: decision.youtube_video_id,
      reviewer_action: decision.reviewer_action,
      reviewer_chapter_id: decision.reviewer_chapter_id,
      reviewer_notes: decision.reviewer_notes,
    })),
    video_scope_responses: worksheet.video_scope_decisions.map((decision) => ({
      position: decision.position,
      youtube_video_id: decision.youtube_video_id,
      reviewer_action: decision.reviewer_action,
      reviewer_notes: decision.reviewer_notes,
    })),
  };
}
