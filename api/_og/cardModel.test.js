// Tests for the pure half of /api/og: id parsing, the static-fallback glyph
// gate, row normalisation (including the rating-honesty rule shared with every
// student-facing surface), the card tree's content — and one real satori
// render with the embedded fonts, proving the base64 modules parse as TTFs and
// the tree is a valid satori document at exactly 1200x630.
import { describe, expect, it } from "vitest";
import satori from "satori";
import { RATING_CONFIDENCE_MIN } from "../../src/ratingConfidence.js";
import { SUBJECT_COLORS } from "../../src/brandColors.js";
import fontRegular from "./fontRegular.js";
import fontBold from "./fontBold.js";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  courseCardModel,
  courseCardTree,
  needsStaticFallback,
  parseCourseId,
} from "./cardModel.js";

const ROW = {
  title: "Rotational Motion — Complete Course",
  teacher: "Mahendra Singh",
  average_rating: 4.6,
  ratings_count: 12,
  subjects: { name: "Physics" },
  institutes_channels: { name: "Unacademy NEET" },
  playlist_videos: [{ count: 14 }],
};

function texts(node, out = []) {
  if (typeof node === "string") { out.push(node); return out; }
  if (Array.isArray(node)) { node.forEach((n) => texts(n, out)); return out; }
  if (node?.props?.children) texts(node.props.children, out);
  return out;
}

describe("parseCourseId", () => {
  it("accepts only positive integer ids", () => {
    expect(parseCourseId("374")).toBe(374);
    expect(parseCourseId(" 12 ")).toBe(12);
    for (const bad of ["0", "-3", "1.5", "13; drop", "abc", "", null, undefined, "1e3", "9".repeat(13)]) {
      expect(parseCourseId(bad)).toBeNull();
    }
  });
});

describe("needsStaticFallback", () => {
  it("keeps Latin course titles and the punctuation the serif covers", () => {
    for (const ok of [
      "Rotational Motion — Complete Course",
      "Chapter-wise PYQs (2019–2025), 'best of' picks…",
      "Électrostatique für JEE",
    ]) {
      expect(needsStaticFallback(ok)).toBe(false);
    }
  });

  it("falls back for anything the embedded serif cannot draw", () => {
    // ★, ₹ and the middle dot render as missing-glyph boxes in KaTeX Main —
    // verified against an actual render — so they take the static image too,
    // alongside non-Latin scripts and emoji.
    for (const bad of ["PYQs ★ rated", "Costs ₹0", "a · b", "कबीर की साखी", "रसायन विज्ञान", "物理", "Physics 🚀"]) {
      expect(needsStaticFallback(bad)).toBe(true);
    }
  });
});

describe("courseCardModel", () => {
  it("normalises the PostgREST row", () => {
    const model = courseCardModel(ROW);
    expect(model).toMatchObject({
      title: ROW.title,
      teacher: "Mahendra Singh",
      channel: "Unacademy NEET",
      subject: "Physics",
      lectures: 14,
    });
    expect(model.rating).toEqual({ kind: "scored", count: 12, score: 4.6 });
  });

  it("returns null without a row or title, so the handler falls back", () => {
    expect(courseCardModel(null)).toBeNull();
    expect(courseCardModel({})).toBeNull();
  });

  it("mirrors the site's rating-confidence rule exactly", () => {
    const below = courseCardModel({ ...ROW, ratings_count: RATING_CONFIDENCE_MIN - 1 });
    expect(below.rating.kind).toBe("low");
    const none = courseCardModel({ ...ROW, average_rating: null, ratings_count: 0 });
    expect(none.rating).toBeNull();
  });

  it("truncates a runaway title instead of overflowing the card", () => {
    const model = courseCardModel({ ...ROW, title: "x".repeat(300) });
    expect(model.title.length).toBeLessThanOrEqual(90);
    expect(model.title.endsWith("…")).toBe(true);
  });
});

describe("courseCardTree", () => {
  it("draws the title, byline, lecture count and confidence-gated rating", () => {
    const t = texts(courseCardTree(courseCardModel(ROW)));
    expect(t).toContain(ROW.title);
    expect(t).toContain("Mahendra Singh  —  Unacademy NEET");
    expect(t).toContain("14 lectures");
    expect(t.some((s) => s.includes("4.6/5") && s.includes("12 student ratings"))).toBe(true);
    expect(t).toContain("JEENEETARD");
  });

  it("never shows a star for a below-confidence rating", () => {
    const model = courseCardModel({ ...ROW, ratings_count: 2 });
    const t = texts(courseCardTree(model));
    expect(t.some((s) => s.includes("/5"))).toBe(false);
    expect(t).toContain("2 student ratings");
  });

  it("uses the subject's own spine colour", () => {
    const tree = courseCardTree(courseCardModel(ROW));
    expect(tree.props.children[0].props.style.backgroundColor)
      .toBe(SUBJECT_COLORS.physics);
  });
});

describe("satori render", () => {
  it("renders the card with the embedded fonts at 1200x630", async () => {
    const svg = await satori(courseCardTree(courseCardModel(ROW)), {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: [
        { name: "KaTeX Main", data: fontRegular, weight: 400, style: "normal" },
        { name: "KaTeX Main", data: fontBold, weight: 700, style: "normal" },
      ],
    });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
  }, 30_000);
});
