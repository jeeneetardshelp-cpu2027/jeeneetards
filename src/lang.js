// lang.js — tell a screen reader which script a piece of catalogue text is in.
//
// THE PROBLEM
// index.html declares lang="en" on <html>. That is right for the interface,
// and wrong for the catalogue: real course, chapter and lesson titles in this
// library are written in Devanagari — "कबीर की साखी", "हिंदी दसवीं". Under an
// English lang a screen reader either applies English phonetics to those
// letters or falls back to spelling them out, so a student who listens to the
// page hears noise where the course name should be. Both JEE and NEET have PwD
// categories; this is a real student, not a hypothetical one.
//
// THE FIX, AND ITS LIMITS
// One Unicode script test. No language model, no dependency, no per-character
// walk beyond the first match. It is deliberately modest, and honest about it:
//
//   • Devanagari carries Hindi, Marathi, Sanskrit, Nepali and others. This
//     catalogue's Devanagari content is Hindi, so "hi" is the correct tag
//     here. If Marathi or Sanskrit material is ever added, this is the one
//     place that has to learn the difference.
//   • A MIXED string ("Class 10 हिंदी") is tagged "hi" as a whole. Tagging it
//     at all is a clear improvement on tagging it "en"; splitting a string
//     into per-script spans is a much larger change and is not worth it for
//     titles this short.
//   • Hindi written in Latin letters ("Hindi Dasvin") is NOT detected. No
//     script test can do that, and guessing would be worse than not trying.

// The Unicode script property rather than a hand-written codepoint range: it
// covers the Devanagari block AND Devanagari Extended (the vedic marks that
// Sanskrit material uses), it cannot drift out of step with the standard the
// way a literal range can, and it correctly excludes the neighbouring Indic
// scripts — Bengali sits right next to Devanagari in Unicode.
const DEVANAGARI = /\p{Script=Devanagari}/u;

/** True when `value` is a string containing at least one Devanagari character. */
export function hasDevanagari(value) {
  return typeof value === "string" && DEVANAGARI.test(value);
}

/**
 * Attributes to spread onto the element that renders `value`:
 *
 *   <span {...langAttrs(course.title)}>{course.title}</span>
 *
 * Returns an empty object for Latin text (and for anything that is not a
 * string, e.g. a React node), so the document's own lang keeps applying and
 * nothing is marked as Hindi on a guess.
 */
export function langAttrs(value) {
  return hasDevanagari(value) ? { lang: "hi" } : {};
}
