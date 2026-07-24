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
