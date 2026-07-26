import { STAGES_BY_EXAM } from "./filterModel.js";
import { filterByKey } from "./filterSchema.js";
import { toClassSlug, classSlugToStage } from "./canonicalUrl.js";
// filterChips.js — the active-filter chips under the Browse heading.
//
//     JEE ×   Class 11 ×   Physics ×   Kinematics ×
//
// Pure: takes URLSearchParams (plus display names the caller already fetched)
// and returns chips; removing one returns the NEXT URLSearchParams. No React,
// no supabase, so the dependency cascade below is testable directly.
//
// THE CASCADE IS THE WHOLE POINT. The curriculum is a hierarchy, so removing a
// level must remove everything beneath it — otherwise you get a URL like
// ?chapter=kinematics with no subject, which either returns nothing or
// silently returns a chapter from another subject. Removing a level must NOT
// touch its siblings or anything above it.
//
//   remove chapter  -> chapter only
//   remove subject  -> subject + chapter
//   remove class    -> class only        (class is orthogonal to subject)
//   remove board    -> board only
//   remove goal     -> goal + class + board + subject + chapter (everything)

// Ordered parent -> child. Index matters: removing key i clears the
// DEPENDENTS listed for it, never anything earlier.
export const CHIP_ORDER = ["goal", "class", "board", "subject", "chapter", "channel", "language", "type", "difficulty"];

// What each removal clears, including itself.
const CLEARS = {
  goal: ["goal", "class", "board", "subject", "chapter"],
  class: ["class"],
  board: ["board"],
  subject: ["subject", "chapter"],
  chapter: ["chapter"],
  channel: ["channel", "institute"],
  language: ["language"],
  type: ["type"],
  difficulty: ["difficulty"],
};

// Legacy id-based aliases that must be cleared alongside the canonical key,
// or an old link's ?sub=/&ch= would survive the removal and keep filtering.
const ALIASES = { subject: ["sub"], chapter: ["ch"], class: ["stage"] };

const CLASS_LABEL = {
  "10": "Class 10", "11": "Class 11", "12": "Class 12", dropper: "Dropper",
};

/**
 * Build the chip list.
 *
 * `names` supplies human labels the caller already has ({ goal: {jee:"JEE"},
 * subject: {physics:"Physics"}, ... }). When a name is unknown we show the
 * slug rather than inventing a title — a chip reading "Physics" for a slug we
 * could not resolve would be a lie about what is being filtered.
 */
export function buildChips(params, names = {}) {
  const chips = [];
  for (const key of CHIP_ORDER) {
    const raw = params.get(key) ?? (key === "subject" ? params.get("sub")
                : key === "chapter" ? params.get("ch")
                : key === "class" ? params.get("stage") : null);
    if (!raw) continue;

    const schema = filterByKey(key);
    // Multi-select filters get ONE CHIP PER VALUE. A single chip reading
    // "full-course,revision" cannot be removed one value at a time, so the
    // student could only ever clear the whole filter.
    const values = schema?.kind === "enum" ? raw.split(",").filter(Boolean) : [raw];

    for (const value of values) {
      const label =
        key === "class"
          ? (CLASS_LABEL[toClassSlug(value)] ?? `Class ${value}`)
          // Enum labels come from the canonical vocabulary, so a chip never
          // shows a raw slug ("full-course") where the panel says "Full course".
          : schema?.kind === "enum"
            ? (schema.options.find((o) => o.id === value)?.label ?? value)
            : (names[key]?.[value] ?? value);
      chips.push({ key, value, label });
    }
  }
  return chips;
}

/**
 * A comparison is only meaningful inside ONE chapter, so `?compare=` may
 * survive only while the SAME chapter is still active.
 *
 * This is applied by every path that can change the chapter — removing the
 * Chapter chip, removing Subject or Goal above it, Clear All, and the empty
 * state's "Choose another chapter". Each of those used to leave `compare=`
 * behind, producing a /compare link the comparison page then rejects as
 * mixed-chapter. One helper, called from all of them, is the only way to keep
 * that consistent.
 */
export function dropCompareIfChapterChanged(prev, next) {
  const before = prev.get("chapter") ?? prev.get("ch") ?? null;
  const after = next.get("chapter") ?? next.get("ch") ?? null;
  if (before !== after) next.delete("compare");
  return next;
}

/** Remove one chip, applying the cascade. Returns the next URLSearchParams. */
export function removeChip(params, key, value) {
  const next = new URLSearchParams(params);

  // Multi-select: remove just this value and keep the rest.
  const schema = filterByKey(key);
  if (schema?.kind === "enum" && value != null) {
    const rest = (next.get(key) ?? "").split(",").filter(Boolean).filter((v) => v !== value);
    if (rest.length) next.set(key, rest.join(",")); else next.delete(key);
    next.delete("page");
    return next;
  }

  for (const k of CLEARS[key] ?? [key]) {
    next.delete(k);
    for (const alias of ALIASES[k] ?? []) next.delete(alias);
  }
  // Any filter change resets paging: staying on page 4 of a now-larger result
  // set is how a working filter looks broken.
  next.delete("page");
  return dropCompareIfChapterChanged(params, next);
}

/**
 * Clear every curriculum filter.
 *
 * Preserves state that is not a filter and is still meaningful without one —
 * the sort order and the playlists/lectures tab. The comparison tray is NOT
 * preserved: it is chapter-scoped, and Clear All always removes the chapter.
 */
export function clearAllChips(params) {
  const next = new URLSearchParams(params);
  for (const k of CHIP_ORDER) {
    next.delete(k);
    for (const alias of ALIASES[k] ?? []) next.delete(alias);
  }
  next.delete("q");
  next.delete("teacher");
  next.delete("page");
  // Clear All always removes the chapter, so an in-progress comparison is
  // orphaned by definition. An earlier version preserved it deliberately;
  // that was wrong — the tray survived pointing at a chapter no longer in
  // context, and Compare then refused the link it produced.
  return dropCompareIfChapterChanged(params, next);
}

// Remove specific params (and reset paging) without the curriculum cascade.
// Used by the empty state's escape hatches, where the student is widening one
// axis rather than dismantling the hierarchy.
export function dropParam(params, keys) {
  const next = new URLSearchParams(params);
  for (const k of keys) next.delete(k);
  next.delete("page");
  return dropCompareIfChapterChanged(params, next);
}

const CLASS_NAME = {
  "class-10": "Class 10", "class-11": "Class 11",
  "class-12": "Class 12", dropper: "Dropper",
};

/**
 * What to say when a filtered view is empty.
 *
 * "0 courses" is technically true and completely unhelpful: it does not say
 * WHICH filter emptied the list, so the student cannot tell a narrow filter
 * from a broken site. Name the most specific active filter instead.
 *
 * The wording is deliberately "not classified yet" rather than "none exist":
 * an untagged course is excluded because we do not KNOW its class, which is a
 * gap in our metadata, not a fact about the library.
 */
export function emptyStateMessage({ stage, chapterName, subjectName } = {}) {
  const cls = CLASS_NAME[stage] ?? null;
  const where = chapterName ?? subjectName ?? null;

  if (cls && where)
    return {
      title: `No ${cls} courses are classified for ${where} yet.`,
      detail: "Other classes may cover this chapter. Courses without a class tag are not shown here.",
    };
  if (cls)
    return {
      title: `No ${cls} courses are classified yet.`,
      detail: "Courses without a class tag are not shown when a class is selected.",
    };
  if (where)
    return {
      title: `No courses are listed for ${where} yet.`,
      detail: "Try another chapter, or clear your filters to see everything.",
    };
  return {
    title: "No courses match this view.",
    detail: "Try clearing a filter, or browse a different chapter.",
  };
}

// ---------------------------------------------------------------- cascade

// Independent scalar filters: changing one affects nothing else.
const INDEPENDENT = ["channel", "language", "type", "difficulty"];

/**
 * Apply one filter interaction and return the next URLSearchParams.
 *
 * All hierarchy rules live here, so no component can forget one:
 *
 *   exam    -> keeps the class only if the new exam still offers it
 *              (JEE->NEET keeps Class 11; JEE->School drops Dropper),
 *              and always clears subject + chapter, whose validity is
 *              goal-dependent and cannot be judged without a query
 *   subject -> clears chapter
 *   chapter -> clears the comparison tray, which is chapter-scoped
 *   class   -> orthogonal to subject/chapter, so clears nothing
 *
 * Enum filters toggle within a comma list; dimension filters are single-select
 * and toggle off when re-clicked.
 */
export function applyFilterChange(params, filter, value) {
  const next = new URLSearchParams(params);
  const key = filter.param;
  const v = String(value);

  if (filter.kind === "enum") {
    const cur = (next.get(key) ?? "").split(",").filter(Boolean);
    const updated = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    if (updated.length) next.set(key, updated.join(",")); else next.delete(key);
  } else {
    if (next.get(key) === v) next.delete(key); else next.set(key, v);
  }

  if (!INDEPENDENT.includes(filter.key)) applyCascade(next, filter.key, params);

  // Any change to WHICH courses match sends the student back to page 1.
  // Leaving them on page 7 of a now 2-page result is how a working filter
  // looks broken.
  next.delete("page");
  return next;
}

/** Clear selections that the new parent value invalidates. */
function applyCascade(next, changedKey, prev) {
  if (changedKey === "goal") {
    const exam = next.get("goal");
    const stage = toClassSlug(next.get("class"));
    // Keep a class the new exam genuinely offers; drop one it does not.
    if (exam && stage) {
      const stageId = classSlugToStage(stage);
      const allowed = STAGES_BY_EXAM[exam] ?? [];
      if (!allowed.includes(stageId)) { next.delete("class"); next.delete("stage"); }
    }
    // Subject availability is goal-dependent (JEE has no Biology) and cannot
    // be checked without a query, so both go.
    next.delete("subject"); next.delete("sub");
    next.delete("chapter"); next.delete("ch");
  }
  if (changedKey === "subject") { next.delete("chapter"); next.delete("ch"); }

  // A comparison only means something within one chapter. Carrying a
  // selection across a chapter change would produce a /compare link the
  // comparison page then rejects as mixed-chapter.
  const chapterChanged =
    (prev.get("chapter") ?? prev.get("ch")) !== (next.get("chapter") ?? next.get("ch"));
  if (chapterChanged) next.delete("compare");
}
