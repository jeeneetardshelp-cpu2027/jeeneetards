// studyMaterialScope.js — the /materials URL *is* the filter.
//
// Same parameter names /browse uses — goal, class, subject, chapter, type —
// so one student scope carries between the two pages, a filtered view is a
// link they can send, refresh keeps it, and Back walks it backwards.
//
// The values arrive from the address bar, which is typo- and attacker-
// controlled, and every one of them ends up in a database predicate. So the
// rules of filterParams.js apply here too:
//
//   * a value not shaped like a slug is DROPPED, never forwarded
//   * an unknown material type is DROPPED — a scope carried over from /browse
//     spells ?type=full-course, which means nothing here. Dropping it widens
//     the page; forwarding it would return zero rows and blame the student
//   * an id must be a positive integer
//   * changing one level clears the levels BELOW it, never its siblings
//
// Pure: no React, no supabase, and deliberately no import from the /browse
// filter modules — /materials is its own route chunk and must not drag the
// browse screen's graph in behind it. The param NAMES are the contract here,
// not the code that reads them.

import { STUDY_MATERIAL_TYPES } from "./useStudyMaterials.js";

// A 200-character "slug" is not a slug; it is a crafted or corrupted URL.
export const MAX_VALUE_LENGTH = 64;

// The shape every slug on this site is generated with
// (name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), see importChannel.js) and
// the shape the database CHECKs that do constrain slugs use.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MATERIAL_TYPE_VALUES = STUDY_MATERIAL_TYPES.map((option) => option.value);

// class_levels.slug — the value get_study_materials actually compares against.
const CLASS_SLUGS = Object.freeze(["class-10", "class-11", "class-12", "dropper"]);

/** Every key /materials reads out of the URL, parent before child. */
export const MATERIAL_SCOPE_KEYS = Object.freeze([
  "goal", "board", "class", "subject", "chapter", "chapterId", "type",
]);

/**
 * "class-11" | "11" | "11th" | "class 11" -> the class_levels slug.
 *
 * Both spellings exist in real links: /browse emits the short `class=11`,
 * while a study-material search result emits the database slug
 * `class=class-11`. Accepting both is what makes a scope carry between the
 * two pages instead of silently returning nothing.
 */
export function toMaterialClassSlug(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim().toLowerCase();
  if (raw.length > MAX_VALUE_LENGTH) return null;
  if (raw === "dropper") return "dropper";
  const match = raw.match(/^(?:class[-\s]?)?(\d{1,2})(?:st|nd|rd|th)?$/);
  if (!match) return null;
  const slug = `class-${match[1]}`;
  return CLASS_SLUGS.includes(slug) ? slug : null;
}

function cleanSlug(value) {
  if (value == null) return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw || raw.length > MAX_VALUE_LENGTH) return null;
  return SLUG.test(raw) ? raw : null;
}

function cleanMaterialType(value) {
  if (value == null) return null;
  // Stored with underscores (short_notes); a hand-written `short-notes` means
  // the same thing, so accept it and emit the stored form.
  const raw = String(value).trim().toLowerCase().replace(/-/g, "_");
  if (!raw || raw.length > MAX_VALUE_LENGTH) return null;
  // Membership in the frozen vocabulary IS the validation. Nothing else can
  // reach get_study_materials as p_material_type.
  return MATERIAL_TYPE_VALUES.includes(raw) ? raw : null;
}

function cleanPositiveId(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  // Digits only on purpose: Number(" 12 ") is 12 and Number("1e3") is 1000,
  // neither of which is an id a link should be allowed to carry.
  if (!/^[0-9]+$/.test(raw) || raw.length > MAX_VALUE_LENGTH) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
}

/**
 * The canonical form of one parameter, or null when it must be dropped.
 * One function so reading, rewriting and reacting to a control can never
 * disagree about what a value means.
 */
export function canonicalScopeValue(key, value) {
  if (value == null || value === "") return null;
  switch (key) {
    case "class": return toMaterialClassSlug(value);
    case "type": return cleanMaterialType(value);
    case "chapterId": return cleanPositiveId(value);
    case "goal":
    case "board":
    case "subject":
    case "chapter":
      return cleanSlug(value);
    default:
      return null;
  }
}

/**
 * The validated scope behind the current URL.
 *
 * `stage` is the class_levels slug the RPC wants; `invalid` lists everything
 * that was thrown away, so the caller can rewrite the address bar and the
 * controls never claim a filter the query is not applying.
 */
export function readMaterialScope(params) {
  const scope = {
    goal: null, board: null, stage: null, subject: null,
    chapter: null, chapterId: null, type: null, invalid: [],
  };
  const field = { class: "stage" };
  for (const key of MATERIAL_SCOPE_KEYS) {
    const raw = params?.get?.(key) ?? null;
    if (raw == null || raw === "") continue;
    const value = canonicalScopeValue(key, raw);
    if (value == null) {
      scope.invalid.push({ key, value: String(raw).slice(0, MAX_VALUE_LENGTH) });
      continue;
    }
    scope[field[key] ?? key] = value;
  }
  return scope;
}

/**
 * Rewrite the URL so it holds only values we would act on, in canonical form.
 * Returns null when nothing needs changing, so the caller can skip a no-op
 * navigation (which would otherwise loop). Keys this page does not own are
 * left exactly as they are.
 */
export function normalizeMaterialScopeParams(params) {
  const next = new URLSearchParams(params);
  let changed = false;
  for (const key of MATERIAL_SCOPE_KEYS) {
    const current = params.get(key);
    if (current == null) continue;
    const value = canonicalScopeValue(key, current);
    if (value == null) { next.delete(key); changed = true; }
    else if (value !== current) { next.set(key, value); changed = true; }
  }
  return changed ? next : null;
}

/**
 * What each change clears, including itself.
 *
 * THE CASCADE IS THE POINT. get_study_material_curriculum narrows every level
 * by the levels above it, so a selection left behind by its parent filters
 * against a list it is no longer part of: ?subject=biology surviving a switch
 * to JEE empties the page with no way to see why.
 *
 * Class is a PARENT here, unlike the chip cascade on /browse where it is
 * orthogonal: get_study_material_curriculum narrows subjects by class, so a
 * subject chosen under Class 10 need not exist under Class 12.
 *
 * chapterId is the watch page's hand-off (StudyMaterialPanel links
 * /materials?chapterId=…). It is a chapter selection by another name, so any
 * curriculum change clears it too.
 */
export const MATERIAL_SCOPE_CLEARS = Object.freeze({
  goal: ["goal", "board", "class", "subject", "chapter", "chapterId"],
  board: ["board", "class", "subject", "chapter", "chapterId"],
  class: ["class", "subject", "chapter", "chapterId"],
  subject: ["subject", "chapter", "chapterId"],
  chapter: ["chapter", "chapterId"],
  type: ["type"],
});

/**
 * Parent before child, always in the same order, so the same selection always
 * produces the same link — the rule canonicalBrowseUrl follows for /browse.
 * Two links that mean the same thing must not look different. Keys this page
 * does not own keep their values and follow at the end.
 */
function orderScopeParams(params) {
  const next = new URLSearchParams();
  for (const key of MATERIAL_SCOPE_KEYS) {
    const value = params.get(key);
    if (value != null && value !== "") next.set(key, value);
  }
  for (const [key, value] of params) {
    if (!MATERIAL_SCOPE_KEYS.includes(key)) next.append(key, value);
  }
  return next;
}

/**
 * Apply one control interaction and return the next URLSearchParams.
 * An empty value clears the level. A value we cannot validate clears it too —
 * a control must never put something in the URL that the query would ignore.
 */
export function applyMaterialScopeChange(params, key, value) {
  const next = new URLSearchParams(params);
  for (const dependent of MATERIAL_SCOPE_CLEARS[key] ?? [key]) next.delete(dependent);
  const canonical = canonicalScopeValue(key, value);
  if (canonical) next.set(key, canonical);
  return orderScopeParams(next);
}
