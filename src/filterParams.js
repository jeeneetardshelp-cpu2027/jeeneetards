// filterParams.js — read filter values out of the URL, safely.
//
// A URL is attacker- and typo-controlled. Every value here reaches a database
// predicate, so nothing is passed through unchecked. The rules:
//
//   * an enum value must exist in the canonical vocabulary
//   * a channel id must be a positive integer
//   * duplicates are collapsed, order preserved
//   * a bounded number of values, each of bounded length
//
// An invalid value is DROPPED and reported, never forwarded. Forwarding junk
// would either produce a database error the student cannot act on, or — worse
// — be ignored by the query and silently widen the result set.
//
// TERMINOLOGY. The canonical parameter is `channel`, not `institute`.
// institutes_channels is a registry of YouTube channels; "Institute" is
// reserved for a curated identity model that does not exist yet. Legacy
// `institute=` links are still READ, but only `channel=` is ever emitted.

import { COURSE_TYPES, DIFFICULTIES, LANGUAGES } from "./filterModel.js";

export const CANONICAL_CHANNEL_PARAM = "channel";
export const LEGACY_CHANNEL_PARAM = "institute";

// Bounds. A filter with 50 values is not a filter, and a 200-character "slug"
// is not a slug — both are signs of a crafted or corrupted URL.
export const MAX_VALUES = 12;
export const MAX_VALUE_LENGTH = 64;

const VOCAB = {
  language: LANGUAGES.map((o) => o.id),
  type: COURSE_TYPES.map((o) => o.id),
  difficulty: DIFFICULTIES.map((o) => o.id),
};

/**
 * Parse a comma-separated enum parameter.
 * @returns {{values: string[]|null, invalid: string[]}}
 *          `values` is null when the filter is absent (≠ an empty array,
 *          which would mean "match nothing").
 */
export function parseEnumParam(params, key) {
  const raw = params.get(key);
  if (raw == null || raw === "") return { values: null, invalid: [] };

  const allowed = VOCAB[key] ?? [];
  const seen = new Set();
  const values = [];
  const invalid = [];

  for (const piece of String(raw).split(",")) {
    const v = piece.trim();
    if (!v) continue;                                  // ",,," and trailing commas
    if (v.length > MAX_VALUE_LENGTH) { invalid.push(v.slice(0, MAX_VALUE_LENGTH)); continue; }
    if (!allowed.includes(v)) { invalid.push(v); continue; }
    if (seen.has(v)) continue;                         // duplicates collapse
    seen.add(v);
    values.push(v);
  }

  return {
    values: values.length ? values.slice(0, MAX_VALUES) : null,
    invalid,
  };
}

/**
 * Parse the channel id, accepting the legacy `institute=` key.
 * Must be a positive integer; anything else is invalid, not zero.
 */
export function parseChannelParam(params) {
  const raw = params.get(CANONICAL_CHANNEL_PARAM) ?? params.get(LEGACY_CHANNEL_PARAM);
  if (raw == null || raw === "") return { value: null, invalid: [] };
  const s = String(raw).trim();
  // Explicit digits-only test: Number("12abc") is NaN but Number(" 12 ") is 12,
  // and Number("1e3") is 1000 — none of which are ids a link should carry.
  if (!/^[0-9]+$/.test(s) || s.length > MAX_VALUE_LENGTH) return { value: null, invalid: [s] };
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0) return { value: null, invalid: [s] };
  return { value: String(n), invalid: [] };
}

/** Parse any single positive database id controlled by the URL. */
export function parsePositiveIdParam(params, key) {
  const raw = params.get(key);
  if (raw == null || raw === "") return { value: null, invalid: [] };
  const s = String(raw).trim();
  if (!/^[0-9]+$/.test(s) || s.length > MAX_VALUE_LENGTH)
    return { value: null, invalid: [s] };
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0) return { value: null, invalid: [s] };
  return { value: String(n), invalid: [] };
}

/** Every validated filter value, plus everything that was rejected. */
export function parseFilterParams(params) {
  const language = parseEnumParam(params, "language");
  const type = parseEnumParam(params, "type");
  const difficulty = parseEnumParam(params, "difficulty");
  const channel = parseChannelParam(params);
  const teacher = parsePositiveIdParam(params, "teacher");

  const invalid = [
    ...language.invalid.map((v) => ({ key: "language", value: v })),
    ...type.invalid.map((v) => ({ key: "type", value: v })),
    ...difficulty.invalid.map((v) => ({ key: "difficulty", value: v })),
    ...channel.invalid.map((v) => ({ key: "channel", value: v })),
    ...teacher.invalid.map((v) => ({ key: "teacher", value: v })),
  ];

  return {
    language: language.values,
    contentType: type.values,
    difficulty: difficulty.values,
    channelId: channel.value,
    teacherId: teacher.value,
    invalid,
  };
}

/**
 * Rewrite the URL so it holds only valid values, and only canonical keys.
 * Returns null when nothing needs changing, so callers can skip a no-op
 * navigation (which would otherwise loop).
 */
export function normalizeFilterParams(params) {
  const next = new URLSearchParams(params);
  let changed = false;

  for (const key of ["language", "type", "difficulty"]) {
    const { values } = parseEnumParam(params, key);
    const canonical = values ? values.join(",") : null;
    const current = params.get(key);
    if (current == null) continue;
    if (canonical === null) { next.delete(key); changed = true; }
    else if (canonical !== current) { next.set(key, canonical); changed = true; }
  }

  // Collapse legacy institute= into channel=, emitting only the canonical key.
  const { value } = parseChannelParam(params);
  const hadLegacy = params.get(LEGACY_CHANNEL_PARAM) != null;
  const current = params.get(CANONICAL_CHANNEL_PARAM);
  if (hadLegacy || current != null) {
    next.delete(LEGACY_CHANNEL_PARAM);
    if (value === null) { next.delete(CANONICAL_CHANNEL_PARAM); }
    else next.set(CANONICAL_CHANNEL_PARAM, value);
    if (hadLegacy || value !== current) changed = true;
  }


  const teacherCurrent = params.get("teacher");
  if (teacherCurrent != null) {
    const { value: teacher } = parsePositiveIdParam(params, "teacher");
    if (teacher === null) { next.delete("teacher"); changed = true; }
    else if (teacher !== teacherCurrent) { next.set("teacher", teacher); changed = true; }
  }

  return changed ? next : null;
}
