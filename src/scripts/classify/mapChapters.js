// mapChapters.js — Phase 2 (rules-only) per-video chapter mapper.
//
// Pure functions, no I/O, no network. Given a video title and the subject's
// REAL chapter list, propose the best-fit chapter with a confidence and
// runner-ups. It NEVER invents a chapter outside the list, and it flags anything
// it is not confident about for a human to confirm — the easy majority
// auto-maps, the hard/ambiguous rows get surfaced.
//
// A future Phase-2b can add an LLM pass for the flagged rows; this rules pass is
// the free first cut and the fallback.

// Domain filler + generic words that carry no chapter signal. Dropping them
// stops a title like "Complete NEET 2025 One Shot" from matching on noise.
const STOPWORDS = new Set([
  "neet", "jee", "class", "dropper", "one", "shot", "oneshot", "complete",
  "full", "lecture", "lec", "part", "chapter", "ch", "session", "sir", "maam",
  "mam", "series", "batch", "video", "playlist", "revision", "marathon", "live",
  "crash", "course", "the", "of", "and", "for", "with", "to", "an", "by", "on",
  "vs", "in", "a", "from", "your", "you", "how", "what", "all", "best", "hindi",
  "english", "hinglish", "pw", "physics", "chemistry", "biology", "maths",
  "science", "social", // subject words are too broad to disambiguate a chapter
  // common title filler across sources
  "mcq", "pyq", "summary", "explanation", "animation", "cbse", "ncert", "board",
  "exam", "questions", "important", "expected", "repeated", "th",
  // Hindi function words (romanized + Devanagari) — high-frequency, low signal
  "ki", "ke", "ka", "ko", "mein", "se", "hai", "aur", "ek",
  "के", "की", "का", "को", "में", "से", "है", "और", "एक", "पर",
]);

// Common source-title names that differ from the canonical catalogue names.
// Aliases only contribute when their canonical chapter is present in the
// caller-supplied chapter list, so this map can never invent taxonomy.
const CHAPTER_ALIASES = new Map([
  ["current electricity", ["potentiometer"]],
  ["work energy and power", ["mechanical energy conservation"]],
  ["rotational motion", ["rotation revision", "complete rotation"]],
  ["kinematics", [
    "motion in a straight line",
    "motion in a plane",
    "projectile motion",
  ]],
]);

/** Lowercase, drop apostrophes, then collapse anything that is NOT a Unicode
 *  letter or number to a space. Script-agnostic: keeps Latin, Devanagari, etc.,
 *  so it works for Hindi (Devanagari) chapter names as well as English. */
export function normalizeForMatch(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/['’`´]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Significant tokens: drop pure numbers, 1-char tokens, and stopwords. */
export function tokenize(text) {
  return normalizeForMatch(text)
    .split(" ")
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !STOPWORDS.has(t));
}

/**
 * Score a chapter name against a title (0..1).
 *   1.0  the whole chapter name appears as a phrase in the title
 *   else recall of the chapter's significant tokens present in the title
 */
export function scoreChapter(titleNorm, titleTokenSet, chapterName) {
  const cNorm = normalizeForMatch(chapterName);
  if (!cNorm) return 0;
  if (cNorm.length >= 4 && titleNorm.includes(cNorm)) return 1;
  if ((CHAPTER_ALIASES.get(cNorm) ?? []).some((alias) => titleNorm.includes(alias))) {
    return 1;
  }
  const cTokens = tokenize(cNorm);
  if (!cTokens.length) return 0;
  const present = cTokens.filter((t) => titleTokenSet.has(t)).length;
  return present / cTokens.length;
}

const HIGH = 0.8; // confident
const LOW = 0.4; // below this, no confident proposal at all
const MARGIN = 0.2; // top must beat the runner-up by this to auto-accept

/**
 * Propose a chapter for one title.
 * @returns {{chapter: string|null, confidence: number, review: boolean,
 *            reason: string, alternatives: {name:string, score:number}[]}}
 */
export function proposeChapter(title, chapters = []) {
  const titleNorm = normalizeForMatch(title);
  const titleTokenSet = new Set(tokenize(title));
  const scored = chapters
    .map((name) => ({ name, score: scoreChapter(titleNorm, titleTokenSet, name) }))
    // On a score tie, prefer the LONGER (more specific) chapter: a title
    // containing "Resources and Development" must beat the shorter "Development"
    // chapter whose name is merely a substring of it.
    .sort((a, b) => b.score - a.score || b.name.length - a.name.length);

  const best = scored[0];
  const alternatives = scored.filter((s) => s.score > 0).slice(0, 3);

  if (!best || best.score < LOW) {
    return { chapter: null, confidence: best?.score ?? 0, review: true,
             reason: "no confident match", alternatives };
  }
  // A runner-up whose name is a substring of the best match is not real
  // competition ("Development" under "Resources and Development") — measure the
  // margin against the closest GENUINELY different chapter.
  const bestNorm = normalizeForMatch(best.name);
  const rival = scored.slice(1).find(
    (s) => s.score > 0 && !bestNorm.includes(normalizeForMatch(s.name)));
  const margin = best.score - (rival?.score ?? 0);
  const confident = best.score >= HIGH && margin >= MARGIN;
  return {
    chapter: best.name,
    confidence: best.score,
    review: !confident,
    reason: confident
      ? "high confidence"
      : best.score >= HIGH ? "ambiguous (close runner-up)" : "medium confidence",
    alternatives,
  };
}

/**
 * Draft assignments for a whole playlist.
 * @param videos [{ videoId, title, position }]
 * @param chapters string[] (the subject's real chapter names)
 * @returns { assignments, review, summary }
 */
export function draftAssignments(videos = [], chapters = []) {
  const rows = videos
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((v, i) => {
      const p = proposeChapter(v.title, chapters);
      return {
        position: v.position ?? i + 1,
        youtube_video_id: v.videoId,
        title: v.title,
        chapter: p.chapter,
        confidence: Number(p.confidence.toFixed(2)),
        review: p.review,
        reason: p.reason,
        alternatives: p.alternatives.map((a) => a.name),
      };
    });

  const summary = {
    total: rows.length,
    auto: rows.filter((r) => !r.review).length,
    review: rows.filter((r) => r.review && r.chapter).length,
    unmatched: rows.filter((r) => !r.chapter).length,
  };
  return { rows, summary };
}
