// Orthogonal content taxonomy for reviewed course and video metadata.
//
// The live catalogue still stores one legacy playlists.content_type value.
// Never infer these fields from that value: a one-shot can be revision and
// PYQ practice at the same time, while a confirmed Short must stay out of a
// structured learning sequence.

export const CONTENT_FORMATS = [
  { value: "series", label: "Lecture series" },
  { value: "one-shot", label: "One-shot" },
  { value: "live-class", label: "Live class" },
  { value: "short", label: "Short clip" },
];

export const LEARNING_PURPOSES = [
  { value: "theory", label: "Theory" },
  { value: "revision", label: "Revision" },
  { value: "practice", label: "Practice" },
  { value: "pyq", label: "Previous-year questions" },
  { value: "strategy", label: "Strategy" },
];

export const EXAM_SCOPES = [
  { value: "jee-main", label: "JEE Main" },
  { value: "jee-advanced", label: "JEE Advanced" },
  { value: "neet", label: "NEET" },
  { value: "boards", label: "Boards" },
  { value: "olympiad", label: "Olympiad" },
];

export const TARGET_COHORTS = [
  { value: "class-9", label: "Class 9" },
  { value: "class-10", label: "Class 10" },
  { value: "class-11", label: "Class 11" },
  { value: "class-12", label: "Class 12" },
  { value: "dropper", label: "Dropper" },
];

export const TEACHING_DEPTHS = [
  { value: "foundation", label: "Foundation" },
  { value: "standard", label: "Standard" },
  { value: "advanced", label: "Advanced" },
];

export const COVERAGE_LEVELS = [
  { value: "topic", label: "Topic" },
  { value: "chapter", label: "Chapter" },
  { value: "unit", label: "Unit" },
  { value: "full-syllabus", label: "Full syllabus" },
];

export const COMPLETION_STATUSES = [
  { value: "complete", label: "Complete" },
  { value: "ongoing", label: "Ongoing" },
  { value: "incomplete", label: "Incomplete" },
];

export const CONTENT_SHELVES = [
  { value: "learn", label: "Learn" },
  { value: "revise", label: "Revise" },
  { value: "practice", label: "Practice" },
  { value: "quick-clips", label: "Quick clips" },
];

/**
 * Convert only explicitly verified orthogonal metadata into chapter shelves.
 * A confirmed Short is isolated in Quick clips even if its purpose is theory
 * or revision, so it cannot enter a structured course sequence.
 */
export function shelvesForReviewedTaxonomy(taxonomy) {
  if (taxonomy?.review_status !== "verified") return [];
  if (taxonomy.content_format === "short") return ["quick-clips"];

  const purposes = new Set(taxonomy.learning_purposes ?? []);
  const shelves = [];
  if (purposes.has("theory")) shelves.push("learn");
  if (purposes.has("revision")) shelves.push("revise");
  if (purposes.has("practice") || purposes.has("pyq")) shelves.push("practice");
  return shelves;
}
