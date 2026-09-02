// Shared brand colours. The teal is deliberately dark enough for white text
// on buttons: #0F6F78 has a 5.89:1 contrast ratio against white (WCAG AA).
export const BRAND_NAVY = "#142A4F";
export const BRAND_TEAL = "#0F6F78";

// Editorial serif for the wordmark, hero and card/section titles. Academic and
// premium, deliberately not the default sans-everywhere look. System faces only
// (the build ships no webfonts): highest-quality serif first, graceful fallback.
// ONE definition so the header, home and catalogue cards can never drift apart.
export const BRAND_SERIF =
  '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Times New Roman",serif';

// A restrained per-subject palette for card spines / kickers. Falls back to the
// brand accent for anything unmapped.
export const SUBJECT_COLORS = {
  physics: "#3B6FE0", chemistry: "#CF8526", mathematics: "#7A5AF0",
  maths: "#7A5AF0", biology: "#D85B84", botany: "#2E9E6B", zoology: "#2E9E6B",
};
export const subjectColor = (name) =>
  SUBJECT_COLORS[String(name || "").toLowerCase()] ?? BRAND_TEAL;

// Which theme token a subject reads from. Aliases collapse here, so "maths"
// and "zoology" cannot drift from the colours they share.
const SUBJECT_TOKENS = {
  physics: "physics", chemistry: "chemistry", mathematics: "mathematics",
  maths: "mathematics", biology: "biology", botany: "botany", zoology: "botany",
};

/**
 * The subject's colour as TEXT — a CSS variable, so it swaps with the theme.
 *
 * SUBJECT_COLORS are fixed hexes chosen as BACKGROUNDS (the card spine, the
 * avatar). Used as small text they failed WCAG AA in one theme or the other,
 * every one of the six: physics 4.01:1 and mathematics 4.02:1 on the dark
 * surface, chemistry 2.98:1, botany 3.38:1 and biology 3.65:1 on the light
 * one, against the 4.5:1 needed. A fixed hex cannot swap, so the fix is a
 * token per theme (see index.css); these clear 4.6:1 on their own surface.
 */
export const subjectTextColor = (name) => {
  const token = SUBJECT_TOKENS[String(name || "").toLowerCase()];
  return `var(--subject-${token ?? "accent"})`;
};

// Black or white on the subject colour, whichever is legible. White initials
// were 2.98:1 on chemistry and 3.38:1 on botany; picking the ink by measured
// contrast puts every subject at 4.62:1 or better without changing the circle.
const SUBJECT_INK = {
  physics: "#ffffff", chemistry: "#0b0b0c", mathematics: "#ffffff",
  biology: "#0b0b0c", botany: "#0b0b0c", accent: "#ffffff",
};

/** The readable ink for text placed ON subjectColor(name). */
export const subjectInk = (name) =>
  SUBJECT_INK[SUBJECT_TOKENS[String(name || "").toLowerCase()] ?? "accent"];
