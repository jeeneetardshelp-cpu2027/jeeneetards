// Pure shared shapes for ingestion decision worksheets.
// No I/O, network, database, or import behavior belongs in this module.

export function proposalDecision(item) {
  return {
    field: item.field,
    proposed_value: item.value ?? null,
    confidence: item.confidence ?? null,
    evidence: item.evidence ?? null,
    candidates: Array.isArray(item.candidates) ? item.candidates : [],
    reviewer_action: null,
    reviewer_value: null,
    reviewer_notes: null,
  };
}

export function chapterDecision(row) {
  return {
    position: row.position,
    youtube_video_id: row.youtube_video_id,
    title: row.title,
    proposed_chapter_id: row.chapter_id ?? null,
    proposed_chapter_name: row.chapter_name ?? null,
    confidence: row.confidence ?? null,
    evidence: row.reason ?? null,
    alternatives: Array.isArray(row.alternatives) ? row.alternatives : [],
    reviewer_action: null,
    reviewer_chapter_id: null,
    reviewer_notes: null,
  };
}

export function automaticContext(bundle) {
  return {
    proposal_fields: Object.entries(bundle.proposal.decisions)
      .filter(([, decision]) => decision.status === "auto")
      .map(([field, decision]) => ({
        field,
        value: decision.value,
        confidence: decision.confidence,
        evidence: decision.evidence,
      })),
    chapter_rows: bundle.chapter_review.rows.filter((row) => row.status === "auto").length,
  };
}
