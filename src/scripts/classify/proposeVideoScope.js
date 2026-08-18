// proposeVideoScope.js — deterministic per-video scope signals.
//
// Flags assessment/supplement titles that frequently sit beside a coherent
// lecture sequence. A signal always requires human review and never excludes a
// video automatically.

const SIGNALS = Object.freeze([
  { code: "dpp", label: "DPP/practice supplement", pattern: /\bdpp(?:\s*[-#]?\s*\d+)?\b/iu },
  { code: "quiz", label: "quiz/assessment", pattern: /\b(?:quiz|menti)\b/iu },
  { code: "paper-discussion", label: "paper discussion", pattern: /\bpaper\s+discussion\b/iu },
]);

export function proposeVideoScope(video = {}) {
  const text = [
    video.title ?? "",
    video.description ?? "",
    ...(Array.isArray(video.tags) ? video.tags : []),
  ].join(" \n ");
  const signals = SIGNALS
    .filter((signal) => signal.pattern.test(text))
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
