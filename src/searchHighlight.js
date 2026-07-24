// searchHighlight.js — normalisation used ONLY for drawing the yellow marks.
//
// This is deliberately weaker than the database's normalize_search_text().
//
// Why they differ: the SQL version collapses punctuation and whitespace, which
// CHANGES THE LENGTH of the string. Highlighting works by finding an offset in
// a normalised copy and then slicing the ORIGINAL text at that offset — so if
// the two strings have different lengths, the slice lands in the wrong place
// and the UI renders mangled words. A cosmetic feature must never alter the
// text it is decorating.
//
// So the rule here is: length-preserving transforms only.
//
// The cost is that "abj-sir" will not visibly highlight inside "ABJ Sir" even
// though the server correctly MATCHED them. That is the right trade: the
// result is still returned and still ranked, it simply is not underlined. The
// alternative — an index map from normalised offsets back to original ones —
// is real complexity for a purely decorative gain.

/**
 * Case-fold without changing length.
 *
 * `toLowerCase()` is length-preserving for effectively every character we
 * store, but not universally (İ -> i̇ is 1 char -> 2). Rather than assume, we
 * verify and fall back to the original string, which simply yields no
 * highlight instead of a corrupted one.
 */
export function normalizeForHighlight(text) {
  const src = text ?? "";
  const lowered = src.toLowerCase();
  return lowered.length === src.length ? lowered : src;
}
