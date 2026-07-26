// validatePlaylistQuality.js — automated pre-import quality gate.
//
// Every check here maps to a REAL reason Codex has deferred or blocked a
// playlist by hand (see docs/mass_ingestion_preflight.md). The point is to turn
// that manual triage into an instant, deterministic report so a human reviews
// findings instead of eyeballing every playlist. Pure functions only — no
// network, no DB, no clock — so each rule is unit-testable.
//
// Severity:
//   block  — a hard data defect that must not be imported as-is
//            (duplicate video IDs, duplicate lesson numbers).
//   warn   — needs a human decision before import
//            (out-of-order lessons, cross-chapter reuse, no teacher evidence,
//             fewer usable videos than the source advertises).
//
// It decides nothing academic (is this the right chapter?) — only mechanical
// integrity, exactly the line the preflight doc draws.

import { findDuplicateVideoIds } from "../ingestionSafety.js";

// Parse a lesson number out of a source title. Handles the conventions seen in
// real catalogue sources: "…#7", "07.", "Lecture 7", "L-7", "Part 3".
// A plain-space leading number is authoritative over an internal "(Part N)"
// label, which describes a subseries rather than the playlist lesson number.
export function lessonNumber(title = "") {
  const hash = title.match(/#\s*(\d{1,3})\b/);
  if (hash) return Number(hash[1]);
  const lead = title.match(/^\s*(\d{1,3})(?=\s|[.)\-|])/);
  if (lead) return Number(lead[1]);
  const kw = title.match(/\b(?:lecture|lesson|part|ep|episode|l)\s*[-.:]?\s*(\d{1,3})\b/i);
  if (kw) return Number(kw[1]);
  return null;
}

const byPosition = (videos) =>
  [...videos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

// A lesson number appearing on more than one video. Codex blocked Ray Optics
// partly for "duplicates lesson number 36".
export function findDuplicateLessonNumbers(videos = []) {
  const seen = new Map();
  const dupes = new Set();
  for (const v of videos) {
    const n = lessonNumber(v.title);
    if (n == null) continue;
    if (seen.has(n)) dupes.add(n);
    else seen.set(n, true);
  }
  return [...dupes].sort((a, b) => a - b);
}

// Positions where the numbered sequence goes backwards. Codex deferred
// playlists for "lessons 6,7,8 out of source order" and "first two reversed".
// Only assessed when most videos carry a parseable number.
export function findOrderInversions(videos = []) {
  const ordered = byPosition(videos);
  const numbered = ordered.map((v) => ({ title: v.title, n: lessonNumber(v.title) }));
  const parsed = numbered.filter((x) => x.n != null);
  if (parsed.length < Math.ceil(ordered.length * 0.6)) return { assessable: false, inversions: [] };
  const inversions = [];
  let prev = null;
  for (let i = 0; i < numbered.length; i += 1) {
    const cur = numbered[i];
    if (cur.n == null) continue;
    if (prev != null && cur.n < prev.n) {
      inversions.push({ position: i, title: cur.title, number: cur.n, after: prev.n });
    }
    prev = cur;
  }
  return { assessable: true, inversions };
}

// Videos already present elsewhere in the catalogue. Codex deferred Sound Waves
// because it "includes an existing Wave Optics video". Legitimate reuse exists,
// so this is a review flag, not a hard block.
export function findOverlap(videos = [], existingVideoIds = new Set()) {
  return videos
    .map((v) => v.videoId)
    .filter((id) => id && existingVideoIds.has(id));
}

// The mapped RPC validates reused videos against their exact reviewed subject
// and chapter inside the same transaction. That resolves only the generic
// overlap warning; every other mechanical or review finding remains a write
// blocker until the classifier/source evidence is corrected.
export function mappedImportBlockingFindings(findings = []) {
  return findings.filter((finding) => finding.code !== "cross_chapter_overlap");
}

// Is there ANY teacher-attribution evidence across the playlist? Codex accepts
// a playlist once one video shows evidence (e.g. the "#alksir" hashtag), and
// defers when none does. Checks hashtags, "X Sir/Ma'am", "by X", and any
// known-teacher name/slug.
export function hasTeacherEvidence(videos = [], description = "", knownTeachers = []) {
  const haystack = [description, ...videos.map((v) => `${v.title ?? ""} ${v.description ?? ""}`)]
    .join(" \n ");
  if (/#\w*(?:sir|maam|ma'am)\b/i.test(haystack)) return true;
  if (/\b[A-Z][A-Za-z.]+\s+(?:sir|ma'?am)\b/i.test(haystack)) return true;
  if (/\bby\s+[A-Z][A-Za-z.]+/.test(haystack)) return true;
  for (const name of knownTeachers) {
    const slug = String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!slug) continue;
    const loose = String(name).toLowerCase().replace(/\s+/g, "\\s*");
    if (new RegExp(loose, "i").test(haystack)) return true;
    if (haystack.toLowerCase().replace(/[^a-z0-9]/g, "").includes(slug)) return true;
  }
  return false;
}

// Main gate. Returns a structured report; worst finding sets the overall status.
export function validatePlaylistQuality({
  playlist,
  existingVideoIds = new Set(),
  expectedVideoCount = null,
  knownTeachers = [],
} = {}) {
  const videos = byPosition(playlist?.videos ?? []);
  const findings = [];
  const add = (code, severity, message, items) => findings.push({ code, severity, message, items });

  // 1. Duplicate YouTube video IDs (hard block — reuses the importer's own rule).
  const dupIds = findDuplicateVideoIds(videos);
  if (dupIds.length) {
    add("duplicate_video_ids", "block",
      `Playlist repeats ${dupIds.length} YouTube video ID(s); blocked before any write.`, dupIds);
  }

  // 2. Duplicate lesson numbers (hard block).
  const dupNums = findDuplicateLessonNumbers(videos);
  if (dupNums.length) {
    add("duplicate_lesson_numbers", "block",
      `Two or more lessons share a number: ${dupNums.join(", ")}.`, dupNums);
  }

  // 3. Out-of-order lessons (review).
  const order = findOrderInversions(videos);
  if (order.assessable && order.inversions.length) {
    add("lesson_order_inversions", "warn",
      `${order.inversions.length} lesson(s) appear out of source order.`, order.inversions);
  }

  // 4. Cross-chapter reuse (review).
  const overlap = findOverlap(videos, existingVideoIds);
  if (overlap.length) {
    add("cross_chapter_overlap", "warn",
      `${overlap.length} video(s) already exist in the catalogue; confirm this is intended reuse.`, overlap);
  }

  // 5. Missing teacher evidence (review).
  if (videos.length && !hasTeacherEvidence(videos, playlist?.description ?? "", knownTeachers)) {
    add("no_teacher_evidence", "warn",
      "No teacher-attribution evidence found (hashtag, \"X Sir\", \"by X\", or a known name).", null);
  }

  // 6. Fewer usable videos than the source advertises (review).
  if (expectedVideoCount != null && videos.length < expectedVideoCount) {
    add("usable_count_shortfall", "warn",
      `Only ${videos.length} usable of ${expectedVideoCount} advertised (deleted/private removed).`,
      { usable: videos.length, expected: expectedVideoCount });
  }

  const status = findings.some((f) => f.severity === "block")
    ? "blocked"
    : findings.some((f) => f.severity === "warn")
      ? "review"
      : "ok";

  return {
    status,
    findings,
    blockers: findings.filter((f) => f.severity === "block"),
    warnings: findings.filter((f) => f.severity === "warn"),
    summary: {
      videoCount: videos.length,
      expectedVideoCount,
      duplicateVideoIds: dupIds.length,
      duplicateLessonNumbers: dupNums.length,
      orderInversions: order.assessable ? order.inversions.length : null,
      overlapCount: overlap.length,
    },
  };
}
