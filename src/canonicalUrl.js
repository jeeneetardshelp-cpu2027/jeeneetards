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
// The second half of this file does the same job for a single course's own
// address, /course/:id/:slug — same rule (readable, but the id is what
// resolves), different shape.
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

// ---------------------------------------------------------------------------
// A course's own address: /course/:id/:slug
//
// Same principle as the results URL above — the address is readable — with one
// difference that decides the whole design: THE ID IS THE LOOKUP KEY AND THE
// SLUG IS NEVER READ. Every consumer resolves the course from the id alone, so
// a retitled course keeps working, an old link keeps working, and a slug typed
// wrong by hand keeps working. The slug exists for two audiences only: a search
// engine reading keywords in the URL, and a student seeing what a link is
// before WhatsApp finishes loading its preview card.
//
// The edge (middleware.js) redirects any non-canonical shape to the canonical
// one and emits the canonical as <link rel="canonical"> and og:url; the sitemap
// lists the canonical form. All three call the two functions below, so they
// cannot disagree about what a course's address is.
// ---------------------------------------------------------------------------

// Long enough for a real course title, short enough to stay readable when
// WhatsApp truncates a pasted link.
const COURSE_SLUG_MAX = 60;

// "chapter" would make /course/13/chapter ambiguous with the chapter sub-route
// /course/13/chapter/:chapterId. Refusing it costs one title in a thousand and
// removes the ambiguity entirely.
const RESERVED_COURSE_SLUGS = new Set(["chapter"]);

/**
 * A course title reduced to a lowercase ASCII slug, or "" when the title has
 * no ASCII letters or digits to work with.
 *
 * DELIBERATELY ASCII-ONLY. This catalogue has Devanagari titles ("कबीर की
 * साखी"), and they get NO slug — their canonical address stays the bare
 * /course/:id. Three reasons, in order of weight:
 *
 *   1. A URL is a permanent public artifact. The database has a
 *      transliteration bridge (translit_devanagari, used by universal_search),
 *      but it exists to MATCH a query, where a wrong guess costs one bad
 *      ranking. Minting an address from a guess about how a student spells a
 *      course name is a different bet, and a durable one.
 *   2. The edge, the sitemap builder and the browser must all compute the same
 *      slug offline. The bridge is a SQL function: using it would mean either
 *      an extra round trip inside the edge's 1500 ms budget or a second
 *      transliteration table in JavaScript that would drift from the SQL one.
 *      A canonical URL two systems compute differently is worse than no slug.
 *   3. Percent-encoded Devanagari (/course/398/%E0%A4%95%E0%A4%AC…) is MORE
 *      opaque in a WhatsApp message than /course/398, which is the exact
 *      problem the slug is here to fix.
 *
 * Nothing regresses for those courses: /api/og still renders the real title on
 * the preview card, and the id-only URL is what they already have.
 */
export function courseSlug(title) {
  const ascii = String(title ?? "")
    // Decompose first, then drop the combining marks, so "Résumé"/"Ångström"
    // become "resume"/"angstrom" instead of losing the letter entirely.
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!ascii) return "";

  let cut = ascii;
  if (ascii.length > COURSE_SLUG_MAX) {
    const head = ascii.slice(0, COURSE_SLUG_MAX);
    // Cut on a word boundary when there is one, so the slug never ends
    // mid-word. A single word longer than the cap is simply truncated.
    const lastDash = ascii[COURSE_SLUG_MAX] === "-" ? -1 : head.lastIndexOf("-");
    cut = lastDash > 0 ? head.slice(0, lastDash) : head;
  }
  const slug = cut.replace(/^-+|-+$/g, "");
  return RESERVED_COURSE_SLUGS.has(slug) ? "" : slug;
}

/**
 * The one canonical path for a course. Falls back to the bare id whenever the
 * title yields no slug, so this always returns a working address.
 */
export function canonicalCoursePath(id, title) {
  const key = encodeURIComponent(String(id ?? "").trim());
  const slug = courseSlug(title);
  return slug ? `/course/${key}/${slug}` : `/course/${key}`;
}

/**
 * Read a /course/... path, accepting every shape the site answers:
 *
 *     /course/398                          bare id (old links, internal links)
 *     /course/398/kinematics               canonical
 *     /course/398/chapter/7                chapter sub-URL
 *     /course/398/kinematics/chapter/7     hand-edited combination of the two
 *
 * Returns { id, slug, chapterId } or null. The slug is returned so the caller
 * can decide whether the URL is canonical — never so it can look anything up.
 * The 120-character cap keeps the accepted URL space finite; anything longer
 * is not a stale slug, it is junk, and gets a real 404.
 */
export function parseCoursePath(pathname) {
  const raw = String(pathname ?? "");
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  const match = path.match(/^\/course\/(\d+)(?:\/([^/]{1,120}))?(?:\/chapter\/(\d+))?$/);
  if (!match) return null;
  return { id: match[1], slug: match[2] ?? null, chapterId: match[3] ?? null };
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
