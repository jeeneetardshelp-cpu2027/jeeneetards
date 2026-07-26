// filterModel.js — ONE definition of what a catalogue filter is.
//
// Class-level semantics are OWNED BY classLevels.js and imported below.
//
// Everything that touches filters (desktop sidebar, mobile bottom sheet, the
// query builder, the chips, the URL) reads this module. A second definition
// living in a component is how the class filter drifted from "strict" to
// "matches anything untagged" last time.
//
// Design rules encoded here:
//   * the URL is the state — nothing filter-shaped is held in component state
//   * strict membership: an untagged playlist matches NO class, ever
//   * Dropper INCLUDES Class 11 and 12 (see classLevels.js — that file owns
//     the rule; this one must never restate it)
//   * a board only applies to school content, and never crosses boards
//   * changing anything that changes the result set resets the page
//
// This module is deliberately pure: no React, no supabase. It can be reasoned
// about and tested without a browser or a database.

// ---------------------------------------------------------------- vocabulary
import { CLASS_LEVELS_BY_GOAL, CLASS_SLUG_TO_LABEL, playlistMatchesClass } from "./classLevels.js";

export const EXAMS = [
  { id: "jee", label: "JEE" },
  { id: "neet", label: "NEET" },
  { id: "school", label: "Boards" },
  { id: "olympiad", label: "Olympiad" },
];

export const STAGES = [
  { id: "class-10", label: "Class 10" },
  { id: "class-11", label: "Class 11" },
  { id: "class-12", label: "Class 12" },
  { id: "dropper", label: "Dropper" },
];

// Which stages an exam legitimately offers. Entrance exams do not run Class 10;
// school boards have no Dropper year. Rule 4 (disable impossible combinations)
// is driven from this table rather than from scattered conditionals.
// Re-exported, not re-declared. This was a verbatim copy of
// CLASS_LEVELS_BY_GOAL; two copies of the same table is how the Dropper rule
// drifted apart from classLevels.js in the first place.
export const STAGES_BY_EXAM = CLASS_LEVELS_BY_GOAL;

// Entrance-exam subject vocabularies are fixed by the exam, not by whatever
// happens to have been imported today. School Boards and Olympiad intentionally
// fall back to the database list because their subject catalogues are broader.
// This prevents impossible choices such as JEE + Biology and NEET + Mathematics.
export const SUBJECT_SLUGS_BY_GOAL = {
  jee: ["physics", "chemistry", "mathematics"],
  neet: ["physics", "chemistry", "biology"],
};

export const BOARDS = [
  { id: "cbse", label: "CBSE" },
  { id: "icse", label: "ICSE" },
  { id: "state", label: "State Board" },
];

export const COURSE_TYPES = [
  { id: "full-course", label: "Full course" },
  { id: "one-shot", label: "One-shot" },
  { id: "revision", label: "Revision" },
  { id: "pyq", label: "PYQ" },
  { id: "practice", label: "Problem-solving" },
];

export const DIFFICULTIES = [
  { id: "beginner", label: "Foundation" },
  { id: "intermediate", label: "Main" },
  { id: "advanced", label: "Advanced" },
];

export const LANGUAGES = [
  { id: "hindi", label: "Hindi" },
  { id: "english", label: "English" },
  { id: "hinglish", label: "Hinglish" },
];

// Buckets, not free numbers — a slider produces unshareable URLs and unbounded
// facet permutations. Seconds, inclusive lower bound, exclusive upper.
export const TOTAL_DURATION = [
  { id: "lt5h", label: "Under 5 hours", min: 0, max: 5 * 3600 },
  { id: "5to15h", label: "5–15 hours", min: 5 * 3600, max: 15 * 3600 },
  { id: "15to40h", label: "15–40 hours", min: 15 * 3600, max: 40 * 3600 },
  { id: "gt40h", label: "40+ hours", min: 40 * 3600, max: null },
];

export const AVG_LECTURE = [
  { id: "short", label: "Under 20 min", min: 0, max: 20 * 60 },
  { id: "medium", label: "20–45 min", min: 20 * 60, max: 45 * 60 },
  { id: "long", label: "45+ min", min: 45 * 60, max: null },
];

// Comparison bounds live here, in the pure module, because BOTH the catalogue
// tray and the comparison page need them. Defining them in either component
// would either duplicate the rule or create a circular import between them.
// Two is the minimum that is a comparison at all; beyond four the columns stop
// being readable on a phone, which is where comparison matters most.
export const MIN_COMPARE = 2;
export const MAX_COMPARE = 4;

// Only sorts that are actually backed by a column/query are offered. Options
// with no data behind them (a "Most complete" coverage metric, a "Shortest"
// total-duration column) are deliberately absent rather than decorative — a
// dropdown option that does nothing is worse than one that isn't there.
// "popular" / "most_viewed" are driven by the video_stats rollups
// (view_count_total / popularity_score); usePlaylistBrowse.js maps each id to
// its .order() chain.
export const SORTS = [
  { id: "recommended", label: "Recommended" },
  { id: "popular", label: "Most popular" },
  { id: "most_viewed", label: "Most viewed" },
  { id: "rating", label: "Highest rated" },
  { id: "recent", label: "Recently added" },
];
export const DEFAULT_SORT = "recommended";

// ---------------------------------------------------------------- URL schema
// Short, stable keys. Renaming one is a breaking change to every shared link,
// so they are defined once, here.
export const KEYS = {
  exam: "exam", stage: "stage", board: "board", subject: "sub",
  unit: "unit", chapter: "ch", faculty: "teacher", institute: "inst",
  language: "lang", courseType: "type", difficulty: "level",
  totalDuration: "dur", avgLecture: "avg", updated: "updated",
  completeOnly: "complete", sort: "sort", page: "page", q: "q", tab: "tab",
};

// Multi-select filters are comma-joined; single-select are scalar.
const MULTI = new Set(["language", "courseType", "difficulty", "faculty", "institute"]);

const asList = (raw) => (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const oneOf = (raw, options) => (options.some((o) => o.id === raw) ? raw : null);
const posInt = (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Read the whole filter state out of URLSearchParams. Never throws. */
export function parseFilters(params) {
  const get = (k) => params.get(KEYS[k]);
  const exam = oneOf(get("exam"), EXAMS);
  const stageRaw = oneOf(get("stage"), STAGES);
  // Rule 4: an impossible pair is dropped, not silently honoured. JEE + Class 10
  // would otherwise produce a permanently empty result set with no explanation.
  const stage = exam && stageRaw && !(STAGES_BY_EXAM[exam] ?? []).includes(stageRaw)
    ? null : stageRaw;
  // A board is meaningless outside school content; carrying it into a JEE view
  // would filter results by something the student never chose.
  const board = exam === "school" ? oneOf(get("board"), BOARDS) : null;

  return {
    exam, stage, board,
    subject: posInt(get("subject")),
    unit: posInt(get("unit")),
    chapter: posInt(get("chapter")),
    faculty: asList(get("faculty")).map(Number).filter(Number.isInteger),
    institute: asList(get("institute")).map(Number).filter(Number.isInteger),
    language: asList(get("language")).filter((v) => LANGUAGES.some((l) => l.id === v)),
    courseType: asList(get("courseType")).filter((v) => COURSE_TYPES.some((c) => c.id === v)),
    difficulty: asList(get("difficulty")).filter((v) => DIFFICULTIES.some((d) => d.id === v)),
    totalDuration: oneOf(get("totalDuration"), TOTAL_DURATION),
    avgLecture: oneOf(get("avgLecture"), AVG_LECTURE),
    updated: get("updated") === "1",
    completeOnly: get("completeOnly") === "1",
    sort: oneOf(get("sort"), SORTS) ?? DEFAULT_SORT,
    page: Math.max(0, Number(params.get(KEYS.page) ?? 0) || 0),
    q: (params.get(KEYS.q) ?? "").trim(),
    tab: params.get(KEYS.tab) === "lectures" ? "lectures" : "playlists",
  };
}

// Filters that change WHICH courses match. Changing any of them must send the
// student back to page 1 — leaving them on page 7 of a 2-page result is how a
// filter looks broken when it is working.
export const RESULT_CHANGING = [
  "exam", "stage", "board", "subject", "unit", "chapter", "faculty", "institute",
  "language", "courseType", "difficulty", "totalDuration", "avgLecture",
  "updated", "completeOnly", "q",
];

/**
 * Apply a change and return the next URLSearchParams.
 * Rule 8 lives here so no caller can forget it.
 */
export function applyFilter(params, key, value) {
  const next = new URLSearchParams(params);
  const urlKey = KEYS[key];
  if (!urlKey) return next;

  if (MULTI.has(key)) {
    const cur = asList(next.get(urlKey));
    const v = String(value);
    const updated = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    if (updated.length) next.set(urlKey, updated.join(",")); else next.delete(urlKey);
  } else if (value == null || value === "" || value === false) {
    next.delete(urlKey);
  } else if (value === true) {
    next.set(urlKey, "1");
  } else {
    // toggling the same single-select value off is what a second click means
    if (next.get(urlKey) === String(value)) next.delete(urlKey);
    else next.set(urlKey, String(value));
  }

  // changing the exam invalidates a stage the new exam does not offer, and any
  // board (which only applies to school content)
  if (key === "exam") {
    const exam = next.get(KEYS.exam);
    const stage = next.get(KEYS.stage);
    if (stage && !(STAGES_BY_EXAM[exam] ?? []).includes(stage)) next.delete(KEYS.stage);
    if (exam !== "school") next.delete(KEYS.board);
  }

  if (RESULT_CHANGING.includes(key)) next.delete(KEYS.page);
  return next;
}

export function clearAll(params) {
  const next = new URLSearchParams(params);
  for (const k of RESULT_CHANGING) next.delete(KEYS[k]);
  next.delete(KEYS.page);
  return next;                       // sort and tab are view preferences, kept
}

// ---------------------------------------------------------------- chips
const labelOf = (options, id) => options.find((o) => o.id === id)?.label ?? id;

/**
 * Removable chips for everything currently selected (rule 2).
 * `names` supplies labels for id-based filters the URL cannot describe on its
 * own (subject 3 -> "Physics"); without a name the chip stays honest and shows
 * the raw reference rather than inventing one.
 */
export function toChips(filters, names = {}) {
  const chips = [];
  const push = (key, value, label) => chips.push({ key, value, label });

  if (filters.exam) push("exam", filters.exam, labelOf(EXAMS, filters.exam));
  if (filters.stage) push("stage", filters.stage, labelOf(STAGES, filters.stage));
  if (filters.board) push("board", filters.board, labelOf(BOARDS, filters.board));
  if (filters.subject) push("subject", filters.subject, names.subject?.[filters.subject] ?? `Subject #${filters.subject}`);
  if (filters.unit) push("unit", filters.unit, names.unit?.[filters.unit] ?? `Unit #${filters.unit}`);
  if (filters.chapter) push("chapter", filters.chapter, names.chapter?.[filters.chapter] ?? `Chapter #${filters.chapter}`);
  for (const id of filters.faculty) push("faculty", id, names.faculty?.[id] ?? `Teacher #${id}`);
  for (const id of filters.institute) push("institute", id, names.institute?.[id] ?? `Institute #${id}`);
  for (const v of filters.language) push("language", v, labelOf(LANGUAGES, v));
  for (const v of filters.courseType) push("courseType", v, labelOf(COURSE_TYPES, v));
  for (const v of filters.difficulty) push("difficulty", v, labelOf(DIFFICULTIES, v));
  if (filters.totalDuration) push("totalDuration", filters.totalDuration, labelOf(TOTAL_DURATION, filters.totalDuration));
  if (filters.avgLecture) push("avgLecture", filters.avgLecture, labelOf(AVG_LECTURE, filters.avgLecture));
  if (filters.updated) push("updated", true, "Updated recently");
  if (filters.completeOnly) push("completeOnly", true, "Metadata complete");
  if (filters.q) push("q", filters.q, `“${filters.q}”`);
  return chips;
}

// ---------------------------------------------------------------- semantics
/**
 * STRICT class membership. An untagged playlist matches NOTHING — a class
 * filter that lets unclassified content through is not a filter.
 *
 * DROPPER INCLUDES CLASS 11 AND 12. A dropper is revising both years, so
 * material tagged "11th" or "12th" is exactly what they need; requiring an
 * explicit "Dropper" tag would hide most of the library from them.
 *
 * The inclusion is one-directional: Class 11 does NOT pick up Class-12-only
 * content. Dropper is a superset of 11 and 12, not a peer of them.
 *
 * This delegates to classLevels.js rather than restating the rule. An earlier
 * version of this file kept its own copy that made Dropper strictly
 * non-inheriting — the opposite of the real behaviour — and the two sources
 * disagreed silently. There must be exactly one definition.
 *
 * Note this is CURRICULUM CLASS, not teaching audience. "Made for droppers"
 * (a course authored specifically for repeat candidates) is a different
 * concept and belongs in a separate audience_focus filter; it is not modelled
 * here and must not be inferred from class tags.
 */
export const STAGE_TO_LABEL = CLASS_SLUG_TO_LABEL;

export function playlistMatchesStage(stageId, playlistClassLevels) {
  if (!stageId) return true;                        // no stage chosen: no filter
  const label = STAGE_TO_LABEL[stageId];
  if (!label) return true;                          // unknown stage: no filter
  return playlistMatchesClass(label, playlistClassLevels);
}

/** Is this exam/stage pair selectable at all? Drives the disabled state. */
export function isStageAvailable(examId, stageId) {
  if (!examId) return true;
  return (STAGES_BY_EXAM[examId] ?? []).includes(stageId);
}

/** Boards only apply to school content (rule 7's first half). */
export function isBoardApplicable(examId) {
  return examId === "school";
}

/**
 * Which filter most likely emptied the result set (rule 14). Ordered from most
 * to least restrictive so the message names the real culprit rather than the
 * first thing set.
 */
export function likelyCulprit(filters) {
  const order = [
    ["chapter", filters.chapter], ["faculty", filters.faculty?.length],
    ["board", filters.board], ["stage", filters.stage],
    ["difficulty", filters.difficulty?.length], ["courseType", filters.courseType?.length],
    ["totalDuration", filters.totalDuration], ["avgLecture", filters.avgLecture],
    ["language", filters.language?.length], ["completeOnly", filters.completeOnly],
    ["updated", filters.updated], ["q", filters.q], ["subject", filters.subject],
    ["exam", filters.exam],
  ];
  const hit = order.find(([, v]) => Boolean(v));
  return hit ? hit[0] : null;
}
