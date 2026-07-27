import { describe, expect, it } from "vitest";
import {
  normalizeForMatch,
  tokenize,
  scoreChapter,
  proposeChapter,
  draftAssignments,
} from "./mapChapters.js";

const BIO = [
  "Biological Classification",
  "The Living World",
  "Plant Kingdom",
  "Animal Kingdom",
  "Cell: The Unit of Life",
  "Biomolecules",
  "Photosynthesis in Higher Plants",
];

describe("normalizeForMatch / tokenize", () => {
  it("strips punctuation and lowercases", () => {
    expect(normalizeForMatch("Cell: The Unit of Life!")).toBe("cell the unit of life");
  });
  it("drops numbers, stopwords, and subject filler", () => {
    expect(tokenize("#7 Complete NEET Biology One Shot Photosynthesis"))
      .toEqual(["photosynthesis"]);
  });
});

describe("scoreChapter", () => {
  it("full chapter phrase in the title scores 1", () => {
    const t = normalizeForMatch("Complete Biological Classification One Shot");
    expect(scoreChapter(t, new Set(tokenize("Complete Biological Classification One Shot")),
      "Biological Classification")).toBe(1);
  });
  it("partial token overlap scores by recall", () => {
    const t = normalizeForMatch("Animal Kingdom basics");
    // "Plant Kingdom" shares only "kingdom" of 2 tokens -> 0.5
    expect(scoreChapter(t, new Set(tokenize("Animal Kingdom basics")), "Plant Kingdom")).toBe(0.5);
  });
});

describe("proposeChapter", () => {
  it("auto-accepts an obvious phrase match", () => {
    const p = proposeChapter("Biological Classification | Full Chapter NEET", BIO);
    expect(p.chapter).toBe("Biological Classification");
    expect(p.review).toBe(false);
  });

  it("flags an ambiguous title for review instead of guessing silently", () => {
    // "Kingdom Monera" overlaps Plant Kingdom AND Animal Kingdom equally.
    const p = proposeChapter("#7 Kingdom Monera and Bacteria", BIO);
    expect(p.review).toBe(true);
    expect(p.alternatives.map((a) => a.name))
      .toEqual(expect.arrayContaining(["Plant Kingdom", "Animal Kingdom"]));
  });

  it("returns null chapter when nothing matches", () => {
    const p = proposeChapter("Motivation: How to crack NEET in 2025", BIO);
    expect(p.chapter).toBeNull();
    expect(p.review).toBe(true);
  });

  it("prefers the longer, more specific chapter when one name contains another", () => {
    // Both "Resources and Development" and "Development" phrase-match; the longer
    // (correct) chapter must win, not the substring one.
    const chapters = ["Development", "Resources and Development", "Water Resources"];
    const p = proposeChapter("Resources and Development | New One Shot | Class 10", chapters);
    expect(p.chapter).toBe("Resources and Development");
    expect(p.review).toBe(false);
  });

  it.each([
    ["Easiest way to solve circuit & potentiometer question", "Current Electricity"],
    ["Mechanical Energy Conservation in 1 Shot", "Work, Energy and Power"],
    ["Complete Rotation Revision in 40 Minutes", "Rotational Motion"],
    ["Motion in a Straight Line - Complete Revision", "Kinematics"],
  ])("maps a common source-title alias without inventing taxonomy", (title, expected) => {
    const chapters = [
      "Current Electricity",
      "Work, Energy and Power",
      "Rotational Motion",
      "Kinematics",
    ];
    const p = proposeChapter(title, chapters);
    expect(p.chapter).toBe(expected);
    expect(p.review).toBe(false);
    expect(p.confidence).toBe(1);
  });

  it("does not return an alias target absent from the supplied chapter list", () => {
    const p = proposeChapter("Motion in a Straight Line - Complete Revision", BIO);
    expect(p.chapter).toBeNull();
    expect(p.review).toBe(true);
  });
});

describe("draftAssignments", () => {
  it("orders by position and summarises auto/review/unmatched", () => {
    const videos = [
      { videoId: "a", title: "Biological Classification One Shot", position: 1 },
      { videoId: "b", title: "#2 Kingdom Monera Bacteria", position: 2 },
      { videoId: "c", title: "Best study playlist intro", position: 3 },
    ];
    const { rows, summary } = draftAssignments(videos, BIO);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(rows[0].chapter).toBe("Biological Classification");
    expect(rows[0].review).toBe(false);
    expect(summary.total).toBe(3);
    expect(summary.auto).toBe(1);
    expect(summary.unmatched).toBe(1);
  });
});
