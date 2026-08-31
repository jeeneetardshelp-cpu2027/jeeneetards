// proposeVideoScope.js — deterministic per-video scope signals.
//
// Flags assessment/supplement titles that frequently sit beside a coherent
// lecture sequence. A signal always requires human review and never excludes a
// video automatically.

const SIGNALS = Object.freeze([
  {
    code: "dpp",
    label: "DPP/practice supplement",
    pattern: /\bdpp(?:\s*[-#]?\s*\d+)?\b/iu,
    source: "title",
  },
  {
    code: "quiz",
    label: "quiz/assessment",
    pattern: /\b(?:quiz|menti)\b/iu,
    source: "title",
  },
  { code: "paper-discussion", label: "paper discussion", pattern: /\bpaper\s+discussion\b/iu },
  {
    code: "promotional-giveaway",
    label: "promotional giveaway",
    pattern: /\b(?:free\s+)?giveaway\b/iu,
  },
  {
    code: "one-shot-revision",
    label: "one-shot revision supplement",
    pattern: /\b(?:one[\s-]?shot\s+revision|revision\s+one[\s-]?shot)\b/iu,
  },
]);

export function proposeVideoScope(video = {}) {
  const title = video.title ?? "";
  const text = [
    title,
    video.description ?? "",
    ...(Array.isArray(video.tags) ? video.tags : []),
  ].join(" \n ");
  const signals = SIGNALS
    .filter((signal) => signal.pattern.test(signal.source === "title" ? title : text))
    .map(({ code, label }) => ({ code, label }));
  return {
    requiresReview: signals.length > 0,
    proposed_action: null,
    evidence: signals.length
      ? `scope signals: ${signals.map((signal) => signal.label).join(", ")}`
      : "no supplement or assessment scope signal",
    signals,
  };
}
