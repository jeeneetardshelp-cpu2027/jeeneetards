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
  chapterCardModel,
  chapterCardText,
  chapterCardTree,
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

// The chapter card: what /course/:id/chapter/:chapterId previews draw.
describe("chapterCardModel", () => {
  it("combines the chapter with the course it is from", () => {
    const model = chapterCardModel(ROW, { name: "Moment of Inertia", lectures: 6 });
    expect(model).toEqual({
      chapter: "Moment of Inertia",
      courseTitle: ROW.title,
      teacher: "Mahendra Singh",
      channel: "Unacademy NEET",
      subject: "Physics",
      lectures: 6,
    });
    // No rating field at all — a course's rating is not a chapter's.
    expect(model).not.toHaveProperty("rating");
  });

  it("returns null without a chapter name or a course, so the handler picks another card", () => {
    expect(chapterCardModel(ROW, null)).toBeNull();
    expect(chapterCardModel(ROW, { name: "  ", lectures: 3 })).toBeNull();
    expect(chapterCardModel(null, { name: "Moment of Inertia", lectures: 3 })).toBeNull();
  });

  it("drops an unusable lecture count rather than drawing it", () => {
    for (const lectures of [0, null, undefined, -1, 2.5, "abc"]) {
      expect(chapterCardModel(ROW, { name: "Moment of Inertia", lectures }).lectures).toBeNull();
    }
  });

  it("feeds every drawn string to the static-fallback gate", () => {
    const model = chapterCardModel(ROW, { name: "Moment of Inertia", lectures: 6 });
    const text = chapterCardText(model);
    for (const part of ["Moment of Inertia", ROW.title, "Mahendra Singh", "Unacademy NEET"]) {
      expect(text).toContain(part);
    }
    expect(needsStaticFallback(chapterCardText({ ...model, chapter: "द्विपद प्रमेय" }))).toBe(true);
    expect(needsStaticFallback(chapterCardText({ ...model, courseTitle: "भौतिकी" }))).toBe(true);
    expect(needsStaticFallback(chapterCardText({ ...model, teacher: "Physics 🚀" }))).toBe(true);
    expect(needsStaticFallback(chapterCardText({ ...model, channel: "物理" }))).toBe(true);
  });
});

describe("chapterCardTree", () => {
  const tree = (lectures, row = ROW) =>
    texts(chapterCardTree(chapterCardModel(row, { name: "Moment of Inertia", lectures })));

  it("draws the chapter name, the course line, the byline and the free chip", () => {
    const t = tree(6);
    expect(t).toContain("Moment of Inertia");
    expect(t).toContain(`From the course: ${ROW.title}`);
    expect(t).toContain("Mahendra Singh  —  Unacademy NEET");
    expect(t).toContain("PHYSICS");
    expect(t).toContain("Free — no account to browse");
    expect(t).toContain("JEENEETARD");
  });

  it("leaves out the course line when the course is named after the chapter", () => {
    // "From the course: Friction" under a "Friction" headline says nothing.
    // Compared on the FULL title, so a long one truncated for the card still
    // matches, and case or punctuation never keeps the line.
    const named = (title, chapter) => texts(chapterCardTree(
      chapterCardModel({ ...ROW, title }, { name: chapter, lectures: 5 }),
    ));
    const same = named("Friction", "friction.");
    expect(same).toContain("friction.");
    expect(same.some((s) => s.startsWith("From the course"))).toBe(false);
    expect(same).toContain("Mahendra Singh  —  Unacademy NEET");
    expect(same).toContain("5 lectures in this chapter");

    const long = "A".repeat(70);
    expect(named(long, long.toLowerCase()).some((s) => s.startsWith("From the course"))).toBe(false);

    // A title that says more than the chapter keeps its line.
    expect(named("Kinematics| Irodov solutions", "Kinematics"))
      .toContain("From the course: Kinematics| Irodov solutions");
  });

  it("pluralises the lecture chip, and omits it without a count", () => {
    expect(tree(6)).toContain("6 lectures in this chapter");
    expect(tree(1)).toContain("1 lecture in this chapter");
    expect(tree(1)).not.toContain("1 lectures in this chapter");
    expect(tree(null).some((s) => s.includes("in this chapter"))).toBe(false);
  });

  it("never shows rating text, even when the course's rating is confident", () => {
    // ROW is 4.6 from 12 ratings — the course card shows it (see above).
    expect(courseCardModel(ROW).rating.kind).toBe("scored");
    const t = tree(6);
    expect(t.some((s) => /\/5|rating|★/i.test(s))).toBe(false);
    // Nor a below-confidence one.
    expect(tree(6, { ...ROW, ratings_count: 2 }).some((s) => /rating/i.test(s))).toBe(false);
  });

  it("shares the course card's frame and subject spine", () => {
    const chapter = chapterCardTree(chapterCardModel(ROW, { name: "Moment of Inertia", lectures: 6 }));
    expect(chapter.props.style).toEqual(courseCardTree(courseCardModel(ROW)).props.style);
    expect(chapter.props.children[0].props.style.backgroundColor).toBe(SUBJECT_COLORS.physics);
  });

  it("renders through satori at 1200x630", async () => {
    const svg = await satori(
      chapterCardTree(chapterCardModel(ROW, { name: "Moment of Inertia", lectures: 6 })),
      {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fonts: [
          { name: "KaTeX Main", data: fontRegular, weight: 400, style: "normal" },
          { name: "KaTeX Main", data: fontBold, weight: 700, style: "normal" },
        ],
      },
    );
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
  }, 30_000);
});

// Said once, not twice. courseCredit (src/courseCredit.js, where the teacher
// counts live) credits a teacher who is only the channel again once;
// namesMatch (src/courseMetadata.js, tested above for the course line) names a
// chapter once. Course 88 is the shape that shipped a repeat on BOTH lines of
// its chapter preview: teacher and channel are both "Mohit Tyagi", and its one
// chapter is named "Binomial Theorem", exactly like the course.
describe("names are drawn once, not twice", () => {
  const COURSE_88 = {
    title: "Binomial Theorem",
    teacher: "Mohit Tyagi",
    average_rating: null,
    ratings_count: 0,
    subjects: { name: "Mathematics" },
    institutes_channels: { name: "Mohit Tyagi" },
    playlist_videos: [{ count: 92 }],
  };
  const CHAPTER_78 = { name: "Binomial Theorem", lectures: 92 };

  // How many times `name` is said anywhere on the card, whole strings or not.
  const saidTimes = (strings, name) =>
    strings.join(" | ").toLowerCase().split(name.toLowerCase()).length - 1;
  const bylineOf = (strings) => strings.filter((s) => s.includes("Tyagi") || s.includes("Sunlike") || s.includes("Alakh"));

  it("credits a teacher who IS the channel once, on the course card", () => {
    const model = courseCardModel(COURSE_88);
    // The teacher is dropped and the linked channel kept — courseCredit's rule.
    expect(model).toMatchObject({ teacher: "", channel: "Mohit Tyagi" });
    const t = texts(courseCardTree(model));
    expect(bylineOf(t)).toEqual(["Mohit Tyagi"]);
    expect(saidTimes(t, "Mohit Tyagi")).toBe(1);
    expect(t.some((s) => s.includes("  —  "))).toBe(false);
  });

  it("credits a teacher who IS the channel once, on the chapter card", () => {
    const model = chapterCardModel(COURSE_88, CHAPTER_78);
    expect(model).toMatchObject({ teacher: "", channel: "Mohit Tyagi" });
    const t = texts(chapterCardTree(model));
    expect(bylineOf(t)).toEqual(["Mohit Tyagi"]);
    expect(saidTimes(t, "Mohit Tyagi")).toBe(1);
  });

  it("treats a case-only difference as the same name, and keeps the channel's spelling", () => {
    const row = { ...ROW, teacher: "Sunlike Study", institutes_channels: { name: "Sunlike study" } };
    for (const t of [
      texts(courseCardTree(courseCardModel(row))),
      texts(chapterCardTree(chapterCardModel(row, { name: "Moment of Inertia", lectures: 6 }))),
    ]) {
      expect(bylineOf(t)).toEqual(["Sunlike study"]);
      expect(saidTimes(t, "Sunlike Study")).toBe(1);
    }
  });

  it("keeps BOTH names when one only contains the other", () => {
    const row = { ...ROW, teacher: "Alakh Pandey", institutes_channels: { name: "Alakh Pandey - Class 9th & 10th" } };
    for (const t of [
      texts(courseCardTree(courseCardModel(row))),
      texts(chapterCardTree(chapterCardModel(row, { name: "Moment of Inertia", lectures: 6 }))),
    ]) {
      expect(t).toContain("Alakh Pandey  —  Alakh Pandey - Class 9th & 10th");
    }
  });

  it("compares the full names, not the 40-character cut the byline draws", () => {
    // Equal for the first 40 characters, different after: two real names.
    const stem = "Physics Wallah Foundation Olympiad Batch ";
    const row = { ...ROW, teacher: `${stem}Class 9`, institutes_channels: { name: `${stem}Class 10` } };
    const model = courseCardModel(row);
    expect(model.teacher).not.toBe("");
    expect(model.channel).not.toBe("");
  });

  it("keeps the course line when chapter and title differ only after the cuts the card draws", () => {
    // Identical for the first 89 characters (more than the course line's 50
    // and within the headline's 90), different after: a real course line.
    const stem = "Complete Revision of Electromagnetic Induction and Alternating Current with PYQs for JEE ";
    const model = chapterCardModel({ ...ROW, title: `${stem}Main` }, { name: `${stem}Advanced`, lectures: 3 });
    expect(model.courseTitle).not.toBe("");
    expect(texts(chapterCardTree(model)).some((s) => s.startsWith("From the course: "))).toBe(true);
  });

  it("draws course 88's chapter card with each name once, and the model says so", () => {
    const model = chapterCardModel(COURSE_88, CHAPTER_78);
    expect(model).toEqual({
      chapter: "Binomial Theorem",
      courseTitle: "",
      teacher: "",
      channel: "Mohit Tyagi",
      subject: "Mathematics",
      lectures: 92,
    });
    const t = texts(chapterCardTree(model));
    expect(saidTimes(t, "Binomial Theorem")).toBe(1);
    expect(saidTimes(t, "Mohit Tyagi")).toBe(1);
  });

  it("still renders through satori at 1200x630 without the course line", async () => {
    const svg = await satori(chapterCardTree(chapterCardModel(COURSE_88, CHAPTER_78)), {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: [
        { name: "KaTeX Main", data: fontRegular, weight: 400, style: "normal" },
        { name: "KaTeX Main", data: fontBold, weight: 700, style: "normal" },
      ],
    });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
  }, 30_000);
});
