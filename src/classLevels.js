// classLevels.js — the single source of truth for class levels and their
// display order. Kept dependency-free so both the admin UI and the student
// UI can import it without a circular dependency.

export const CLASS_LEVELS = ["10th", "11th", "12th", "Dropper"];

// Which class_levels rows (by slug) are VALID for each learning goal.
// JEE/NEET/Olympiad are 11 / 12 / Dropper only — Class 10 belongs to school
// boards, never to an entrance-exam stage. Unlisted goals fall back to all.
export const CLASS_LEVELS_BY_GOAL = {
  jee: ["class-11", "class-12", "dropper"],
  neet: ["class-11", "class-12", "dropper"],
  olympiad: ["class-11", "class-12", "dropper"],
  school: ["class-10", "class-11", "class-12"],
};

// class_levels.slug  <->  the labels stored in playlists.class_levels[].
export const CLASS_SLUG_TO_LABEL = {
  "class-10": "10th",
  "class-11": "11th",
  "class-12": "12th",
  dropper: "Dropper",
};

// Database-side equivalent of playlistMatchesClass(). Both playlist and
// lecture queries use this set, so Dropper cannot mean one thing per tab.
export function classSlugsForStage(stageId) {
  if (!stageId) return null;
  if (stageId === "dropper") return ["dropper", "class-11", "class-12"];
  return ["class-10", "class-11", "class-12"].includes(stageId) ? [stageId] : null;
}

// A reviewed chapter's academic class is authoritative. Course-level class
// tags describe the intended audience of a playlist; they must not hide a
// Class 12 chapter merely because one useful source was tagged Dropper-only.
// Empty/null scope means v13 is unavailable or the chapter is not reviewed,
// so callers retain the existing playlist-class fallback.
export function chapterScopeStageDecision(reviewedClassSlugs, stageId) {
  if (!stageId || !Array.isArray(reviewedClassSlugs) || reviewedClassSlugs.length === 0)
    return "fallback";
  if (stageId === "dropper")
    return reviewedClassSlugs.some((slug) => ["class-11", "class-12"].includes(slug))
      ? "match"
      : "mismatch";
  return reviewedClassSlugs.includes(stageId) ? "match" : "mismatch";
}

// Does a playlist (its class_levels label array) apply to the chosen class?
// STRICT: an untagged playlist matches NOTHING — a class filter that lets
// unclassified content through isn't a filter. "Dropper" additionally
// includes Class 11 & 12 material (droppers revise both years).
export function playlistMatchesClass(classLabel, playlistClassLevels) {
  const levels = playlistClassLevels ?? [];
  if (levels.length === 0) return false;
  if (classLabel === "Dropper")
    return levels.some((l) => ["Dropper", "11th", "12th"].includes(l));
  return levels.includes(classLabel);
}
