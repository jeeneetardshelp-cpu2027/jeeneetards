// canonicalUrl.js — ONE address for a set of results.
//
// The guided journey ("Find a course") and the catalogue ("Browse courses")
// must not be two products. They are one result system with two ways in, and
// this module defines the address they both land on:
//
//     /browse?goal=jee&class=11&subject=physics&chapter=kinematics
//
// Slugs, not database ids, because this URL is shareable, bookmarkable and
// readable. Ids still work — an older link with ?sub=3&ch=7 keeps resolving —
// but slugs are what we EMIT.
//
// Pure: no React, no supabase. The slug -> id resolution that needs the
// database lives in useCanonicalFilters.js; everything here can be tested
// without either.

import { CLASS_SLUG_TO_LABEL } from "./classLevels.js";

// Canonical (slug) keys, and the legacy id-based keys they supersede.
export const CANONICAL_KEYS = {
  goal: "goal", class: "class", board: "board",
  subject: "subject", chapter: "chapter",
};
export const LEGACY_KEYS = { subject: "sub", chapter: "ch", class: "stage" };

/** "class-11" | "11" | "11th" -> the canonical short form used in the URL. */
export function toClassSlug(value) {
  if (!value) return null;
  const v = String(value).toLowerCase().trim();
  if (v === "dropper") return "dropper";
  const m = v.match(/(\d{1,2})/);
  if (m && ["10", "11", "12"].includes(m[1])) return m[1];
  return null;
}

/** The short URL form ("11") back to the stage id filterModel speaks ("class-11"). */
export function classSlugToStage(slug) {
  if (!slug) return null;
  if (slug === "dropper") return "dropper";
  return ["10", "11", "12"].includes(String(slug)) ? `class-${slug}` : null;
}

/** The stage id back to the class LABEL stored in playlists.class_levels[]. */
export function classSlugToLabel(slug) {
  return CLASS_SLUG_TO_LABEL[classSlugToStage(slug)] ?? null;
}

/**
 * Build the canonical results URL.
 *
 * Only truthy parts are emitted, and always in the same order, so the same
 * selection always produces a byte-identical URL. Two links that mean the same
 * thing must not differ, or "did the guided journey and the catalogue agree?"
 * becomes unanswerable.
 */
export function canonicalBrowseUrl({ goal, cls, board, subject, chapter, extra } = {}) {
  const p = new URLSearchParams();
  if (goal) p.set("goal", String(goal));
  const c = toClassSlug(cls);
  if (c) p.set("class", c);
  if (board) p.set("board", String(board));
  if (subject) p.set("subject", String(subject));
  if (chapter) p.set("chapter", String(chapter));
  for (const [k, v] of Object.entries(extra ?? {}))
    if (v != null && v !== "") p.set(k, String(v));
  const qs = p.toString();
  return qs ? `/browse?${qs}` : "/browse";
}

/**
 * Read the canonical selection out of URLSearchParams, accepting both the
 * slug form and the legacy id form. Never throws.
 *
 * Each field reports whether it is a slug (needs resolving against the
 * database) or already an id, so the caller knows what work is left.
 */
export function parseCanonical(params) {
  const pick = (canonical, legacy) => {
    const raw = params.get(canonical) ?? (legacy ? params.get(legacy) : null);
    if (raw == null || raw === "") return { raw: null, id: null, slug: null };
    const n = Number(raw);
    return Number.isInteger(n) && n > 0
      ? { raw, id: n, slug: null }
      : { raw, id: null, slug: String(raw) };
  };
  const clsRaw = params.get("class") ?? params.get("stage");
  return {
    goal: pick(CANONICAL_KEYS.goal, null),
    subject: pick(CANONICAL_KEYS.subject, LEGACY_KEYS.subject),
    chapter: pick(CANONICAL_KEYS.chapter, LEGACY_KEYS.chapter),
    board: params.get("board") || null,
    classSlug: toClassSlug(clsRaw),
    stage: classSlugToStage(toClassSlug(clsRaw)),
  };
}

/** Do two URLs select the same results? Compares only result-changing parts. */
export function sameSelection(a, b) {
  const norm = (u) => {
    const p = new URLSearchParams(u.includes("?") ? u.slice(u.indexOf("?") + 1) : u);
    const c = parseCanonical(p);
    return JSON.stringify({
      goal: c.goal.raw, subject: c.subject.raw, chapter: c.chapter.raw,
      board: c.board, cls: c.classSlug,
    });
  };
  return norm(a) === norm(b);
}
