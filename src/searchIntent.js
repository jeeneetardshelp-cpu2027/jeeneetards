// searchIntent.js — conservative natural-language parsing for /browse.
//
// The search box is allowed to turn a phrase into URL-backed filters only when
// the meaning is exact and reviewed. Anything ambiguous remains in `q`, where
// the ordinary catalogue search can handle it. This is deliberately not a
// probabilistic classifier: a confident-looking wrong filter is worse than a
// slightly longer search query.

import { COURSE_TYPES, DIFFICULTIES, LANGUAGES } from "./filterModel.js";

const ENUM_INTENTS = [
  ...LANGUAGES.map(({ id, label }) => ({ key: "language", value: id, label, phrases: [label, id] })),
  ...COURSE_TYPES.map(({ id, label }) => ({
    key: "type", value: id, label, phrases: [label, id, ...(id === "practice" ? ["problem solving"] : [])],
  })),
  ...DIFFICULTIES.map(({ id, label }) => ({
    key: "difficulty", value: id, label, phrases: [label, id],
  })),
];

const GOAL_INTENTS = [
  { key: "goal", value: "jee", label: "JEE", phrases: ["jee"] },
  { key: "goal", value: "neet", label: "NEET", phrases: ["neet"] },
  { key: "goal", value: "school", label: "Boards", phrases: ["boards", "board exam"] },
  { key: "goal", value: "olympiad", label: "Olympiad", phrases: ["olympiad"] },
];

// These aliases are reviewed curriculum mappings, not fuzzy guesses. A
// chapter intent carries its subject because chapter slugs are only unique
// inside a subject. Additions to this list should be covered by a test.
const REVIEWED_CHAPTER_INTENTS = [
  {
    subject: "physics", chapter: "kinematics", label: "Kinematics",
    phrases: ["kinematics", "kinematcs"],
  },
  {
    subject: "physics", chapter: "ray-optics", label: "Ray Optics and Optical Instruments",
    phrases: ["ray optics", "geometrical optics"],
  },
  {
    subject: "mathematics", chapter: "differentiation", label: "Differentiation",
    phrases: ["differentiation"],
  },
];

const PARAM_ALIASES = {
  class: ["class", "stage"],
  subject: ["subject", "sub"],
  chapter: ["chapter", "ch"],
};

const normalize = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim()
  .replace(/\s+/g, " ");

const cleanQuery = (value) => String(value ?? "")
  .normalize("NFKC")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim()
  .replace(/\s+/g, " ");

const currentValue = (params, key) => {
  for (const candidate of PARAM_ALIASES[key] ?? [key]) {
    const value = params.get(candidate);
    if (value) return value;
  }
  return null;
};

const compatible = (params, key, value) => {
  const current = currentValue(params, key);
  if (!current) return true;
  if (["language", "type", "difficulty"].includes(key))
    return current.split(",").includes(String(value));
  return String(current) === String(value);
};

const phrasePattern = (phrase) => new RegExp(`(^|\\s)${normalize(phrase).replace(/\s+/g, "\\s+")}(?=\\s|$)`, "i");

function consume(working, phrases) {
  const ordered = [...new Set(phrases.map(normalize).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  for (const phrase of ordered) {
    const pattern = phrasePattern(phrase);
    if (!pattern.test(working)) continue;
    return {
      working: working.replace(pattern, "$1").trim().replace(/\s+/g, " "),
      phrase,
    };
  }
  return null;
}

function uniqueOptionIntents(options, key) {
  const grouped = new Map();
  for (const option of options?.[key] ?? []) {
    const phrase = normalize(option.label);
    if (!phrase) continue;
    const rows = grouped.get(phrase) ?? [];
    rows.push({ key, value: String(option.value), label: option.label, phrases: [phrase] });
    grouped.set(phrase, rows);
  }
  // A duplicated display name is not safe to turn into a single filter.
  return [...grouped.values()].filter((rows) => rows.length === 1).map((rows) => rows[0]);
}

function classIntent(working, params) {
  const patterns = [
    /(^|\s)(?:class|grade)\s*(10|11|12)(?:th)?(?=\s|$)/i,
    /(^|\s)(10|11|12)(?:th)\s*(?:class|grade)?(?=\s|$)/i,
  ];
  for (const pattern of patterns) {
    const match = working.match(pattern);
    if (!match) continue;
    const value = match[2];
    if (!compatible(params, "class", value)) return null;
    return {
      working: working.replace(pattern, "$1").trim().replace(/\s+/g, " "),
      match: { key: "class", value, label: `Class ${value}`, phrase: match[0].trim() },
    };
  }
  const dropper = consume(working, ["dropper"]);
  if (dropper && compatible(params, "class", "dropper"))
    return {
      working: dropper.working,
      match: { key: "class", value: "dropper", label: "Class 11 + 12 syllabus", phrase: dropper.phrase },
    };
  return null;
}

function applyIntent(working, params, intent) {
  if (!compatible(params, intent.key, intent.value)) return null;
  const consumed = consume(working, intent.phrases);
  if (!consumed) return null;
  return {
    working: consumed.working,
    match: {
      key: intent.key, value: String(intent.value), label: intent.label,
      phrase: consumed.phrase,
    },
  };
}

/**
 * Parse exact browse intents and preserve all uncertain text.
 *
 * Existing explicit URL filters win. If a phrase conflicts with one, it is
 * left in the free-text query rather than silently changing either request.
 */
export function parseBrowseSearchIntent(query, { params = new URLSearchParams(), options = {} } = {}) {
  let working = cleanQuery(query);
  const matches = [];
  const filters = {};

  const accept = (result) => {
    if (!result) return;
    working = result.working;
    matches.push(result.match);
    filters[result.match.key] = result.match.value;
  };

  accept(classIntent(working, params));

  const intents = [
    ...GOAL_INTENTS,
    ...ENUM_INTENTS,
    ...uniqueOptionIntents(options, "subject"),
    ...uniqueOptionIntents(options, "channel"),
  ];
  for (const intent of intents) accept(applyIntent(working, params, intent));

  // Dynamic chapter options are available once a subject is selected.
  for (const intent of uniqueOptionIntents(options, "chapter"))
    accept(applyIntent(working, params, intent));

  // A bare chapter name is already a useful broad search (it can find the
  // chapter, courses, and lectures). Narrow it to a chapter filter only when
  // another structured clue such as class or language proves the student is
  // expressing a compound filter intent. This also preserves old ?q= links.
  const hasStructuredContext = matches.length > 0;
  for (const intent of hasStructuredContext ? REVIEWED_CHAPTER_INTENTS : []) {
    const existingSubject = filters.subject ?? currentValue(params, "subject");
    const canSetSubject = !existingSubject || existingSubject === intent.subject;
    const canSetChapter = compatible(params, "chapter", intent.chapter);
    if (!canSetSubject || !canSetChapter) continue;

    // "motion" is useful in the common query "class 11 motion", but is too
    // broad inside phrases such as "rotational motion". Accept it only when it
    // is the entire unconsumed query.
    const phrases = [...intent.phrases];
    if (intent.chapter === "kinematics" && normalize(working) === "motion") phrases.push("motion");
    const consumed = consume(working, phrases);
    if (!consumed) continue;

    if (!existingSubject) {
      filters.subject = intent.subject;
      matches.push({ key: "subject", value: intent.subject, label: intent.subject[0].toUpperCase() + intent.subject.slice(1), phrase: consumed.phrase });
    }
    filters.chapter = intent.chapter;
    matches.push({ key: "chapter", value: intent.chapter, label: intent.label, phrase: consumed.phrase });
    working = consumed.working;
  }

  return { filters, matches, remainingQuery: working };
}

/** Return canonical next URL params for a debounced search-box value. */
export function applyBrowseSearchIntent(params, query, options = {}) {
  const next = new URLSearchParams(params);
  const parsed = parseBrowseSearchIntent(query, { params, options });

  for (const [key, value] of Object.entries(parsed.filters)) {
    if (!currentValue(params, key)) next.set(key, value);
  }
  if (parsed.remainingQuery) next.set("q", parsed.remainingQuery);
  else next.delete("q");
  next.delete("page");

  return { ...parsed, params: next };
}
