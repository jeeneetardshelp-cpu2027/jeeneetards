// api/_og/cardModel.js — the pure half of the /api/og card renderer.
//
// Everything here is deliberately side-effect free so it can be unit-tested
// without a serverless runtime: parse and validate the ?course= id, decide
// whether the embedded fonts can render a title at all, normalise the
// PostgREST row into a card model, and build the satori element tree.
//
// TWO CARDS, ONE LOOK. The course card (/api/og?course=<id>) and the chapter
// card (/api/og?course=<id>&chapter=<chapterId>) share the frame, header,
// kicker, byline and chip helpers below. The chapter card exists because the
// most-shared URL is /course/:id/chapter/:chapterId — the link ChapterCleared
// builds — and as measured on 15 Sep 2026 every one of those previews showed
// the WHOLE course's card underneath a "Cleared <chapter>" message.
//
// HONESTY RULE. The course card shows a star score ONLY when the site itself
// would: it reuses ratingDisplay from src/ratingConfidence.js (the "one
// rating-confidence rule for every student-facing surface"), so a WhatsApp
// preview can never claim a confidence the course page refuses to show. The
// chapter card shows no rating at all — a course's rating is not a chapter's.
//
// FONTS. The renderer embeds the KaTeX Main serif (Latin coverage only). A
// title containing scripts those fonts cannot draw — Devanagari most of all —
// must fall back to the static social-preview.png rather than render tofu
// into a shared image. needsStaticFallback() is that decision.

import { BRAND_TEAL, subjectColor } from "../../src/brandColors.js";
import { ratingDisplay } from "../../src/ratingConfidence.js";
import { namesMatch } from "../../src/courseMetadata.js";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/**
 * ?course= must be a positive integer id; anything else is not a course.
 * ?chapter= uses the same rule — chapter ids are the same bigint shape.
 */
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

/** A lecture count worth drawing: a positive integer, else null (no chip). */
function lectureCount(value) {
  const n = Number(value ?? 0);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Normalise the PostgREST playlists row into what the card actually draws. */
export function courseCardModel(row) {
  if (!row || typeof row !== "object" || !row.title) return null;
  return {
    title: truncate(row.title, 90),
    teacher: truncate(row.teacher ?? "", 40),
    channel: truncate(row.institutes_channels?.name ?? "", 40),
    subject: String(row.subjects?.name ?? "").trim(),
    lectures: lectureCount(row.playlist_videos?.[0]?.count),
    rating: ratingDisplay(row.average_rating, row.ratings_count),
  };
}

/**
 * The chapter card's model: the chapter as the headline, the course it belongs
 * to as context. `chapterInfo` is { name, lectures }, where lectures counts
 * THIS course's lectures in the chapter — never a catalogue-wide count.
 * Measured against production 16 Sep 2026: chapter 78 (Binomial Theorem) has
 * 92 lectures in course 88 but 114 across the catalogue, so the wrong count
 * would overstate the chapter by a quarter.
 *
 * Returns null without a usable course row or chapter name, so the handler
 * draws the course card instead. Deliberately carries NO rating.
 */
export function chapterCardModel(courseRow, chapterInfo) {
  const course = courseCardModel(courseRow);
  const name = String(chapterInfo?.name ?? "").trim();
  if (!course || !name) return null;
  return {
    chapter: truncate(name, 90),
    // 50 keeps "From the course: …" on ONE line at 30px in the 1062px text
    // column (70 wrapped to two in a worst-case render), leaving the chips room.
    // Empty when the course is named after this chapter (compared in full,
    // before truncating): "From the course: Friction" under a "Friction"
    // headline says nothing, so the tree leaves the line out.
    courseTitle: namesMatch(name, courseRow.title) ? "" : truncate(course.title, 50),
    teacher: course.teacher,
    channel: course.channel,
    subject: course.subject,
    lectures: lectureCount(chapterInfo.lectures),
  };
}

/** Every string the chapter card draws, for the needsStaticFallback gate. */
export function chapterCardText(model) {
  return `${model.chapter}${model.courseTitle}${model.teacher}${model.channel}`;
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

const freeChip = () => chip("Free — no account to browse", "#6FD9CC", "#1E4B47");

/** The big headline: course title on one card, chapter name on the other. */
function headline(text) {
  return el("div", {
    display: "block",
    lineClamp: 2,
    marginTop: 18,
    fontSize: 62,
    fontWeight: 700,
    lineHeight: 1.15,
    color: INK,
  }, text);
}

function byline(model) {
  const text = [model.teacher, model.channel].filter(Boolean).join("  —  ");
  return text
    ? el("div", { display: "flex", marginTop: 22, fontSize: 30, color: INK_2 }, text)
    : el("div", { display: "flex" });
}

/**
 * The shared 1200x630 frame: subject-coloured spine, wordmark header, subject
 * kicker, the card-specific `body` blocks, and the chips pinned to the bottom.
 * Both cards go through here so their visual language cannot drift apart.
 */
function cardFrame(subject, body, stats) {
  const spine = subjectColor(subject);
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
      }, (subject || "Course").toUpperCase()),
      ...body,
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

/**
 * The 1200x630 course card as a satori element tree. Plain objects only — no
 * JSX, no React — so tests can walk it and the handler can hand it straight to
 * satori.
 */
export function courseCardTree(model) {
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
  stats.push(freeChip());

  // The course title, the card's whole point.
  return cardFrame(model.subject, [headline(model.title), byline(model)], stats);
}

/**
 * The 1200x630 chapter card: the chapter name as the headline, the course it
 * is from beneath it, then the same teacher/channel byline as the course card.
 * The chips carry only what was counted for THIS chapter in THIS course — and
 * no rating chip, because no chapter-level rating exists to stand behind.
 */
export function chapterCardTree(model) {
  const stats = [];
  if (model.lectures) {
    const noun = model.lectures === 1 ? "lecture" : "lectures";
    stats.push(chip(`${model.lectures} ${noun} in this chapter`));
  }
  stats.push(freeChip());

  return cardFrame(model.subject, [
    headline(model.chapter),
    ...(model.courseTitle
      ? [el("div", { display: "flex", marginTop: 20, fontSize: 30, color: INK_2 },
        `From the course: ${model.courseTitle}`)]
      : []),
    byline(model),
  ], stats);
}

export const CARD_BACKGROUNDS = { CANVAS, SURFACE, BRAND_TEAL };
