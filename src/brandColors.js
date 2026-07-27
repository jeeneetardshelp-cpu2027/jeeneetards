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
