// metadata.js — canonical vocabularies for the structured filter facets.
// Stored values are stable slugs; labels are for display. Kept dependency-free
// so admin UI, student UI and the migration's CHECK constraints agree.

export const CONTENT_TYPES = [
  { value: "full-course", label: "Full course" },
  { value: "one-shot", label: "One-shot" },
  { value: "revision", label: "Revision" },
  { value: "pyq", label: "PYQ" },
  { value: "practice", label: "Practice" },
];

export const LANGUAGES = [
  { value: "hindi", label: "Hindi" },
  { value: "english", label: "English" },
  { value: "hinglish", label: "Hinglish" },
];

export const DIFFICULTIES = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

// Rating-form vocabularies (note: rating difficulty is Beginner/Moderate/
// Advanced — a student's perception — distinct from a course's own
// beginner/intermediate/advanced difficulty above).
export const RATING_DIFFICULTY = [
  { value: "beginner", label: "Beginner" },
  { value: "moderate", label: "Moderate" },
  { value: "advanced", label: "Advanced" },
];

export const RATING_BEST_FOR = [
  { value: "first-learning", label: "First learning" },
  { value: "revision", label: "Revision" },
  { value: "practice", label: "Practice" },
];

const labelMap = (arr) => Object.fromEntries(arr.map((x) => [x.value, x.label]));
export const CONTENT_TYPE_LABELS = labelMap(CONTENT_TYPES);
export const LANGUAGE_LABELS = labelMap(LANGUAGES);
export const DIFFICULTY_LABELS = labelMap(DIFFICULTIES);
export const RATING_DIFFICULTY_LABELS = labelMap(RATING_DIFFICULTY);
export const RATING_BEST_FOR_LABELS = labelMap(RATING_BEST_FOR);

// "PT1H2M3S" -> 3723 seconds. Returns null if unparseable.
export function isoDurationToSeconds(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

// 2616 -> "43m", 3723 -> "1h 2m"
export function formatDuration(seconds) {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
