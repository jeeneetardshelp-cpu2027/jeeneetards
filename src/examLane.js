// examLane.js — remembers which exam a student is preparing for.
//
// The countdown's JEE/NEET/Boards tab was plain useState, so the site asked
// the same student the same question on every visit. The chosen lane is kept
// under a versioned key like the other ll_* stores (see streak.js), and the
// homepage reads it to put the student's own exam first.
//
// Storage can be blocked or throw (private mode, school lab machines), so
// every read and write is wrapped: with nothing stored the page simply
// behaves exactly as before. Like every ll_* key, this one is listed in the
// Privacy Policy's local-storage inventory (PrivacyPolicy.jsx section 4).

const KEY = "ll_exam_lane_v1";
const LANES = ["jee", "neet", "school"];

/** The remembered lane ("jee" | "neet" | "school"), or null when unknown. */
export function getExamLane() {
  try {
    const value = localStorage.getItem(KEY);
    return LANES.includes(value) ? value : null;
  } catch {
    // Blocked storage must not break the homepage; "no preference" is the
    // honest reading of "we cannot tell".
    return null;
  }
}

/** Remember the lane. Unknown values are ignored rather than stored. */
export function setExamLane(lane) {
  if (!LANES.includes(lane)) return;
  try {
    localStorage.setItem(KEY, lane);
  } catch {
    /* storage blocked — the choice simply does not persist */
  }
}

/**
 * The exam cards with the student's own lane first — a stable partition, so
 * every other card keeps its existing order and nothing else about the grid
 * changes. With no remembered lane, or one the grid does not actually show,
 * the order is untouched.
 */
export function orderExamsByLane(exams, lane = getExamLane()) {
  const rows = exams ?? [];
  if (!lane || !rows.some((exam) => exam.id === lane)) return rows;
  return [
    ...rows.filter((exam) => exam.id === lane),
    ...rows.filter((exam) => exam.id !== lane),
  ];
}
