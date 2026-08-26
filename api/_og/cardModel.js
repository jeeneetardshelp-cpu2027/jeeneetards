// api/_og/cardModel.js — the pure half of the /api/og course-card renderer.
//
// Everything here is deliberately side-effect free so it can be unit-tested
// without a serverless runtime: parse and validate the ?course= id, decide
// whether the embedded fonts can render a title at all, normalise the
// PostgREST row into a card model, and build the satori element tree.
//
// HONESTY RULE. The card shows a star score ONLY when the site itself would:
// it reuses ratingDisplay from src/ratingConfidence.js (the "one
// rating-confidence rule for every student-facing surface"), so a WhatsApp
// preview can never claim a confidence the course page refuses to show.
//
// FONTS. The renderer embeds the KaTeX Main serif (Latin coverage only). A
// title containing scripts those fonts cannot draw — Devanagari most of all —
// must fall back to the static social-preview.png rather than render tofu
// into a shared image. needsStaticFallback() is that decision.

import { BRAND_TEAL, subjectColor } from "../../src/brandColors.js";
import { ratingDisplay } from "../../src/ratingConfidence.js";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** ?course= must be a positive integer id; anything else is not a course. */
export function parseCourseId(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,12}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Latin scripts (incl. Latin-1/Extended), general punctuation, and the few
// symbols course titles actually use. Anything outside — Devanagari, emoji,
// CJK — would render as missing-glyph boxes in the embedded serif.
const RENDERABLE = /^[\u0020-\u00B6\u00B8-\u024F\u2010-\u205E\u2212]*$/;

export function needsStaticFallback(text) {
  return !RENDERABLE.test(String(text ?? ""));
}

const INK = "#E8EEEC";
const INK_2 = "#B4C2BD";
const INK_3 = "#7E8F89";
const CANVAS = "#0F1512";
const SURFACE = "#161D1A";
const SERIF = "KaTeX Main";

function truncate(text, max) {
  const s = String(text ?? "").trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Normalise the PostgREST playlists row into what the card actually draws. */
export function courseCardModel(row) {
  if (!row || typeof row !== "object" || !row.title) return null;
  const lectures = Number(row.playlist_videos?.[0]?.count ?? 0);
  return {
    title: truncate(row.title, 90),
    teacher: truncate(row.teacher ?? "", 40),
    channel: truncate(row.institutes_channels?.name ?? "", 40),
    subject: String(row.subjects?.name ?? "").trim(),
    lectures: Number.isFinite(lectures) && lectures > 0 ? lectures : null,
    rating: ratingDisplay(row.average_rating, row.ratings_count),
  };
}

const el = (type, style, children) => ({ type, props: { style, children } });

function chip(text, color = INK_2, borderColor = "#26312E") {
  return el("div", {
    display: "flex",
    alignItems: "center",
    border: `2px solid ${borderColor}`,
    borderRadius: 999,
    padding: "10px 26px",
    fontSize: 26,
    color,
  }, text);
}

/**
 * The 1200x630 card as a satori element tree. Plain objects only — no JSX, no
 * React — so tests can walk it and the handler can hand it straight to satori.
 */
export function courseCardTree(model) {
  const spine = subjectColor(model.subject);
  const byline = [model.teacher, model.channel].filter(Boolean).join("  —  ");

  const stats = [];
  if (model.lectures) {
    stats.push(chip(`${model.lectures} lectures`));
  }
  if (model.rating?.kind === "scored") {
    stats.push(chip(
      `${model.rating.score.toFixed(1)}/5  —  ${model.rating.count} student ratings`,
      "#F0C24B",
      "#4A3E1F",
    ));
  } else if (model.rating?.kind === "low") {
    stats.push(chip(model.rating.text));
  }
  stats.push(chip("Free — no account to browse", "#6FD9CC", "#1E4B47"));

  return el("div", {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    display: "flex",
    backgroundColor: CANVAS,
    fontFamily: SERIF,
  }, [
    el("div", { width: 18, height: "100%", backgroundColor: spine, display: "flex" }),
    el("div", {
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      padding: "56px 64px 48px 56px",
    }, [
      // Header row: wordmark + domain.
      el("div", {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }, [
        el("div", { display: "flex", fontSize: 34, fontWeight: 700, color: INK }, "JEENEETARD"),
        el("div", { display: "flex", fontSize: 24, color: INK_3 }, "www.jeeneetard.com"),
      ]),
      // Kicker: the subject, in its colour.
      el("div", {
        display: "flex",
        marginTop: 54,
        fontSize: 26,
        letterSpacing: 4,
        color: spine,
      }, (model.subject || "Course").toUpperCase()),
      // The course title, the card's whole point.
      el("div", {
        display: "block",
        lineClamp: 2,
        marginTop: 18,
        fontSize: 62,
        fontWeight: 700,
        lineHeight: 1.15,
        color: INK,
      }, model.title),
      byline
        ? el("div", { display: "flex", marginTop: 22, fontSize: 30, color: INK_2 }, byline)
        : el("div", { display: "flex" }),
      // Stats chips pinned to the bottom.
      el("div", {
        display: "flex",
        marginTop: "auto",
        gap: 18,
        backgroundColor: CANVAS,
      }, stats),
    ]),
  ]);
}

export const CARD_BACKGROUNDS = { CANVAS, SURFACE, BRAND_TEAL };
